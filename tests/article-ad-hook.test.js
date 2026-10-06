"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "articles/smartphone-keiyaku-erabi/index.html"), "utf8");
const configSource = fs.readFileSync(path.join(root, "config.js"), "utf8");

/** 記事内の広告フック（affiliates.mobileChoice を読む inline script）だけを取り出す */
function hookScript() {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const hook = scripts.find((s) => s.includes("mobileChoice"));
  assert.ok(hook, "mobileChoice を読む広告フックが存在する");
  return hook;
}

function render(mutateConfig) {
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ""), { runScripts: "outside-only" });
  const w = dom.window;
  w.eval(configSource);
  if (mutateConfig) mutateConfig(w.SITE_CONFIG);
  w.eval(hookScript());
  return w;
}

test("mobile-choice: 広告コードが未設定なら、広告カードは出ない", () => {
  const w = render();
  assert.equal(w.document.querySelectorAll(".ad-card").length, 0);
  assert.equal(w.document.getElementById("ad-slot-mobile-choice").innerHTML, "");
  w.close();
});

test("mobile-choice: 設定されたASPコードを、1文字も変えずに表示する", () => {
  // 実在しないダミーのコード。属性・アンカーテキスト・計測imgまで保持されることを確認する。
  const code = '<a href="https://example.test/click?id=T1" rel="nofollow" referrerpolicy="no-referrer-when-downgrade">テスト案件<img src="https://example.test/imp?id=T1" width="1" height="1" border="0" alt=""></a>';
  const w = render((cfg) => {
    cfg.affiliates.mobileChoice = { heading: "見出し", body: "説明", code };
  });
  const card = w.document.querySelector(".ad-card");
  assert.ok(card, "広告カードが出る");
  assert.equal(card.getAttribute("data-ad-slot"), "mobile-choice");
  assert.ok(card.querySelector(".ad-tag"), "「広告」ラベルが付く");
  assert.equal(card.querySelector(".ad-card__link").innerHTML, code);
  w.close();
});

test("mobile-choice: 記事は広告なしで公開できる（既定で広告コードを含まない）", () => {
  assert.ok(!/a8mat=|accesstrade\.net/.test(html), "記事HTMLに広告URLを直書きしていない");
  assert.ok(html.includes('data-track="to-diagnosis"'), "診断への導線がある");
});
