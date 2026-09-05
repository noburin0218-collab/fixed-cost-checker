# Growth Loop（家計の保健室）

サイト構築フェーズ（Phase 1〜3・UXホットフィックス・26記事公開）から、
**計測 → 評価 → 改善対象の選定** を実データにもとづいて回す運用フェーズへの移行ドキュメント。

このファイルは `DESIGN.md` と同じ位置づけの Single Source of Truth（Growth Loop版）です。
実装は `tools/growth/`（`tools/growth/README.md` に手順）。

## 0. 大原則

- **新記事は追加しない。** 記事制作は第7バッチで停止した状態を維持する。
- **実データが出るまで、既存記事本文・title・description・URL・canonical・診断ロジック・広告配置を変更しない。**
- 変更する場合も、一度に大量変更しない。変更日と変更内容を記録し、前後比較できるようにする。
- 既存の安全ルール（`CLAUDE.md` / `.ai/REVIEW_RUBRIC.md`）・`DESIGN.md`・`tools/audit-site.py` は維持する。
- Growth Loopのためだけに React・DB・大規模分析基盤を導入しない。CSV / JSON / Markdown / 小さなPython・Nodeで足りる範囲にとどめる。

## 1. 追う流れ（ファネル）

```
Google検索
  ↓
記事
  ↓
家計チェック（診断フォーム）
  ↓
家計カルテ（診断結果）
  ↓
関連記事（次に読む）
  ↓
必要なら広告・比較
```

## 2. ベースライン

- **基準日：2026-09-04**（Phase 3・UXホットフィックス・26記事公開の完了時点）
- これより前の状態（UI変更前・大量記事追加前）のデータとは混ぜない。
- **公開から14日未満の記事は、データの有無にかかわらず「判定保留」とする**
  （2026-09-04時点で26記事はすべて公開直後のため、A〜Fの実質判定はまだ機能しない。下記5節参照）。
- GSCの確定データには遅延があるため、直近数日（既定3日）の未確定値は最終評価に使わない。

## 3. 現在の計測環境

| 項目 | 状態 |
|---|---|
| GoatCounter | 稼働中。`config.js` の `goatCounterEndpoint`（`https://kakei-hokenshitsu.goatcounter.com/count`）。Cookie不使用 |
| GA4 | 未設定（`config.js` の `gaMeasurementId` が空文字）。コード自体はindex.htmlに実装済みで、IDを入れれば有効化される |
| Google Search Console | **ドメインプロパティ `kakei-hokenshitsu.com` は2026-09-03に所有権確認済み。** Growth Loop API取得用のサービスアカウント／鍵はまだ未設定 |
| 既存イベント | `diagnose` / `result_view` / `article_to_diagnosis/{slug}` / `ad_view/{slot}` / `ad_click/{slot}` / `share/*` / `share_image/*` / `cta_click`（すべて実装済み・稼働中） |
| slug↔イベント対応 | できる。記事の `<body data-article="{slug}">` を起点に `article_to_diagnosis/{slug}` が発火する |
| slot↔イベント対応 | できる。`data-ad-slot` 属性を起点に `ad_view/{slot}` `ad_click/{slot}` が発火する（ASP発行コード自体は無改変） |
| 既存のレポート機構 | 無かった。今回 `tools/growth/` として新設 |

`tools/growth/README.md` に手動セットアップ手順を記載。

## 4. KPI定義

### Search（GSC・記事単位）
`impressions` / `clicks` / `CTR` / `average position`

### Search（GSC・クエリ単位）
`query` / `page` / `impressions` / `clicks` / `CTR` / `position`

### Content → Diagnosis
- 記事PV（GoatCounter、`/articles/{slug}/` のヒット数）
- `article_to_diagnosis/{slug}`（クリック数）
- 記事→家計チェック遷移率 ＝ `article_to_diagnosis/{slug}` ÷ 記事PV

### Diagnosis
- `diagnose`（診断完了・送信数）
- `result_view`（結果表示数）
- **診断開始数／診断完了数の分離は、現状のイベントでは算出できない。**
  `diagnose` と `result_view` はどちらも「フォーム送信が成功した」同一操作の中で、
  ほぼ同時に発火する2つのイベントであり、開始と完了という別々の段階を表していない。
  新しいイベントは今回追加しない。不足として報告するにとどめる（下記6節）。

