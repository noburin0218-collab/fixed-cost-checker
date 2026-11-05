"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const configSource = fs.readFileSync(path.join(root, "config.js"), "utf8");

// 記事内の広告フック（config.js の affiliates.<key> を読む inline script）を、記事ごとに検証する。
const CASES = [
  { article: "smartphone-keiyaku-erabi", key: "mobileChoice", slotId: "ad-slot-mobile-choice", slot: "mobile-choice" },
  { article: "chintai-net-kaisen", key: "internetNoConstruction", slotId: "ad-slot-internet-nc", slot: "internet-nc" },
  { article: "denryoku-kirikae-demerit", key: "electricityDirect", slotId: "ad-slot-denryoku-direct", slot: "denryoku-direct" },
  { article: "jidosha-hoken-koshin-mae", key: "carInsurance", slotId: "ad-slot-car-insurance", slot: "car-insurance" },
];

for (const c of CASES) {
  const html = fs.readFileSync(path.join(root, "articles", c.article, "index.html"), "utf8");

  /** 記事内の広告フックだけを取り出す */
  const hookScript = () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const hook = scripts.find((s) => s.includes(c.key));
    assert.ok(hook, `${c.key} を読む広告フックが存在する`);
    return hook;
  };

  const render = (mutateConfig) => {
    const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ""), { runScripts: "outside-only" });
    const w = dom.window;
    w.eval(configSource);
    // 本番の config.js の設定有無に左右されないよう、既定は「未設定」に揃えてから個別ケースで上書きする。
    delete w.SITE_CONFIG.affiliates[c.key];
    if (mutateConfig) mutateConfig(w.SITE_CONFIG);
    w.eval(hookScript());
    return w;
  };

  test(`${c.slot}: 広告コードが未設定なら、広告カードは出ない`, () => {
    const w = render();
    assert.equal(w.document.querySelectorAll(".ad-card").length, 0);
    assert.equal(w.document.getElementById(c.slotId).innerHTML, "");
    w.close();
  });

  test(`${c.slot}: 設定されたASPコードを、1文字も変えずに表示する`, () => {
    // 実在しないダミーのコード。属性・アンカーテキスト・計測imgまで保持されることを確認する。
    const code = '<a href="https://example.test/click?id=T1" rel="nofollow" referrerpolicy="no-referrer-when-downgrade">テスト案件<img src="https://example.test/imp?id=T1" width="1" height="1" border="0" alt=""></a>';
    const w = render((cfg) => {
      cfg.affiliates[c.key] = { heading: "見出し", body: "説明", code };
    });
    const cards = w.document.querySelectorAll(".ad-card");
    assert.equal(cards.length, 1, "広告カードは1枠だけ出る");
    const card = cards[0];
    assert.equal(card.getAttribute("data-ad-slot"), c.slot);
    assert.equal(card.closest(`#${c.slotId}`)?.id, c.slotId, "所定の枠の中に出る");
    assert.ok(card.querySelector(".ad-tag"), "「広告」ラベルが付く");
    assert.equal(card.querySelector(".ad-card__link").innerHTML, code);
    w.close();
  });

  test(`${c.slot}: 記事は広告なしで公開できる（記事HTMLに広告コードを直書きしない）`, () => {
    assert.ok(!/a8mat=|accesstrade\.net/.test(html), "記事HTMLに広告URLを直書きしていない");
    assert.ok(html.includes('data-track="to-diagnosis"'), "診断への導線がある");
  });
}
