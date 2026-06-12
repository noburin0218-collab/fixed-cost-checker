# fixed-cost-checker（家計の保健室｜固定費＆家計見直し診断）

> 🔖 **作業を再開する人へ：まず [`RESUME.md`](./RESUME.md) を読むと、現状と次の一歩が30秒で分かります。**


30代子持ち会社員向けの固定費削減診断ツールです。
スマホ代・電気・ガス・保険・サブスクなど毎月の固定費を入力するだけで、
**月間／年間の削減可能額の目安**、**優先して見直すべき項目TOP3**、
**各項目の改善アドバイス**、**今日やるべきアクション3つ**を表示します。

- 完全クライアントサイド（HTML / CSS / JavaScript のみ）
- バックエンド・ログイン・データ保存なし（入力値は**どこにも送信されません**）
- スマホ最適化のレスポンシブデザイン
- GitHub Pages でそのまま公開可能

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面構成（ヒーロー／入力フォーム／結果／CTA／フッター） |
| `styles.css` | デザイン（モバイルファースト） |
| `script.js` | 診断ロジック・結果描画 |
| `config.js` | **公開前に編集する設定ファイル**（計測ID・各リンク） |
| `SETUP.md` | **公開までの完全手順書**（まずこれを上から実行） |
| `MONETIZATION.md` | 収益化ガイド（ASP・案件の選び方、`config.js` の埋め方） |
| `MARKETING.md` | 集客・需要検証ガイド（SNS投稿文・アカウント設定・7日検証） |
| `note_article.md` | note販売記事のコピペ用ドラフト |
| `favicon.*` / `apple-touch-icon.png` | サイトのアイコン |

## 診断ロジック（精度のしくみ）

一律の削減率を掛けるだけの単純計算ではなく、**世帯人数・スマホ契約形態を踏まえた目安額（ベンチマーク）との比較**で削減余地を算出します。

- 入力前に「世帯人数」と「スマホの契約（大手キャリア / 格安SIM）」を選択
- 電気・ガス・水道・外食などは**世帯人数別の目安額**と比較し、`目安超過分 × 現実的に削れる割合 ＋ 目安内でも乗り換え等で下がる分` で算出
- スマホは契約形態で目安額と削減率を変更（大手キャリアは格安SIM乗り換えで大きく減）
- 各項目に「◯人世帯の目安 ◯円／あなた ◯円 → 高め・適正・低め」の比較を表示
- 算出額は入力額の80%を上限にクランプ（非現実的な数値を防止）

### 手軽さ × 精緻さ（任意の詳細診断）

デフォルトは最小入力の「30秒診断」。フォームの **「⚙️ もっと詳しく診断する（任意・選ぶだけ）」** を開くと、
入力ではなく**選択するだけ**で精度が上がります（未選択ならデフォルト挙動のまま）。

| 選択項目 | 効果 |
|---|---|
| 🏠 住居タイプ（戸建て / 集合） | 電気・ガス・水道の目安を補正（戸建ては高め） |
| 🔥 ガスの種類（都市 / プロパン / なし） | プロパンは下げ余地を大きく評価。「なし」は除外 |
| 📱 スマホ回線数（1〜5） | 「1回線あたりの目安 × 回線数」でスマホ目安を精緻化 |

> 数値はあくまで一般的な相場をもとにした目安です。

## ローカルで確認する

`index.html` をブラウザで開くだけで動作します。
（簡易サーバーで確認する場合）

```bash
python3 -m http.server 8000
# http://localhost:8000 を開く
```

## 開発・テスト

Node.js 18+ で動きます。開発ツール（型チェック・DOMテスト）を使う場合のみ `npm ci` で devDependencies を入れてください。

```bash
npm ci          # 開発依存（typescript / jsdom）を入れる（テスト・型チェック用）
npm test        # テスト（node --test）：ロジック単体＋diagnose統合＋render DOM
npm run check   # 構文チェック（node --check）
npm run typecheck # 型チェック（tsc --noEmit／checkJs）
npm run serve   # ローカルサーバ（python3 -m http.server 8000）
```

