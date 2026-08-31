import re,os,json,glob,html,sys
#!/usr/bin/env python3
"""
公開前チェック（リポジトリのルートで `python3 tools/audit-site.py` を実行）。

機械的に検証するもの:
  - ASP発行コードが原文どおりか（URL・アンカーテキスト・計測imgの改変が無いか）
  - 記事の数値が一次情報どおりか（家計調査2025年 第3-1表・3人世帯）
  - 断定を避けるべき表現が、断定的に使われていないか
  - canonical / title / description / 構造化データ(JSON妥当性)
  - 記事の公開日・更新日・署名・出典・パンくず・診断CTA
  - 1記事あたりの広告枠が1つ以内で、広告ラベルが付いているか
  - 内部リンク切れ、sitemap と実ファイルの一致

外部の一次情報そのものへは接続しません（この環境からは到達できないため）。
数値の突き合わせは、上の expected / figures に人が確認した値を入れて行います。
"""

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
fails=[]; warns=[]

# ---- 1) ASP発行コードの原文一致 ----
cfg=open('config.js',encoding='utf-8').read()
expected={
 "mobile_a8":'<a href="https://px.a8.net/svt/ejp?a8mat=4BA0X8+462SA+3UM0+5YRHE" rel="nofollow">格安SIMなら【ＬＩＢＭＯ】</a>',
 "internet_a8":'<a href="https://px.a8.net/svt/ejp?a8mat=4BA0X8+LFNBU+4VXM+60OXE" rel="nofollow">次世代接続方式v6プラス利用可能光回線【イツキ光】</a>',
 "elec_a8":'<a href="https://px.a8.net/svt/ejp?a8mat=4BA0X8+SKUL6+3SPO+TS3OI" rel="nofollow">電気料金プランを比較して電気代を今よりお安く！【電気チョイス】</a>',
 "gas_a8":'<a href="https://px.a8.net/svt/ejp?a8mat=4BA0X8+UYL0A+2W92+NVHCY" rel="nofollow">プロパンガス料金を比較し、最適なガス会社を選ぼう！【エネピ】</a>',
 "mammoth":'<a href="https://h.accesstrade.net/sp/cc?rk=010039sr00owy6" rel="nofollow" referrerpolicy="no-referrer-when-downgrade">無料保険相談<img src="https://h.accesstrade.net/sp/rr?rk=010039sr00owy6" width="1" height="1" border="0" alt=""></a>',
 "chochiku":'<a href="https://h.accesstrade.net/sp/cc?rk=0100pedo00owy6" rel="nofollow" referrerpolicy="no-referrer-when-downgrade">貯蓄の無料相談サイト「ガーデン」<img src="https://h.accesstrade.net/sp/rr?rk=0100pedo00owy6" width="1" height="1" border="0" alt=""></a>',
}
for k,v in expected.items():
    if v not in cfg: fails.append(f"[ASPコード] {k} が原文一致しない")
# 計測用imgの本数（A8は別行、アクセストレードはa内）
for beacon in ["www11.a8.net/0.gif?a8mat=4BA0X8+462SA+3UM0+5YRHE",
               "www14.a8.net/0.gif?a8mat=4BA0X8+LFNBU+4VXM+60OXE",
               "www16.a8.net/0.gif?a8mat=4BA0X8+SKUL6+3SPO+TS3OI",
               "www17.a8.net/0.gif?a8mat=4BA0X8+UYL0A+2W92+NVHCY"]:
    if beacon not in cfg: fails.append(f"[ASPコード] 計測用img欠落: {beacon}")

# ---- 2) 家計調査の数値が記事に正しく入っているか ----
art2='articles/3nin-kazoku-seikatsuhi/index.html'
a2=open(art2,encoding='utf-8').read()
figures={"324,047":"消費支出","92,240":"食料","17,629":"住居","25,626":"光熱・水道",
 "13,475":"家具・家事用品","10,034":"被服及び履物","16,445":"保健医療","49,752":"交通・通信",
 "10,887":"教育","29,433":"教養娯楽","58,525":"その他の消費支出"}
