# Growth Loop ツール（`tools/growth/`）

「家計の保健室」を **サイト構築フェーズ → Growth Loop 運用フェーズ** へ移すための、
計測データ収集・集計スクリプト一式です。詳しい方針・KPI定義は `../../GROWTH.md` を参照してください。

このディレクトリのスクリプトは、いずれもサイト本体（HTML/CSS/JS/`config.js`）を変更しません。
出力先は `tools/growth/data/`（生データ）と `tools/growth/reports/`（レポート）です。

## 前提

- **既存の計測環境**：GoatCounter（`config.js` の `goatCounterEndpoint`）のみ稼働中。GA4は未設定（空文字）。
- **Google Search Console**：このリポジトリ内に設定・認証情報は一切ありません（サイト側の verification meta タグも無し）。
  取得するには、GSC側でのプロパティ確認とサービスアカウント追加が別途・手動で必要です。
- 認証情報・APIキーはこのリポジトリにコミットしないでください（`.gitignore` で `tools/growth/data/*.csv` 等を除外済み）。

## 1. 記事レジストリ（今すぐ実行できる・外部アクセス不要）

```bash
python3 tools/growth/article_registry.py
# または: npm run growth:registry
```

`articles/*/index.html` を静的解析し、slug・カテゴリ・title・description・公開日・広告slot等を
`tools/growth/data/article_registry.csv` / `.json` に書き出します。記事を追加・変更した後に再実行してください
（このコマンド自体は記事を変更しません。読み取り専用です）。

## 2. Google Search Console データの取得

```bash
pip install google-auth google-api-python-client   # このスクリプト専用。npm依存には含めない

export GSC_SERVICE_ACCOUNT_JSON=/path/to/service-account.json
export GSC_SITE_URL=https://kakei-hokenshitsu.com/   # 省略可（既定値）

python3 tools/growth/fetch_gsc.py
# または: npm run growth:gsc
```

事前に必要な手動設定：

1. Google Cloud でサービスアカウントを作成し、鍵（JSON）をダウンロードする
2. Search Console の対象プロパティ → 設定 → ユーザーと権限 → そのサービスアカウントのメールアドレスを追加する（読み取りのみで可）
3. 鍵ファイルのパスを `GSC_SERVICE_ACCOUNT_JSON` に設定する

`GSC_LAG_DAYS`（既定3）だけ直近日を除外して取得します。GSCの確定データには遅延があるため、
未確定の直近数日を最終評価に使わないためです。

出力：`tools/growth/data/gsc_pages_<終了日>.csv`（記事単位）、`gsc_queries_<終了日>.csv`（クエリ単位）。

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

## このツールが自動でやらないこと

- title / description / 本文 / H1 / URL / canonical / 広告位置 / 家計カルテUI の変更
- 新しい計測イベントの追加
- ASP管理画面のスクレイピング（成果・承認・報酬データの自動取得）
- 記事の追加・削除
