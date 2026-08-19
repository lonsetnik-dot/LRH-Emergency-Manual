import qrcode, io, json
from pyzbar.pyzbar import decode
from PIL import Image

# The QR pixels bake in the site's domain, so they are regenerated per edition:
# the domain comes from site.config.json (the same file build.mjs substitutes
# into every page), never hardcoded here.
BASE='https://'+json.load(open('site.config.json'))['domain']
# Destination per label. Only where a real card exists — no invented targets.
DEST = {
 # --- code cart ---
 # Cart-front category faces point at their own drawer anchor; item faces point at the card that
 # uses them. Drawer 5 is the deep drawer and carries two category faces.
 'Intubation':             '/codes/?from=home#d1',
 'I.V. Supplies':          '/codes/?from=home#d5',
 'Medications':            '/codes/?from=home#d3',
 'Suction':                '/codes/?from=home#d4',
 'I.V. Fluids':            '/codes/?from=home#d4',
 'Surgical / Supraglottic':'/codes/?from=home#d2',
 'Miscellaneous':          '/codes/?from=home#d5',
 'OPA / NPA':              '/codes/?from=home#c06',
 'End-Tidal CO₂':          '/codes/?from=home#c06',
 'ETT / Bougie':           '/codes/?from=home#c06',
 'Video Laryngoscopy':     '/codes/?from=home#c06',
 'iGel':                   '/codes/?from=home#c06',
 'Direct Laryngoscopy':    '/codes/?from=home#c06',
 'EZ-IO':                  '/codes/?from=home#c01',
 'Jet Ventilation':        '/codes/?from=home#c18',
 'Front of Neck Access':   '/codes/?from=home#c18',
 # --- trauma cart ---
 'Scalpel':                '/procedures/?from=home',
 'Needle Decompression':   '/procedures/?from=home#c01',
 'Hemorrhage Control 1':   '/procedures/?from=home#c12',
 'Hemorrhage Control 2':   '/procedures/?from=home#c10',
 'Canthotomy Kit':         '/procedures/?from=home#c05',
 'Pneumothorax Tray':      '/procedures/?from=home#c01',
 'Burr Hole':              '/procedures/?from=home#c04',
 'Thoracostomy':           '/procedures/?from=home#c02',
 'Rib Spreader':           '/procedures/?from=home#c02',
 'Chest Tube Insertion':   '/procedures/?from=home#c01',
 # --- OB cart ---
 'Airway / Breathing':     '/ob-neonatal/?from=home#cart',
 'Circulation':            '/ob-neonatal/?from=home#cart',
 'Postpartum Hemorrhage':  '/procedures/?from=home#c13',
 'C-section':              '/ob-neonatal/?from=home#c10',
 # --- cabinets ---
 'Airway':                 '/codes/?from=home#c06',
 'Vascular Access':        '/procedures/?from=home#c06',
 'Fluids':                 '/codes/?from=home#c12',
 'Chest Drainage':         '/procedures/?from=home#c01',
 'Monitoring':             '/codes/?from=home#c06',
 'GI Hemorrhage':          '/codes/?from=home#c23',
 'Lung Isolation':         '/codes/?from=home#c24',
 'Epistaxis':              '/codes/?from=home#c25',
 'SALAD Suction':          '/procedures/?from=home#c15',
 'Pacemaker Magnet':       '/codes/?from=home#c26',
 'Procedure Trays':        '/procedures/?from=home#c16',
 # Kit build sheets and their 4x6 cabinet cards resolve to the procedure they belong to.
 # Retargeted 2026-08-13: the kit card's QR is the entry point to the CHECK,
 # not to the reading. A tech scanning the card on the cabinet wants the walk
 # screen; the contents are already on the card in their hand.
 'Chest Tube Kit':           '/equipment-readiness/?from=qr#kitcheck',
 'Thoracotomy Tray':         '/procedures/?from=home#c02',
 'Burr Hole Kit':            '/procedures/?from=home#c04',
 'Central Line Kit':         '/procedures/?from=home#c06',
 'Transvenous Pacing Kit':   '/procedures/?from=home#c07',
 'Transvenous Pacing':       '/procedures/?from=home#c07',
 'Escharotomy Kit':          '/procedures/?from=home#c08',
 'Neck Tamponade Kit':       '/procedures/?from=home#c11',
 'Junctional Hemorrhage Kit':'/procedures/?from=home#c12',
 'JADA Kit':                 '/procedures/?from=home#c13',
 'Resuscitation Line Kit':   '/procedures/?from=home#c14',
 # These four cabinets have no card of their own yet. Rather than leave them the only labels in the
 # building with no QR, or invent a destination, they resolve to the system map's Room 7 index --
 # which really does say what is in each cabinet. Repoint them the day a card exists.
 'Arterial Line':          '/system/',
 'Suture / Wound':         '/system/',
 'Specimens':              '/system/',
 'Splints':                '/system/',
 # --- per-cart check cards ---
 '@check-code':            '/codes/?from=home#cart',
 '@check-trauma':          '/procedures/?from=home',
 '@check-ob':              '/ob-neonatal/?from=home#cart',
 '@check-peds':            '/peds/?from=home',
 '@room7':                 '/system/',
}

def qr_svg(url):
    q=qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=0)
    q.add_data(url); q.make(fit=True)
    m=q.get_matrix(); n=len(m)
    # round-trip verify against a rendered PNG
    img=q.make_image(fill_color='black', back_color='white').convert('RGB')
    buf=io.BytesIO(); img.save(buf,'PNG'); buf.seek(0)
    got=decode(Image.open(buf))
    ok = bool(got) and got[0].data.decode()==url
    # merge modules into one path (runs per row) to keep the file small
    d=[]
    for y,row in enumerate(m):
        x=0
        while x<n:
            if row[x]:
                x0=x
                while x<n and row[x]: x+=1
                d.append('M%d %dh%dv1h-%dz'%(x0,y,x-x0,x-x0))
            else: x+=1
    return n, ''.join(d), ok

OUT={}; bad=[]
for name,path in DEST.items():
    url=BASE+path
    n,d,ok=qr_svg(url)
    if not ok: bad.append(name)
    OUT[name]=dict(n=n,d=d,url=url)
print('generated',len(OUT),'QR codes; failed round-trip:', bad if bad else 'none')
json.dump(OUT, open('/tmp/qrs.json','w'))
