"use strict";

/**
 * 固定費削減診断ツール
 * - 完全クライアントサイド（入力はどこにも送信されません）
 * - 「世帯人数別の目安額(benchmark)」と入力額を比較し、
 *   目安超過分のうち現実的に削れる割合 + 目安内でも乗り換え等で下がる分、で削減余地を算出。
 * - スマホは契約形態（大手キャリア / 格安SIM）で目安と削減率を変える。
 * - 削減余地の大きい順に優先度を決定する。
 */

/** 世帯人数で配列から目安を引く（1〜6人、6人以上は末尾） */
function hh(arr, n) {
  const i = Math.min(Math.max((n | 0) - 1, 0), arr.length - 1);
  return arr[i];
}
/** 目安超過分 */
function excess(input, b) {
  return Math.max(input - b, 0);
}
/** 削減余地は入力額の80%を上限にクランプ（非現実的な数値を防ぐ） */
function clampSave(s, input) {
  return Math.max(0, Math.min(s, input * 0.8));
}

/** 住居タイプによる光熱費の目安補正（戸建ては高め、集合は低め） */
function housingMult(housing) {
  if (housing === "house") return 1.15;
  if (housing === "apartment") return 0.9;
  return 1.0;
}

/**
 * ガス代の目安（見直し後に到達しやすい目標額）。
 * プロパンは「現状が割高」なだけで目標は都市ガス水準に置く
 * → 高く払っている人ほど超過分が大きく出て、削減余地が大きく評価される。
 */
function gasBenchmark(c) {
  return Math.round(hh([3500, 4800, 5500, 6000, 6500, 7000], c.n) * housingMult(c.housing));
}

/** スマホ代の目安（1回線あたり目安 × 回線数）。回線数未指定は1回線扱い */
function mobileBenchmark(c) {
  const perLine = c.carrier === "mvno" ? 2200 : 3500;
  const lines = c.lines > 0 ? c.lines : 1;
  return perLine * lines;
}

/**
 * 光回線の目安。世帯人数ではなく住居タイプで決まる（1住戸あたりの契約のため）。
 * 戸建て向けプランは集合住宅向けより高いのが一般的。
 * @param {{ housing?: string }} c
 * @returns {number}
 */
function internetBenchmark(c) {
  if (c.housing === "house") return 5800;
  if (c.housing === "apartment") return 4500;
  return 5000;
}

/**
 * カテゴリ定義（id は index.html の input id と一致させる）
 * - benchmark(ctx): 月額の目安（円）。ctx = { n: 世帯人数, carrier: 'carrier'|'mvno' }
 * - scaled: true なら目安が世帯人数に応じて変わる（表示に「N人世帯の目安」を付ける）
 * - saving(input, ctx): 削減余地（円/月）
 *
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} name
 * @property {(c: any) => (number|null)} benchmark
 * @property {(input: number, c: any) => number} saving
 * @property {string} advice
 * @property {boolean} [scaled]
 * @property {boolean} [variable]
 *
 * @type {Category[]}
 */
