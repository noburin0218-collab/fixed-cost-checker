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
 * カテゴリ定義（id は index.html の input id と一致させる）
 * - benchmark(ctx): 月額の目安（円）。ctx = { n: 世帯人数, carrier: 'carrier'|'mvno' }
 * - scaled: true なら目安が世帯人数に応じて変わる（表示に「N人世帯の目安」を付ける）
 * - saving(input, ctx): 削減余地（円/月）
 */
const CATEGORIES = [
  {
    id: "housing",
    name: "住宅費（家賃・ローン）",
    icon: "🏠",
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
    icon: "📱",
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
    id: "electricity",
    name: "電気代",
    icon: "💡",
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
    icon: "🔥",
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
    icon: "🚰",
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
    icon: "🛡️",
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
    icon: "🎬",
    benchmark: () => 2000,
    saving: (input) =>
      clampSave(excess(input, 2000) * 0.5 + Math.min(input, 2000) * 0.1, input),
    advice:
      "使っていない・重複している動画/音楽/アプリのサブスクが眠っていないか棚卸しを。年払いへの切り替えや無料プランで足りるものへの変更も検討しましょう。",
  },
  {
    id: "car",
    name: "車関連費",
    icon: "🚗",
    benchmark: () => 18000,
    saving: (input) =>
      clampSave(excess(input, 18000) * 0.2 + Math.min(input, 18000) * 0.08, input),
    advice:
      "自動車保険の等級・補償内容の見直し、ガソリンカードの活用、駐車場の相見積もりが効きます。利用頻度が低いならカーシェアやレンタカーへの切り替えも選択肢です。",
  },
  {
    id: "waterserver",
    name: "ウォーターサーバー代",
    icon: "💧",
    benchmark: () => 0, // この費目自体が見直し候補
    saving: (input) => clampSave(input * 0.9, input),
    advice:
      "費用対効果を感じにくければ解約候補の筆頭です。浄水器やブリタ等のポット型に替えるだけで月数千円が浮きます。レンタル料・水ノルマ・電気代の合計で再評価しましょう。",
  },
  {
    id: "eatingout",
    name: "外食・コンビニ代",
    icon: "🍔",
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
    icon: "📦",
    benchmark: () => 3000,
    saving: (input) => clampSave(excess(input, 3000) * 0.3, input),
    advice:
      "ジム・習い事・各種会費・有料アプリなど“なんとなく続いている”支出を棚卸し。利用頻度に見合っているか1つずつ確認すると、不要な定額課金が見つかります。",
  },
];

/** ブラウザ保存用キー */
const STORAGE_KEY = "fixedCostChecker.inputs.v1";

/** 直近の診断結果（画像生成で参照） */
let lastResult = null;

/** GA等のイベント送信（未設定なら何もしない） */
function track(eventName, params) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params || {});
  }
}

/** 数値を「12,345円」形式に整形 */
function yen(n) {
  return Math.round(n).toLocaleString("ja-JP") + "円";
}

/** 入力値を取得（空欄やマイナス・非数は0） */
function readValue(id) {
  const el = document.getElementById(id);
  const v = Number(el && el.value);
  if (!isFinite(v) || v < 0) return 0;
  return v;
}

/** 世帯人数を取得（1〜6、未選択は3） */
function readHousehold() {
  const el = document.getElementById("household");
  const v = el ? parseInt(el.value, 10) : NaN;
  return isFinite(v) && v >= 1 ? v : 3;
}

/** スマホ契約形態を取得（'carrier' | 'mvno'、既定は大手キャリア） */
function readMobileType() {
  const checked = document.querySelector('input[name="mobile-type"]:checked');
  return checked && checked.value === "mvno" ? "mvno" : "carrier";
}

