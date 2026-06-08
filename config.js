"use strict";

/**
 * ▼▼▼ 公開前に、この1ファイルだけ編集すればOK ▼▼▼
 *
 * 固定費削減診断ツールの設定（リンク・計測ID）をまとめています。
 * URL は取得したものを "" の中に貼り付けてください。
 * 空欄（""）のままなら、その導線は自動的に非表示になります（崩れません）。
 *
 * どのASP・どの案件に登録すればよいかは MONETIZATION.md を参照してください。
 */
window.SITE_CONFIG = {
  // Google Analytics 4 の測定ID（例: "G-ABCDE12345"）。未設定なら計測しません。
  gaMeasurementId: "G-XXXXXXXXXX",

  // 有料PDF / チェックリストの販売ページURL（note・Tips など）
  cta: {
    label: "【家計の保健室】固定費見直し完全チェックリスト（PDF）を受け取る",
    href: "", // 例: "https://note.com/xxxx/n/xxxxxxxx"
  },

  // 各カテゴリのアフィリエイトリンク（取得したURLを href に貼るだけ）
  // ラベルは自由に変更可。href が空ならそのボタンは表示されません。
  affiliates: {
    housing: { label: "住宅ローンの借り換えメリットを試算する", href: "" },
    mobile: { label: "格安SIMのプランを比較する", href: "" },
    electricity: { label: "電気・ガス料金を比較する", href: "" },
    gas: { label: "ガス会社を比較・相見積もりする", href: "" },
    insurance: { label: "保険の無料相談を予約する", href: "" },
    car: { label: "自動車保険を一括見積もりする", href: "" },
  },
};
