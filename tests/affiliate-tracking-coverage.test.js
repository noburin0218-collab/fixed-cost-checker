"use strict";
// 広告slotを追加したのに config.js の affiliateTracking への追記を忘れると、
// GA4 affiliate_click の merchant が "unknown" になる。その取りこぼしを検知する。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const dom = new JSDOM("<body></body>", { runScripts: "outside-only", url: "https://example.test/" });
dom.window.eval(fs.readFileSync(path.join(root, "config.js"), "utf8"));
const cfg = JSON.parse(JSON.stringify(dom.window.SITE_CONFIG));
dom.window.close();

const hasCode = entry => Boolean(entry && typeof entry.code === "string" && entry.code.trim());

// 記事ページに静的に書かれた data-ad-slot を収集する。
const articlesDir = path.join(root, "articles");
const articleSlots = new Set();
for (const dir of fs.readdirSync(articlesDir, { withFileTypes: true })) {
  const file = path.join(articlesDir, dir.name, "index.html");
  if (!dir.isDirectory() || !fs.existsSync(file)) continue;
  for (const m of fs.readFileSync(file, "utf8").matchAll(/data-ad-slot="([^"]+)"/g)) articleSlots.add(m[1]);
}

// 記事内の静的slot -> 表示可否を決める code の持ち主。
// internet-nc は affiliates.internetNoConstruction が空（未提携）のため表示されない。
// 表示されない枠はクリックされないので追跡対象外。将来 code が入ったら自動的に対象になる。
const articleSlotOwner = {
  "internet-nc": () => cfg.affiliates.internetNoConstruction,
  savings: () => cfg.savingsAdvisor,
};

// 広告として表示され得るslotの一覧を組み立てる。
const slots = new Map(); // slot -> 出所
// 診断ページ: affiliates のキー名がそのまま slot。code が空の枠(housing, car 等)は表示されない。
for (const [key, entry] of Object.entries(cfg.affiliates)) if (hasCode(entry)) slots.set(key, `affiliates.${key}`);
// 貯蓄アドバイザー: slot は "savings"。
if (hasCode(cfg.savingsAdvisor)) slots.set("savings", "savingsAdvisor");
// 比較記事。
for (const item of cfg.insuranceComparison || []) if (hasCode(item)) slots.set(item.slot, "insuranceComparison");
// 記事側の静的slot。
for (const slot of articleSlots) {
  const entry = articleSlotOwner[slot] ? articleSlotOwner[slot]() : cfg.affiliates[slot];
  if (hasCode(entry)) slots.set(slot, `articles data-ad-slot="${slot}"`);
}

test("表示され得る広告slotが検出できる（テスト自体の健全性）", () => {
  for (const s of ["mobile", "internet", "electricity", "gas", "insurance", "savings", "hoken-garden", "hoken-mammoth", "hoken-minna"]) {
    assert.ok(slots.has(s), `slot ${s} を検出できていない`);
  }
  assert.ok(!slots.has("housing") && !slots.has("car"), "code が空の枠は対象外");
});

test("表示され得る広告slotはすべて affiliateTracking に merchant と affiliate_program を持つ", () => {
  const tracking = cfg.affiliateTracking || {};
  for (const [slot, origin] of slots) {
    const meta = tracking[slot];
    assert.ok(meta, `affiliateTracking に "${slot}" がない（${origin}）。追記しないと merchant が unknown になる`);
    assert.ok(typeof meta.merchant === "string" && meta.merchant.trim(), `"${slot}" の merchant が空`);
    assert.ok(typeof meta.affiliate_program === "string" && meta.affiliate_program.trim(), `"${slot}" の affiliate_program が空`);
  }
});
