#!/usr/bin/env python3
"""記事が出典として挙げている外部の公式ページを、実際に取得して確認する。

GitHub Actions（.github/workflows/source-check.yml）から実行する前提。
Claude Code のクラウド環境はネットワーク設定で外部サイトへの通信が制限されることがあるため、
公式ページの確認は、外部へ通信できる GitHub Actions 上で行い、結果をジョブログに残す。

使い方:
  python3 tools/check-sources.py                 # 記事内の外部リンクをすべて取得し、HTTPステータスを一覧にする
  python3 tools/check-sources.py --text URL ...  # 指定したページ（HTML・PDF・Excel）の本文テキストをログに出す（記載内容の照合用）
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
TEXT_LIMIT = 60000
MAX_BYTES = 20_000_000


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


# ブラウザ（WHATWG）と同じく、Shift_JIS 系の宣言は Windows-31J（cp932）として読む。
# Python の shift_jis は丸数字（①）などの拡張文字を含まず、置換文字になるため。
SJIS_ALIASES = {"shift_jis", "shift-jis", "sjis", "x-sjis", "ms_kanji", "csshiftjis", "windows-31j", "ms932", "cp932"}


def normalize_charset(name):
    name = name.strip().lower()
    return "cp932" if name in SJIS_ALIASES else name


def detect_charset(header_charset, body):
    """HTTPヘッダーに文字コードが無いときは、<meta charset> を見る（Shift_JIS のページ対策）。"""
    if header_charset:
        return normalize_charset(header_charset)
    m = re.search(rb'<meta[^>]+charset\s*=\s*["\']?([A-Za-z0-9_-]+)', body[:4096], re.I)
    if m:
        name = normalize_charset(m.group(1).decode("ascii"))
        try:
            "".encode(name)
            return name
        except LookupError:
            pass
    return "utf-8"


def fetch_raw(url, timeout=30):
    """(status, final_url, content_type, bytes, error) を返す。"""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ja"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            body = res.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                return res.status, res.geturl(), res.headers, b"", f"ファイルが大きすぎます（{MAX_BYTES // 1_000_000}MB超）。途中までしか読めないため、本文の取り出しを中止しました"
            return res.status, res.geturl(), res.headers, body, ""
    except urllib.error.HTTPError as e:
        return e.code, url, None, b"", ""
    except Exception as e:  # DNS・タイムアウト・TLS など
        return None, url, None, b"", f"{type(e).__name__}: {e}"


def fetch(url, timeout=30):
    status, final, headers, body, err = fetch_raw(url, timeout)
    if headers is None:
        return status, final, err
    return status, final, body.decode(detect_charset(headers.get_content_charset(), body), errors="replace")


def kind_of(url, headers, body):
    """本文の種類（pdf / xlsx / html）を、中身の先頭バイト・Content-Type・拡張子から判定する。"""
    ctype = (headers.get_content_type() if headers else "") or ""
    path = urlparse(url).path.lower()
    disposition = (headers.get("Content-Disposition", "") if headers else "").lower()
    if body[:5] == b"%PDF-" or ctype == "application/pdf" or path.endswith(".pdf"):
        return "pdf"
    if body[:2] == b"PK":
        # e-Stat などは /file-download?… から application/octet-stream で配るため、ZIP の中身でも判定する
        if path.endswith(".xlsx") or "spreadsheetml" in ctype or ".xlsx" in disposition or is_xlsx_zip(body):
            return "xlsx"
    return "html"


def is_xlsx_zip(body):
    import io
    import zipfile
    try:
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            return "xl/workbook.xml" in z.namelist()
    except zipfile.BadZipFile:
        return False


def pdf_text(body):
    """PDF の本文を文字にする（pypdf が必要。ワークフローで入れる）。"""
    import io
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(body))
    pages = []
    for i, page in enumerate(reader.pages, 1):
        pages.append(f"--- p.{i} ---\n" + (page.extract_text() or ""))
    return "\n".join(pages)


def xlsx_text(body):
    """Excel（.xlsx）の各シートを、タブ区切りの行として出す（openpyxl が必要）。"""
    import io
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(body), read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets:
        out.append(f"--- sheet: {ws.title} ---")
        for row in ws.iter_rows(values_only=True):
            cells = ["" if v is None else str(v) for v in row]
            if any(cells):
                out.append("\t".join(cells).rstrip())
    return "\n".join(out)


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
            status, final, headers, body, err = fetch_raw(url)
            kind = kind_of(final, headers, body) if headers is not None else "-"
            print(f"===== {url}\nstatus: {status}  final_url: {final}  kind: {kind}")
            if err:
                print(err)
            elif status and 200 <= status < 300:
                try:
                    if kind == "pdf":
                        text = pdf_text(body)
                    elif kind == "xlsx":
                        text = xlsx_text(body)
                    else:
                        text = page_text(body.decode(detect_charset(headers.get_content_charset(), body), errors="replace"))
                except Exception as e:  # 壊れたファイル・未対応の形式
                    text = f"（本文を取り出せませんでした：{type(e).__name__}: {e}）"
                print(text[:TEXT_LIMIT])
                if len(text) > TEXT_LIMIT:
                    print(f"...（{len(text) - TEXT_LIMIT}文字省略）")
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