const CATEGORIES = [
  {
    id: "housing",
    name: "住宅費（家賃・ローン）",
    benchmark: () => null, // 地域差が大きいため目安比較はしない
    saving: (input, c) => {
      if (c.tenure === "own_loan") return clampSave(input * 0.05, input); // 借り換え余地（条件次第）
      if (c.tenure === "rent") return clampSave(input * 0.02, input); // 家賃は下げにくい
      return 0; // 完済・未指定は0
    },
    advice:
      "住宅費は固定費の中で最大級です。持ち家でローン返済中なら、残高・金利・残期間しだいで“借り換え”により総返済額が大きく下がることがあります（一般に残高が多く・残期間が長く・金利差があるほど効果大）。賃貸は下げにくい費目ですが、更新時の交渉やより条件の良い物件への住み替え時に見直せます。",
  },
  {
    id: "mobile",
    name: "スマホ代",
    benchmark: (c) => mobileBenchmark(c),
    saving: (input, c) => {
      const b = mobileBenchmark(c);
      const r = c.carrier === "mvno" ? 0.25 : 0.6; // 大手は格安SIMで大幅減
      return clampSave(excess(input, b) * r + Math.min(input, b) * 0.05, input);
    },
    advice:
      "月3,000円を超えるなら格安SIM・eSIMへの乗り換えが最も効果的です。家族割やセット割で実は割高になっているケースも多く、データ使用量を見直して必要なプランに変えるだけで大きく下がります。",
  },
  {
    id: "internet",
    name: "ネット回線（光回線など）",
    benchmark: (c) => internetBenchmark(c),
    saving: (input, c) => {
      const b = internetBenchmark(c);
      return clampSave(excess(input, b) * 0.35 + Math.min(input, b) * 0.05, input);
    },
    advice:
      "光回線は乗り換え時のキャッシュバックや割引で、実質の負担が下がることがあります。まず明細を開き、ひかり電話・セキュリティ・サポートなど使っていないオプションが付いていないか確認してください。スマホと同じ系列にまとめるセット割が使える場合もあります。集合住宅では建物側の配線方式によって料金と速度が変わるため、住んでいる建物で選べるプランを確認するのが先です。",
  },
  {
    id: "electricity",
    name: "電気代",
    scaled: true,
    benchmark: (c) =>
      Math.round(hh([6500, 11000, 12000, 13000, 14000, 15500], c.n) * housingMult(c.housing)),
    saving: (input, c) => {
      const b = Math.round(
        hh([6500, 11000, 12000, 13000, 14000, 15500], c.n) * housingMult(c.housing)
      );
      return clampSave(excess(input, b) * 0.4 + Math.min(input, b) * 0.07, input);
    },
    advice:
      "電力会社・料金プランは自由に選べます。比較サイトで現在の使用量を入力し、より安いプランがないか確認しましょう。待機電力カットやアンペア数の見直しも地味に効きます。",
  },
  {
    id: "gas",
    name: "ガス代",
    scaled: true,
    benchmark: (c) => gasBenchmark(c),
    saving: (input, c) => {
      if (c.gasType === "none") return 0; // ガスを使っていない
      const b = gasBenchmark(c);
      const r = c.gasType === "lpg" ? 0.5 : 0.4; // プロパンは下げ余地大
      const sw = c.gasType === "lpg" ? 0.1 : 0.07;
      return clampSave(excess(input, b) * r + Math.min(input, b) * sw, input);
    },
    advice:
      "都市ガスは自由化されており会社の切り替えが可能です。プロパンガスの場合は割高なことが多く、複数業者の見積もり比較で下がる余地があります。電気とのセット割もチェックを。",
  },
  {
    id: "water",
    name: "水道代",
    scaled: true,
    benchmark: (c) =>
      Math.round(hh([2500, 4200, 5000, 6000, 6800, 7500], c.n) * housingMult(c.housing)),
    saving: (input, c) => {
      const b = Math.round(
        hh([2500, 4200, 5000, 6000, 6800, 7500], c.n) * housingMult(c.housing)
      );
      return clampSave(excess(input, b) * 0.3, input); // 会社は選べず使い方中心
    },
    advice:
      "水道は会社を選べないため削減幅は小さめ。節水シャワーヘッドや食洗機の活用、お風呂の残り湯利用など使い方の工夫が中心になります。目安より高い場合は使い方の見直し余地があります。",
  },
  {
    id: "insurance",
    name: "保険料",
    scaled: true,
    benchmark: (c) => hh([5000, 9000, 13000, 16000, 18000, 20000], c.n),
    saving: (input, c) => {
      const b = hh([5000, 9000, 13000, 16000, 18000, 20000], c.n);
      // 「入り方」で削れる割合を変える（貯蓄型は割高になりがちで余地大）
      const r =
        c.insType === "savings" ? 0.55 : c.insType === "kakezute" ? 0.2 : 0.4;
      const sw = c.insType === "kakezute" ? 0.05 : 0.1;
      return clampSave(excess(input, b) * r + Math.min(input, b) * sw, input);
    },
    advice:
      "保険は「生命保険（死亡保障）」「医療保険」「学資保険」などに分けて見ると無駄が見つかります。" +
      "特に終身・養老・学資などの“貯蓄型”は保障と貯蓄が混ざって割高になりがち。掛け捨て中心に組み替え、" +
      "公的保障（遺族年金・高額療養費）でカバーできる部分は保険を薄くするのが基本です。無料相談の活用も有効です。",
  },
  {
    id: "subscription",
    name: "サブスク代",
    benchmark: () => 2000,
    saving: (input) =>
      clampSave(excess(input, 2000) * 0.5 + Math.min(input, 2000) * 0.1, input),
    advice:
      "使っていない・重複している動画/音楽/アプリのサブスクが眠っていないか棚卸しを。年払いへの切り替えや無料プランで足りるものへの変更も検討しましょう。",
  },
  {
    id: "car",
    name: "車関連費",
    benchmark: () => 18000,
    saving: (input) =>
      clampSave(excess(input, 18000) * 0.2 + Math.min(input, 18000) * 0.08, input),
    advice:
      "自動車保険の等級・補償内容の見直し、ガソリンカードの活用、駐車場の相見積もりが効きます。利用頻度が低いならカーシェアやレンタカーへの切り替えも選択肢です。",
  },
  {
    id: "waterserver",
    name: "ウォーターサーバー代",
    benchmark: () => 0, // この費目自体が見直し候補
    saving: (input) => clampSave(input * 0.9, input),
    advice:
      "費用対効果を感じにくければ解約候補の筆頭です。浄水器やブリタ等のポット型に替えるだけで月数千円が浮きます。レンタル料・水ノルマ・電気代の合計で再評価しましょう。",
  },
  {
    id: "eatingout",
    name: "外食・コンビニ代",
    variable: true, // 固定費ではなく変動費（使い方で変わる）
    scaled: true,
    benchmark: (c) => hh([12000, 18000, 24000, 30000, 35000, 40000], c.n),
    saving: (input, c) => {
      const b = hh([12000, 18000, 24000, 30000, 35000, 40000], c.n);
      return clampSave(excess(input, b) * 0.4 + Math.min(input, b) * 0.08, input);
    },
    advice:
      "コンビニの“ついで買い”と外食回数が膨らみやすいポイント。週の外食回数を1回減らす、まとめ買い＋作り置きに切り替えるだけで月単位の効果が出ます。",
  },
  {
    id: "other",
    name: "その他の固定費",
    benchmark: () => 3000,
    saving: (input) => clampSave(excess(input, 3000) * 0.3, input),
    advice:
      "ジム・習い事・各種会費・有料アプリなど“なんとなく続いている”支出を棚卸し。利用頻度に見合っているか1つずつ確認すると、不要な定額課金が見つかります。",
  },
];

/** ブラウザ保存用キー */
const STORAGE_KEY = "fixedCostChecker.inputs.v1";

/**
 * 「わからない」で入れた目安値かどうかの記録用キー。
 *
 * 入力値そのものは STORAGE_KEY のまま変更しない（後方互換）。
 * 「どの費目が目安値か」だけを別キーに持つので、
 * 旧バージョンの保存データがあっても読み書きは壊れない。
 */
const GUESSED_KEY = "fixedCostChecker.guessed.v1";

/** 直近の診断結果（画像生成で参照） */
let lastResult = null;

