# Growth Loop ツール（`tools/growth/`）

「家計の保健室」を **サイト構築フェーズ → Growth Loop 運用フェーズ** へ移すための、
計測データ収集・集計スクリプト一式です。詳しい方針・KPI定義は `../../GROWTH.md` を参照してください。

このディレクトリのスクリプトは、いずれもサイト本体（HTML/CSS/JS/`config.js`）を変更しません。
出力先は `tools/growth/data/`（生データ）と `tools/growth/reports/`（レポート）です。

## 前提

- **GoatCounter**：`config.js` の `goatCounterEndpoint` で計測中。GitHub Actions Secret
  `GOATCOUNTER_API_TOKEN` を登録済みで、`.github/workflows/growth-goatcounter.yml` から
  `fetch_goatcounter.py` の実取得に成功している（2026-09-09時点）。GA4は未設定（空文字）。
- **Google Search Console**：ドメインプロパティ `sc-domain:kakei-hokenshitsu.com` は
  GSC Wizard経由で所有権確認済み（これはこのリポジトリのスクリプトとは別物）。
  加えて、**repo-side（`fetch_gsc.py`）用のサービスアカウントも同プロパティに追加済みで、
  `GSC_SERVICE_ACCOUNT_JSON` をGitHub Actions Secretに登録し、`growth-gsc.yml` の実行成功を確認済み**。
  直近の取得期間（2026-08-11〜2026-09-07）はpage×date/query×page×dateとも0件だったが、
  これは接続失敗ではなく、その期間に返却可能な検索データがまだ無い状態。
- 認証情報・APIキーはこのリポジトリにコミットしないでください
  （`.gitignore` で `tools/growth/data/*.csv` 等を除外済み）。
  サービスアカウント鍵は **GitHub Actions Secret**・**環境変数**・**.gitignore済みのローカルファイル**
  のいずれかからのみ読み込む設計です（後述）。

## 1. 記事レジストリ（今すぐ実行できる・外部アクセス不要）

```bash
python3 tools/growth/article_registry.py
# または: npm run growth:registry
```

`articles/*/index.html` を静的解析し、slug・カテゴリ・title・description・公開日・広告slot等を
`tools/growth/data/article_registry.csv` / `.json` に書き出します。記事を追加・変更した後に再実行してください
（このコマンド自体は記事を変更しません。読み取り専用です）。

## 2. Google Search Console データの取得

**接続は完了済み。** 以下は完了済みの手順（参考・再設定時用）：

1. Google Cloud でサービスアカウントを作成し、Search Console API を有効化して、鍵（JSON）を発行する
2. Search Console の `sc-domain:kakei-hokenshitsu.com` プロパティ → 設定 → ユーザーと権限 →
   そのサービスアカウントのメールアドレスを追加する（読み取りのみで可）
3. 鍵JSONを、次のいずれかの方法で渡す（**リポジトリにはコミットしない**）：
   - GitHub Actions Secret `GSC_SERVICE_ACCOUNT_JSON` に鍵JSONの中身をそのまま登録する
     （`.github/workflows/growth-gsc.yml` が読む）
   - ローカル実行時は、環境変数 `GSC_SERVICE_ACCOUNT_JSON` に鍵JSONの中身、または
     `.gitignore`済みのローカルファイルへの絶対パスを設定する（どちらの形式かはスクリプトが自動判定する）

```bash
pip install google-auth google-api-python-client   # このスクリプト専用。npm依存には含めない

export GSC_SERVICE_ACCOUNT_JSON=/path/to/service-account.json   # または鍵JSONの中身そのもの
export GSC_SITE_URL=sc-domain:kakei-hokenshitsu.com   # 省略可（既定値・ドメインプロパティのため sc-domain: 形式）

python3 tools/growth/fetch_gsc.py
# または: npm run growth:gsc
# または GitHub Actions: growth-gsc.yml を workflow_dispatch で手動実行
```

`GSC_LAG_DAYS`（既定3）だけ直近日を除外して取得します。GSCの確定データには遅延があるため、
未確定の直近数日を最終評価に使わないためです。

