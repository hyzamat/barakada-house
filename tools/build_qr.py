# Builds site/qr.svg: the "scan to book" QR code that opens the live site on a phone.
# Error correction is H so the sun logo drawn over its centre doesn't stop it scanning.
# Needs segno: pip install segno
import os
import segno

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://barakadahouse.hizarc.com'
OUT = os.path.join(ROOT, 'site', 'qr.svg')

qr = segno.make_qr(URL, error='h')
qr.save(OUT, kind='svg', dark='#0c0907', light=None, border=0, xmldecl=False, omitsize=True,
        title='Barkada House: ' + URL)
print(f'Wrote {OUT} (version {qr.version}, {qr.symbol_size(border=0)[0]} modules)')