### Affiliate（slot単位）
`ad_view` / `ad_click` / `CTR`

ASP成果（CV・承認・報酬）の自動取得はしない。今回スクレイピングは行わない方針のため、
`ad_click → ASP CV → 承認 → 報酬` の接続は、**将来ASP側にAPI/CSVエクスポートがあれば**
`tools/growth/data/` に同じ日付キーで並べて突き合わせる、という構造だけを想定しておく
（未実装。現時点でASP側の自動取得環境は確認していない）。

## 5. 記事評価の分類（A〜F）

`tools/growth/build_growth_brief.py` が、記事ごとに次のいずれかを付ける。

| 分類 | 条件 | 対応 |
|---|---|---|
| A | 表示・クリックとも伸びている（CTR高） | 原則触らない |
| B | 表示はあるがCTRが弱い | title / description 改善候補 |
| C | 掲載順位が8〜20位 | 本文改善・内部リンク候補 |
| D | 記事PVはあるが家計チェックへ進まない | CTA・記事導線候補 |
| E | 診断への遷移率が高い | 成功パターンとして分析 |
| F | 表示自体がほぼ無い | すぐに削除・書き換えず、検索需要／インデックス／時間不足を切り分ける |
| 判定保留（公開間もない） | 公開から14日未満 | 判定しない |
| 判定不能（データ不足） | 閾値に届くデータが無い | 判定しない |

閾値（表示回数・PV・CTR・遷移率の下限など）はすべて `build_growth_brief.py` 冒頭の定数に集約した
プレースホルダー。実データが貯まってから見直す。

## 6. 現状の既知の不足（新イベントは追加せず、ここに記録する）

1. **診断開始数と完了数の分離ができない**（5節参照）。将来必要になれば、
   フォームの最初の入力操作を捉える新イベント案を別途提案する（今回は追加しない）。
2. **「記事→診断→結果表示」までは繋がるが、その先の家計カルテでの行動
   （どのカテゴリを見たか等）が個別記事に紐づかない**。診断結果は同一の `/`（トップページ）で
   完結するため、`article_to_diagnosis/{slug}` クリックと、その後の `diagnose` / `ad_view` 等が
   同一セッション由来かどうかはイベント単体からは分からない
   （GoatCounter側のリファラ集計で近似できる可能性はあるが、今回のダッシュボード未検証のため未確認扱い）。
3. **ASP側の成果（CV・承認・報酬）データを本サイト側から見る手段が無い**。ASPの管理画面を手動で確認する運用が前提。
4. **ad_view は「表示された（HTMLに出力された）」ことの計測であり、実際に読者の画面に入った
   （viewability）ことの計測ではない**。記事ページ・トップページ結果面のいずれも、
   要素が生成された時点で発火する。

## 7. 初回評価が可能になる条件

- GSC：ドメインプロパティの所有権確認は完了済み。Growth Loop API取得用サービスアカウントをプロパティに追加し、`fetch_gsc.py` が動く状態にする
- GoatCounter：読み取り専用APIトークンを発行し、`fetch_goatcounter.py` が動く状態にする
- 上記に加えて、**記事の公開から14日以上経過**していること（5節のガード）
- 統計的に読める最低限のボリューム（表示回数・PVがほぼ0の記事は、"F"ではなく判定保留のまま）

## 8. 次に自動化できること（今回は実施しない・候補のみ）

- `fetch_gsc.py` / `fetch_goatcounter.py` / `build_growth_brief.py` を
  CIやスケジュール実行で定期的に回し、レポートの履歴を `tools/growth/reports/` に積み上げる
- クエリ単位データから「伸び始めたクエリ」（直近と前期間の比較）を検出するロジックの追加
- ASPにCSVエクスポート等の自動取得手段があれば、`ad_click → CV` の突き合わせスクリプトを追加

いずれも、今回は実装しない。データが十分に貯まり、次の指示があってから着手する。