/** GA等のイベント送信（未設定なら何もしない） */
function track(eventName, params) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params || {});
  }
  // GoatCounter へはイベント名だけを送る。
  // 入力された金額や、そこから計算した削減額は送らない
  // （「入力した数字はどこにも送信されない」という説明を守るため）。
  const gc = window.goatcounter;
  if (gc && typeof gc.count === "function") {
    gc.count({ path: `event/${eventName}`, title: eventName, event: true });
  }
}

/** 数値を「12,345円」形式に整形 */
/**
 * その項目の広告設定を返す。ASP発行コード（code）が無ければ出さない。
 *
 * 属性による出し分けは行わない。CVR・承認率の実績が無い段階で振り分けても
 * 根拠にならないため、まず1本に集約してデータを貯める方針。
 *
 * @param {string} id カテゴリID
 * @returns {SiteAffiliate | null}
 */
function resolveAffiliate(id) {
  const cfg =
    (window.SITE_CONFIG &&
      window.SITE_CONFIG.affiliates &&
      window.SITE_CONFIG.affiliates[id]) ||
    null;
  if (!cfg || !cfg.code) return null;
  return cfg;
}

/**
 * 案件ごとのクリック数を計測する。
 *
 * ASP発行コードの <a> には手を入れられないため、
 * 親要素でクリックを拾う（イベント委譲）。コードは無改変のまま。
 */
function setupAdClickTracking() {
  document.addEventListener(
    "click",
    (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (!target || typeof target.closest !== "function") return;
      const link = target.closest(".ad-card__link a");
      if (!link) return;
      const card = link.closest(".ad-card");
      const slot = (card && card.getAttribute("data-ad-slot")) || "unknown";
      track(`ad_click/${slot}`, {});
    },
    true // 遷移前に確実に拾うためキャプチャ段階で
  );
}

/**
 * その項目の広告を出してよいか判定する。
 *
 * 方針：**当てはまらない人には出さない**。無関係な広告は信頼を損ね、
 * クリックもされないため、掲載しない方が結果的に成果につながる。
 *
 * @param {{ id: string, input: number, guessed?: boolean }} item 診断項目
 * @param {{ tenure?: string, gasType?: string, carrier?: string }} ctx 前提条件
 * @returns {boolean}
 */
function shouldShowAd(item, ctx) {
  if (!item) return false;
  // 未入力・未診断の項目には出さない。
  // （input を持たない生のカテゴリが渡ることがあるため、数値かどうかから確かめる）
  if (typeof item.input !== "number" || !(item.input > 0)) return false;
  // サイトが入れた目安値だけを根拠に広告は出さない
  if (item.guessed) return false;
  const c = ctx || {};
  switch (item.id) {
    case "housing":
      // 借り換えの話ができるのは「持ち家・ローン返済中」の人だけ
      return c.tenure === "own_loan";
    case "gas":
      // オール電化には出さない。都市ガスの人にプロパン比較は当てはまらない
      return c.gasType !== "none" && c.gasType !== "city";
    case "mobile":
      // すでに格安SIM中心の人に乗り換えを勧めても響かない
      return c.carrier !== "mvno";
    default:
      return true;
  }
}

/**
 * 広告カードのHTMLを組み立てる。
 *
 * 見出し・説明文はサイト側で書き、ASPが発行したコード（cfg.code）は
 * **一切改変せずそのまま**その下に配置する。
 * URLの抜き出しやアンカーテキストの書き換えはASP規約違反になるため行わない。
 *
 * @param {SiteAffiliate | null} cfg
 * @returns {string}
 */
function buildAdCard(cfg, slot) {
  if (!cfg || !cfg.code) return "";
  const heading = cfg.heading ? `<p class="ad-card__heading">${cfg.heading}</p>` : "";
  const body = cfg.body ? `<p class="ad-card__body">${cfg.body}</p>` : "";
  if (slot) track(`ad_view/${slot}`, {}); // 案件ごとの表示回数
  return (
    `<div class="ad-card" data-ad-slot="${slot || ""}">` +
    `<span class="ad-tag">広告</span>` +
    heading +
    body +
    // ↓ ここから下はASP発行コード。改変しないこと
    `<p class="ad-card__link">${cfg.code}</p>` +
    `</div>`
  );
}

/**
 * 各入力欄に「わからない」ボタンを付ける。
 * 押すと、世帯人数などから算出した目安額を入れる（＝入力を諦めて離脱するのを防ぐ）。
 * 目安を出せない項目（住宅費など）には付けない。
 */
function setupGuessButtons() {
  CATEGORIES.forEach((cat) => {
    const input = /** @type {HTMLInputElement | null} */ (document.getElementById(cat.id));
    if (!input) return;
    const field = input.closest(".field");
    const labelEl = field ? field.querySelector(".field__label") : null;
    if (!labelEl) return;
    if (cat.benchmark(readContext()) == null) return; // 目安が出せない項目

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "field__guess";
    btn.textContent = "わからない";
    btn.setAttribute("aria-label", `${cat.name}に目安の金額を入れる`);

    btn.addEventListener("click", (e) => {
      e.preventDefault(); // label内にあるため、入力欄へのフォーカス移動を抑える
      const b = cat.benchmark(readContext());
      if (b == null) return;
      input.value = String(Math.round(b));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      // サイトが入れた数字であることを、以後ずっと分かるようにしておく
      setGuessed(input, true);
    });

    // 本人が手で入力し直したら、目安値の扱いを解除する。
    // isTrusted で、上の dispatchEvent（プログラムからの発火）と区別する。
    input.addEventListener("input", (e) => {
      if (e.isTrusted && isGuessed(cat.id)) setGuessed(input, false);
    });

    labelEl.appendChild(btn);
  });
}

