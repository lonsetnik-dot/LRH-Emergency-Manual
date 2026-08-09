import re, glob, html as H
def txt(p): return open(p,encoding='utf-8').read()
proc=txt('procedures/index.html'); lab=txt('labels/index.html'); cod=txt('codes/index.html')

# The map covers the PHYSICAL system, so it is not simply "every card in the manual".
# procedures/ is included whole — every one of those cards is a thing you do to a patient with
# equipment that has to live somewhere. codes/ is included SELECTIVELY: a Codes card only earns a
# row once it has a poster, a defined kit, or a cart/cabinet label. Symptomatic bradycardia does not
# need a drawer; massive hematemesis does. Without that rule the denominator fills with cards that
# can never score, and the coverage bars stop meaning anything.
TOOLS=[('procedures',proc,'all'),('codes',cod,'physical-only')]

CARTS=[]
blk=lab[lab.find('var CARTS = ['):lab.find('/* Cabinets')]
starts=[(m.start(), m.group(1), m.group(2)) for m in re.finditer(r"id:'(\w+)',\s*name:'([^']+)'", blk)]
for i,(pos,cid,cname) in enumerate(starts):
    seg = blk[pos: starts[i+1][0] if i+1<len(starts) else len(blk)]
    drawers=[]
    # allow arbitrary whitespace between fields — the Broselow rows are aligned with spaces
    for dm in re.finditer(r"\{\s*n:\s*'?([^,']+)'?\s*,\s*c:\s*'([^']+)'\s*,(.*?)labels:\s*\[(.*?)\]\s*\}", seg, re.S):
        names=re.findall(r"\{t:'([^']+)'", dm.group(4))
        kind='shelf' if 'shelf:true' in dm.group(3) else ('side panel' if 'side:true' in dm.group(3) else 'drawer')
        if names: drawers.append((dm.group(1).strip(), kind, names))
    CARTS.append((cid,cname,drawers))
ROOM7=[m.group(1) for m in re.finditer(r"\{t:'([^']+)',c:'--p\d',icon:", lab[lab.find('var CABINETS'):])]

LOC={}
for cid,cname,drawers in CARTS:
    for n,kind,names in drawers:
        for nm in names:
            LOC[nm]=('loc-'+cid, ('%s · side panel'%cname) if kind=='side panel' else '%s · %s %s'%(cname,kind,n))
for nm in ROOM7: LOC[nm]=('loc-room7','Room 7 cabinets · %s'%nm)

LABELMAP={
 'procedures':{'c01':['Chest Tube Insertion','Pneumothorax Tray'],'c02':['Thoracostomy','Rib Spreader'],
   'c04':['Burr Hole'],'c05':['Canthotomy Kit'],'c06':['Vascular Access'],
   'c07':['Transvenous Pacing'],'c08':['Procedure Trays'],
   'c09':[],'c10':['Hemorrhage Control 2'],'c11':['Hemorrhage Control 1'],'c12':['Hemorrhage Control 1'],
   'c13':['Postpartum Hemorrhage'],'c14':['Vascular Access'],
   'c15':['SALAD Suction'],'c16':['Chest Drainage']},
 'codes':{'c23':['GI Hemorrhage'],'c24':['Lung Isolation'],'c25':['Epistaxis'],'c26':['Pacemaker Magnet']},
}

TILE={}
for tool,src,_ in TOOLS:
    for m in re.finditer(r'<a href="#(c\d+)"[^>]*>(.*?)</a>', src, re.S):
        sv=re.search(r'<svg.*?</svg>', m.group(2), re.S)
        if sv: TILE.setdefault((tool,m.group(1)), sv.group(0))
POST={}
for d in sorted(glob.glob('posters/*/index.html')):
    hh=txt(d); t=re.search(r'(procedures|codes)/\?from=home#(c\d+)', hh)
    POST[d.split('/')[1]]=dict(qr=bool(re.search(r'class="qr"',hh)),
                               target=(t.group(1),t.group(2)) if t else None)

