"use strict";
// render() の DOM 統合テスト。実際の index.html を jsdom に読み込み、
// script.js をブラウザ同様に実行 → フォーム送信 → 結果DOMが正しく構築されるか検証する。
// 実行: node --test（jsdom が必要：npm ci 済みであること）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");

function boot() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  // jsdom が未実装のAPIを最小スタブ
  window.HTMLElement.prototype.scrollIntoView = function () {};
  // config.js 相当（リンク未設定の素の状態）
  window.SITE_CONFIG = { gaMeasurementId: "G-XXXXXXXXXX", cta: { label: "受け取る", href: "" }, affiliates: {} };

  // script.js をブラウザ文脈で実行（module 未定義なので exports 分岐はスキップされDOM処理が有効化）
  const code = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
  window.eval(code);
  // 解析中に発火済みの DOMContentLoaded を、リスナ登録後に手動で再現
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  return window;
}

function setValue(win, id, val) {
  win.document.getElementById(id).value = String(val);
}

test("フォーム送信で結果が表示され、主要セクションが構築される", () => {
  const win = boot();
  const d = win.document;

  // 入力（固定費＋変動費）
  setValue(win, "household", "4");
  setValue(win, "housing-tenure", "own_loan");
  setValue(win, "housing", "90000");
  setValue(win, "mobile", "16000");
  setValue(win, "electricity", "16000");
  setValue(win, "insurance", "25000");
  setValue(win, "eatingout", "30000");

  // 送信
  const form = d.getElementById("cost-form");
  form.dispatchEvent(new win.Event("submit", { cancelable: true, bubbles: true }));

  // 結果が表示される
  assert.equal(d.getElementById("result").hidden, false, "結果セクションが表示される");

  // 月間・年間の削減額が円表記で入る
  assert.match(d.getElementById("monthly-saving").textContent, /円$/);
  assert.match(d.getElementById("yearly-saving").textContent, /円$/);

  // サマリーに固定費/変動費の内訳が出る
  assert.match(d.getElementById("total-line").textContent, /固定費/);
  assert.match(d.getElementById("total-line").textContent, /変動費/);

  // TOP3 が1件以上
  assert.ok(d.getElementById("top3-list").children.length >= 1, "TOP3が構築される");

  // アドバイスに固定費/変動費のグループ見出しが出る
  const adviceHtml = d.getElementById("advice-list").innerHTML;
  assert.match(adviceHtml, /固定費/);
  assert.match(adviceHtml, /変動費/);

  // 今日のアクションが3件
  assert.equal(d.getElementById("action-list").children.length, 3, "アクション3件");

  // シェアリンクにツールURLが反映される
  assert.match(d.getElementById("share-x").getAttribute("href") || "", /twitter\.com\/intent/);
});

test("リセットで結果が隠れ、入力がクリアされる", () => {
  const win = boot();
  const d = win.document;
  setValue(win, "mobile", "16000");
  d.getElementById("cost-form").dispatchEvent(new win.Event("submit", { cancelable: true, bubbles: true }));
  assert.equal(d.getElementById("result").hidden, false);

  d.getElementById("reset-btn").click();
  assert.equal(d.getElementById("result").hidden, true, "結果が隠れる");
  assert.equal(d.getElementById("mobile").value, "", "入力がクリアされる");
});
