"use strict";
// 診断ロジックの単体テスト（依存ゼロ／Node標準の node:test を使用）
// 実行: node --test
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CATEGORIES,
  hh,
  excess,
  clampSave,
  housingMult,
  gasBenchmark,
  mobileBenchmark,
  buildNote,
  yen,
} = require("../script.js");

/** id からカテゴリ定義を取得 */
const cat = (id) => CATEGORIES.find((c) => c.id === id);
/** 既定コンテキスト（未選択状態） */
const ctx = (over = {}) => ({ n: 3, carrier: "carrier", housing: "", gasType: "", lines: 0, insType: "", tenure: "", ...over });

test("hh: 世帯人数で配列を引き、範囲外はクランプ", () => {
  const a = [10, 20, 30, 40, 50, 60];
  assert.equal(hh(a, 1), 10);
  assert.equal(hh(a, 4), 40);
  assert.equal(hh(a, 6), 60);
  assert.equal(hh(a, 99), 60); // 上限クランプ
  assert.equal(hh(a, 0), 10); // 下限クランプ
});

test("excess: 目安超過分（マイナスは0）", () => {
  assert.equal(excess(8000, 5000), 3000);
  assert.equal(excess(4000, 5000), 0);
});

test("clampSave: 入力の80%を上限にクランプ", () => {
  assert.equal(clampSave(9999, 1000), 800); // 80%上限
  assert.equal(clampSave(300, 1000), 300);
  assert.equal(clampSave(-50, 1000), 0); // 下限0
});

test("housingMult: 戸建ては高め・集合は低め・未指定は等倍", () => {
  assert.equal(housingMult("house"), 1.15);
  assert.equal(housingMult("apartment"), 0.9);
  assert.equal(housingMult(""), 1.0);
});

test("yen: 日本円フォーマット", () => {
  assert.equal(yen(12345), "12,345円");
  assert.equal(yen(0), "0円");
});

test("CATEGORIES: id重複なし・必須フィールドあり", () => {
  const ids = CATEGORIES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "id が重複している");
  for (const c of CATEGORIES) {
    assert.ok(typeof c.name === "string" && c.name.length > 0, `${c.id}: name`);
    assert.equal(typeof c.benchmark, "function", `${c.id}: benchmark`);
    assert.equal(typeof c.saving, "function", `${c.id}: saving`);
    assert.ok(typeof c.advice === "string" && c.advice.length > 0, `${c.id}: advice`);
  }
});

test("変動費フラグは外食・コンビニのみ", () => {
  const variableIds = CATEGORIES.filter((c) => c.variable).map((c) => c.id);
  assert.deepEqual(variableIds, ["eatingout"]);
});

test("全カテゴリ: 入力0なら削減0／削減は入力の80%以下", () => {
  for (const c of CATEGORIES) {
    assert.equal(c.saving(0, ctx()), 0, `${c.id}: 入力0で削減0`);
    const s = c.saving(50000, ctx({ tenure: "own_loan", gasType: "lpg", insType: "savings" }));
    assert.ok(s >= 0 && s <= 50000 * 0.8 + 0.001, `${c.id}: 上限クランプ`);
  }
});

test("スマホ: 大手キャリアは格安SIMより削減余地が大きい", () => {
  const m = cat("mobile");
  const carrier = m.saving(16000, ctx({ carrier: "carrier" }));
  const mvno = m.saving(16000, ctx({ carrier: "mvno" }));
  assert.ok(carrier > mvno, `carrier(${carrier}) > mvno(${mvno})`);
});

test("スマホ: 回線数を指定すると目安が回線数ぶん増える", () => {
  assert.equal(mobileBenchmark(ctx({ carrier: "carrier", lines: 0 })), 3500); // おまかせ=1回線
  assert.equal(mobileBenchmark(ctx({ carrier: "carrier", lines: 4 })), 14000);
  assert.equal(mobileBenchmark(ctx({ carrier: "mvno", lines: 2 })), 4400);
});

test("電気: 戸建ては目安が高く（同額なら削減余地が小さい）", () => {
  const e = cat("electricity");
  const house = e.saving(12000, ctx({ housing: "house" }));
  const apt = e.saving(12000, ctx({ housing: "apartment" }));
  assert.ok(apt > house, `集合(${apt}) > 戸建て(${house})`);
});

test("ガス: プロパンは都市ガスより削減余地が大きく、なしは0", () => {
  const g = cat("gas");
  const lpg = g.saving(8000, ctx({ gasType: "lpg" }));
  const city = g.saving(8000, ctx({ gasType: "city" }));
  const none = g.saving(8000, ctx({ gasType: "none" }));
  assert.ok(lpg > city, `lpg(${lpg}) > city(${city})`);
  assert.equal(none, 0);
  // プロパンでも目安（到達目標）は都市ガス水準のまま
  assert.equal(gasBenchmark(ctx({ gasType: "lpg" })), gasBenchmark(ctx({ gasType: "city" })));
});

test("保険: 貯蓄型 > 未指定 > 掛け捨て中心 の順で削減余地", () => {
  const ins = cat("insurance");
  const savings = ins.saving(25000, ctx({ insType: "savings" }));
  const none = ins.saving(25000, ctx({ insType: "" }));
  const kakezute = ins.saving(25000, ctx({ insType: "kakezute" }));
  assert.ok(savings > none && none > kakezute, `${savings} > ${none} > ${kakezute}`);
});

test("住宅費: ローン中>賃貸>完済(=0)／未指定は0", () => {
  const h = cat("housing");
  const loan = h.saving(90000, ctx({ tenure: "own_loan" }));
  const rent = h.saving(90000, ctx({ tenure: "rent" }));
  assert.ok(loan > rent, `loan(${loan}) > rent(${rent})`);
  assert.equal(h.saving(90000, ctx({ tenure: "own_paid" })), 0);
  assert.equal(h.saving(90000, ctx({ tenure: "" })), 0);
  // 住宅費は目安比較しない（benchmark は null）
  assert.equal(h.benchmark(ctx()), null);
});

test("ウォーターサーバー: 入力のほぼ全額が見直し候補（上限80%）", () => {
  const w = cat("waterserver");
  assert.equal(w.saving(4000, ctx()), 3200); // 4000*0.8
});

test("buildNote: 住まい・ガス種別・目安比較の文言", () => {
  const h = cat("housing");
  assert.match(buildNote(h, 90000, null, ctx({ tenure: "own_loan" })), /借り換え/);
  assert.match(buildNote(h, 90000, null, ctx({ tenure: "rent" })), /家賃は下げにくい/);
  assert.equal(buildNote(h, 0, null, ctx()), ""); // 入力0は空

  const g = cat("gas");
  assert.match(buildNote(g, 8000, gasBenchmark(ctx({ gasType: "none" })), ctx({ gasType: "none" })), /使用していない/);

  const e = cat("electricity");
  const b = e.benchmark(ctx());
  assert.match(buildNote(e, b * 3, b, ctx()), /高め/);
  assert.match(buildNote(e, Math.round(b * 0.5), b, ctx()), /低め|良好/);

  const ws = cat("waterserver");
  assert.match(buildNote(ws, 4000, 0, ctx()), /見直し候補/);
});
