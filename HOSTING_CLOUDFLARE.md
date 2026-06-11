# Cloudflare Pages へ公開する手順（匿名・無料）

公開URLを `https://kakei-hokenshitsu.pages.dev/` にして、**ブランド名で・本名と無関係に**運営するための手順です。
Cloudflare Pages は静的サイトを無料でホストでき、独自のサブドメイン（`*.pages.dev`）が使えます。

> 目標URL：**https://kakei-hokenshitsu.pages.dev/**
> そのためには、Cloudflareの**プロジェクト名を `kakei-hokenshitsu`** にします（空いていれば一致）。
> もし取れなければ別名（例：`kakei-hokenshitsu-app`）にして、私に伝えてください。リポジトリ内のURLを一括で直します。

---

## 事前準備
- **本名・現職と無関係の新しいメール**（作成済みのGmaiでOK）で Cloudflare アカウントを作成（無料）

---

## 方法1：Gitと接続（おすすめ・以後は自動公開）
編集→コミットするだけで自動で再公開されます。

1. Cloudflare ダッシュボード → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. GitHub を認証し、リポジトリ **`fixed-cost-checker`** を選択
3. ビルド設定（静的サイトなのでビルド不要）：
   - **Project name**：`kakei-hokenshitsu` ← これがURLになる
   - **Production branch**：`main`
   - **Framework preset**：None
   - **Build command**：空欄
   - **Build output directory**：`/`（ルート）
4. **Save and Deploy** → 数十秒で `https://kakei-hokenshitsu.pages.dev/` が公開
5. 以後、`main` に push すると自動で再デプロイ

> 補足：この方法だと「ソースのGitHubリポジトリ」は今のアカウント（noburin…）のままです。
> 公開URL（pages.dev）からはソースのアカウント名は見えませんが、より徹底するなら方法2、または別の匿名GitHubに置き直してから接続してください。

## 方法2：直接アップロード（GitHubと切り離す＝匿名性が最も高い）
1. GitHub の **Code → Download ZIP** でリポジトリをダウンロードして解凍
2. Cloudflare：**Create application → Pages → Upload assets**
3. **Project name**：`kakei-hokenshitsu`
4. 解凍フォルダ（`index.html` がある階層）をドラッグしてアップロード → Deploy
5. 更新時は、変更後に再アップロード（または Wrangler CLI を使うと自動化可）

---

## 公開後にやること
- 動作確認：`https://kakei-hokenshitsu.pages.dev/` を開いて診断が動くか
- 既存の GitHub Pages（`*.github.io`）は**予備として残してOK**。本名露出が気になれば、リポジトリを **Settings → 一番下 → Change visibility で Private** にする
- （任意・将来）独自ドメインを買えば、Cloudflare Pages の **Custom domains** から無料で `家計の保健室.com` 等に差し替え可能

---

## 注意
- すでにリポジトリ内のURL表記・PDF・QRコード・OGPは `kakei-hokenshitsu.pages.dev` に更新済みです。
  **プロジェクト名を `kakei-hokenshitsu` 以外にした場合は必ず教えてください**（不一致だとQRやリンクが切れます）。
- Cloudflare のアカウント情報・メールは、このリポジトリには書かないこと（公開のため）。
