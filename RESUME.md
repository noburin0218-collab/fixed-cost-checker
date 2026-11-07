# RESUME｜再開用メモ（まずこれを読む）

> 作業を中断→再開したとき、**この1枚**で現状を思い出すためのメモです。
> ⚠️ このリポジトリは**公開**です。メールアドレス・パスワード・本名・ASPの管理画面情報など
> 秘密情報はここに書かないこと（控えはパスワード管理アプリ等の安全な場所へ）。
>
> 最終更新：2026-11-07（main `d1a6e82` 時点の事実にもとづく）

## いま何をやっているか（30秒で思い出す）
- 屋号：**家計の保健室**（匿名・顔出しなしの副業）
- 公開URL：**https://kakei-hokenshitsu.com/**（独自ドメイン × GitHub Pages。mainへのマージで自動デプロイ）
- プロダクト：無料の**家計チェック（固定費の診断ツール）**＋ 解説記事 ＋ 無料チェックリスト（PDF）
- 収益モデル：診断・記事で役に立つ情報を出し、該当する人にだけアフィリエイト（「広告」表示つき）
- 編集方針：一次情報を優先し、推測で数字を書かない（`/editorial-policy/`、`ARTICLE_PLAN.md`）

## 現状のスナップショット

| 区分 | 状態 |
|---|---|
| サイト | 診断ツール＋**記事32本**＋通信費シミュレーター（どちらも `articles/`）＋カテゴリまとめ |
| 市場調査 | `MARKET_RESEARCH_2026-11.md`（AI検索対策の根拠の有無、未提携の案件候補、記事テーマ） |
| 公式情報の確認 | GitHub Actions **Source Check**（週1回の出典リンク確認＋手動で本文取得）。`tools/check-sources.py` |
| Codex レビュー | PC のタスク **AI Cross Review Watcher**（`ai-dev-control`）が30分ごとに open の `claude/*` PR を自動レビュー。`CLAUDE.md` などAIへの指示ファイルを含むPRは対象外で、`-Force` の手動実行が必要 |
| 無料PDF | **自サイトで配布中**：`/checklist.pdf`（Dropbox等は不要になった） |
| 計測 | **GoatCounter**（クッキーなし）で計測中。**Google Search Console** 接続済み。GA4は**未設定**（`gaMeasurementId` が空） |
| 定期レビュー | Growth Loop（`GROWTH.md`）。週次の Growth Review が GitHub Actions で動いている |
| SNS | X **@kakei_clinic** 開設済み（`MARKETING.md`／`POSTING_PLAN.md`） |
| 品質ゲート | `npm test`／`npm run typecheck`／`npm run check`／`python3 tools/audit-site.py` が CI で毎回実行 |

## 稼働中の広告（`config.js`）

ASP発行コードは**原文のまま**保持し、`tools/audit-site.py` が原文一致を検査する。
クリックは GoatCounter `ad_click/<slot>` と、GA4 `affiliate_click`（GA4 ID設定時のみ）で計測する。

| 枠（slot） | 案件 | ASP | 主な表示場所 |
|---|---|---|---|
| `mobile` | LIBMO | A8 | 診断結果・4人家族の通信費 |
| `internet` | イツキ光 | A8 | 診断結果 |
| `electricity` | 電気チョイス（比較サービス） | A8 | 診断結果・オール電化 |
| `gas` | エネピ | A8 | 診断結果・プロパンガス |
| `insurance` | 保険マンモス | アクセストレード | 診断結果 |
| `savings` | 貯蓄ガーデン | アクセストレード | 診断結果（条件つき）・貯まらない記事 |
| 比較3社 | 保険ガーデン／保険マンモス／みんなの生命保険アドバイザー | アクセストレード | 保険相談比較記事（五十音順・同じ器） |
| `internet-nc` | GMOとくとくBB SoftBank Air | A8 | 賃貸のネット回線 |
| `mobile-choice` | NUROモバイル | A8 | スマホの契約を選ぶ手順 |
| `denryoku-direct` | idemitsuでんき（個別事業者） | A8 | 電力会社の切り替え |

