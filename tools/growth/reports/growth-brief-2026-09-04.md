# 家計の保健室 Growth Brief

- 生成日: 2026-09-04T02:46:16
- 基準日（Growth Loop ベースライン）: 2026-09-04
- GSCデータ: なし（未取得）
- GoatCounterデータ: なし（未取得）

## 結論：変更しない

GSC・GoatCounterいずれも実データを取得できていないため、今回は記事の評価・改善対象の選定を行いません。データ不足の状態で変更を行わないことを、正しい結論として扱います。

### 次にやること（手動）

1. Google Search Console でプロパティを確認し、サービスアカウントを追加する
2. GoatCounter管理画面で読み取り専用APIトークンを発行する
3. `tools/growth/README.md` の手順で環境変数を設定し、`fetch_gsc.py` / `fetch_goatcounter.py` を実行する
4. `build_growth_brief.py` を再実行する