/** select の値を取得（未選択は ""） */
function readSelect(id) {
  const el = document.getElementById(id);
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
  };
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
    return { ...cat, input, benchmark, saving, note };
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
    return `診断の結果、あなたの家計には年間 約${yen(yearly)} の削減余地があります。これは「やるかどうか」だけの差。次は実際に手続きを完了させる番です。`;
  }
  if (yearly > 0) {
    return `年間 約${yen(yearly)} の削減余地が見つかりました。金額の大小よりも、ここで止まらず行動に移せるかが家計改善の分かれ道です。`;
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
      const el = document.getElementById(cat.id);
      if (el && data[cat.id] > 0) el.value = data[cat.id];
    });
    const setSelect = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null && val !== "") el.value = String(val);
    };
    setSelect("household", data._household);
    setSelect("housing-type", data._housing);
    setSelect("gas-type", data._gasType);
    setSelect("mobile-lines", data._lines);
    setSelect("insurance-type", data._insType);
    setSelect("housing-tenure", data._tenure);
    if (data._mobileType) {
      const radio = document.querySelector(
        `input[name="mobile-type"][value="${data._mobileType}"]`
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
  } catch (e) {
    /* 無視 */
  }
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
  ctx.fillText(yen(lastResult.monthlySaving), cx, 390);

  // 年間
  ctx.fillStyle = "#6b7280";
  ctx.font = "bold 38px sans-serif";
  ctx.fillText("年間の削減可能額の目安", cx, 500);
  ctx.fillStyle = "#ff7a45";
  ctx.font = "bold 100px sans-serif";
  ctx.fillText(yen(lastResult.yearlySaving), cx, 600);

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
        `${idx + 1}. ${i.name}（月 約${yen(i.saving)}）`,
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
      ? `「家計の保健室」の無料診断をやってみたら、年間 約${yen(yearly)} の削減余地が見つかった！登録不要で30秒👇`
      : `「家計の保健室」の無料診断で家計をチェック！登録不要で30秒👇`;

  const xUrl =
    "https://twitter.com/intent/tweet?text=" +
    encodeURIComponent(text) +
    "&url=" +
    encodeURIComponent(url);
  const lineUrl =
    "https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent(url);

  document.getElementById("share-x").href = xUrl;
  document.getElementById("share-line").href = lineUrl;

  document.getElementById("share-x").onclick = () => track("share", { method: "x" });
  document.getElementById("share-line").onclick = () => track("share", { method: "line" });

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
  document.getElementById("monthly-saving").textContent = yen(result.monthlySaving);
  document.getElementById("yearly-saving").textContent = yen(result.yearlySaving);
  const carrierLabel = result.ctx.carrier === "mvno" ? "格安SIM中心" : "大手キャリア中心";
  document.getElementById("total-line").innerHTML =
    `${result.ctx.n}人世帯・${carrierLabel}で診断／現在の支出合計：月 ${yen(result.totalInput)}（年 ${yen(result.totalInput * 12)}）` +
    `<br><span class="split">└ 固定費 月${yen(result.fixedInput)}（削減余地 ${yen(result.fixedSaving)}）／変動費 月${yen(result.variableInput)}（同 ${yen(result.variableSaving)}）</span>`;

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
        ? `${i.note}。年間で約${yen(i.saving * 12)}の削減が見込めます。`
        : `年間で約${yen(i.saving * 12)}の削減が見込めます。`;
      li.innerHTML =
        `<span class="top3__name">${i.icon} ${i.name}</span> ` +
        `<span class="top3__saving">月 約${yen(i.saving)}</span>` +
        `<p class="top3__desc">${desc}</p>`;
      top3List.appendChild(li);
    });
  }

  // 全項目アドバイス（入力があるものを削減余地順に表示。固定費／変動費で分ける）
  const adviceList = document.getElementById("advice-list");
  adviceList.innerHTML = "";
  const adviceItems = ranked.filter((i) => i.input > 0);
  const toShow = adviceItems.length > 0 ? adviceItems : CATEGORIES;

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
      i.saving > 0 ? `<span class="advice__saving">削減目安 月${yen(i.saving)}</span>` : "";
    // 目安との比較メモ
    const note = i.note ? `<p class="advice__note">${i.note}</p>` : "";
    // アフィリエイトリンクは config.js で href が設定されている項目のみ表示
    const cfg =
      (window.SITE_CONFIG &&
        window.SITE_CONFIG.affiliates &&
        window.SITE_CONFIG.affiliates[i.id]) ||
      null;
    // 住宅ローン借り換えリンクは「持ち家ローン返済中」の人だけに表示
    const affOk = i.id === "housing" ? result.ctx.tenure === "own_loan" : true;
    const aff =
      affOk && cfg && cfg.href
        ? `<a class="advice__link" href="${cfg.href}" target="_blank" rel="noopener sponsored">${cfg.label || "くわしく見る"} ›</a>`
        : "";
    div.innerHTML =
      `<div class="advice__head"><span class="advice__name">${i.icon} ${i.name}</span>${savingTag}</div>` +
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

  // 表示＆スクロール
  const resultSection = document.getElementById("result");
  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** 初期化（ブラウザでのみ実行。Nodeからのrequire時はDOM処理をスキップ） */
if (typeof document !== "undefined") {
document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 前回の入力があれば復元
  restoreInputs();

  const form = document.getElementById("cost-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const result = diagnose();
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
    document.getElementById("result").hidden = true;
    document.getElementById("form").scrollIntoView({ behavior: "smooth" });
  });

  const ctaBtn = document.getElementById("cta-btn");
  if (ctaBtn) {
    const ctaCfg = (window.SITE_CONFIG && window.SITE_CONFIG.cta) || {};
    if (ctaCfg.label) ctaBtn.textContent = ctaCfg.label;
    if (ctaCfg.href) ctaBtn.href = ctaCfg.href; // 未設定なら "#" のまま
    ctaBtn.addEventListener("click", () => track("cta_click", {}));
  }
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
  };
}
