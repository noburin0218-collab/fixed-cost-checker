"use strict";

/**
 * ▼▼▼ 公開前に、この1ファイルだけ編集すればOK ▼▼▼
 *
 * 固定費削減診断ツールの設定（広告リンク・計測ID）をまとめています。
 *
 * ■ 広告リンクの書き方（重要）
 *   ASPが発行した広告コードは **一切改変せずそのまま** `code` に貼り付けてください。
 *   URLだけを抜き出したり、アンカーテキストや img タグを書き換えたりしないこと
 *   （ASPの規約違反となり、成果否認・提携解除の対象になります）。
 *
 *   見出し（heading）と説明文（body）はサイト側で自由に書けます。
 *   広告コードは、その見出し・説明のすぐ下にそのまま配置されます。
 *
 *   {
 *     heading: "サイト側で書く見出し",
 *     body: "サイト側で書く説明文",
 *     code: `ASPが発行したコードをそのまま貼る`,
 *   }
 *
 *   `code` が空のカテゴリは、その導線ごと非表示になります（レイアウトは崩れません）。
 *
 * どのASP・どの案件を使うかは MONETIZATION.md / AFFILIATE_BACKLOG.md を参照してください。
 */
window.SITE_CONFIG = {
  // アクセス解析（GoatCounter）の集計先URL。空にすると計測しません。
  // Googleアカウント不要・クッキー不要の解析です。
  // ※ 送るのは「ページの閲覧」と「診断した・共有した」等のイベント名だけで、
  //   入力された金額や削減額は送りません。
  goatCounterEndpoint: "https://kakei-hokenshitsu.goatcounter.com/count",

  // Google Analytics 4 の測定ID（例: "G-ABCDE12345"）。未設定なら計測しません。
  gaMeasurementId: "",

  // 有料PDF / チェックリストの販売ページURL（note・Tips など）
  cta: {
    label: "【家計の保健室】固定費見直し完全チェックリスト（PDF）を受け取る",
    href: "", // 例: "https://note.com/xxxx/n/xxxxxxxx"
  },

  // 診断結果の各項目に出す広告。code はASP発行コードをそのまま貼る。
  affiliates: {
    housing: {
      heading: "住宅ローンは、残高が多いほど見直しの効果が大きい費目です",
      body: "借り換えの試算は無料でできます。残高・残期間・金利差の条件しだいで総返済額が変わります。",
      code: "", // 未提携
    },

    mobile: {
      heading: "スマホ代は、乗り換えの手続きが軽いわりに効果が続きます",
      body: "使っているデータ量に合うプランへ変えるだけで、毎月の負担が下がることがあります。",
      code: `<a href="https://px.a8.net/svt/ejp?a8mat=4BA0X8+462SA+3UM0+5YRHE" rel="nofollow">格安SIMなら【ＬＩＢＭＯ】</a>
<img border="0" width="1" height="1" src="https://www11.a8.net/0.gif?a8mat=4BA0X8+462SA+3UM0+5YRHE" alt="">`,
    },

    internet: {
      heading: "ネット回線は、乗り換えの特典で実質の負担が下がることがあります",
      body: "まずは使っていないオプションの有無と、住んでいる建物で選べるプランを確認してください。",
      code: `<a href="https://px.a8.net/svt/ejp?a8mat=4BA0X8+LFNBU+4VXM+60OXE" rel="nofollow">次世代接続方式v6プラス利用可能光回線【イツキ光】</a>
<img border="0" width="1" height="1" src="https://www14.a8.net/0.gif?a8mat=4BA0X8+LFNBU+4VXM+60OXE" alt="">`,
    },

    electricity: {
      heading: "電力会社とプランは、自由に選べます",
      body: "検針票の使用量を入力して比較するだけです。切り替えても電気の品質は変わりません。",
      code: `<a href="https://px.a8.net/svt/ejp?a8mat=4BA0X8+SKUL6+3SPO+TS3OI" rel="nofollow">電気料金プランを比較して電気代を今よりお安く！【電気チョイス】</a>
<img border="0" width="1" height="1" src="https://www16.a8.net/0.gif?a8mat=4BA0X8+SKUL6+3SPO+TS3OI" alt="">`,
    },

    gas: {
      heading: "プロパンガスは会社ごとの料金差が大きい費目です",
      body: "自由料金のため、比較・相見積もりで下がる余地が残っていることがあります。",
      code: `<a href="https://px.a8.net/svt/ejp?a8mat=4BA0X8+UYL0A+2W92+NVHCY" rel="nofollow">プロパンガス料金を比較し、最適なガス会社を選ぼう！【エネピ】</a>
<img border="0" width="1" height="1" src="https://www17.a8.net/0.gif?a8mat=4BA0X8+UYL0A+2W92+NVHCY" alt="">`,
    },

    // 保険は「保険マンモス」を主CTAとする。
    // 世帯人数などの属性による出し分けは、CVR・承認率の実績が貯まるまで行わない。
    insurance: {
      heading: "保険は「入りすぎ」も「不足」も、見直さないと分かりません",
      body: "公的保障でカバーできる範囲を踏まえて、必要な保障だけに整えるのが基本です。無料で相談できます。",
      code: `<a href="https://h.accesstrade.net/sp/cc?rk=010039sr00owy6" rel="nofollow" referrerpolicy="no-referrer-when-downgrade">無料保険相談<img src="https://h.accesstrade.net/sp/rr?rk=010039sr00owy6" width="1" height="1" border="0" alt=""></a>`,
    },

    car: {
      heading: "自動車保険は、同じ補償でも会社によって保険料が変わります",
      body: "更新月に一括見積もりを取る、と決めておくだけで見直しが習慣になります。",
      code: "", // 未提携
    },
  },

  // 貯蓄の相談（保険とは別導線）。
  // 「貯蓄できていない」という回答だけでは出さず、診断結果とあわせて判定します。
  savingsAdvisor: {
    heading: "固定費を削ったあと、その分をどう残すか",
    body: "貯蓄は「余ったら貯める」では貯まりません。先取りの仕組みづくりや、教育費・老後資金の見通しは無料で相談できます。",
    code: `<a href="https://h.accesstrade.net/sp/cc?rk=0100pedo00owy6" rel="nofollow" referrerpolicy="no-referrer-when-downgrade">貯蓄の無料相談サイト「ガーデン」<img src="https://h.accesstrade.net/sp/rr?rk=0100pedo00owy6" width="1" height="1" border="0" alt=""></a>`,
  },
};