/**
 * 「あなた」と「目安」を並べた横棒グラフを組み立てる。
 * 目安が無い項目（住宅費など地域差が大きいもの）や未入力の項目では何も描かない。
 * @param {{ input: number, benchmark: number | null }} item
 * @returns {string} HTML文字列（描かない場合は空文字）
 */
function buildGauge(item) {
  const b = item.benchmark;
  if (!b || b <= 0 || !item.input || item.input <= 0) return "";

  const max = Math.max(item.input, b);
  const pct = (v) => Math.max(2, Math.round((v / max) * 100)); // 0幅だと線が消えるので下限を持たせる
  const over = item.input > b;

  return (
    `<div class="gauge" role="img" aria-label="あなた ${yen(item.input)}、目安 ${yen(b)}">` +
    `<div class="gauge__row gauge__row--you">` +
    `<span class="gauge__key">あなた</span>` +
    `<span class="gauge__track"><span class="gauge__bar ${over ? "gauge__bar--over" : "gauge__bar--you"}" style="width:${pct(item.input)}%"></span></span>` +
    `<span class="gauge__val">${yen(item.input)}</span>` +
    `</div>` +
    `<div class="gauge__row">` +
    `<span class="gauge__key">目安</span>` +
    `<span class="gauge__track"><span class="gauge__bar" style="width:${pct(b)}%"></span></span>` +
    `<span class="gauge__val">${yen(b)}</span>` +
    `</div>` +
    `</div>`
  );
}

/**
 * 金額を「数値」と「単位」に分けて要素に描画する。
 * 単位は「円」または「万円」。textContent の末尾は必ず「円」。
 * @param {HTMLElement | null} el
 * @param {number} value
 * @param {(n: number) => string} [format] 既定は推定値向けの丸め表示
 */
function setAmount(el, value, format) {
  if (!el) return;
  const text = (format || roundedYen)(value);
  const m = /^(.*?)(万円|円)$/.exec(text) || [text, text, ""];
  el.textContent = "";
  const num = document.createElement("span");
  num.className = "amount__num";
  num.textContent = m[1];
  const unit = document.createElement("span");
  unit.className = "amount__unit";
  unit.textContent = m[2];
  el.append(num, unit);
}

function yen(n) {
  return Math.round(n).toLocaleString("ja-JP") + "円";
}

/**
 * 「削減余地」のような**推定値**を表示するための丸め。
 *
 * 目安との差に係数を掛けて出した数字を1円単位で見せると、
 * 実際には持っていない精度を持っているように読めてしまう。
 * 表示だけを丸め、計算そのものには手を入れない。
 *
 *   368,820 → 約37万円 ／ 30,735 → 約3.1万円
 *     7,675 → 約7,700円 ／    440 → 約440円 ／ 0 → 0円
 *
 * @param {number} n
 * @returns {string}
 */
function roundedYen(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (v === 0) return "0円";
  if (v >= 100000) return `約${Math.round(v / 10000).toLocaleString("ja-JP")}万円`;
  if (v >= 10000) return `約${(Math.round(v / 1000) / 10).toFixed(1)}万円`;
  if (v >= 1000) return `約${(Math.round(v / 100) * 100).toLocaleString("ja-JP")}円`;
  return `約${Math.round(v / 10) * 10}円`;
}

/**
 * その費目の金額が「わからない」で入れた目安値かどうか。
 *
 * 目安値は診断の計算には使うが、**その人の実額としては扱わない**。
 * （広告の根拠にしない／「あなたの金額」として断定しない）
 *
 * @param {string} id カテゴリID
 * @returns {boolean}
 */
function isGuessed(id) {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(id);
  return !!(el && el.dataset && el.dataset.guessed === "1");
}

/**
 * 目安値フラグを立てる／降ろす。入力欄のそばに状態の説明を出す。
 * @param {HTMLInputElement} input
 * @param {boolean} on
 */
function setGuessed(input, on) {
  if (!input) return;
  const field = input.closest(".field");
  if (on) {
    input.dataset.guessed = "1";
  } else {
    delete input.dataset.guessed;
  }
  if (!field) return;

  const btn = /** @type {HTMLElement | null} */ (field.querySelector(".field__guess"));
  if (btn) btn.classList.toggle("field__guess--on", on);

  let hint = /** @type {HTMLElement | null} */ (field.querySelector(".field__hint"));
  if (on) {
    if (!hint) {
      hint = document.createElement("p");
      hint.className = "field__hint";
      hint.textContent = "目安を入れました。実際の金額が分かれば変更できます。";
      field.appendChild(hint);
    }
  } else if (hint) {
    hint.remove();
  }
  saveGuessed();
}

/** 目安値フラグを保存（入力値の保存とは別キー） */
function saveGuessed() {
  try {
    const ids = CATEGORIES.map((c) => c.id).filter(isGuessed);
    if (ids.length === 0) localStorage.removeItem(GUESSED_KEY);
    else localStorage.setItem(GUESSED_KEY, JSON.stringify(ids));
  } catch (e) {
    /* プライベートモード等で失敗しても無視 */
  }
}

/** 保存済みの目安値フラグを復元（値が残っている費目のみ） */
function restoreGuessed() {
  try {
    const raw = localStorage.getItem(GUESSED_KEY);
    if (!raw) return;
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return;
    ids.forEach((id) => {
      const el = /** @type {HTMLInputElement | null} */ (document.getElementById(String(id)));
      if (el && el.value !== "") setGuessed(el, true);
    });
  } catch (e) {
    /* 壊れたデータは無視 */
  }
}

/** 入力値を取得（空欄やマイナス・非数は0） */
function readValue(id) {
  const el = /** @type {HTMLInputElement | null} */ (document.getElementById(id));
  const v = Number(el && el.value);
  if (!isFinite(v) || v < 0) return 0;
  return v;
}

