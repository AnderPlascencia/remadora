# Junta las piezas de la orilla en un atlas WebP y escribe sus medidas en JSON para carrera.js.
# Uso: python3 tools/blender/paisaje/atlas.py DIR_PIEZAS assets/carrera/orilla.webp DIR_PIEZAS/orilla.json
# (los recortes del JSON se copian a mano en la constante ORILLA de carrera.js)
import json, os, sys
from PIL import Image

ent, sal_img, sal_json = sys.argv[1:4]
info = json.load(open(os.path.join(ent, 'piezas.json')))
ims = {n: Image.open(os.path.join(ent, n + '.png')).convert('RGBA') for n in info}
# Recorta el margen transparente de cada pieza y recalcula el pie
for n, im in ims.items():
    caja = im.getbbox()
    w, h = im.size
    pie_x, pie_y = info[n]['pie_x'] * w - caja[0], info[n]['pie_y'] * h - caja[1]
    ims[n] = im.crop(caja)
    info[n]['pie'] = [round(pie_x / (caja[2] - caja[0]), 3), round(pie_y / (caja[3] - caja[1]), 3)]
# Estantes: piezas altas primero
orden = sorted(ims, key=lambda n: -ims[n].height)
ANCHO = 1024
x = y = alto_fila = 0
pos = {}
for n in orden:
    w, h = ims[n].size
    if x + w > ANCHO:
        x, y, alto_fila = 0, y + alto_fila + 2, 0
    pos[n] = (x, y)
    x += w + 2
    alto_fila = max(alto_fila, h)
atlas = Image.new('RGBA', (ANCHO, y + alto_fila), (0, 0, 0, 0))
salida = {}
for n in orden:
    atlas.alpha_composite(ims[n], pos[n])
    w, h = ims[n].size
    salida[n] = {'x': pos[n][0], 'y': pos[n][1], 'w': w, 'h': h, 'pie': info[n]['pie'], 'alto_m': round(h * info[n]['m_por_px'], 2)}
atlas.save(sal_img, 'WEBP', quality=80, method=6)
json.dump(salida, open(sal_json, 'w'), indent=1)
print('ATLAS', atlas.size, os.path.getsize(sal_img), 'bytes')
