#!/usr/bin/env python3
"""記事が出典として挙げている外部の公式ページを、実際に取得して確認する。

GitHub Actions（.github/workflows/source-check.yml）から実行する前提。
Claude Code のクラウド環境はネットワーク設定で外部サイトへの通信が制限されることがあるため、
公式ページの確認は、外部へ通信できる GitHub Actions 上で行い、結果をジョブログに残す。

使い方:
  python3 tools/check-sources.py                 # 記事内の外部リンクをすべて取得し、HTTPステータスを一覧にする
  python3 tools/check-sources.py --text URL ...  # 指定したページの本文テキストをログに出す（記載内容の照合用）
  python3 tools/check-sources.py --domains       # 記事が参照している外部ドメインの一覧（環境の許可リスト用）

終了コード: 404/410（ページが無くなった）があれば 1。それ以外の取得失敗は警告として表示するだけ
（公式サイトがボットからのアクセスを一時的に拒むことがあり、記事の誤りとは限らないため）。
"""
import argparse
import glob
import html
import os
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OWN_HOSTS = {"kakei-hokenshitsu.com", "www.kakei-hokenshitsu.com", "schema.org"}
UA = "kakei-hokenshitsu-source-check/1.0 (+https://kakei-hokenshitsu.com/editorial-policy/)"
TEXT_LIMIT = 20000


def cited_urls():
    """記事本文の <a href> に書かれた外部URL（広告コードを含まない記事HTMLのみ）を、記事ごとに集める。"""
    found = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "articles", "*", "index.html"))):
        slug = os.path.basename(os.path.dirname(path))
        src = open(path, encoding="utf-8").read()
        for href in re.findall(r'<a\s[^>]*href="(https?://[^"]+)"', src):
            url = html.unescape(href)
            if urlparse(url).hostname in OWN_HOSTS:
                continue
            found.setdefault(url, set()).add(slug)
    return found


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ja"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            body = res.read(5_000_000)
            charset = res.headers.get_content_charset() or "utf-8"
            return res.status, res.geturl(), body.decode(charset, errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, url, ""
    except Exception as e:  # DNS・タイムアウト・TLS など
        return None, url, f"{type(e).__name__}: {e}"


def page_text(raw):
    raw = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<br\s*/?>|</(p|div|li|tr|h[1-6]|dt|dd|th|td)>", "\n", raw)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    lines = [re.sub(r"[ \t　]+", " ", l).strip() for l in text.splitlines()]
    return "\n".join(l for l in lines if l)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", nargs="+", metavar="URL", help="本文テキストを出すURL")
    ap.add_argument("--domains", action="store_true", help="参照している外部ドメインを一覧にする")
    args = ap.parse_args()

    if args.domains:
        for host in sorted({urlparse(u).hostname for u in cited_urls()}):
            print(host)
        return 0

    if args.text:
        for url in args.text:
            if urlparse(url).scheme not in ("http", "https"):
                print(f"skip (not http/https): {url}")
                continue
            status, final, body = fetch(url)
            print(f"===== {url}\nstatus: {status}  final_url: {final}")
            if status and 200 <= status < 300:
                text = page_text(body)
                print(text[:TEXT_LIMIT])
                if len(text) > TEXT_LIMIT:
                    print(f"...（{len(text) - TEXT_LIMIT}文字省略）")
            elif body:
                print(body)
            print()
        return 0

    gone, warn = [], []
    urls = cited_urls()
    for url, slugs in sorted(urls.items()):
        status, final, err = fetch(url)
        mark = "OK " if status and 200 <= status < 400 else "NG "
        note = f" -> {final}" if final != url else ""
        print(f"{mark}{status or '---'}  {url}{note}  [{', '.join(sorted(slugs))}]" + (f"  ({err})" if status is None else ""))
        if status in (404, 410):
            gone.append(url)
        elif not (status and 200 <= status < 400):
            warn.append(url)
    print(f"\n対象 {len(urls)} 件 / 取得失敗（警告） {len(warn)} 件 / ページ消失（404・410） {len(gone)} 件")
    if gone:
        print("出典ページが無くなっています。記事の出典と記載を見直してください:")
        for u in gone:
            print(f"  {u}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
