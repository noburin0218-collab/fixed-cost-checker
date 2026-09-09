#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GoatCounter の REST API から、ページ別カウントとイベント（カスタムカウント）を取得する。
標準ライブラリのみで動く（追加パッケージのインストール不要）。

前提：
  1. GoatCounter管理画面 → Settings → API で Read statistics 権限のAPIトークンを発行する。
  2. 環境変数：
       GOATCOUNTER_API_TOKEN … 上記トークン
       GOATCOUNTER_SITE      … 既定値 kakei-hokenshitsu（config.js から自動推定も試みる）
       GC_START_DATE / GC_END_DATE … YYYY-MM-DD。省略時は直近30日

このスクリプトはトークンの中身を一切表示・保存しない。

取得するもの：
  - パス別カウント（記事・トップページを含む）
  - イベント別カウント（diagnose / result_view / article_to_diagnosis/* / ad_view/* / ad_click/*）
    GoatCounter 側では、これらは path="event/<name>" のイベントとして記録されている。
"""
import csv
import datetime
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def fail(msg):
    print("[fetch_goatcounter] " + msg, file=sys.stderr)
    sys.exit(1)


def guess_site_code():
    cfg_path = os.path.join(ROOT, "config.js")
    if not os.path.exists(cfg_path):
        return None
    with open(cfg_path, encoding="utf-8") as f:
        s = f.read()
    m = re.search(r'goatCounterEndpoint:\s*"https://([a-z0-9-]+)\.goatcounter\.com', s)
    return m.group(1) if m else None


def api_get(site, token, path, params):
    url = f"https://{site}.goatcounter.com/api/v0{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        fail(f"GoatCounter API がエラーを返しました（{e.code}）: {body[:300]}")
    except urllib.error.URLError as e:
        fail(
            f"GoatCounter ({site}.goatcounter.com) に到達できませんでした: {e.reason}\n"
            "  実行環境のネットワーク制限で GoatCounter への直接アクセスがブロックされる場合があります。"
            "  その場合はネットワークアクセスのある環境（手元PC・CI等）で実行してください。"
        )


def api_datetime(date_str, *, end=False):
    """YYYY-MM-DD を GoatCounter API が期待するRFC3339時刻へ変換する。"""
    try:
        day = datetime.date.fromisoformat(date_str)
    except ValueError:
        fail(f"日付は YYYY-MM-DD で指定してください: {date_str}")
    if end:
        # 指定日の末尾まで含める。GoatCounterはRFC3339を受け付ける。
        return f"{day.isoformat()}T23:59:59Z"
    return f"{day.isoformat()}T00:00:00Z"


def fetch_all_hits(site, token, start, end):
    """/stats/hits を exclude_paths でページングしながら全件取得する。"""
    all_hits = []
    excluded_ids = []
    seen_ids = set()

    while True:
        params = {
            "start": api_datetime(start),
            "end": api_datetime(end, end=True),
            "group": "day",
            "limit": 100,
        }
        if excluded_ids:
            params["exclude_paths"] = ",".join(str(i) for i in excluded_ids)

        data = api_get(site, token, "/stats/hits", params)
        hits = data.get("hits", [])
        all_hits.extend(hits)

        if not data.get("more"):
            break
        if not hits:
            fail("GoatCounter API が more=true を返しましたが、hits が空でした。ページングを停止します。")

        new_ids = []
        for hit in hits:
            path_id = hit.get("path_id")
            if path_id is None or path_id in seen_ids:
                continue
            seen_ids.add(path_id)
            new_ids.append(path_id)
        if not new_ids:
            fail("GoatCounter API のページングで新しい path_id を取得できませんでした。")
        excluded_ids.extend(new_ids)

    return all_hits


def main():
    token = os.environ.get("GOATCOUNTER_API_TOKEN")
    if not token:
        fail(
            "環境変数 GOATCOUNTER_API_TOKEN が未設定です。\n"
            "GoatCounter管理画面の Settings → API で Read statistics 権限のトークンを発行し、設定してください。"
        )

    site = os.environ.get("GOATCOUNTER_SITE") or guess_site_code()
    if not site:
        fail("サイトコードを特定できません。GOATCOUNTER_SITE を設定してください（例: kakei-hokenshitsu）。")

    end = os.environ.get("GC_END_DATE") or datetime.date.today().isoformat()
    try:
        end_date = datetime.date.fromisoformat(end)
    except ValueError:
        fail(f"GC_END_DATE は YYYY-MM-DD で指定してください: {end}")
    start = os.environ.get("GC_START_DATE") or (end_date - datetime.timedelta(days=30)).isoformat()
    try:
        datetime.date.fromisoformat(start)
    except ValueError:
        fail(f"GC_START_DATE は YYYY-MM-DD で指定してください: {start}")

    print(f"[fetch_goatcounter] site={site} period={start}〜{end}")

    os.makedirs(OUT_DIR, exist_ok=True)
    hits = fetch_all_hits(site, token, start, end)

    pages = []
    events = []
    for h in hits:
        row = {
            "path": h.get("path"),
            "title": h.get("title"),
            "count": h.get("count", 0),
            # /stats/hits は独立した count_unique を返さないため互換列として空欄を維持する。
            "count_unique": "",
            "event": bool(h.get("event", False)),
        }
        if row["event"] or (row["path"] or "").startswith("event/"):
            events.append(row)
        else:
            pages.append(row)

    pages_csv = os.path.join(OUT_DIR, f"goatcounter_pages_{end}.csv")
    with open(pages_csv, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["path", "title", "count", "count_unique"])
        w.writeheader()
        for r in pages:
            w.writerow({k: r[k] for k in ["path", "title", "count", "count_unique"]})

    events_csv = os.path.join(OUT_DIR, f"goatcounter_events_{end}.csv")
    with open(events_csv, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["path", "title", "count", "count_unique"])
        w.writeheader()
        for r in events:
            w.writerow({k: r[k] for k in ["path", "title", "count", "count_unique"]})

    print(f"  ページ: {len(pages)} 件 → {os.path.relpath(pages_csv)}")
    print(f"  イベント: {len(events)} 件 → {os.path.relpath(events_csv)}")

    meta = {
        "site": site,
        "start": start,
        "end": end,
        "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    with open(os.path.join(OUT_DIR, "goatcounter_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
