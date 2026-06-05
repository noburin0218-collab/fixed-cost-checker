"use strict";

/**
 * 固定費削減診断ツール
 * - 完全クライアントサイド（入力はどこにも送信されません）
 * - 各カテゴリに「削減期待率(rate)」と「現実的な下限額(floor)」を設定し、
 *   削減余地 = min(入力額 * rate, max(入力額 - floor, 0)) で算出。
 * - 削減余地の大きい順に優先度を決定する。
 */

/** カテゴリ定義（id は index.html の input id と一致させる） */
const CATEGORIES = [
  {
    id: "mobile",
    name: "スマホ代",
    icon: "📱",
    rate: 0.6,       // 格安SIMで大幅減が見込める
    floor: 2000,     // これ以下は現実的に下げにくい
    advice:
      "月3,000円を超えるなら格安SIM・eSIMへの乗り換えが最も効果的です。家族割やセット割で実は割高になっているケースも多く、データ使用量を見直して必要なプランに変えるだけで大きく下がります。",
  },
  {
    id: "electricity",
    name: "電気代",
    icon: "💡",
    rate: 0.1,
    floor: 4000,
    advice:
      "電力会社・料金プランは自由に選べます。比較サイトで現在の使用量を入力し、より安いプランがないか確認しましょう。待機電力カットやアンペア数の見直しも地味に効きます。",
  },
  {
    id: "gas",
    name: "ガス代",
    icon: "🔥",
    rate: 0.1,
    floor: 3000,
    advice:
      "都市ガスは自由化されており会社の切り替えが可能です。プロパンガスの場合は割高なことが多く、複数業者の見積もり比較で下がる余地があります。電気とのセット割もチェックを。",
  },
  {
    id: "water",
    name: "水道代",
    icon: "🚰",
    rate: 0.05,
    floor: 2500,
    advice:
      "水道は会社を選べないため削減幅は小さめ。節水シャワーヘッドや食洗機の活用、お風呂の残り湯利用など使い方の工夫が中心になります。まずは現状維持でもOKな項目です。",
  },
  {
    id: "insurance",
    name: "保険料",
    icon: "🛡️",
    rate: 0.35,
    floor: 3000,
    advice:
      "子育て世帯で保障が手厚すぎて割高になっているケースが非常に多い項目です。公的保障（遺族年金・高額療養費）でカバーできる部分を把握し、掛け捨て中心に組み替えると大きく下がります。無料相談の活用も有効です。",
  },
  {
    id: "subscription",
    name: "サブスク代",
    icon: "🎬",
    rate: 0.5,
    floor: 0,
    advice:
      "使っていない・重複している動画/音楽/アプリのサブスクが眠っていないか棚卸しを。年払いへの切り替えや無料プランで足りるものへの変更も検討しましょう。",
  },
  {
    id: "car",
    name: "車関連費",
    icon: "🚗",
    rate: 0.2,
    floor: 5000,
    advice:
      "自動車保険の等級・補償内容の見直し、ガソリンカードの活用、駐車場の相見積もりが効きます。利用頻度が低いならカーシェアやレンタカーへの切り替えも選択肢です。",
  },
  {
    id: "waterserver",
    name: "ウォーターサーバー代",
    icon: "💧",
    rate: 0.9,
    floor: 0,
    advice:
      "費用対効果を感じにくければ解約候補の筆頭です。浄水器やブリタ等のポット型に替えるだけで月数千円が浮きます。レンタル料・水ノルマ・電気代の合計で再評価しましょう。",
  },
  {
    id: "eatingout",
    name: "外食・コンビニ代",
    icon: "🍔",
    rate: 0.3,
    floor: 5000,
    advice:
      "コンビニの“ついで買い”と外食回数が膨らみやすいポイント。週の外食回数を1回減らす、まとめ買い＋作り置きに切り替えるだけで月単位の効果が出ます。",
  },
  {
    id: "other",
    name: "その他の固定費",
    icon: "📦",
    rate: 0.15,
    floor: 0,
    advice:
      "ジム・習い事・各種会費・有料アプリなど“なんとなく続いている”支出を棚卸し。利用頻度に見合っているか1つずつ確認すると、不要な定額課金が見つかります。",
  },
];

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

/** 診断を実行して結果オブジェクトを返す */
function diagnose() {
  const items = CATEGORIES.map((cat) => {
    const input = readValue(cat.id);
    const byRate = input * cat.rate;
    const byFloor = Math.max(input - cat.floor, 0);
    const saving = Math.min(byRate, byFloor);
    return { ...cat, input, saving };
  });

  const totalInput = items.reduce((s, i) => s + i.input, 0);
  const monthlySaving = items.reduce((s, i) => s + i.saving, 0);

  return {
    items,
    totalInput,
    monthlySaving,
    yearlySaving: monthlySaving * 12,
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

/** 結果を画面に描画 */
function render(result) {
  // サマリー
  document.getElementById("monthly-saving").textContent = yen(result.monthlySaving);
  document.getElementById("yearly-saving").textContent = yen(result.yearlySaving);
  document.getElementById("total-line").textContent =
    `現在の固定費合計：月 ${yen(result.totalInput)}（年 ${yen(result.totalInput * 12)}）`;

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
      li.innerHTML =
        `<span class="top3__name">${i.icon} ${i.name}</span> ` +
        `<span class="top3__saving">月 約${yen(i.saving)}</span>` +
        `<p class="top3__desc">年間で約${yen(i.saving * 12)}の削減が見込めます。</p>`;
      top3List.appendChild(li);
    });
  }

  // 全項目アドバイス（入力があるものを削減余地順に表示）
  const adviceList = document.getElementById("advice-list");
  adviceList.innerHTML = "";
  const adviceItems = ranked.filter((i) => i.input > 0);
  const toShow = adviceItems.length > 0 ? adviceItems : CATEGORIES;
  toShow.forEach((i) => {
    const div = document.createElement("div");
    div.className = "advice";
    const savingTag =
      i.saving > 0 ? `<span class="advice__saving">削減目安 月${yen(i.saving)}</span>` : "";
    div.innerHTML =
      `<div class="advice__head"><span class="advice__name">${i.icon} ${i.name}</span>${savingTag}</div>` +
      `<p class="advice__text">${i.advice}</p>`;
    adviceList.appendChild(div);
  });

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

  // CTA
  document.getElementById("cta-lead").textContent = buildCtaLead(result.yearlySaving);

  // 表示＆スクロール
  const resultSection = document.getElementById("result");
  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** 初期化 */
document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const form = document.getElementById("cost-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    render(diagnose());
  });

  const resetBtn = document.getElementById("reset-btn");
  resetBtn.addEventListener("click", () => {
    form.reset();
    document.getElementById("result").hidden = true;
    document.getElementById("form").scrollIntoView({ behavior: "smooth" });
  });
});
