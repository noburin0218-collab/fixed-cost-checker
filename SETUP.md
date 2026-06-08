# 公開までの完全手順書（家計の保健室）

「あとは貼るだけ／出すだけ」で収益化に進めるよう、作業を一本道にまとめました。
上から順にやればOK。所要：初回まとめて約2〜3時間（審査待ちを除く）。

サイト：https://noburin0218-collab.github.io/fixed-cost-checker/

---

## STEP 0｜サイトはもう公開済み
GitHub Pages で自動公開・自動デプロイ済み。`main` に変更が入るたび自動で反映されます。
（このリポジトリを編集 → コミットすればOK。ブラウザ上のGitHubでファイルを直接編集してもOK）

---

## STEP 1｜匿名アカウントを作る（30分）
- X（旧Twitter）と Threads を、本名・現職に紐づかないメールで新規作成
- プロフィール文・固定ポストは `MARKETING.md` の「アカウント初期設定」からコピペ
- アイコンは当面 `apple-touch-icon.png`（緑の¥アイコン）を流用可

---

## STEP 2｜無料PDFを配布できる状態にする（15分）
1. 受け取った「固定費見直し かんたんチェック（無料版）.pdf」を Google Drive にアップ
2. 「リンクを知っている全員が閲覧可」に設定し、共有リンクを取得
3. そのリンクを `MARKETING.md` 投稿文⑩の「（配布リンク）」に差し込む

---

## STEP 3｜収益の蛇口：ASP登録とリンク貼り（審査待ちあり）
詳しい案件選びは `MONETIZATION.md`。ここでは **config.js のどこに貼るか** を示します。

### 3-1. まず登録（無料）
A8.net（必須）／もしもアフィリエイト／バリューコマース のいずれか。サイトURLは上記。

### 3-2. 提携して「広告リンク（テキストリンク）」のURLを取得
おすすめ優先順（報酬が大きい順）：
1. 保険の無料相談
2. 住宅ローン 借り換え（モゲチェック等）
3. 自動車保険 一括見積もり
4. 格安SIM ／ 5. 電気・ガス比較

### 3-3. `config.js` を編集（該当行に貼るだけ）
`config.js` の `affiliates` 内、各行の `href: ""` の **""の中** に貼ります。

```js
// 変更前
affiliates: {
  housing:     { label: "住宅ローンの借り換えメリットを試算する", href: "" },
  mobile:      { label: "格安SIMのプランを比較する",          href: "" },
  electricity: { label: "電気・ガス料金を比較する",            href: "" },
  gas:         { label: "ガス会社を比較・相見積もりする",      href: "" },
  insurance:   { label: "保険の無料相談を予約する",            href: "" },
  car:         { label: "自動車保険を一括見積もりする",        href: "" },
},

// 変更後（例：取得できたものだけ貼ればOK。空欄はボタン非表示）
affiliates: {
  housing:     { label: "住宅ローンの借り換えメリットを試算する", href: "https://px.a8.net/svt/ejp?a8mat=XXXX" },
  mobile:      { label: "格安SIMのプランを比較する",          href: "" },
  electricity: { label: "電気・ガス料金を比較する",            href: "" },
  gas:         { label: "ガス会社を比較・相見積もりする",      href: "" },
  insurance:   { label: "保険の無料相談を予約する",            href: "https://px.a8.net/svt/ejp?a8mat=YYYY" },
  car:         { label: "自動車保険を一括見積もりする",        href: "" },
},
```

> ポイント：**取得できたものから順に貼ればOK**。空欄の項目は結果画面にボタンが出ません（崩れません）。
> 住宅ローンの借り換えボタンは「持ち家（ローン返済中）」を選んだ人にだけ表示されます。

---

## STEP 4｜アクセス計測を有効化（10分）
1. Google Analytics 4 でプロパティを作成し、測定ID（`G-XXXXXXXXXX`）を取得
2. `config.js` の先頭 `gaMeasurementId: "G-XXXXXXXXXX"` を自分のIDに置き換える
3. これで `diagnose`（診断完了）/ `share` / `cta_click` が自動計測されます

---

## STEP 5｜有料PDFをnoteで販売（30分）
1. note で新規記事を作成
2. 見出し画像に `note_eyecatch.png`
3. 本文は `note_article.md` をコピペ（無料エリアに `note_preview.png` を挿入）
4. 価格を 500〜980円に設定し、有料エリアに「有料PDFのダウンロードリンク（Drive）」を貼る
5. `config.js` の `cta.href` に、この note 記事のURLを貼る（ツール結果からの導線がつながる）

---

## STEP 6｜7日間の需要検証（毎日10分）
`MARKETING.md` の「7日間 需要検証プラン」に沿って投稿。7日後にGA4で判定：
- 訪問100＋／診断完了率30%＋／CTAクリック10%＋ なら「脈あり」
- 反応が偏ったテーマ（保険・住宅ローン等）を次の深掘り対象に

---

## 困ったときの早見表
| やりたいこと | 触るファイル |
|---|---|
| アフィリリンクを貼る | `config.js` の `affiliates` |
| 有料PDFの販売URL設定 | `config.js` の `cta.href` |
| アクセス計測を入れる | `config.js` の `gaMeasurementId` |
| 診断ロジック・項目の調整 | `script.js` |
| 見た目の調整 | `styles.css` |
| 文言・画面構成 | `index.html` |

> 変更後はコミットすれば数分で自動的に本番反映されます。