for num,name in figures.items():
    if num not in a2: fails.append(f"[一次情報] {name} {num} が記事に無い")
for must in ["第3-1表","2025年","2026年2月6日","家計調査"]:
    if must not in a2: fails.append(f"[出典] '{must}' の記載が無い")
# 禁止表現
# 断定的に使っている場合のみ違反（否定文脈は可）
for ng in ["適正生活費","理想額","適正額","固定費の平均","固定費平均"]:
    for m in re.finditer(re.escape(ng), a2):
        ctx = a2[m.start(): m.start()+80]
        if not re.search(r"(ありません|ではない|できません|していません|存在しません|扱わず|扱いません|使えません|限りません|算出していません)", ctx):
            fails.append(f"[禁止表現] '{ng}' が断定的に使われている: ...{ctx[:50]}...")

# ---- 3) 全HTMLの構造チェック ----
pages=['index.html','articles/index.html','about/index.html','editorial-policy/index.html']+ \
      sorted(glob.glob('articles/*/index.html'))
pages=[p for p in dict.fromkeys(pages)]
internal=set(); defined=set()
for p in pages:
    s=open(p,encoding='utf-8').read()
    if '<link rel="canonical"' not in s: fails.append(f"[canonical] {p}")
    if 'name="robots"' in s and 'noindex' in s: fails.append(f"[noindex] {p}")
    if '<title>' not in s: fails.append(f"[title] {p}")
    if 'name="description"' not in s: fails.append(f"[description] {p}")
    # ld+json の妥当性
    for m in re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try: json.loads(m)
        except Exception as e: fails.append(f"[構造化データ] {p}: {e}")
    # 記事は日付・署名・出典・パンくず
    if p.startswith('articles/') and p!='articles/index.html':
        for need,label in [('datePublished','公開日'),('dateModified','更新日'),
                           ('家計の保健室 編集部','署名'),('class="sources"','出典'),
                           ('class="crumbs"','パンくず'),('data-track="to-diagnosis"','診断CTA')]:
            if need not in s: fails.append(f"[記事要素] {p} に{label}が無い")
        # 広告の出し過ぎ（1記事1枠まで）
        n_ad=s.count('data-ad-slot=')
        if n_ad>1: fails.append(f"[広告過多] {p} に広告枠が{n_ad}個")
        if 'ad-card' in s and 'class="ad-tag">広告' not in s: fails.append(f"[広告表示] {p} に広告ラベルが無い")
    # 内部リンク収集
    for href in re.findall(r'href="(/[^"#?]*)', s):
        internal.add(href)
    defined.add('/'+p.replace('index.html',''))

# ---- 4) 内部リンク切れ ----
def exists(u):
    u=u.lstrip('/')
    if u=='' : return os.path.exists('index.html')
    if u.endswith('/'): return os.path.exists(u+'index.html')
    return os.path.exists(u)
for u in sorted(internal):
    if not exists(u): fails.append(f"[リンク切れ] {u}")

# ---- 5) sitemap と実ファイルの一致 ----
sm=open('sitemap.xml',encoding='utf-8').read()
locs=re.findall(r'<loc>https://kakei-hokenshitsu\.com(/[^<]*)</loc>', sm)
for l in locs:
    if not exists(l): fails.append(f"[sitemap] 実体が無い: {l}")
for p in pages:
    path='/'+p.replace('index.html','')
    if path not in locs: fails.append(f"[sitemap] 未登録: {path}")

print("=== 検証結果 ===")
print(f"対象ページ: {len(pages)}  内部リンク: {len(internal)}  sitemap: {len(locs)}")
if warns: [print("WARN:",w) for w in warns]
if fails:
    print(f"\n❌ 不合格 {len(fails)}件"); [print(" -",f) for f in fails]; sys.exit(1)
print("\n✅ すべて合格")