取得する次元は `page × date`（記事単位・日別）と `query × page × date`（クエリ単位・日別）。
出力：`tools/growth/data/gsc_pages_<終了日>.csv`、`gsc_queries_<終了日>.csv`（いずれも1行＝1日分）。
`build_growth_brief.py` 側で、期間内の合算値（CTRはクリック÷表示回数で再計算、掲載順位は表示回数の加重平均）に集約する。

## 3. GoatCounter データの取得

```bash
export GOATCOUNTER_API_TOKEN=xxxxx   # GoatCounter管理画面 Settings → API で発行（読み取り専用）
export GOATCOUNTER_SITE=kakei-hokenshitsu   # 省略可。config.js から自動推定を試みる

python3 tools/growth/fetch_goatcounter.py
# または: npm run growth:goatcounter
```

標準ライブラリのみで動作します（追加パッケージ不要）。`/stats/hits` をページングして取得し、
ページのヒットとイベント（`event/...` パス）に分けて
`goatcounter_pages_<終了日>.csv` / `goatcounter_events_<終了日>.csv` に書き出します。

一時的な404/429/5xx・ネットワーク断は、最大3回・短いbackoff（1s, 2s）で自動的に再試行します
（401/403は再試行せず即失敗）。`growth-goatcounter.yml`／`growth-review.yml` のどちらから呼んでも
同じリトライが効きます。ロジックのテストは `python3 tools/growth/test_fetch_goatcounter_retry.py`
（実APIにはアクセスしません）。

このサンドボックス実行環境では、egressプロキシの制限により `*.goatcounter.com` への
直接アクセス自体がブロックされることを確認済みです。その場合は、ネットワーク制限のない環境
（手元PC・CI等）で実行してください。

## 4. Growth Brief の生成

```bash
python3 tools/growth/build_growth_brief.py
# または: npm run growth:brief
```

`article_registry.json` と、`data/` にある最新の `gsc_*` / `goatcounter_*` を突き合わせ、
`tools/growth/reports/growth-brief-<日付>.md` を書き出します。

- GSC・GoatCounterどちらのデータも無い場合は「結論：変更しない」を出力します（正しい挙動です）。
- 公開から14日未満の記事は、データの有無に関わらず「判定保留（公開間もない）」になります
  （数日のデータで失敗と判定しないため）。
- 分類の閾値（`MIN_IMPRESSIONS_FOR_JUDGEMENT` 等）はスクリプト冒頭の定数です。
  実データが貯まってから見直してください。現時点ではプレースホルダーです。

## 5. 週次の自動レビュー（GitHub Actions）

`.github/workflows/growth-review.yml` が、上記1〜4（記事レジストリ再生成・GSC取得・GoatCounter取得・
Growth Brief生成）を通しで実行します。既存の `fetch_gsc.py` / `fetch_goatcounter.py` /
`build_growth_brief.py` / `article_registry.py` をそのまま呼び出すだけで、新しい分析基盤は作っていません。

- スケジュール：毎週月曜 07:00 JST（`cron: "0 22 * * 0"`、日曜22:00 UTC）
- `workflow_dispatch` で手動実行も可能
- 生データ（`gsc_*` / `goatcounter_*` / `article_registry.*`）は `growth-review-data` artifact、
  Growth Briefは `growth-brief` artifact として保存（保持期間はワークフロー内の設定を参照）。
  **どちらもmainへcommitしない。**
- GSC・GoatCounterのいずれかが0件を返しても、ファイル自体が生成されていればワークフローは失敗にしない
  （0件＝データがまだ無いだけで、接続失敗と区別する）。
  Secret未設定・API認証エラー・スクリプトの異常終了は、そのステップの失敗としてワークフローが失敗する。
- `growth-gsc.yml` / `growth-goatcounter.yml`（単体の疎通確認用）は従来どおり残しており、
  個別に手動実行・診断したいときはそちらを使う。

## このツールが自動でやらないこと

- title / description / 本文 / H1 / URL / canonical / 広告位置 / 家計カルテUI の変更
- 新しい計測イベントの追加
- ASP管理画面のスクレイピング（成果・承認・報酬データの自動取得）
- 記事の追加・削除
- Growth Brief・生データのmainへのcommit（`growth-review.yml` はArtifact保存のみ）
