#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GoatCounter の REST API から、ページビューとイベント（カスタムカウント）を取得する。
標準ライブラリのみで動く（追加パッケージのインストール不要）。

前提（未設定なら実行時に何が足りないかを表示して終了する。エラーで落とさない）：
  1. GoatCounter管理画面 → Settings → API で「読み取り専用」のAPIトークンを発行する。
  2. 環境変数：
       GOATCOUNTER_API_TOKEN … 上記トークン
       GOATCOUNTER_SITE      … 既定値 kakei-hokenshitsu（config.js の goatCounterEndpoint から自動推定も試みる）
       GC_START_DATE / GC_END_DATE … 省略時は直近30日

このスクリプトはトークンの中身を一切表示・保存しない（.gitignore済みのCSVにも書かない）。

取得するもの：
  - パス別ヒット数（記事PV・トップページPVを含む）
  - イベント別カウント（diagnose / result_view / article_to_diagnosis/* / ad_view/* / ad_click/*）
    GoatCounter 側では、これらは path="event/<name>" のヒットとして記録されている
    （script.js / articles.js の track() 実装を参照）。
"""
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
    s = open(cfg_path, encoding="utf-8").read()
    m = re.search(r"goatCounterEndpoint:\s*\"https://([a-z0-9-]+)\.goatcounter\.com", s)
    return m.group(1) if m else None


def api_get(site, token, path, params):
    url = f"https://{site}.goatcounter.com/api/v0{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        fail(f"GoatCounter API がエラーを返しました（{e.code}）: {body[:300]}")
    except urllib.error.URLError as e:
        fail(
            f"GoatCounter ({site}.goatcounter.com) に到達できませんでした: {e.reason}\n"
            "  このサンドボックス環境では egress プロキシの制限で、"
            "GoatCounter への直接アクセス自体がブロックされることがあります。"
            "その場合は、この計測環境にネットワークアクセスがある場所（手元PC・CI等）で実行してください。"
        )


def fetch_all_hits(site, token, start, end):
    """/stats/hits をページングしながら全件取得する（イベントも含む）。"""
    all_hits = []
    after = None
    while True:
        params = {"start": start, "end": end, "daily": "false"}
        if after:
            params["after"] = after
        data = api_get(site, token, "/stats/hits", params)
        hits = data.get("hits", [])
        all_hits.extend(hits)
        if not data.get("more"):
            break
        if not hits:
            break
        after = hits[-1].get("path")
    return all_hits


def main():
    token = os.environ.get("GOATCOUNTER_API_TOKEN")
    if not token:
        fail(
            "環境変数 GOATCOUNTER_API_TOKEN が未設定です。\n"
            "GoatCounter管理画面の Settings → API で読み取り専用トークンを発行し、設定してください。"
        )
    site = os.environ.get("GOATCOUNTER_SITE") or guess_site_code()
    if not site:
        fail("サイトコードを特定できません。環境変数 GOATCOUNTER_SITE を設定してください（例: kakei-hokenshitsu）。")

    end = os.environ.get("GC_END_DATE") or datetime.date.today().isoformat()
    start = os.environ.get("GC_START_DATE") or (datetime.date.fromisoformat(end) - datetime.timedelta(days=30)).isoformat()

    print(f"[fetch_goatcounter] site={site} period={start}〜{end}")

    os.makedirs(OUT_DIR, exist_ok=True)
    hits = fetch_all_hits(site, token, start, end)

    pages = []
    events = []
    for h in hits:
        row = {
            "path": h.get("path"),
            "title": h.get("title"),
            "count": h.get("count"),
            "count_unique": h.get("count_unique"),
            "event": h.get("event", False),
        }
        if row["event"] or (row["path"] or "").startswith("event/"):
            events.append(row)
        else:
            pages.append(row)

    import csv

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

    meta = {"site": site, "start": start, "end": end, "fetched_at": datetime.datetime.now().isoformat()}
    with open(os.path.join(OUT_DIR, "goatcounter_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