- 新しい枠を足すときは、`affiliateTracking` に同じslotを追加する（`tests/affiliate-tracking-coverage.test.js` が漏れを検知）。
- **空の広告枠（未提携。コードが入れば表示）**：`carInsurance`（/articles/jidosha-hoken-koshin-mae/）、`fireInsurance`（/articles/kasai-hoken-minaoshi/）、`cityGas`（/articles/toshi-gas-minaoshi/）。
- 未設置：住宅ローン借り換え（未提携・記事もまだ）。GMOとくとくBB ソフトバンク光は、広告主の告知により 2026-11-16 から一時停止のため未設置。
- 配置の判断と経緯は `AFFILIATE_PLACEMENT_AUDIT.md`、候補一覧は `AFFILIATE_BACKLOG.md`。

## 運営者側で確認・判断が必要なこと（私には代行できない）
- [ ] 有料PDFを note で販売するか（`note_article.md` に原稿あり）。販売するなら `config.js` の `cta.href` を設定
- [ ] Threads / note アカウントの要否
- [ ] GA4 を使うか。使う場合は、ID設定の前に `/about/` の計測の説明を更新する（現在は GoatCounter のみと記載）
- [ ] 診断結果から「スマホの契約を選ぶ手順」記事へ直接リンクするか（CV導線の変更に当たるため保留中）
- [ ] 案件の提携申請：自動車保険・火災保険の一括見積もり、都市ガス比較、住宅ローン借り換え、縛りなし光回線（申請はASPの管理画面へのログインが必要。PCの Claude in Chrome で代行させる方法あり）
- [ ] 一次情報の提供（`ARTICLE_PLAN.md` の「保留している内容」参照）

## ファイルマップ
| やりたいこと | 見る/触るファイル |
|---|---|
| 広告コード・計測ID | `config.js`（コードは原文のまま貼る） |
| 広告の配置判断・候補 | `AFFILIATE_PLACEMENT_AUDIT.md`／`AFFILIATE_BACKLOG.md` |
| 記事の企画・保留事項・制作ルール | `ARTICLE_PLAN.md` |
| データにもとづく改善の流れ | `GROWTH.md`、`tools/growth/` |
| デザインの基準 | `DESIGN.md` |
| SNS投稿 | `MARKETING.md`／`POSTING_PLAN.md` |
| 公開前チェック | `python3 tools/audit-site.py` |
| 開発の進め方（レビュー・マージ） | `AGENTS.md`／`CLAUDE.md`（独立レビュー＋人間のマージ判断） |

## 外部サイトの確認とクロスレビュー（毎回つまずかないための手順）

**公式ページの確認**（Claude Code のクラウド環境は、ネットワーク設定で外部サイトへの通信が止められていることがある）
- 恒久対応①（環境側・運営者が1回だけ設定）：クラウド環境の設定 → Network access → Allowed domains に、
  `python3 tools/check-sources.py --domains` が出すドメインと、広告主の公式サイト（例：`www.nuro.jp`、`gmobb.jp`）を追加する。
  手順：https://code.claude.com/docs/en/cloud-environments#network-access
- 恒久対応②（環境に左右されない）：GitHub Actions の **Source Check** を使う。
  - 週1回、記事の出典リンクがすべて開けるかを確認（ページが無くなっていたら失敗）
  - 手動実行で `urls` にURLを入れると、そのページの本文がジョブログに出る → 記事の記載と照合する
- どちらでも開けない場合は、推測で補わず「未確認」と明記する（編集方針どおり）。

**Codex による独立レビュー**（Claude が作ったPRは Codex がレビューする決まり）
- Codex はこのクラウド環境では動かない（OpenAI アカウントでのログインが必要なため）。運営者のPCで実行する。
- PRが「Ready」になったら、Windows の `C:\Users\nobur\ai-dev-control` で：
  `.\scripts\invoke-cross-review.ps1 -Repo noburin0218-collab/fixed-cost-checker -Pr <番号>`
- スクリプトは **open の PR しか対象にできない**。マージしてからでは遅いので、**Codex レビュー → 指摘の修正 → マージ** の順にする（2026-11-06 運営者決定）。レビューと修正のあと、**マージは人間が判断する**（AGENTS.md）。セッション内で運営者が明示的にマージを指示した場合は、それをその判断とみなす。過去の承認を継続的な承認として扱わない。
- 指摘は Claude が1件ずつ検証し、正しいものだけを1回の修正で直す。

## 変更の反映方法
ブランチで作業 → PR → CI（test／baseline／Cloudflare Pagesプレビュー）→ 独立レビュー → 人間がマージ判断 → mainへのマージで自動デプロイ。
