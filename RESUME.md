# 🔖 RESUME｜再開用メモ（まずこれを読む）

> 作業を中断→再開したとき、**この1枚**で思い出せるようにしたメモです。
> ⚠️ このリポジトリは**公開**です。**Gmailアドレス・パスワード・本名などの秘密情報はここに書かない**こと
> （控えはパスワード管理アプリ等の安全な場所へ）。

## いま何をやっているか（30秒で思い出す）
- 屋号：**家計の保健室**（匿名・顔出しなしの副業）
- プロダクト：**固定費＆家計 見直し診断ツール**（無料）＋ 無料/有料PDF
- 公開URL：**https://kakei-hokenshitsu.pages.dev/**
- 収益モデル：無料ツール／無料PDFで集客 → **高単価アフィリエイト**（保険相談・住宅ローン借換・自動車保険一括 など）＋ note有料PDF
- 進め方：作り込みすぎる前に **7日間の需要検証**（`MARKETING.md`）

## ⚠️ 公開先を Cloudflare Pages に移す（匿名化・未完）
現状のGitHub PagesのURLには本名系ユーザー名が入るため、公開先を `kakei-hokenshitsu.pages.dev` に移行予定。
→ 手順：[`HOSTING_CLOUDFLARE.md`](./HOSTING_CLOUDFLARE.md)（Cloudflareでプロジェクト名を `kakei-hokenshitsu` にする）。
リポジトリ内のURL・QR・PDF・OGPは既に `kakei-hokenshitsu.pages.dev` へ更新済み。**別名にしたら要連絡**。

## 次に開いたら、まずこの3つ
1. **収益の蛇口を1本開ける**：A8.net等で「保険の無料相談」か「住宅ローン借り換え」のリンクを取得 → `config.js` の該当 `href` に貼る（手順は `SETUP.md` STEP3）
2. **無料PDFを配布可能に**：受領済みPDFを Google Drive にアップ → 共有リンクを `MARKETING.md` 投稿文⑩へ
3. **SNSで7日検証スタート**：`MARKETING.md` のプロフィール/固定ポスト/投稿文を使って投稿

## 進捗スナップショット
### ✅ 完成・公開済み（私が作成）
| 区分 | 成果物 |
|---|---|
| プロダクト | 無料診断ツール（世帯人数・スマホ契約・住居/ガス種別・保険の入り方・住宅費/借換まで対応） |
| 集客 | 無料版PDF・OGP画像・ファビコン・SNS投稿文/プロフィール/固定ポスト |
| 収益化 | 有料PDF（QR入り10p）・note記事ドラフト・note用画像（アイキャッチ/プレビュー）・`config.js`の高単価アフィリ枠 |
| 運用 | `SETUP.md`（手順）・`MONETIZATION.md`（案件選び）・`MARKETING.md`（集客/検証） |
| 公開 | GitHub Pages 自動デプロイ（mainへpushで自動反映） |

### ⏳ あなたの残タスク（私には代行不可）
- [x] 専用Gmail を作る
- [ ] note / X / Threads(要Instagram) を同Gmailで開設（`SETUP.md` STEP1）
- [ ] 無料PDFを Google Drive にアップして共有リンク取得（STEP2）
- [ ] ASP登録 → 高単価リンクを `config.js` に貼る（STEP3）← **最優先・最も収益化に効く**
- [ ] GA4 測定IDを `config.js` に設定（STEP4）
- [ ] 有料PDFを note で販売（`note_article.md`＋画像、STEP5）
- [ ] 7日間の需要検証（STEP6 / `MARKETING.md`）

## ファイルマップ（どこに何があるか）
| やりたいこと | 見る/触るファイル |
|---|---|
| 公開までの手順（最初に読む） | `SETUP.md` |
| 公開先をCloudflareに移す手順 | `HOSTING_CLOUDFLARE.md` |
| アフィリ/CTA/計測IDを設定 | `config.js`（`affiliates` / `cta.href` / `gaMeasurementId`） |
| どのASP・案件に登録するか | `MONETIZATION.md` |
| SNS投稿文・プロフィール・7日検証 | `MARKETING.md` |
| note記事の本文（コピペ用） | `note_article.md` |
| 診断ロジック・項目の調整 | `script.js`（変更後は `npm test` で検証） |
| 単体テスト | `tests/diagnose.test.js`（`npm test`／CIでも自動実行） |
| 見た目／文言・画面構成 | `styles.css` / `index.html` |
| 配布物（無料/有料PDF・note画像） | ※チャットで受領＝リポジトリ外。安全な場所に保管 |

## 編集の反映方法
GitHub上で対象ファイルを編集 → コミット（mainへ）→ 数分で自動的に本番反映（`.github/workflows/deploy-pages.yml`）。

## メモ（自由記入欄）
- 取得したASP案件・承認状況：（ここに書くなら案件名だけ。URL/IDは貼らない方が無難）
- 検証で反応が良かったテーマ：
- 次にやりたい改善：
