"use strict";
// 家計カルテの DOM 統合テスト。実際の index.html を jsdom に読み込み、
// script.js をブラウザ同様に実行 → フォーム送信 → 結果DOMが正しく構築されるか検証する。
//
// ここで守っているのは「旧実装の形」ではなく、次のユーザー価値。
//   ・中身の無い診断結果に広告だけが並ぶ状態を作らない
//   ・サイトが入れた目安値を、本人の実額として断定しない
//   ・広告は該当する人にだけ、最大3件まで
//   ・広告より先に、理解するための記事を出す
//
// 実行: node --test（jsdom が必要：npm ci 済みであること）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");

/** ASP発行コードの代わりに使うダミー（本物のコードはテストに持ち込まない） */
const adCode = (name) => `<a href="https://example.test/${name}" rel="nofollow">${name}</a>`;

const FULL_CONFIG = {
  gaMeasurementId: "G-XXXXXXXXXX",
  cta: { label: "受け取る", href: "" },
  affiliates: {
    mobile: { heading: "スマホ", body: "b", code: adCode("mobile") },
    internet: { heading: "回線", body: "b", code: adCode("internet") },
    electricity: { heading: "電気", body: "b", code: adCode("electricity") },
    gas: { heading: "ガス", body: "b", code: adCode("gas") },
    insurance: { heading: "保険", body: "b", code: adCode("insurance") },
    housing: { heading: "住宅", body: "b", code: adCode("housing") },
    car: { heading: "車", body: "b", code: "" },
  },
  savingsAdvisor: {
    thresholds: { rarely: 30000, sometimes: 60000 },
    heading: "貯蓄",
    body: "b",
    code: adCode("savings"),
  },
};

