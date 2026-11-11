# 収益化ガイド（アフィリエイト・有料PDFの導線設定）

このツールは「無料診断で集客 → 各項目のアフィリエイト＆有料PDFで収益化」する設計です。
広告枠は `config.js` の `affiliates` に設定します。記事枠と診断結果枠で表示場所・キーが異なるため、変更前に該当記事と `config.js` を確認してください。

> ⚠️ アフィリエイトリンクは**あなた自身のASPアカウントで発行される固有URL**です。
> 他人のリンクや汎用URLでは報酬が発生しません。各案件で発行した広告コードを
> `config.js` の該当枠の `code` に原文のまま貼り付けてください。

---

> 📋 **掲載を検討中の案件は [`AFFILIATE_BACKLOG.md`](./AFFILIATE_BACKLOG.md) にまとめています。**
> 別メディアで提携承認済みでも、A8はサイト単位で提携を管理するため、
> **家計の保健室名義での提携が確認できるまでリンクを設置しない**でください。

## 1. 提携・掲載の確認

ASP、案件、報酬条件、サイトごとの提携状態は変わります。最新情報は各ASPの管理画面で確認し、提携承認前は広告を掲載しないでください。候補は [`AFFILIATE_BACKLOG.md`](./AFFILIATE_BACKLOG.md) を参照してください。

---

## 2. 設定箇所（`config.js`）

ASP発行コードは `affiliates.<key>.code` に原文のまま設定します。コードのない枠は表示されません。設定時は `affiliateTracking` の対応slot・`merchant`・`affiliate_program` も確認し、`npm test` と `python3 tools/audit-site.py` で検証してください。

自動車保険・火災保険・都市ガスなどの未提携枠は、`RESUME.md` の「提携申請の状況」を参照してください。記事が読むキーと、`config.js` に定義済みのキーは同じではありません。

| config キー | 用途 |
|---|---|
| `internetNoConstruction`, `mobileChoice`, `electricityDirect` | 対応する個別記事内の広告枠 |
| `mobile`, `internet`, `electricity`, `gas`, `insurance`, `housing` | 診断結果の広告枠 |
| `car` | 診断結果専用の車関連費枠（自動車保険記事には表示されない） |
| `carInsurance` | 自動車保険記事専用。未定義・未提携。承認後に定義し、追跡slot `car-insurance` を登録 |
| `fireInsurance` | 火災保険記事専用。未定義・未提携。承認後に定義し、追跡slot `fire-insurance` を登録 |
| `cityGas` | 都市ガス記事専用。未定義・未提携。承認後に定義し、追跡slot `city-gas` を登録 |
| `mortgageRefinance` | 住宅ローン借り換え記事（未提携枠） |

> ※ 案件の有無・報酬額・提携可否はASP／時期により変わります。提携承認後にリンクを発行してください。
> ※ 金融商品（保険）の表現は景表法・薬機法ならぬ各種ガイドラインに注意。「必ず安くなる」等の断定は避ける（本ツールも免責を明記済み）。

---

## 3. 有料PDF / チェックリスト（自社デジタル商品）

`config.js` の `cta.href` に販売ページURLを設定します。

- **販売プラットフォーム**：note（記事＋有料エリア）、Tips、BOOTH など。匿名販売・低コストで開始可能。
- **商品例**：「固定費見直し完全チェックリスト（PDF）」「我が家の固定費シミュレーションテンプレ（スプレッドシート）」
- **価格帯**：まずは 0〜500円で実績作り → レビュー獲得後に値上げ。

---

## 4. 販売ページ設定（`config.js`）

```js
window.SITE_CONFIG.cta.href = "販売ページURL";
```

有料販売を決めた場合のみ `cta.href` を設定します。現在は自サイトで無料PDFを配布中です。

---

## 5. 効果測定（任意）

GoatCounterは稼働中、GA4は未設定です。Google Search Consoleも接続済みです。直近の実測と制約は [`revenue-review-2026-11-12.md`](./tools/growth/reports/revenue-review-2026-11-12.md) を参照してください。

`config.js` の `gaMeasurementId` は空欄のため、現在GA4イベントは送信されません。GoatCounterではページ閲覧とイベント名を計測します（フォームの金額・削減額は送信しません）。

- `diagnose`（診断実行）
- `share`（X / LINE / コピー）
- `share_image`（結果画像の保存・共有）
- `cta_click`（有料PDFボタンのクリック）
