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
 # 比較記事（保険相談3社）で横並びに使うコード
 "hoken_garden":'<a href="https://h.accesstrade.net/sp/cc?rk=0100ped000owy6" rel="nofollow" referrerpolicy="no-referrer-when-downgrade">保険の無料相談サイト「ガーデン」<img src="https://h.accesstrade.net/sp/rr?rk=0100ped000owy6" width="1" height="1" border="0" alt=""></a>',
 "hoken_minna":'<a href="https://h.accesstrade.net/sp/cc?rk=0100pfk700owy6" rel="nofollow" referrerpolicy="no-referrer-when-downgrade">みんなの生命保険アドバイザー<img src="https://h.accesstrade.net/sp/rr?rk=0100pfk700owy6" width="1" height="1" border="0" alt=""></a>',
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

# ---- 2b) #1 LPガス制度の記述（一次情報どおりか／断定していないか）----
art1='articles/propane-gas-takai/index.html'
a1=open(art1,encoding='utf-8').read()
for must in ["2024年4月","2024年","2025年4月2日","三部料金制","基本料金","従量料金","設備料金",
             "LPガスの取引適正化について","三部料金制の徹底に関するQ&amp;A"]:
    if must not in a1: fails.append(f"[LPガス制度] '{must}' の記載が無い")
# 既存契約の例外に触れているか
if "外出し表示" not in a1 or "計上禁止" not in a1:
    fails.append("[LPガス制度] 既存契約の例外（外出し表示／計上禁止）の説明が無い")
# 断定的な言い切りの禁止
for ng in ["すべて禁止された","全面的に禁止","一律に禁止","請求はすべてなくなりました"]:
    if ng in a1: fails.append(f"[LPガス制度] 断定表現 '{ng}' が含まれる")

NEG = r"(ありません|ではない|ではありません|とまでは言えません|言えません|誤りです|ものではない|扱わず|扱いません|示していません|作りません|付けません|一択、ではありません)"

def assert_not_asserted(text, phrases, label, fails):
    """禁止語が『断定』として使われている場合だけ違反にする（否定・注意喚起の文脈は可）。"""
    flat = re.sub(r"\s+", " ", text)
    for ng in phrases:
        for m in re.finditer(re.escape(ng), flat):
            ctx = flat[max(0, m.start()-40): m.start()+120]
            if not re.search(NEG, ctx):
                fails.append(f"[{label}] '{ng}' が断定的に使われている: ...{ctx[:60]}...")

# ---- 2c) 第2バッチの一次情報と断定禁止 ----
# #4 通信費（家計調査2025年 第3-1表の「通信」）
a4=open('articles/4nin-kazoku-tsushinhi/index.html',encoding='utf-8').read()
for must in ["12,438","13,328","第3-1表","2025年","交通・通信","自動車等関係費"]:
    if must not in a4: fails.append(f"[#4 一次情報] '{must}' の記載が無い")
assert_not_asserted(a4, ["スマホ代の平均は13,328","13,328円が適正","移動電話通信料の平均","適正額"], "#4 断定", fails)

# #5 ネット回線（SoftBank公式で確認済みの事実／料金は載せない）
a5=open('articles/chintai-net-kaisen/index.html',encoding='utf-8').read()
for must in ["工事不要","ホームルーター","ベストエフォート","5G","速度が低下する場合","確認時点"]:
    if must not in a5: fails.append(f"[#5 一次情報] '{must}' の記載が無い")
assert_not_asserted(a5, ["ホームルーター一択","必ず速い","速度を保証"], "#5 断定", fails)
if "一択にはならない" not in a5 and "一択、ではありません" not in a5:
    fails.append("[#5] 「工事できない＝ホームルーター一択ではない」旨の記載が無い")

# #6 電力切り替え（資源エネルギー庁の確認済み事実）
a6=open('articles/denryoku-kirikae-demerit/index.html',encoding='utf-8').read()
for must in ["送配電網","約15分","スマートメーター","原則無料","約2週間","約4日","無契約"]:
    if must not in a6: fails.append(f"[#6 一次情報] '{must}' の記載が無い")
assert_not_asserted(a6, ["絶対に停電しない","倒産しても絶対に電気は止まりません","解約金はかかりません",
                          "違約金は一切かかりません","最終保障供給があるから大丈夫"], "#6 断定", fails)
if "最終保障供給" in a6: fails.append("[#6] 最終保障供給を家庭向け説明に使用している")