/** 世帯人数を取得（1〜6、未選択は3） */
function readHousehold() {
  const el = /** @type {HTMLSelectElement | null} */ (document.getElementById("household"));
  const v = el ? parseInt(el.value, 10) : NaN;
  return isFinite(v) && v >= 1 ? v : 3;
}

/** スマホ契約形態を取得（'carrier' | 'mvno'、既定は大手キャリア） */
function readMobileType() {
  const checked = /** @type {HTMLInputElement | null} */ (
    document.querySelector('input[name="mobile-type"]:checked')
  );
  return checked && checked.value === "mvno" ? "mvno" : "carrier";
}

/** select の値を取得（未選択は ""） */
function readSelect(id) {
  const el = /** @type {HTMLSelectElement | null} */ (document.getElementById(id));
  return el ? el.value : "";
}

/** 入力前提（ctx）をまとめて取得 */
function readContext() {
  return {
    n: readHousehold(),
    carrier: readMobileType(),
    housing: readSelect("housing-type"), // '' | 'apartment' | 'house'
    gasType: readSelect("gas-type"), // '' | 'city' | 'lpg' | 'none'
    lines: parseInt(readSelect("mobile-lines"), 10) || 0, // 0=おまかせ
    insType: readSelect("insurance-type"), // '' | 'savings' | 'kakezute' | 'unknown'
    tenure: readSelect("housing-tenure"), // '' | 'own_loan' | 'own_paid' | 'rent'
    savings: readSelect("savings-status"), // '' | 'monthly' | 'sometimes' | 'rarely'
  };
}

/**
 * 貯蓄の相談導線を出すかどうかを判定する。
 *
 * 回答だけで直行させない。「貯蓄できていない」ことと、
 * **固定費に実際の見直し余地があること**の両方が揃ったときだけ出す。
 * 見直す余地が無いのに相談へ送っても、その人の役には立たないため。
 *
 * @param {{ ctx: { savings?: string }, yearlySaving: number, totalInput: number }} result
 * @returns {boolean}
 */
function shouldShowSavingsAdvisor(result) {
  const status = (result.ctx && result.ctx.savings) || "";
  if (status !== "rarely" && status !== "sometimes") return false; // 未回答・わからない・できている人には出さない
  if (result.totalInput <= 0) return false; // 支出の入力が無ければ判断材料がない

  // 閾値は config.js で変更できる（実績が貯まったら見直す前提の仮の値）
  const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.savingsAdvisor) || {};
  const th = cfg.thresholds || {};
  const limit = status === "rarely" ? th.rarely : th.sometimes;
  const fallback = status === "rarely" ? 30000 : 60000;
  return result.yearlySaving >= (typeof limit === "number" ? limit : fallback);
}

/** 入力額と目安から「目安比較メモ」を作る */
function buildNote(cat, input, b, ctx) {
  if (input <= 0) return "";
  if (cat.id === "gas" && ctx.gasType === "none") {
    return "ガスを使用していない設定です（オール電化など）。";
  }
  if (cat.id === "housing") {
    if (ctx.tenure === "own_loan")
      return "ローン返済中：借り換えで下がる可能性（残高・金利・残期間しだい）。試算する価値大。";
    if (ctx.tenure === "rent")
      return "家賃は下げにくい費目。更新時の交渉や、より条件の良い物件への住み替え時に検討を。";
    if (ctx.tenure === "own_paid")
      return "完済済み：固定資産税・修繕積立など維持費の点検が中心です。";
    return "「住まいの種類」を選ぶと、住宅費の見直し余地（借り換え等）も診断します。";
  }
  if (b == null || b <= 0) return "この費目自体が見直し候補です（解約・代替で大きく圧縮可能）。";
  const base = cat.scaled ? `${ctx.n}人世帯の目安 約${yen(b)}` : `目安 約${yen(b)}`;
  const diff = input - b;
  const margin = b * 0.12;
  if (diff > margin) {
    return `${base}／あなた ${yen(input)} → 約${yen(diff)}高め`;
  }
  if (diff < -margin) {
    return `${base}／あなた ${yen(input)} → 目安より約${yen(-diff)}低め（良好）`;
  }
  return `${base}／あなた ${yen(input)} → ほぼ適正`;
}

/** 診断を実行して結果オブジェクトを返す */
function diagnose() {
  const ctx = readContext();

  const items = CATEGORIES.map((cat) => {
    const input = readValue(cat.id);
    const benchmark = cat.benchmark(ctx);
    const saving = input > 0 ? cat.saving(input, ctx) : 0;
    const note = buildNote(cat, input, benchmark, ctx);
    // guessed は「その金額がサイトの入れた目安である」ことの印。
    // 計算（input / benchmark / saving）には一切影響させない。
    return { ...cat, input, benchmark, saving, note, guessed: isGuessed(cat.id) };
  });

  const totalInput = items.reduce((s, i) => s + i.input, 0);
  const monthlySaving = items.reduce((s, i) => s + i.saving, 0);
  const sum = (arr, key, pred) =>
    arr.filter(pred).reduce((s, i) => s + i[key], 0);

  return {
    items,
    ctx,
    totalInput,
    monthlySaving,
    yearlySaving: monthlySaving * 12,
    fixedInput: sum(items, "input", (i) => !i.variable),
    variableInput: sum(items, "input", (i) => i.variable),
    fixedSaving: sum(items, "saving", (i) => !i.variable),
    variableSaving: sum(items, "saving", (i) => i.variable),
  };
}