function boot(config) {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  // jsdom が未実装のAPIを最小スタブ
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.SITE_CONFIG = config || {
    gaMeasurementId: "G-XXXXXXXXXX",
    cta: { label: "受け取る", href: "" },
    affiliates: {},
  };

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

function submit(win) {
  win.document
    .getElementById("cost-form")
    .dispatchEvent(new win.Event("submit", { cancelable: true, bubbles: true }));
}

/** 「わからない」ボタンを押して目安値を入れる */
function pressGuess(win, id) {
  const field = win.document.getElementById(id).closest(".field");
  field.querySelector(".field__guess").dispatchEvent(new win.Event("click", { bubbles: true }));
}

function adSlots(win) {
  return [...win.document.querySelectorAll(".ad-card")].map((el) =>
    el.getAttribute("data-ad-slot")
  );
}

test("フォーム送信で家計カルテが表示され、主要セクションが構築される", () => {
  const win = boot();
  const d = win.document;

  setValue(win, "household", "4");
  setValue(win, "housing-tenure", "own_loan");
  setValue(win, "housing", "90000");
  setValue(win, "mobile", "16000");
  setValue(win, "electricity", "16000");
  setValue(win, "insurance", "25000");
  setValue(win, "eatingout", "30000");
  submit(win);

  assert.equal(d.getElementById("result").hidden, false, "カルテが表示される");

  // 見直し余地は丸めて表示する（末尾は必ず「円」）
  assert.match(d.getElementById("monthly-saving").textContent, /円$/);
  assert.match(d.getElementById("yearly-saving").textContent, /円$/);

  // 表題に作成日と世帯の前提が入る
  assert.match(d.getElementById("chart-meta").textContent, /人世帯/);

  // 総括に固定費/変動費の内訳が出る
  assert.match(d.getElementById("total-line").textContent, /固定費/);
  assert.match(d.getElementById("total-line").textContent, /変動費/);

  // 費目一覧が入力した費目ぶん構築される
  const rows = d.querySelectorAll("#chart-rows .chart-row");
  assert.ok(rows.length >= 5, "費目一覧が構築される");

  // 今日のアクションが3件
  assert.equal(d.getElementById("action-list").children.length, 3, "アクション3件");

  // シェアリンクにツールURLが反映される
  assert.match(d.getElementById("share-x").getAttribute("href") || "", /twitter\.com\/intent/);
});

test("空入力ではカルテを表示せず、案内だけを出す", () => {
  const win = boot(FULL_CONFIG);
  const d = win.document;

  submit(win);

  assert.equal(d.getElementById("result").hidden, true, "カルテを出さない");
  assert.equal(d.getElementById("input-empty").hidden, false, "案内を出す");
  assert.match(d.getElementById("input-empty").textContent, /まず1つだけ/);
});

test("空入力では広告が0件", () => {
  const win = boot(FULL_CONFIG);
  submit(win);
  assert.equal(adSlots(win).length, 0, "広告は1件も出さない");
});

test("「わからない」で入れた費目は『情報不足』になる", () => {
  const win = boot(FULL_CONFIG);
  const d = win.document;

  pressGuess(win, "mobile");
  assert.equal(d.getElementById("mobile").dataset.guessed, "1", "目安値として記録される");
  assert.ok(d.querySelector(".field__hint"), "入力欄のそばに説明が出る");

  setValue(win, "electricity", "16000");
  submit(win);

  const row = [...d.querySelectorAll(".chart-row")].find((el) =>
    el.querySelector(".chart-row__name").textContent.includes("スマホ代")
  );
  assert.ok(row, "スマホ代の行がある");
  assert.match(row.querySelector(".chart-stage").textContent, /情報不足/);
  assert.match(row.textContent, /目安/, "目安値である旨が書かれている");
});

test("「わからない」の値だけを根拠に広告を出さない", () => {
  const win = boot(FULL_CONFIG);

  // スマホだけを目安値で埋めて診断する
  pressGuess(win, "mobile");
  submit(win);

  assert.ok(!adSlots(win).includes("mobile"), "目安値の費目に広告を出さない");
});

test("手入力し直すと目安値の扱いが解除され、広告の対象に戻る", () => {
  const win = boot(FULL_CONFIG);
  const d = win.document;

  pressGuess(win, "mobile");
  const input = d.getElementById("mobile");
  assert.equal(input.dataset.guessed, "1");

  // 本人が入力し直す（目安として入れた値から変わる）
  input.value = "16000";
  input.dispatchEvent(new win.Event("input", { bubbles: true }));
  assert.equal(input.dataset.guessed, undefined, "目安値の扱いが解除される");
  assert.equal(d.querySelectorAll(".field__hint").length, 0, "説明も消える");

  submit(win);
  assert.ok(adSlots(win).includes("mobile"), "実額なら広告の対象になる");
});

test("広告は最大3件まで", () => {
  const win = boot(FULL_CONFIG);

  // 広告の候補が4つ以上そろう入力
  setValue(win, "household", "4");
  setValue(win, "housing-tenure", "own_loan");
  setValue(win, "gas-type", "lpg");
  setValue(win, "savings-status", "rarely");
  setValue(win, "housing", "95000");
  setValue(win, "mobile", "16000");
  setValue(win, "internet", "6000");
  setValue(win, "electricity", "16000");
  setValue(win, "gas", "9000");
  setValue(win, "insurance", "28000");
  submit(win);

  const slots = adSlots(win);
  assert.ok(slots.length <= 3, `広告は3件以内（実際: ${slots.length}）`);
  assert.ok(slots.length > 0, "該当があるので0件ではない");
  assert.equal(new Set(slots).size, slots.length, "同じ枠を重複して出さない");
});

test("該当しない費目には広告を出さない", () => {
  const win = boot(FULL_CONFIG);

  // オール電化（ガスなし）＋格安SIM＋賃貸：ガス・スマホ・住宅の広告は当てはまらない
  setValue(win, "gas-type", "none");
  setValue(win, "housing-tenure", "rent");
  win.document.querySelector('input[name="mobile-type"][value="mvno"]').checked = true;
  setValue(win, "housing", "80000");
  setValue(win, "mobile", "6000");
  setValue(win, "gas", "3000");
  setValue(win, "electricity", "18000");
  submit(win);

  const slots = adSlots(win);
  assert.ok(!slots.includes("gas"), "オール電化にガスの広告を出さない");
  assert.ok(!slots.includes("mobile"), "格安SIM利用者に格安SIMの広告を出さない");
  assert.ok(!slots.includes("housing"), "賃貸に借り換えの広告を出さない");
  assert.ok(slots.includes("electricity"), "該当する電気の広告は出る");
});

test("広告が0件ならセクションごと表示しない", () => {
  const win = boot(FULL_CONFIG);

  // 目安を下回る入力：見直し余地が出ないので広告の理由がない
  setValue(win, "household", "1");
  setValue(win, "water", "1000");
  submit(win);

  assert.equal(adSlots(win).length, 0, "広告は0件");
  assert.equal(win.document.getElementById("ad-section").hidden, true, "セクションごと出さない");
});

test("診断結果に対応する記事リンクが表示される", () => {
  const win = boot(FULL_CONFIG);
  const d = win.document;

  setValue(win, "household", "4");
  setValue(win, "gas-type", "lpg");
  setValue(win, "mobile", "16000");
  setValue(win, "gas", "9000");
  submit(win);

  const related = d.querySelectorAll("#related-articles a");
  assert.ok(related.length >= 2, "対応する記事が複数出る");
  const hrefs = [...related].map((a) => a.getAttribute("href"));
  assert.ok(hrefs.includes("/articles/propane-gas-takai/"), "プロパンガスの記事へ導く");

  // 費目一覧の各行からも記事へ行ける
  assert.ok(
    d.querySelectorAll("#chart-rows .chart-row__link a").length >= 2,
    "カルテの行から記事へ行ける"
  );

  // 静的な記事一覧（クローラ向け）は消さない
  assert.ok(
    d.querySelectorAll('.related-articles .article-list a[href^="/articles/"]').length >= 6,
    "静的な内部リンクが残っている"
  );
});

test("状態ラベルが4種類のいずれかで、医学的な表現を使わない", () => {
  const win = boot(FULL_CONFIG);
  const d = win.document;

  setValue(win, "household", "4");
  setValue(win, "mobile", "16000"); // 目安を大きく超える → 優先して確認
  setValue(win, "water", "1000"); // 目安を下回る → 今は見直さなくてよい
  submit(win);

  const allowed = new Set(["情報不足", "今は見直さなくてよい", "確認する価値あり", "優先して確認"]);
  const labels = [...d.querySelectorAll(".chart-stage")].map((el) => el.textContent.trim());
  assert.ok(labels.length > 0, "状態ラベルが出る");
  labels.forEach((l) => assert.ok(allowed.has(l), `想定外のラベル: ${l}`));

  const stageOf = (name) =>
    [...d.querySelectorAll(".chart-row")]
      .find((el) => el.querySelector(".chart-row__name").textContent.includes(name))
      .querySelector(".chart-stage").textContent.trim();
  assert.equal(stageOf("スマホ代"), "優先して確認");
  assert.equal(stageOf("水道代"), "今は見直さなくてよい");
  assert.equal(stageOf("車関連費"), "情報不足", "未入力は情報不足");

  // 医学的・恐怖をあおる表現を使っていない
  const text = d.getElementById("result").textContent;
  ["危険", "異常", "要治療", "重症", "診断名"].forEach((ng) =>
    assert.ok(!text.includes(ng), `禁止語が含まれる: ${ng}`)
  );
});

test("リセットで結果が隠れ、入力と目安値の記録がクリアされる", () => {
  const win = boot();
  const d = win.document;
  pressGuess(win, "mobile");
  submit(win);
  assert.equal(d.getElementById("result").hidden, false);

  d.getElementById("reset-btn").click();
  assert.equal(d.getElementById("result").hidden, true, "結果が隠れる");
  assert.equal(d.getElementById("mobile").value, "", "入力がクリアされる");
  assert.equal(d.getElementById("mobile").dataset.guessed, undefined, "目安値の記録も消える");
  assert.equal(d.querySelectorAll(".field__hint").length, 0, "説明も消える");
});