# ---- 2d) 比較記事：順位を作っていないか ----
# 「1位」「★評価」「No.1」を**断定として**使っていないか。
# 「順位は付けません」のような否定文脈は違反にしない（NEG で除外）。
cmp_path = 'articles/hoken-sodan-hikaku/index.html'
if os.path.exists(cmp_path):
    c = open(cmp_path, encoding='utf-8').read()
    assert_not_asserted(c, ["1位", "第1位", "No.1", "ナンバーワン", "★"], "比較 順位", fails)
    # 適合表の必須要素（掲載順の根拠・確認日・使わない選択肢）
    for need, label in [('fit-table__order', '掲載順の根拠'),
                        ('fit-table__checked', '確認日'),
                        ('fit-optout', '使わない選択肢')]:
        if need not in c:
            fails.append(f"[比較] {cmp_path} に{label}が無い")
    # 3社のCTAが同じ器でそろっているか（1社だけ目立たせない）
    for slot in ["fit-cta-garden", "fit-cta-mammoth", "fit-cta-minna"]:
        if slot not in c:
            fails.append(f"[比較CTA] {cmp_path} に {slot} の枠が無い")
    n_cta = c.count('class="fit-ad"')
    if n_cta != 3:
        fails.append(f"[比較CTA] CTA枠が3つではない（{n_cta}個）")
    # 比較表の中で特定の1社だけを主ボタン扱いしていないか
    if 'btn--primary' in c[c.find('fit-table'):c.find('</table>')]:
        fails.append("[比較CTA] 表の中で1社だけ主ボタン扱いしている")
    # 3社ぶんのコードが config.js に原文である前提で参照されているか
    if 'insuranceComparison' not in cfg:
        fails.append("[比較CTA] config.js に insuranceComparison が無い")
    for slot in ["hoken-garden", "hoken-mammoth", "hoken-minna"]:
        if f'"{slot}"' not in cfg:
            fails.append(f"[比較CTA] config.js に {slot} が無い")
    # 報酬額・確定率を編集に持ち込んでいないか
    for ng in ["報酬額が高い", "高単価", "確定率が高いので"]:
        if ng in c:
            fails.append(f"[比較] 報酬に基づく記述: '{ng}'")

# ---- 2e) 記事内CTAの可読性を守るCSSが残っているか ----
# .article-body a（0,1,1）は .btn--primary（0,1,0）に勝つため、
# 打ち消しが消えると記事内の主CTAが「緑地に緑文字」になって読めなくなる。
acss = open('articles.css', encoding='utf-8').read()
for need, label in [('.article-body .btn--primary', '主CTA'),
                    ('.article-body .btn--ghost', '副CTA'),
                    ('.article-body .fit-cta', '比較表のCTA')]:
    if need not in acss:
        fails.append(f"[CTA可読性] articles.css に {label} の色を保つ指定が無い（{need}）")
# 素のリンクだけに色を当てる指定（訪問済みで部品の色が壊れないように）
scss = open('styles.css', encoding='utf-8').read()
if 'a:not([class]):visited' not in scss:
    fails.append("[CTA可読性] styles.css の a:visited が :not([class]) で絞られていない")

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
    # 全ページ共通のブランドヘッダー
    if 'class="brandbar"' not in s: fails.append(f"[ブランドヘッダー] {p} に brandbar が無い")
    if 'class="skip-link"' not in s: fails.append(f"[アクセシビリティ] {p} にスキップリンクが無い")
    # 記事は日付・署名・出典・パンくず
    if p.startswith('articles/') and p!='articles/index.html':
        for need,label in [('datePublished','公開日'),('dateModified','更新日'),
                           ('家計の保健室 編集部','署名'),('class="sources"','出典'),
                           ('class="crumbs"','パンくず'),('data-track="to-diagnosis"','診断CTA')]:
            if need not in s: fails.append(f"[記事要素] {p} に{label}が無い")
        # 出典・診断CTAの見出しは本文の h2 階層に混ぜない（アウトラインを保つ）。
        # クラス名（.sources / .to-diagnosis）は据え置き、見出しだけ section-label に置く。
        m = re.search(r'<section class="sources">(.*?)</section>', s, re.S)
        if not m:
            fails.append(f"[出典] {p} の .sources ブロックが見つからない")
        else:
            if '<h2' in m.group(1): fails.append(f"[見出し構造] {p} の出典が <h2> のまま")
            if 'class="section-label"' not in m.group(1):
                fails.append(f"[出典] {p} の出典に見出しラベルが無い")
        m = re.search(r'<div class="to-diagnosis">(.*?)</div>', s, re.S)
        if not m:
            fails.append(f"[診断CTA] {p} の .to-diagnosis ブロックが見つからない")
        elif '<h2' in m.group(1):
            fails.append(f"[見出し構造] {p} の診断CTAが <h2> のまま")
        # 広告の出し過ぎ（1記事1枠まで）
        n_ad=s.count('data-ad-slot=')
        if n_ad>1: fails.append(f"[広告過多] {p} に広告枠が{n_ad}個")
        if 'ad-card' in s and 'class="ad-tag">広告' not in s: fails.append(f"[広告表示] {p} に広告ラベルが無い")
    # 内部リンク収集
    for href in re.findall(r'href="(/[^"#?]*)', s):
        internal.add(href)
    defined.add('/'+p.replace('index.html',''))

# ---- 3b) 記事カテゴリのアンカーが記事一覧に実在するか ----
idx = open('articles/index.html', encoding='utf-8').read()
for f in sorted(glob.glob('articles/*/index.html')):
    if f == 'articles/index.html': continue
    body = open(f, encoding='utf-8').read()
    for anchor in re.findall(r'href="/articles/#(category-[a-z-]+)"', body):
        if f'id="{anchor}"' not in idx:
            fails.append(f"[カテゴリ] {f} が参照する #{anchor} が記事一覧に無い")
if '準備中のカテゴリ' in idx:
    fails.append("[カテゴリ] 記事一覧に「準備中のカテゴリ」が残っている")

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