/** 今日やる3アクション（削減余地TOP項目に応じて動的生成） */
function buildTodayActions(rankedWithSaving) {
  const actionMap = {
    mobile: "格安SIM比較サイトで、自分のデータ使用量に合うプランの月額を1社調べる",
    internet: "光回線の明細を開き、使っていないオプション（ひかり電話・セキュリティ等）を1つ解約する",
    electricity: "電力比較サイトに検針票の使用量を入力し、今より安いプランを1つ見つける",
    gas: "ガス会社の切り替え/相見積もりサイトで現在の料金と比較する",
    water: "節水シャワーヘッドの価格と、お風呂の使い方を1つ見直す",
    insurance: "加入中の保険証券を1か所に集め、保障内容と月額を書き出す",
    subscription: "スマホの『サブスク一覧』を開き、3か月使っていないものを1つ解約する",
    car: "自動車保険の証券を見て、補償の重複と等級・更新月をメモする",
    waterserver: "ウォーターサーバーの月額合計（レンタル＋水＋電気）を計算し、解約条件を確認する",
    eatingout: "今週の外食・コンビニ予定を1回分『家での食事』に置き換えると決める",
    other: "毎月の定額課金（ジム・会費・アプリ）を書き出し、1つ続けるか判断する",
  };

  const top = rankedWithSaving.slice(0, 3);
  const actions = top.map((i) => actionMap[i.id]).filter(Boolean);

  // 入力がほぼ無く候補が足りない場合の汎用アクション
  const fallback = [
    "直近1か月の固定費を通帳・クレカ明細から書き出す",
    "一番高いと感じる固定費を1つ選び、相場をネットで調べる",
    "解約・乗り換えの『申し込み締切（更新月）』をカレンダーに登録する",
  ];
  let i = 0;
  while (actions.length < 3) {
    actions.push(fallback[i++ % fallback.length]);
  }
  return actions.slice(0, 3);
}

/** CTA導線文を金額に応じて出し分け */
function buildCtaLead(yearly) {
  if (yearly >= 100000) {
    return `診断の結果、あなたの家計には年間 ${roundedYen(yearly)} の削減余地があります。これは「やるかどうか」だけの差。次は実際に手続きを完了させる番です。`;
  }
  if (yearly > 0) {
    return `年間 ${roundedYen(yearly)} の削減余地が見つかりました。金額の大小よりも、ここで止まらず行動に移せるかが家計改善の分かれ道です。`;
  }
  return "今回は大きな削減余地は出ませんでしたが、固定費は契約条件の変化で再び膨らみがち。定期点検の習慣化が生活防衛のカギです。";
}

/** 入力値をブラウザ（localStorage）に保存。※端末内のみ・外部送信なし */
function saveInputs() {
  try {
    const data = {
      _household: readHousehold(),
      _mobileType: readMobileType(),
      _housing: readSelect("housing-type"),
      _gasType: readSelect("gas-type"),
      _lines: readSelect("mobile-lines"),
      _insType: readSelect("insurance-type"),
      _tenure: readSelect("housing-tenure"),
    };
    CATEGORIES.forEach((cat) => (data[cat.id] = readValue(cat.id)));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    /* プライベートモード等で失敗しても無視 */
  }
}

/** 保存済みの入力値があれば復元 */
function restoreInputs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    CATEGORIES.forEach((cat) => {
      const el = /** @type {HTMLInputElement | null} */ (document.getElementById(cat.id));
      if (el && data[cat.id] > 0) el.value = String(data[cat.id]);
    });
    const setSelect = (id, val) => {
      const el = /** @type {HTMLSelectElement | null} */ (document.getElementById(id));
      if (el && val != null && val !== "") el.value = String(val);
    };
    setSelect("household", data._household);
    setSelect("housing-type", data._housing);
    setSelect("gas-type", data._gasType);
    setSelect("mobile-lines", data._lines);
    setSelect("insurance-type", data._insType);
    setSelect("housing-tenure", data._tenure);
    if (data._mobileType) {
      const radio = /** @type {HTMLInputElement | null} */ (
        document.querySelector(`input[name="mobile-type"][value="${data._mobileType}"]`)
      );
      if (radio) radio.checked = true;
    }
  } catch (e) {
    /* 壊れたデータは無視 */
  }
}

/** 保存をクリア */
function clearInputs() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(GUESSED_KEY);
  } catch (e) {
    /* 無視 */
  }
  // 画面上の「目安を入れました」表示も消す
  CATEGORIES.forEach((cat) => {
    const el = /** @type {HTMLInputElement | null} */ (document.getElementById(cat.id));
    if (el && isGuessed(cat.id)) setGuessed(el, false);
  });
}

/** 診断結果を画像（PNG）にして保存／シェア（外部ライブラリ不要・Canvasで描画） */
function generateImage() {
  if (!lastResult) return;
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // 背景
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1f9d72");
  bg.addColorStop(1, "#15795a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  const cx = W / 2;

  // 見出し
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("固定費削減診断の結果", cx, 130);

  // 白カード
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 90, 200, W - 180, 560, 32);
  ctx.fill();

  // 月間
  ctx.fillStyle = "#6b7280";
  ctx.font = "bold 38px sans-serif";
  ctx.fillText("月間の削減可能額の目安", cx, 300);
  ctx.fillStyle = "#15795a";
  ctx.font = "bold 84px sans-serif";
  ctx.fillText(roundedYen(lastResult.monthlySaving), cx, 390);

  // 年間
  ctx.fillStyle = "#6b7280";
  ctx.font = "bold 38px sans-serif";
  ctx.fillText("年間の削減可能額の目安", cx, 500);
  ctx.fillStyle = "#ff7a45";
  ctx.font = "bold 100px sans-serif";
  ctx.fillText(roundedYen(lastResult.yearlySaving), cx, 600);

  // TOP3
  const top3 = [...lastResult.items]
    .sort((a, b) => b.saving - a.saving)
    .filter((i) => i.saving > 0)
    .slice(0, 3);
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText("優先して見直すべき項目 TOP3", cx, 680);
  ctx.font = "30px sans-serif";
  if (top3.length === 0) {
    ctx.fillText("大きな見直し項目はありませんでした", cx, 730);
  } else {
    top3.forEach((i, idx) => {
      ctx.fillText(
        `${idx + 1}. ${i.name}（月 ${roundedYen(i.saving)}）`,
        cx,
        730 + idx * 18
      );
    });
  }

  // フッター
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText("無料・登録不要｜固定費削減診断ツール", cx, 880);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "26px sans-serif";
  ctx.fillText("※結果は一般的な相場をもとにした目安です", cx, 930);

  // 保存／シェア
  canvas.toBlob((blob) => {
    if (!blob) return;
    const file = new File([blob], "fixed-cost-result.png", { type: "image/png" });
    // 対応端末ではネイティブ共有（画像付き）
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator
        .share({ files: [file], title: "固定費削減診断の結果" })
        .then(() => track("share_image", { method: "web_share" }))
        .catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fixed-cost-result.png";
      a.click();
      URL.revokeObjectURL(url);
      track("share_image", { method: "download" });
    }
  }, "image/png");
}