- テスト本体：
  - `tests/diagnose.test.js`（純粋関数の単体テスト・依存なし）
  - `tests/diagnose.integration.test.js`（`diagnose()` の集計をフェイクDOMで検証）
  - `tests/render.dom.test.js`（jsdom で `index.html`＋`script.js` を実行し、送信→結果生成を検証）
- 型チェックは `// @ts-check` 相当（`tsconfig.json` の `checkJs`）。カスタムグローバルは `types/globals.d.ts`。
- `script.js` はブラウザでは従来どおり動作し、Nodeから `require` した際は DOM 処理をスキップしてロジックのみ公開します（末尾の `module.exports`）。
- CI：`.github/workflows/test.yml` が push / PR ごとに `check`／`typecheck`／`test` を自動実行します。

## 公開（ホスティング）

**本番の公開先は Cloudflare Pages（無料・匿名・ブランドURL）を推奨**：`https://kakei-hokenshitsu.pages.dev/`
→ 手順は [`HOSTING_CLOUDFLARE.md`](./HOSTING_CLOUDFLARE.md)。

以下の GitHub Pages はソース／予備としてそのまま使えます（公開URLに本名系のユーザー名が出る点に注意）。

## GitHub Pages で公開する（予備）

### 方法A：GitHub Actions で自動デプロイ（推奨・設定不要）

`.github/workflows/deploy-pages.yml` を同梱しています。
ワークフローが Pages を自動で有効化（`enablement: true`）するため、**Settings での手動操作は不要**です。
`main` への push のたびに自動で公開されます。

> 組織のポリシー等で自動有効化が拒否される場合のみ、**Settings → Pages → Source** を `GitHub Actions` に設定してください。

### 方法B：ブランチから直接公開

1. **Settings → Pages** を開く
2. **Source** を `Deploy from a branch` に設定
3. **Branch** を `main` ／フォルダを `/ (root)` にして保存

いずれの方法でも、数分後に `https://<ユーザー名>.github.io/fixed-cost-checker/` で公開されます。

> このリポジトリは `index.html` がルート直下にあるため、追加設定なしで公開できます。

## 収益化導線のカスタマイズ（`config.js` だけ編集すればOK）

リンク・計測IDはすべて **`config.js` の1ファイルに集約**しています。公開前にここだけ編集してください。

- `cta.href` → 有料PDF／チェックリストの販売URL（note・Tips など）
- `affiliates.*.href` → 各カテゴリ（スマホ／電気／ガス／保険／車）のアフィリエイトリンク
- `gaMeasurementId` → Google Analytics 4 の測定ID

`href` を設定した項目だけ、診断結果にボタンが表示されます（空欄なら非表示でレイアウトも崩れません）。
**どのASPのどの案件に登録すればよいか・具体的な貼り方は [`MONETIZATION.md`](./MONETIZATION.md) を参照してください。**

## シェア機能・画像保存

診断結果に X・LINE・URLコピー・**結果を画像で保存**のボタンを設置済みです。
- ツイート文には診断で出た「年間削減額」が自動で入り、拡散による集客につながります。
- 「結果を画像で保存」は外部ライブラリ不要（Canvasで描画）。対応端末ではネイティブ共有（画像添付）、非対応ならPNGダウンロードになります。

## アクセス計測（Google Analytics 4）

`config.js` の `gaMeasurementId` にご自身の測定IDを設定するだけで計測が有効になります（未設定のままならタグは読み込まれません）。
診断実行（`diagnose`）・シェア（`share`）・画像保存（`share_image`）・CTAクリック（`cta_click`）のカスタムイベントを自動送信します。

## 入力のブラウザ保存

診断ボタンを押すと入力値がブラウザ（localStorage）に保存され、次回アクセス時に自動復元されます。
**保存は端末内のみで、サーバーには一切送信されません。**「入力をリセット」で保存も消去されます。

## 免責

診断結果は一般的な相場・統計をもとにした**目安**であり、削減額を保証するものではありません。
特定の金融商品・保険商品の売買や乗り換えを助言・推奨するものではありません。