ROWS=[]
for tool,src,mode in TOOLS:
    for m in re.finditer(r'<article id="(c\d+)"', src):
        cid=m.group(1); st=m.start(); e=src.find('</article>',st); b=src[st:e]
        t=re.search(r'</span>([^<]{3,70})</h2>', b)
        if not t: continue
        figs=[f for f in re.findall(r'<svg[^>]*viewBox="0 0 \d+ \d+"[^>]*>.*?</svg>', b, re.S) if 'width="46"' not in f]
        poster=next((n for n,i in POST.items() if i['target']==(tool,cid)), None)
        labels=[l for l in LABELMAP.get(tool,{}).get(cid,[]) if l in LOC]
        kit=bool(re.search(r'IN THE KIT',b))
        if mode=='physical-only' and not (poster or labels or kit): continue
        places=[]
        for l in labels:
            v=LOC[l]
            if v not in places: places.append(v)
        ROWS.append(dict(tool=tool,id=cid,title=re.sub(r'\s+',' ',t.group(1)).strip().replace('&amp;','&'),
          tile=TILE.get((tool,cid),''),fig=figs[0] if figs else '',nfig=len(figs),
          kit=kit,poster=poster,
          qr=POST[poster]['qr'] if poster else False,labels=labels,places=places))
ROWS.sort(key=lambda r:(r['tool'],r['id']))

rows=''
for r in ROWS:
    poster=('<a href="../posters/%s/">%s</a>'%(r['poster'],r['poster'])) if r['poster'] else '—'
    labels='<br>'.join(r['labels']) if r['labels'] else '—'
    place='<br>'.join('<a href="../labels/#%s">%s</a>'%(a,H.escape(x)) for a,x in r['places']) if r['places'] else '—'
    fig=('<div class="figbox">%s</div>%s'%(r['fig'],'<i style="font-style:normal;font-size:10px;color:#5a6a78">%d figures</i>'%r['nfig'] if r['nfig']>1 else '')) if r['fig'] else '<span class="n">no figure</span>'
    rows+=('<tr><td class="ic">%s</td><td class="fg">%s</td><td class="ti"><a href="../%s/?from=home#%s"><b>%s</b></a><i>%s &middot; %s</i></td>'%(r['tile'],fig,r['tool'],r['id'],H.escape(r['title']),r['tool'],r['id']))
    rows+=(('<td class="y">%s</td>'%poster) if r['poster'] else '<td class="n">—</td>')
    rows+=('<td class="y">QR → card</td>' if r['qr'] else '<td class="n">—</td>')
    rows+=(('<td class="y">%s</td>'%place) if r['places'] else '<td class="n">not located</td>')
    rows+=(('<td class="y">%s</td>'%labels) if r['labels'] else '<td class="n">—</td>')
    rows+=('<td class="y">kit defined</td>' if r['kit'] else '<td class="n">—</td>')
    rows+='</tr>'

tot=len(ROWS)
def pct(k): return sum(1 for r in ROWS if k(r))
summary=[('Figure on the card',pct(lambda r:r['fig'])),('Printable poster',pct(lambda r:r['poster'])),
 ('QR poster → card',pct(lambda r:r['qr'])),('Located on a cart / cabinet',pct(lambda r:r['places'])),
 ('Cart / cabinet label',pct(lambda r:r['labels'])),('Kit contents defined',pct(lambda r:r['kit']))]
cards=''.join('<div class="stat"><b>%d<span>/%d</span></b><i>%s</i><div class="bar"><span style="width:%d%%"></span></div></div>'%(v,tot,k,round(v/tot*100)) for k,v in summary)

idx=''
for cid,cname,drawers in CARTS:
    items=''.join('<li><b>%s %s</b> — %s</li>'%(kind,n,' · '.join(names)) for n,kind,names in drawers)
    idx+='<div class="place"><h3><a href="../labels/#loc-%s">%s</a></h3><ul>%s</ul></div>'%(cid,cname,items)
idx+='<div class="place"><h3><a href="../labels/#loc-room7">Room 7 cabinets</a></h3><ul>%s</ul></div>'%(''.join('<li>%s</li>'%x for x in ROOM7))

h=txt('system/index.html')
h=re.sub(r'<div class="stats">.*?</div>\s*</div>\s*<table>','<div class="stats">'+cards+'</div>\n<table>',h,flags=re.S)
h=re.sub(r'<tbody>.*?</tbody>','<tbody>'+rows+'</tbody>',h,flags=re.S)
h=re.sub(r'<b>LOCATION</b> — the card states\s*where the kit is stored\.',
 '<b>WHERE IT LIVES</b> — derived from the cart map that prints the labels, not asserted here.',h,flags=re.S)
h=re.sub(r'<div class="places">.*?</div>\s*</div></body></html>','<div class="places">'+idx+'</div></div></body></html>',h,flags=re.S)
open('system/index.html','w',encoding='utf-8').write(h)
print('regenerated')
for k,v in summary: print(f'  {k:30s} {v}/{tot}')
print('  carts parsed:', [(c[1], len(c[2])) for c in CARTS])
