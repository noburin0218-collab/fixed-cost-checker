# 公開までの完全手順書（家計の保健室）

「あとは貼るだけ／出すだけ」で収益化に進めるよう、作業を一本道にまとめました。
上から順にやればOK。所要：初回まとめて約2〜3時間（審査待ちを除く）。

公開先（予定）：https://kakei-hokenshitsu.pages.dev/ （Cloudflare Pages・無料・匿名）

---

## STEP 0｜公開先を Cloudflare Pages に移す（匿名・無料）
匿名性とブランドのため、公開URLを `kakei-hokenshitsu.pages.dev` にします。**手順は [`HOSTING_CLOUDFLARE.md`](./HOSTING_CLOUDFLARE.md) を参照。**
- 本名と無関係の新メールで Cloudflare に登録 → このリポジトリを接続（または直接アップロード）
- プロジェクト名を **`kakei-hokenshitsu`** にすると、URLが上記とピッタリ一致します
- ※ 既存の GitHub Pages（`*.github.io`）はソース/予備として残してOK。本名が出るのが気になれば、後でリポジトリを非公開化できます

> リポジトリを編集 → コミットすれば、Cloudflare（Git接続時）が自動で再公開します。

---

## STEP 1｜匿名アカウントを作る（30〜60分）

### 1-0. 土台＝専用メール（⚠️ Gmailは避ける／非Googleを推奨）
すべての起点。本名・現職・既存メールに紐づかない**専用メール**を1つ用意する。
- ⚠️ **新規Gmailは Google の bot検知で無効化されやすい**（実際に一度 `kakei.hokenshitsu@gmail.com` が「bot/大量作成の疑い」で無効化された）。
- → **Proton Mail / Outlook / iCloud（Hide My Email）など非Googleの安定メール**を推奨。これを note・X・Cloudflare・ASP の受け皿にする。
- どうしてもGoogleを使う場合は、**自宅/モバイル回線・通常ブラウザ・短時間に複数作らない・電話番号認証・作成後しばらく普通に使う**と無効化されにくい。
> Google Drive / GA4 は Google アカウント必須だが、**配布は後述のとおり代替可、解析は Cloudflare Web Analytics で代替**するため必須ではない。

### 1-1. 各サービスを作る（同じ専用メールで）
| サービス | 作り方の要点 |
|---|---|
| **note** | 専用メールで登録。クリエイター名＝「家計の保健室」。本名・顔写真は不要 |
| **X（旧Twitter）** | 同メールで登録。表示名・@は `MARKETING.md` の案。SMS認証を求められることあり（番号は公開されない） |
| **Threads** | Instagramアカウントが必須。先にIGを匿名で作る→Threadsを開設 |
| **Cloudflare** | 同メールで登録（公開ホスト。`HOSTING_CLOUDFLARE.md`）。**※既にこのGmailで作成済みなら、ログインできるうちにメール＆パスワードを変更しておく** |
| **無料PDFの配布先** | Google Drive でなくてもOK（後述。Cloudflare R2 / Dropbox / GitHub の raw 等でも可） |
| **ASP（A8.net等）** | サイトURLで登録（STEP3）。報酬の受取口座は本人名義が必要（非公開） |

プロフィール文・固定ポスト・ハンドル案は `MARKETING.md` の「3.5 アカウント初期設定」からコピペ。
アイコンは当面 `apple-touch-icon.png`（緑の¥アイコン）を流用可。

### 1-2. 匿名運用の鉄則
- 顔・本名・勤務先・地名・子の学校など**特定につながる情報を出さない**
- 投稿画像の**位置情報(Exif)**に注意（スクショ中心なら基本問題なし）
- 既存の知人アカと**相互フォロー・いいねしない**（足がつく典型）

### 1-3. お金まわり・副業禁止への配慮（重要）
- ASP/noteの**売上振込先は本人名義の口座**が必要（運営の“顔”は匿名のまま、振込情報は非公開）
- まず**就業規則**で副業可否・申請要否を確認
- 収入が出たら**確定申告**が必要になることがあり、住民税を**「普通徴収（自分で納付）」**にすると会社の給与天引きに乗らない、という運用が一般に知られている
- ※ 税務・労務の最終判断は**就業規則と税務署／専門家**へ。ここは断定しません

---

## STEP 2｜無料PDFを配布できる状態にする（15分）
1. 受け取った「固定費見直し かんたんチェック（無料版）.pdf」を**どこかにアップ**（Dropbox / Cloudflare R2 / Google Drive 等。Googleに依存したくなければDropbox等が手軽）
2. 「リンクを知っている全員が閲覧可」で共有リンクを取得
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

## STEP 4｜アクセス計測を有効化（5分・Googleアカウント不要）
**推奨：Cloudflare Web Analytics**（無料・Cookieなし・Googleアカウント不要・プライバシー配慮）
1. Cloudflare ダッシュボード → **Analytics & Logs → Web Analytics**
2. 対象に Pages プロジェクト `kakei-hokenshitsu` を選ぶ（Pagesなら**コード変更不要**でビーコンが自動挿入される）
3. 数時間後から、訪問数・流入元・人気ページが見られる

> 補足：GA4を使いたい場合のみ、`config.js` の `gaMeasurementId` に測定IDを入れると `diagnose`/`share`/`cta_click` のイベントも取れる（任意）。ただしGA4はGoogleアカウントが必要なので、当面はCloudflare Web Analyticsで十分。

---

## STEP 5｜有料PDFをnoteで販売（30分）
1. note で新規記事を作成
2. 見出し画像に `note_eyecatch.png`
3. 本文は `note_article.md` をコピペ（無料エリアに `note_preview.png` を挿入）
4. 価格を 500〜980円に設定し、有料エリアに「有料PDFのダウンロードリンク（Dropbox/Drive等）」を貼る
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
