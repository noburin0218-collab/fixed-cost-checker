#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Search Console（Search Analytics API）から、
記事単位（page × date）・クエリ単位（query × page × date）の
表示回数／クリック数／CTR／掲載順位を取得する。

前提（未設定なら実行時に何が足りないかを表示して終了する。エラーで落とさない）：
  1. サービスアカウントを作成し、対象プロパティに「制限付き」以上の権限で追加しておく
     （Search Console の設定 → ユーザーと権限）。
     対象プロパティは `sc-domain:kakei-hokenshitsu.com`（ドメインプロパティ）。
     ドメインプロパティは Search Console API 上では必ず `sc-domain:` 形式のURIで指定する
     （`https://kakei-hokenshitsu.com/` のようなURL形式では取得できない）。
  2. 依存パッケージ：`pip install google-auth google-api-python-client`
     （このリポジトリの npm 依存には含めない。分析用の別系統として扱う）
  3. 認証情報の渡し方（いずれか。中身はコミットしないこと）：
       - GSC_SERVICE_ACCOUNT_JSON にサービスアカウント鍵（JSON）の内容そのものを入れる
         … GitHub Actions Secret の値として渡す想定
       - GSC_SERVICE_ACCOUNT_JSON に鍵ファイルへの絶対パスを入れる
         … ローカル実行で、.gitignore済みのファイルを指す想定
     どちらの形式かはスクリプト側で自動判定する。
  4. その他の環境変数：
       GSC_SITE_URL              … 既定値 sc-domain:kakei-hokenshitsu.com
       GSC_START_DATE / GSC_END_DATE … 省略時は「昨日から遡って28日間」
                                        （直近数日はGSC側で未確定のため既定で除外）
       GSC_LAG_DAYS              … 直近何日を未確定として除外するか（既定3）

このスクリプトは認証情報そのものを出力・コミットしない。
APIキー・鍵ファイルの中身は一切表示しない。
"""
import csv
import datetime
import json
import os
import sys

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
# 対象は sc-domain:kakei-hokenshitsu.com（ドメインプロパティ）。
# ドメインプロパティはURL形式ではなく sc-domain: 形式のURIでのみ指定できる。
DEFAULT_SITE = "sc-domain:kakei-hokenshitsu.com"
MAX_ROW_LIMIT = 25000  # Search Console API の1リクエストあたり上限


def fail(msg):
    print("[fetch_gsc] " + msg, file=sys.stderr)
    sys.exit(1)


def load_client():
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError:
        fail(
            "google-auth / google-api-python-client が見つかりません。\n"
            "  pip install google-auth google-api-python-client\n"
            "を実行してから、もう一度お試しください。"
        )
    raw = os.environ.get("GSC_SERVICE_ACCOUNT_JSON")
    if not raw:
        fail(
            "環境変数 GSC_SERVICE_ACCOUNT_JSON が未設定です。\n"
            "サービスアカウントの鍵（JSON）そのもの、またはその鍵ファイルへの絶対パスを設定してください。\n"
            "（Search Console 側で、このサービスアカウントを sc-domain:kakei-hokenshitsu.com の"
            "ユーザーに追加する作業も別途・手動で必要です。このスクリプトはその代わりにはなりません）"
        )

    scopes = ["https://www.googleapis.com/auth/webmasters.readonly"]

    # GSC_SERVICE_ACCOUNT_JSON の中身がJSONそのもの（GitHub Actions Secret を想定）か、
    # ファイルパス（ローカルの.gitignore済みファイルを想定）かを自動判定する。
    stripped = raw.strip()
    if stripped.startswith("{"):
        try:
            info = json.loads(stripped)
        except json.JSONDecodeError as e:
            fail(f"GSC_SERVICE_ACCOUNT_JSON の中身をJSONとして解釈できませんでした: {e}")
        creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
    else:
        key_path = raw
        if not os.path.exists(key_path):
            fail(f"GSC_SERVICE_ACCOUNT_JSON で指定されたファイルが見つかりません: {key_path}")
        creds = service_account.Credentials.from_service_account_file(key_path, scopes=scopes)

    return build("searchconsole", "v1", credentials=creds)


def date_range():
    lag = int(os.environ.get("GSC_LAG_DAYS", "3"))
    end = os.environ.get("GSC_END_DATE")
    start = os.environ.get("GSC_START_DATE")
    if not end:
        end = (datetime.date.today() - datetime.timedelta(days=lag)).isoformat()
    if not start:
        start = (datetime.date.fromisoformat(end) - datetime.timedelta(days=27)).isoformat()
    return start, end


def query_all(service, site_url, start, end, dimensions):
    """startRow でページングしながら全件取得する（1回の上限25,000件で打ち切らない）。"""
    all_rows = []
    start_row = 0
    while True:
        body = {
            "startDate": start,
            "endDate": end,
            "dimensions": dimensions,
            "rowLimit": MAX_ROW_LIMIT,
            "startRow": start_row,
        }
        resp = service.searchanalytics().query(siteUrl=site_url, body=body).execute()
        rows = resp.get("rows", [])
        all_rows.extend(rows)
        if len(rows) < MAX_ROW_LIMIT:
            break
        start_row += MAX_ROW_LIMIT
    return all_rows


def write_csv(path, rows, dim_names):
    fieldnames = dim_names + ["impressions", "clicks", "ctr", "position"]
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            keys = r.get("keys", [])
            row = dict(zip(dim_names, keys))
            row["impressions"] = r.get("impressions", 0)
            row["clicks"] = r.get("clicks", 0)
            row["ctr"] = round(r.get("ctr", 0.0), 4)
            row["position"] = round(r.get("position", 0.0), 2)
            w.writerow(row)


def main():
    site_url = os.environ.get("GSC_SITE_URL", DEFAULT_SITE)
    start, end = date_range()
    service = load_client()

    os.makedirs(OUT_DIR, exist_ok=True)

    print(f"[fetch_gsc] site={site_url} period={start}〜{end}")

    # page × date
    page_rows = query_all(service, site_url, start, end, ["page", "date"])
    page_csv = os.path.join(OUT_DIR, f"gsc_pages_{end}.csv")
    write_csv(page_csv, page_rows, ["page", "date"])
    print(f"  ページ×日別: {len(page_rows)} 件 → {os.path.relpath(page_csv)}")

    # query × page × date
    query_rows = query_all(service, site_url, start, end, ["query", "page", "date"])
    query_csv = os.path.join(OUT_DIR, f"gsc_queries_{end}.csv")
    write_csv(query_csv, query_rows, ["query", "page", "date"])
    print(f"  クエリ×ページ×日別: {len(query_rows)} 件 → {os.path.relpath(query_csv)}")

    meta = {
        "site_url": site_url,
        "start": start,
        "end": end,
        "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    with open(os.path.join(OUT_DIR, "gsc_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
