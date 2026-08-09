import qrcode, io, json
from pyzbar.pyzbar import decode
from PIL import Image

BASE='https://lrhemergencymanual.net'
# Destination per label. Only where a real card exists — no invented targets.
DEST = {
 # --- code cart ---
 'Medications':            '/codes/?from=home#cart',
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
