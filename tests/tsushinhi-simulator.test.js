"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "articles/tsushinhi-simulator/index.html"), "utf8");
const configSource = fs.readFileSync(path.join(root, "config.js"), "utf8");

function render() {
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ""), { runScripts: "outside-only" });
  const w = dom.window;
  w.eval(configSource);
  // 外部スクリプト(src付き)は除き、inline script だけを順に実行する
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    if (m[1].includes("getElementById(\"year\")")) continue;
    w.eval(m[1]);
  }
  return w;
}
function fill(w, el, value) {
  el.value = value;
  el.dispatchEvent(new w.Event("input", { bubbles: true }));
}
const text = (w, id) => w.document.getElementById(id).textContent.replace(/\s+/g, " ");

test("simulator: 入力前は案内文だけを出す", () => {
  const w = render();
  assert.match(text(w, "sim-result"), /入力すると/);
  assert.equal(w.document.querySelectorAll(".sim-phone").length, 4);
  w.close();
});

test("simulator: 4人世帯は月額・年額の合計と家計調査(13,328円)との差を出す", () => {
  const w = render();
  const phones = w.document.querySelectorAll(".sim-phone");
  phones.forEach((p) => fill(w, p, "3000")); // 12,000
  fill(w, w.document.getElementById("sim-net"), "5000"); // 17,000
  const t = text(w, "sim-result");
  assert.match(t, /17,000円/);
  assert.match(t, /204,000円/);
  assert.match(t, /13,328円/);
  assert.match(t, /\+3,672円/);
  w.close();
});

test("simulator: 3人世帯は12,438円、それ以外の人数では平均比較を出さない", () => {
  const w = render();
  const sel = w.document.getElementById("sim-people");
  sel.value = "3";
  sel.dispatchEvent(new w.Event("change", { bubbles: true }));
  fill(w, w.document.querySelector(".sim-phone"), "2000");
  assert.match(text(w, "sim-result"), /12,438円/);
  sel.value = "2";
  sel.dispatchEvent(new w.Event("change", { bubbles: true }));
  const t = text(w, "sim-result");
  assert.ok(!/家計調査2025年の/.test(t), "2人世帯では平均を出さない");
  assert.match(t, /3人・4人世帯のみ/);
  w.close();
});

test("simulator: 月◯円下げた場合の年間の差(上限は現在の合計)", () => {
  const w = render();
  fill(w, w.document.getElementById("sim-net"), "5000");
  fill(w, w.document.getElementById("sim-cut"), "1500");
  assert.match(text(w, "sim-cut-result"), /18,000円/);
  fill(w, w.document.getElementById("sim-cut"), "9000");
  assert.match(text(w, "sim-cut-result"), /60,000円/);
  w.close();
});

test("simulator: 広告は config.js の mobile 枠のみ・原文のまま。入力値の送信APIを使わない", () => {
  const w = render();
  const card = w.document.querySelector(".ad-card");
  assert.ok(card);
  assert.equal(card.getAttribute("data-ad-slot"), "mobile");
  assert.equal(card.querySelector(".ad-card__link").innerHTML, w.SITE_CONFIG.affiliates.mobile.code);
  assert.ok(!/a8mat=|accesstrade\.net/.test(html), "記事HTMLに広告URLを直書きしていない");
  const sim = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes("AVG"));
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|gtag|goatcounter/.test(sim), "入力値を送信・保存しない");
  w.close();
});

test("simulator: WebApplication の JSON-LD が妥当", () => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.ok(blocks.some((b) => b["@type"] === "WebApplication" && b.offers.price === "0"));
});
