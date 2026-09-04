#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
家計の保健室 Growth Brief を生成する。

article_registry.json（静的・常にある）と、
tools/growth/data/ にある最新の gsc_*.csv / goatcounter_*.csv（あれば）を突き合わせて、
記事をA〜Fに分類し、tools/growth/reports/growth-brief-<日付>.md を書き出す。

方針（ユーザー指示を厳守）：
  - サイト本体（title/description/本文/H1/URL/canonical/広告位置/家計カルテUI）は一切変更しない。
  - このスクリプトはレポートを書き出すだけで、既存イベントを新設しない。
  - データが無い/足りない場合は「変更しない」を正しい結論として出力する。
  - 公開から日が浅い記事（既定14日未満）は F（失敗）と即断せず、「判定保留」として扱う。
"""
import csv
import datetime
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
REPORTS_DIR = os.path.join(HERE, "reports")
ROOT = os.path.dirname(os.path.dirname(HERE))

# ---- 分類の閾値（プレースホルダー。実データが貯まったら見直す） ----
YOUNG_ARTICLE_DAYS = 14          # これより新しい記事は F 判定を保留する
MIN_IMPRESSIONS_FOR_JUDGEMENT = 20  # これ未満は「表示自体がほぼ無い」寄り
MIN_PAGEVIEWS_FOR_JUDGEMENT = 20    # 記事→家計チェック遷移率を判断できる最低PV
POSITION_C_LOW, POSITION_C_HIGH = 8, 20


def latest_dated_file(prefix):
    files = sorted(glob.glob(os.path.join(DATA_DIR, f"{prefix}_*.csv")))
    return files[-1] if files else None


def read_csv(path):
    if not path or not os.path.exists(path):
        return []
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def slug_from_page_url(url):
    m = re.search(r"/articles/([a-z0-9-]+)/?$", url or "")
    return m.group(1) if m else None


def slug_from_path(path):
    if not path:
        return None
    if path == "/":
        return "__home__"
    m = re.search(r"^/articles/([a-z0-9-]+)/?$", path)
    return m.group(1) if m else None


def load_article_registry():
    reg_path = os.path.join(DATA_DIR, "article_registry.json")
    if not os.path.exists(reg_path):
        raise SystemExit(
            "article_registry.json がありません。先に `python3 tools/growth/article_registry.py` を実行してください。"
        )
    return json.load(open(reg_path, encoding="utf-8"))


def days_since(date_str):
    if not date_str:
        return None
    try:
        d = datetime.date.fromisoformat(date_str)
    except ValueError:
        return None
    return (datetime.date.today() - d).days


def build_search_index():
    """GSCのページ単位CSVを slug -> {impressions, clicks, ctr, position} に変換する。"""
    path = latest_dated_file("gsc_pages")
    rows = read_csv(path)
    out = {}
    for r in rows:
        slug = slug_from_page_url(r.get("page"))
        key = slug or "__home__"
        out[key] = {
            "impressions": int(float(r.get("impressions") or 0)),
            "clicks": int(float(r.get("clicks") or 0)),
            "ctr": float(r.get("ctr") or 0),
            "position": float(r.get("position") or 0),
        }
    return out, path


def build_query_rows():
    path = latest_dated_file("gsc_queries")
    return read_csv(path), path


def build_goatcounter_index():
    """GoatCounterのページ単位CSVを slug -> pageviews に変換する。"""
    path = latest_dated_file("goatcounter_pages")
    rows = read_csv(path)
    out = {}
    for r in rows:
        slug = slug_from_path(r.get("path"))
        if not slug:
            continue
        out[slug] = out.get(slug, 0) + int(float(r.get("count") or 0))
    return out, path


def build_event_index():
    """GoatCounterのイベントCSVを event種別ごとに集計する。"""
    path = latest_dated_file("goatcounter_events")
    rows = read_csv(path)
    article_to_diagnosis = {}   # slug -> count
    ad_view = {}                 # slot -> count
    ad_click = {}                # slot -> count
    totals = {"diagnose": 0, "result_view": 0}
    for r in rows:
        p = re.sub(r"^event/", "", r.get("path") or "")
        count = int(float(r.get("count") or 0))
        if p == "diagnose":
            totals["diagnose"] += count
        elif p == "result_view":
            totals["result_view"] += count
        elif p.startswith("article_to_diagnosis/"):
            slug = p.split("/", 1)[1]
            article_to_diagnosis[slug] = article_to_diagnosis.get(slug, 0) + count
        elif p.startswith("ad_view/"):
            slot = p.split("/", 1)[1]
            ad_view[slot] = ad_view.get(slot, 0) + count
        elif p.startswith("ad_click/"):
            slot = p.split("/", 1)[1]
            ad_click[slot] = ad_click.get(slot, 0) + count
    return {
        "article_to_diagnosis": article_to_diagnosis,
        "ad_view": ad_view,
        "ad_click": ad_click,
        "totals": totals,
    }, path


def classify(article, search, pv, a2d, young_days):
    """記事をA〜Fに分類する。データが無い軸は判定に使わない。"""
    if young_days is not None and young_days < YOUNG_ARTICLE_DAYS:
        return "判定保留（公開間もない）", "公開からまだ日が浅く、数日のデータで判定しない"

    if not search and not pv:
        return "判定不能（データ不足）", "GSC・GoatCounterのデータが未取得"

    impressions = search.get("impressions", 0) if search else 0
    clicks = search.get("clicks", 0) if search else 0
    ctr = search.get("ctr", 0) if search else 0
    position = search.get("position", 0) if search else 0

    if impressions and impressions < MIN_IMPRESSIONS_FOR_JUDGEMENT and not pv:
        return "F", "表示回数がほぼ無い（検索需要／インデックス状況を切り分ける）"

    reasons = []
    tag_candidates = []

    if POSITION_C_LOW <= position <= POSITION_C_HIGH:
        tag_candidates.append("C")
        reasons.append(f"掲載順位 {position:.1f} 位（8〜20位帯）")

    if pv and pv >= MIN_PAGEVIEWS_FOR_JUDGEMENT:
        rate = (a2d / pv) if pv else 0
        if rate < 0.02:
            tag_candidates.append("D")
            reasons.append(f"記事→家計チェック遷移率 {rate:.1%}（PV {pv} / 遷移 {a2d}）")
        elif rate >= 0.08:
            tag_candidates.append("E")
            reasons.append(f"記事→家計チェック遷移率 {rate:.1%}（成功パターン候補）")

    if impressions >= MIN_IMPRESSIONS_FOR_JUDGEMENT:
        if clicks > 0 and ctr < 0.02:
            tag_candidates.append("B")
            reasons.append(f"CTR {ctr:.1%}（表示はあるがクリックされにくい）")
        elif clicks > 0 and ctr >= 0.05:
            tag_candidates.append("A")
            reasons.append(f"CTR {ctr:.1%} で表示・クリックとも伸びている")

    if not tag_candidates:
        return "判定不能（データ不足）", "軸ごとの閾値に届かず、いずれにも分類できない"
    return "/".join(tag_candidates), "、".join(reasons)


def render_markdown(context):
    lines = []
    lines.append("# 家計の保健室 Growth Brief")
    lines.append("")
    lines.append(f"- 生成日: {context['generated_at']}")
    lines.append(f"- 基準日（Growth Loop ベースライン）: 2026-09-04")
    lines.append(f"- GSCデータ: {context['gsc_status']}")
    lines.append(f"- GoatCounterデータ: {context['gc_status']}")
    lines.append("")

    if context["no_data"]:
        lines.append("## 結論：変更しない")
        lines.append("")
        lines.append(
            "GSC・GoatCounterいずれも実データを取得できていないため、"
            "今回は記事の評価・改善対象の選定を行いません。"
            "データ不足の状態で変更を行わないことを、正しい結論として扱います。"
        )
        lines.append("")
        lines.append("### 次にやること（手動）")
        lines.append("")
        lines.append("1. Google Search Console でプロパティを確認し、サービスアカウントを追加する")
        lines.append("2. GoatCounter管理画面で読み取り専用APIトークンを発行する")
        lines.append("3. `tools/growth/README.md` の手順で環境変数を設定し、"
                      "`fetch_gsc.py` / `fetch_goatcounter.py` を実行する")
        lines.append("4. `build_growth_brief.py` を再実行する")
        lines.append("")
        return "\n".join(lines)

    lines.append("## Search")
    lines.append("")
    lines.append("### 表示回数 上位10記事")
    lines.append("")
    lines.append(render_table(context["top_impressions"], ["slug", "impressions", "clicks", "ctr", "position"]))
    lines.append("")
    lines.append("### クリック 上位10記事")
    lines.append("")
    lines.append(render_table(context["top_clicks"], ["slug", "impressions", "clicks", "ctr", "position"]))
    lines.append("")
    lines.append("### CTR改善候補（表示は十分だがCTRが弱い）")
    lines.append("")
    lines.append(render_table(context["low_ctr"], ["slug", "impressions", "clicks", "ctr", "position"]))
    lines.append("")
    lines.append("### 8〜20位の記事（本文・内部リンク改善候補）")
    lines.append("")
    lines.append(render_table(context["mid_position"], ["slug", "impressions", "clicks", "ctr", "position"]))
    lines.append("")

    lines.append("## Content → Diagnosis")
    lines.append("")
    lines.append("### 記事→家計チェック遷移 上位")
    lines.append("")
    lines.append(render_table(context["top_transition"], ["slug", "pageviews", "article_to_diagnosis", "rate"]))
    lines.append("")
    lines.append("### 遷移が弱い記事")
    lines.append("")
    lines.append(render_table(context["low_transition"], ["slug", "pageviews", "article_to_diagnosis", "rate"]))
    lines.append("")

    lines.append("## Diagnosis")
    lines.append("")
    lines.append(f"- diagnose（診断完了・送信ベース）: {context['diagnose_total']}")
    lines.append(f"- result_view（結果表示）: {context['result_view_total']}")
    lines.append(
        "- 診断開始数と診断完了数の分離：**現状のイベントでは算出できません**"
        "（`diagnose` と `result_view` は同一の送信操作で同時に発火するため）。"
    )
    lines.append("")

    lines.append("## Affiliate")
    lines.append("")
    lines.append(render_table(context["ad_rows"], ["slot", "ad_view", "ad_click", "ctr"]))
    lines.append("")
    lines.append(
        "- ASP成果（CV・承認・報酬）は自動取得していません（今回スクレイピングは行わない方針のため）。"
        "手動でASP管理画面と突き合わせてください。"
    )
    lines.append("")

    lines.append("## 記事分類（A〜F）")
    lines.append("")
    lines.append(render_table(context["classification"], ["slug", "class", "reason"]))
    lines.append("")

    lines.append("## Next Action（最大3件）")
    lines.append("")
    if context["next_actions"]:
        for i, a in enumerate(context["next_actions"], 1):
            lines.append(f"{i}. {a}")
    else:
        lines.append("- データ不足のため、今回は「変更しない」を結論とします。")
    lines.append("")

    return "\n".join(lines)


def render_table(rows, cols):
    if not rows:
        return "_該当データなし_"
    header = "| " + " | ".join(cols) + " |"
    sep = "| " + " | ".join("---" for _ in cols) + " |"
    body = []
    for r in rows:
        body.append("| " + " | ".join(str(r.get(c, "")) for c in cols) + " |")
    return "\n".join([header, sep] + body)


def main():
    os.makedirs(REPORTS_DIR, exist_ok=True)
    registry = load_article_registry()

    search_index, gsc_pages_path = build_search_index()
    query_rows, gsc_queries_path = build_query_rows()
    pv_index, gc_pages_path = build_goatcounter_index()
    events, gc_events_path = build_event_index()

    has_gsc = bool(search_index)
    has_gc = bool(pv_index) or any(events["totals"].values()) or events["article_to_diagnosis"]

    gsc_status = f"あり（{os.path.basename(gsc_pages_path)}）" if has_gsc else "なし（未取得）"
    gc_status = f"あり（{os.path.basename(gc_pages_path) if gc_pages_path else os.path.basename(gc_events_path)}）" if has_gc else "なし（未取得）"

    classification_rows = []
    search_rows_for_table = []
    transition_rows = []

    for art in registry:
        slug = art["slug"]
        search = search_index.get(slug)
        pv = pv_index.get(slug, 0)
        a2d = events["article_to_diagnosis"].get(slug, 0)
        yd = days_since(art.get("date_published"))

        cls, reason = classify(art, search, pv, a2d, yd)
        classification_rows.append({"slug": slug, "class": cls, "reason": reason})

        if search:
            search_rows_for_table.append({
                "slug": slug,
                "impressions": search["impressions"],
                "clicks": search["clicks"],
                "ctr": f"{search['ctr']:.1%}",
                "position": f"{search['position']:.1f}",
            })
        if pv:
            rate = (a2d / pv) if pv else 0
            transition_rows.append({
                "slug": slug, "pageviews": pv, "article_to_diagnosis": a2d, "rate": f"{rate:.1%}",
            })

    top_impressions = sorted(search_rows_for_table, key=lambda r: -int(r["impressions"]))[:10]
    top_clicks = sorted(search_rows_for_table, key=lambda r: -int(r["clicks"]))[:10]
    low_ctr = sorted(
        [r for r in search_rows_for_table if int(r["impressions"]) >= MIN_IMPRESSIONS_FOR_JUDGEMENT],
        key=lambda r: float(r["ctr"].rstrip("%")),
    )[:10]
    mid_position = [r for r in search_rows_for_table if POSITION_C_LOW <= float(r["position"]) <= POSITION_C_HIGH]
    mid_position = sorted(mid_position, key=lambda r: float(r["position"]))[:10]

    top_transition = sorted(transition_rows, key=lambda r: -float(r["rate"].rstrip("%")))[:10]
    low_transition = sorted(
        [r for r in transition_rows if int(r["pageviews"]) >= MIN_PAGEVIEWS_FOR_JUDGEMENT],
        key=lambda r: float(r["rate"].rstrip("%")),
    )[:10]

    ad_rows = []
    all_slots = sorted(set(list(events["ad_view"].keys()) + list(events["ad_click"].keys())))
    for slot in all_slots:
        v = events["ad_view"].get(slot, 0)
        c = events["ad_click"].get(slot, 0)
        ctr = f"{(c / v):.1%}" if v else "-"
        ad_rows.append({"slot": slot, "ad_view": v, "ad_click": c, "ctr": ctr})

    next_actions = []
    if has_gsc or has_gc:
        for r in classification_rows:
            if r["class"].startswith("D") and len(next_actions) < 3:
                next_actions.append(f"{r['slug']}: {r['reason']}。記事内CTA・導線の見直し候補")
        for r in classification_rows:
            if r["class"].startswith("B") and len(next_actions) < 3:
                next_actions.append(f"{r['slug']}: {r['reason']}。title/description改善候補")
        for r in classification_rows:
            if r["class"].startswith("C") and len(next_actions) < 3:
                next_actions.append(f"{r['slug']}: {r['reason']}。本文・内部リンク強化候補")

    context = {
        "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "gsc_status": gsc_status,
        "gc_status": gc_status,
        "no_data": not (has_gsc or has_gc),
        "top_impressions": top_impressions,
        "top_clicks": top_clicks,
        "low_ctr": low_ctr,
        "mid_position": mid_position,
        "top_transition": top_transition,
        "low_transition": low_transition,
        "diagnose_total": events["totals"]["diagnose"],
        "result_view_total": events["totals"]["result_view"],
        "ad_rows": ad_rows,
        "classification": classification_rows,
        "next_actions": next_actions[:3],
    }

    md = render_markdown(context)
    today = datetime.date.today().isoformat()
    out_path = os.path.join(REPORTS_DIR, f"growth-brief-{today}.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(md)

    print(f"Growth Brief を書き出しました: {os.path.relpath(out_path, ROOT)}")
    if context["no_data"]:
        print("→ 実データが無いため、結論は「変更しない」です。")


if __name__ == "__main__":
    main()