/** 角丸矩形パス */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** シェアボタンのリンク/挙動をセット */
function setupShare(yearly) {
  const url = location.href.split("#")[0];
  const text =
    yearly > 0
      ? `「家計の保健室」の無料診断をやってみたら、年間 ${roundedYen(yearly)} の削減余地が見つかった！登録不要で30秒👇`
      : `「家計の保健室」の無料診断で家計をチェック！登録不要で30秒👇`;

  const xUrl =
    "https://twitter.com/intent/tweet?text=" +
    encodeURIComponent(text) +
    "&url=" +
    encodeURIComponent(url);
  const lineUrl =
    "https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent(url);

  const shareX = /** @type {HTMLAnchorElement} */ (document.getElementById("share-x"));
  const shareLine = /** @type {HTMLAnchorElement} */ (document.getElementById("share-line"));
  shareX.href = xUrl;
  shareLine.href = lineUrl;

  shareX.onclick = () => track("share", { method: "x" });
  shareLine.onclick = () => track("share", { method: "line" });

  const copyBtn = document.getElementById("share-copy");
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      const original = copyBtn.textContent;
      copyBtn.textContent = "コピーしました ✓";
      setTimeout(() => (copyBtn.textContent = original), 1800);
      track("share", { method: "copy" });
    } catch (e) {
      window.prompt("このURLをコピーしてください:", url);
    }
  };

  document.getElementById("share-image").onclick = generateImage;
}

