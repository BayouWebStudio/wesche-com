"""Build the curated landing page and full published-HTML catalog."""
from pathlib import Path
import json, html, re
W=Path(__file__).parent
ROOT=Path(__file__).resolve().parents[2]
esc=html.escape
experiments=json.loads((W/'experiments.json').read_text())
assert len({x['url'] for x in experiments})==len(experiments)
recipes=json.loads((W/'curated-recipes.json').read_text()) if (W/'curated-recipes.json').exists() else []
cards=[]
for e in experiments:
    contain=' contain' if e.get('contain') else ''
    disclaimer=f'<p class="disclosure">{esc(e["disclosure"])}</p>' if e.get('disclosure') else ''
    cards.append(f'''<article class="experiment" data-entry data-category="{esc(e['category'])}">
    <a class="thumb{contain}" href="{esc(e['url'])}" tabindex="-1" aria-hidden="true"><img src="/lab/assets/{esc(e['image'])}.webp" width="900" height="600" alt="{esc(e['alt'])}" loading="lazy" decoding="async"><span class="launch">↗</span></a>
    <div class="meta"><span class="chip">{esc(e['label'])}</span><span class="kind">{esc(e['type'])}</span></div>
    <h3><a href="{esc(e['url'])}">{esc(e['title'])}</a></h3><p>{esc(e['description'])}</p>{disclaimer}</article>''')
rows=[]
for i,r in enumerate(recipes,1):
    rows.append(f'''<a class="recipe" href="{esc(r['url'])}"><span class="number">{i:02}</span><div><h3>{esc(r['title'])}</h3><small>{esc(r['label'])}</small></div><p>{esc(r['description'])}</p><span class="arrow" aria-hidden="true">↗</span></a>''')
template=(W/'index.template').read_text()
for key,value in {'EXPERIMENT_COUNT':str(len(experiments)), 'GALLERY':'\n'.join(cards),'RECIPES':'\n'.join(rows)}.items():template=template.replace('{{'+key+'}}',value)
assert '{{' not in template
(ROOT/'lab/index.html').write_text(template)
# Keep raw variants and failures explicitly discoverable, not silently folded into winners.
files=[]
for area in ('lab','dgx'):
    for path in sorted((ROOT/area).rglob('*.html')):
        if path.is_relative_to(ROOT/'lab/tools') or path.is_relative_to(ROOT/'lab/archive') or path.is_relative_to(ROOT/'lab/research'):
            continue
        title=re.search(r'<title[^>]*>(.*?)</title>',path.read_text(),re.S|re.I)
        files.append({'path':str(path.relative_to(ROOT)),'title':title.group(1) if title else path.stem})
entries=[]
for f in files:
    path=f['path']
    if path in ('lab/index.html','dgx/index.html'):continue
    if 'report' in path:category='report';label='Benchmark report'
    elif '/animations/' in path or '/visuals/' in path:category='visual';label='Benchmark visual'
    elif '/scenes/' in path or any(x in path for x in ('/glm.html','/qwen.html','/full.html','/flash.html','/flash-original.html')):category='scene';label='Scene / variant'
    else:category='experiment';label='Experiment / page'
    url='/'+path
    if url.endswith('index.html'):url=url[:-10]
    entries.append({'title':html.unescape(f['title']) or Path(path).stem,'url':url,'category':category,'label':label})
entries=sorted({e['url']:e for e in entries}.values(),key=lambda e:(e['category'],e['title'].lower(),e['url']))
(ROOT/'lab/archive').mkdir(exist_ok=True)
archive_rows='\n'.join(f'''<a class="archive-entry" data-entry data-category="{e['category']}" href="{esc(e['url'])}"><div><h2>{esc(e['title'])}</h2><code>{esc(e['url'])}</code></div><span class="kind">{e['label']} ↗</span></a>''' for e in entries)
archive=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111310"><title>Published Artifact Archive — Wesche Lab</title><meta name="description" content="Search the Wesche Lab published HTML archive: experiments, benchmark visuals, reports, original outputs and variants."><link rel="canonical" href="https://wesche.com/lab/archive/"><link rel="stylesheet" href="/lab/lab.css"><script src="/lab/lab.js" defer></script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><div class="wrap nav-inner"><a class="brand" href="/lab/">WESCHE LAB</a><nav class="main-nav" aria-label="Main navigation"><a href="/lab/">← Back to the lab</a><a href="/dgx/">SparkBench ↗</a></nav></div></header><main class="catalog wrap" id="main"><span class="eyebrow">The published HTML index</span><h1>Nothing swept<br>under the rug.</h1><p class="catalog-lede">Experiments, individual model outputs, historical benchmark visuals and reports. Variants and failed outputs stay visible. Inclusion means the HTML is published—not that it passed a fresh functional test, or that historical results are directly comparable.</p><div class="gallery-tools"><div class="filters" role="group" aria-label="Filter archive"><button class="filter" data-filter="all" aria-pressed="true">All</button><button class="filter" data-filter="experiment" aria-pressed="false">Experiments</button><button class="filter" data-filter="scene" aria-pressed="false">Scenes</button><button class="filter" data-filter="visual" aria-pressed="false">Visuals</button><button class="filter" data-filter="report" aria-pressed="false">Reports</button></div><div class="search-wrap"><label class="sr-only" for="catalog-search">Search archive by model, title or path</label><input type="search" id="catalog-search" placeholder="Search model, title or path…" autocomplete="off"></div></div><p id="catalog-status" role="status" aria-live="polite" class="gallery-status">{len(entries)} published HTML entries</p><div data-catalog="archive entries">{archive_rows}</div><p class="empty" id="catalog-empty" hidden>No matching entries. Try a shorter model name or a different filter.</p><button class="filter" id="clear-search" hidden>Clear search & filters</button></main><footer class="footer"><div class="wrap footer-inner"><span>Wesche Lab / Published HTML inventory</span><a href="/lab/">Return to the lab ↗</a></div></footer></body></html>'''
(ROOT/'lab/archive/index.html').write_text(archive)
# Public manifest contains only curated copy and public URLs; never private inventory paths.
public={'experiments':experiments,'research':recipes,'archive':entries}
(ROOT/'lab/catalog.json').write_text(json.dumps(public,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'experiments':len(experiments),'research':len(recipes),'archive_entries':len(entries)},indent=2))
