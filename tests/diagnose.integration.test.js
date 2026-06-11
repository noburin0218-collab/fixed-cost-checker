"use strict";
// diagnose() の統合テスト：最小のフェイクDOMを差し込み、集計（合計・固定費/変動費の内訳・年額）を検証する。
// 実行: node --test
const test = require("node:test");
const assert = require("node:assert/strict");

// --- フェイクDOMを用意してから script.js を読み込む（diagnose は呼び出し時にのみDOMを参照） ---
const selects = {
  household: "4",
  "housing-tenure": "own_loan",
  "gas-type": "lpg",
  "housing-type": "house",
  "mobile-lines": "4",
  "insurance-type": "savings",
};
const inputs = {
  housing: "90000",
  mobile: "16000",
  electricity: "16000",
  gas: "9000",
  water: "6000",
  insurance: "25000",
  subscription: "4000",
  car: "25000",
  waterserver: "4000",
  eatingout: "30000",
  other: "5000",
};
const mobileType = "carrier";

global.window = {};
global.document = {
  // require時に DOMContentLoaded ハンドラ登録が走るため no-op を用意（イベントは発火させない）
  addEventListener() {},
  getElementById(id) {
    if (id in inputs) return { value: inputs[id] };
    if (id in selects) return { value: selects[id] };
    return null; // 未知IDは null（readValue/readSelect 側で 0/"" にフォールバック）
  },
  querySelector(sel) {
    if (sel.includes('mobile-type')) return { value: mobileType };
    return null;
  },
};

const { diagnose, CATEGORIES } = require("../script.js");

const ctx = {
  n: 4,
  carrier: mobileType,
  housing: selects["housing-type"],
  gasType: selects["gas-type"],
  lines: 4,
  insType: selects["insurance-type"],
  tenure: selects["housing-tenure"],
};

test("diagnose: 合計と固定費/変動費の内訳が各カテゴリ計算と一致する", () => {
  const r = diagnose();

  // 期待値は、エクスポート済みの各カテゴリ saving を同じctxで合算して算出（実装の二重化を避ける）
  let expMonthly = 0, expFixed = 0, expVar = 0, expFixedIn = 0, expVarIn = 0;
  const totalInput = Object.values(inputs).reduce((s, v) => s + Number(v), 0);
  for (const c of CATEGORIES) {
    const input = Number(inputs[c.id] || 0);
    const sv = c.saving(input, ctx);
    expMonthly += sv;
    if (c.variable) { expVar += sv; expVarIn += input; }
    else { expFixed += sv; expFixedIn += input; }
  }

  assert.equal(r.totalInput, totalInput, "支出合計");
  assert.equal(Math.round(r.monthlySaving), Math.round(expMonthly), "月間削減");
  assert.equal(Math.round(r.yearlySaving), Math.round(expMonthly * 12), "年間=月間×12");
  assert.equal(Math.round(r.fixedSaving), Math.round(expFixed), "固定費の削減");
  assert.equal(Math.round(r.variableSaving), Math.round(expVar), "変動費の削減");
  assert.equal(r.fixedInput, expFixedIn, "固定費の入力合計");
  assert.equal(r.variableInput, expVarIn, "変動費の入力合計");

  // 変動費は外食のみなので、その入力額と一致する
  assert.equal(r.variableInput, Number(inputs.eatingout));
  // ctx が selects から正しく読めている
  assert.equal(r.ctx.n, 4);
  assert.equal(r.ctx.carrier, "carrier");
  assert.equal(r.ctx.tenure, "own_loan");
});

test("diagnose: 各 item に input/saving/benchmark/note が付与される", () => {
  const r = diagnose();
  assert.equal(r.items.length, CATEGORIES.length);
  for (const it of r.items) {
    assert.equal(typeof it.saving, "number");
    assert.ok("benchmark" in it);
    assert.equal(typeof it.note, "string");
  }
});