/** 結果を画面に描画 */
function render(result) {
  lastResult = result;
  // サマリー
  // 金額は「数値＋単位」に分けて表示する（単位を小さく組み、帳票らしい見え方にする）
  setAmount(document.getElementById("monthly-saving"), result.monthlySaving);
  setAmount(document.getElementById("yearly-saving"), result.yearlySaving);
  const carrierLabel = result.ctx.carrier === "mvno" ? "格安SIM中心" : "大手キャリア中心";
  // 入力額（本人の数字）はそのまま、削減余地（推定）は丸めて出す
  document.getElementById("total-line").innerHTML =
    `${result.ctx.n}人世帯・${carrierLabel}で診断／現在の支出合計：月 ${yen(result.totalInput)}（年 ${yen(result.totalInput * 12)}）` +
    `<br><span class="split">└ 固定費 月${yen(result.fixedInput)}（削減余地 ${roundedYen(result.fixedSaving)}）／変動費 月${yen(result.variableInput)}（同 ${roundedYen(result.variableSaving)}）</span>`;

  // 削減余地でソート
  const ranked = [...result.items].sort((a, b) => b.saving - a.saving);

  // TOP3
  const top3 = ranked.filter((i) => i.saving > 0).slice(0, 3);
  const top3List = document.getElementById("top3-list");
  top3List.innerHTML = "";
  if (top3.length === 0) {
    const li = document.createElement("li");
    li.innerHTML =
      '<span class="top3__name">大きな見直し項目は見つかりませんでした</span>' +
      '<p class="top3__desc">各項目すでに最適化されているか、入力額が少なめのようです。下のアドバイスもご確認ください。</p>';
    top3List.appendChild(li);
  } else {
    top3.forEach((i) => {
      const li = document.createElement("li");
      const desc = i.note
        ? `${i.note}。年間で${roundedYen(i.saving * 12)}の削減が見込めます。`
        : `年間で${roundedYen(i.saving * 12)}の削減が見込めます。`;
      li.innerHTML =
        `<span class="top3__name">${i.name}</span> ` +
        `<span class="top3__saving">月 ${roundedYen(i.saving)}</span>` +
        `<p class="top3__desc">${desc}</p>`;
      top3List.appendChild(li);
    });
  }

  // 全項目アドバイス（入力があるものを削減余地順に表示。固定費／変動費で分ける）
  const adviceList = document.getElementById("advice-list");
  adviceList.innerHTML = "";
  // 入力のある費目だけを出す。1件も無いときは診断自体を出さないため、
  // ここで生の CATEGORIES にフォールバックしない
  // （フォールバックすると input を持たない項目に広告が出てしまう）。
  const toShow = ranked.filter((i) => i.input > 0);

  const renderGroup = (label, sub, items) => {
    if (items.length === 0) return;
    const head = document.createElement("p");
    head.className = "advice-group";
    head.innerHTML = `${label} <span class="advice-group__sub">${sub}</span>`;
    adviceList.appendChild(head);
    items.forEach(appendAdvice);
  };

  function appendAdvice(i) {
    const div = document.createElement("div");
    div.className = "advice";
    const savingTag =
      i.saving > 0 ? `<span class="advice__saving">削減目安 月${roundedYen(i.saving)}</span>` : "";
    // 目安との比較メモ
    const note = i.note ? `<p class="advice__note">${i.note}</p>` : "";
    // 広告は config.js に ASP発行コード（code）がある項目だけ表示する
    const cfg = resolveAffiliate(i.id);
    // 該当しない人には出さない（信頼を損ねるうえ、クリックもされないため）
    const aff = shouldShowAd(i, result.ctx) ? buildAdCard(cfg, i.id) : "";
    div.innerHTML =
      `<div class="advice__head"><span class="advice__name">${i.name}</span>${savingTag}</div>` +
      buildGauge(i) +
      note +
      `<p class="advice__text">${i.advice}</p>` +
      aff;
    adviceList.appendChild(div);
  }

  renderGroup("固定費", "毎月かかる・一度の見直しでずっと効く", toShow.filter((i) => !i.variable));
  renderGroup("変動費", "使い方で変わる・習慣で効いてくる", toShow.filter((i) => i.variable));

  // 今日やる3アクション
  const actionList = document.getElementById("action-list");
  actionList.innerHTML = "";
  buildTodayActions(ranked).forEach((text, idx) => {
    const li = document.createElement("li");
    const cbId = `action-${idx}`;
    li.innerHTML =
      `<input type="checkbox" id="${cbId}" />` +
      `<label for="${cbId}">${text}</label>`;
    actionList.appendChild(li);
  });

  // シェアボタン
  setupShare(result.yearlySaving);

  // CTA
  document.getElementById("cta-lead").textContent = buildCtaLead(result.yearlySaving);

  // 貯蓄の相談（条件を満たしたときだけ）
  const savingsCard = document.getElementById("savings-advisor");
  if (savingsCard) {
    const savingsCfg = (window.SITE_CONFIG && window.SITE_CONFIG.savingsAdvisor) || null;
    const showSavings = !!(savingsCfg && savingsCfg.code && shouldShowSavingsAdvisor(result));
    savingsCard.hidden = !showSavings;
    const slot = document.getElementById("savings-advisor-ad");
    if (slot) slot.innerHTML = showSavings ? buildAdCard(savingsCfg, "savings") : "";
  }

  // 表示＆スクロール
  const resultSection = document.getElementById("result");
  resultSection.hidden = false;
  track("result_view", {}); // 診断結果の表示回数
  renumberSections();
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * 見出しの通し番号を、表示されているセクションだけで振り直す。
 * 条件によって出し入れするカードがあるため、番号を固定で書くと欠番になる。
 */
function renumberSections() {
  let n = 0;
  document.querySelectorAll(".section-title__no").forEach((el) => {
    const card = /** @type {HTMLElement | null} */ (el.closest(".card"));
    const isHidden = !card || card.hidden || card.closest("[hidden]") !== null;
    if (isHidden) {
      el.textContent = "";
      return;
    }
    n += 1;
    el.textContent = String(n).padStart(2, "0");
  });
}

/** 初期化（ブラウザでのみ実行。Nodeからのrequire時はDOM処理をスキップ） */
if (typeof document !== "undefined") {
document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // 前回の入力があれば復元
  restoreInputs();

  const form = /** @type {HTMLFormElement} */ (document.getElementById("cost-form"));
  const emptyNote = document.getElementById("input-empty");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const result = diagnose();

    // 金額が1つも入っていないときは結果を出さない。
    // 中身の無い診断結果に広告だけが並ぶ状態を作らないため。
    if (result.totalInput <= 0) {
      if (emptyNote) emptyNote.hidden = false;
      document.getElementById("result").hidden = true;
      lastResult = null;
      renumberSections();
      if (emptyNote && typeof emptyNote.scrollIntoView === "function") {
        emptyNote.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    if (emptyNote) emptyNote.hidden = true;
    saveInputs();
    render(result);
    track("diagnose", {
      household: result.ctx.n,
      mobile_type: result.ctx.carrier,
      monthly_saving: Math.round(result.monthlySaving),
      yearly_saving: Math.round(result.yearlySaving),
    });
  });

  const resetBtn = document.getElementById("reset-btn");
  resetBtn.addEventListener("click", () => {
    form.reset();
    clearInputs();
    lastResult = null;
    if (emptyNote) emptyNote.hidden = true;
    document.getElementById("result").hidden = true;
    renumberSections();
    document.getElementById("form").scrollIntoView({ behavior: "smooth" });
  });

  const ctaBtn = /** @type {HTMLAnchorElement | null} */ (document.getElementById("cta-btn"));
  if (ctaBtn) {
    const ctaCfg = (window.SITE_CONFIG && window.SITE_CONFIG.cta) || {};
    if (ctaCfg.href) {
      if (ctaCfg.label) ctaBtn.textContent = ctaCfg.label;
      ctaBtn.href = ctaCfg.href;
      ctaBtn.addEventListener("click", () => track("cta_click", {}));
    } else {
      // 配布先URLが未設定のうちは、押しても何も起きないボタンを見せない
      // （config.js の cta.href を設定すると自動的に表示される）
      const ctaCard = ctaBtn.closest(".cta");
      if (ctaCard) {
        /** @type {HTMLElement} */ (ctaCard).hidden = true;
      } else {
        ctaBtn.hidden = true;
      }
    }
  }

  setupGuessButtons();
  restoreGuessed(); // 「わからない」で入れた値かどうかも復元する
  renumberSections();
  setupAdClickTracking();
});
}

/* ===== Nodeからのテスト用エクスポート（ブラウザでは module 未定義のため無視される） ===== */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CATEGORIES,
    diagnose,
    hh,
    excess,
    clampSave,
    housingMult,
    gasBenchmark,
    mobileBenchmark,
    buildNote,
    yen,
    roundedYen,
    shouldShowAd,
  };
}
