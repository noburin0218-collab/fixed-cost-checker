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
  // ※2026/06現在、Googleアカウント無効化のためGA4は利用不可。当面は空のままでOK
  //   （効果測定はASP管理画面のクリック数＋SNSの反応で代用。詳細は MONETIZATION.md 5節）。
  gaMeasurementId: "",

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
    internet: { label: "光回線を比較・乗り換える", href: "" },
    electricity: { label: "電気・ガス料金を比較する", href: "" },
    gas: { label: "ガス会社を比較・相見積もりする", href: "" },
    // 保険だけは世帯人数で出し分ける（family＝3人以上／default＝2人以下）。
    // impression はA8の表示計測用の1×1画像。素材のコードに含まれているものをそのまま指定。
    insurance: {
      family: {
        label: "妊娠〜出産〜子育て中の「ママ」のための保険無料相談サービス【ベビープラネット】",
        href: "https://px.a8.net/svt/ejp?a8mat=4B8B4S+EVU5ZU+503M+5YRHE",
        impression: "https://www18.a8.net/0.gif?a8mat=4B8B4S+EVU5ZU+503M+5YRHE",
      },
      default: {
        label: "保険の無料相談【保険ランドリー】",
        href: "https://px.a8.net/svt/ejp?a8mat=4B8DGR+3TJ6AI+3S2C+5ZEMQ",
        impression: "https://www11.a8.net/0.gif?a8mat=4B8DGR+3TJ6AI+3S2C+5ZEMQ",
      },
    },
    car: { label: "自動車保険を一括見積もりする", href: "" },
  },
};
