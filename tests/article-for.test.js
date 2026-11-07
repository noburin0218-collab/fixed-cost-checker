"use strict";
// 診断結果の費目から、読むべき記事への対応（articleFor）を確認する。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { articleFor } = require("../script.js");

const root = path.join(__dirname, "..");
const exists = (href) => fs.existsSync(path.join(root, href, "index.html"));

test("ガスの種類で記事が変わる（都市ガスにプロパンの記事を出さない）", () => {
  assert.equal(articleFor({ id: "gas" }, { gasType: "city" }).href, "/articles/toshi-gas-minaoshi/");
  assert.equal(articleFor({ id: "gas" }, { gasType: "lpg" }).href, "/articles/propane-gas-takai/");
  assert.equal(articleFor({ id: "gas" }, { gasType: "none" }).href, "/articles/all-denka-konetsuhi/");
});

test("車関連費は、費用を項目ごとに分解する記事へ導く", () => {
  assert.equal(articleFor({ id: "car" }, {}).href, "/articles/kuruma-hiyou-bunkai/");
});

test("対応先の記事がすべて実在する", () => {
  const ids = ["mobile", "internet", "electricity", "gas", "waterserver", "subscription", "housing", "eatingout", "insurance", "car"];
  for (const id of ids) {
    for (const gasType of ["", "city", "lpg", "none"]) {
      const a = articleFor({ id }, { gasType });
      if (a) assert.ok(exists(a.href), `${id}/${gasType}: ${a.href} が存在する`);
    }
  }
});
