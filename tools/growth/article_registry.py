#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
記事レジストリを生成する（Growth Loop の土台）。

articles/*/index.html を静的解析し、記事ごとの
slug・カテゴリ・タイトル・description・公開日・広告slot などを
tools/growth/data/article_registry.csv / .json に書き出す。

外部アクセス・APIキーは不要。サイト本体（HTML/CSS/JS）は一切変更しない。
tools/audit-site.py と同じく、依存追加を避けるため正規表現で抽出する
（このサイトは14ページのHTMLをベタ書きする方針のため、構造は安定している）。
"""
import csv
import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

CAT_NAMES = {
    "category-basics": "家計を見わたす",
    "category-telecom": "通信費を見直す",
    "category-utilities": "光熱費を見直す",
    "category-contracts": "毎月の契約を見直す",
    "category-insurance": "保険と将来のお金",
}

# 記事に静的に埋め込まれた ad-card の slot（1記事1枠のもの）。
RE_STATIC_AD_SLOT = re.compile(r'data-ad-slot=\\?"([a-zA-Z0-9_-]+)\\?"')


def strip_tags(s):
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extract(path):
    slug = os.path.basename(os.path.dirname(path))
    s = open(path, encoding="utf-8").read()

    def m1(pattern, default=""):
        m = re.search(pattern, s, re.S)
        return m.group(1).strip() if m else default

    title = m1(r"<title>(.*?)</title>")
    title = re.sub(r"｜家計の保健室$", "", title)

    description = m1(r'<meta name="description" content="([^"]*)"')
    canonical = m1(r'<link rel="canonical" href="([^"]*)"')
    article_type = m1(r'data-article-type="([^"]*)"')

    h1 = m1(r'<h1 class="article-title">(.*?)</h1>')
    h1 = strip_tags(h1)

    cat_id = m1(r'<a class="article-cat" href="/articles/#([a-z-]+)">')
    category = CAT_NAMES.get(cat_id, cat_id)

    date_published = m1(r'"datePublished":\s*"([^"]*)"')
    date_modified = m1(r'"dateModified":\s*"([^"]*)"')

    # 広告slot：1記事1枠の静的パターン + 比較記事（insuranceComparison）の特例
    ad_slots = sorted(set(RE_STATIC_AD_SLOT.findall(s)))
    if "insuranceComparison" in s:
        ad_slots = sorted(set(ad_slots) | {"hoken-garden", "hoken-mammoth", "hoken-minna"})

    has_cluster = 'class="cluster"' in s
    has_takeaway = 'class="takeaway"' in s
    next_read_block = m1(r'(<section class="next-read">.*?</section>)')
    next_read_links = len(re.findall(r'<li>\s*<span class="article-list__meta">', next_read_block))

    body_m = re.search(r'<article class="card article-body">(.*?)<div class="to-diagnosis">', s, re.S)
    body_text = strip_tags(body_m.group(1)) if body_m else ""

    return {
        "slug": slug,
        "url": f"/articles/{slug}/",
        "category_id": cat_id,
        "category": category,
        "type": article_type,
        "title": title,
        "description": description,
        "h1": h1,
        "canonical": canonical,
        "date_published": date_published,
        "date_modified": date_modified,
        "has_ads": bool(ad_slots),
        "ad_slots": "|".join(ad_slots),
        "has_cluster": has_cluster,
        "has_takeaway": has_takeaway,
        "next_read_count": next_read_links,
        "body_chars": len(body_text),
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    paths = sorted(glob.glob(os.path.join(ROOT, "articles", "*", "index.html")))
    rows = [extract(p) for p in paths]

    csv_path = os.path.join(OUT_DIR, "article_registry.csv")
    json_path = os.path.join(OUT_DIR, "article_registry.json")

    fieldnames = list(rows[0].keys()) if rows else []
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"記事 {len(rows)} 件を書き出しました：")
    print(f"  {os.path.relpath(csv_path, ROOT)}")
    print(f"  {os.path.relpath(json_path, ROOT)}")
    no_ads = sum(1 for r in rows if not r["has_ads"])
    print(f"  広告なし: {no_ads} 件 / 広告あり: {len(rows) - no_ads} 件")


if __name__ == "__main__":
    main()
