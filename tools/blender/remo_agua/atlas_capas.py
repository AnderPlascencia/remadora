# Empaqueta las capas de la vista 3D de la carrera (remo_agua.py --camara carrera3d --sprite --capa barca|remero) en dos
# atlas por clase: la barca con los remos (misma celda y ancla que REMEROS_ATLAS['3d']) y el remero solo, recortado a
# su caja. carrera.js inclina la barca hacia el punto de fuga y pinta encima al remero recto, sin deformarlo.
# Uso: python3 tools/blender/remo_agua/atlas_capas.py DIR assets/carrera [escala]
#   DIR tiene carrera3d_barca_<clase> y carrera3d_remero_<clase>, cada una con frames/ y carrera.json
# Imprime los bloques '3d' y 'remero3d' de REMEROS_ATLAS.
import sys, os, json, math
import numpy as np
from PIL import Image

ent, sal = sys.argv[1], sys.argv[2]
escala = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
CLASES = ('vikingo', 'pirata', 'samurai', 'polinesio', 'romano')


def cargar(capa):
    ims = {}
    for c in CLASES:
        d = os.path.join(ent, f'carrera3d_{capa}_{c}', 'frames')
        ims[c] = [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]
    return ims


def caja(listas):
    alfa = np.max([np.asarray(i)[:, :, 3] for l in listas for i in l], axis=0)
    ys, xs = np.nonzero(alfa > 10)
    return max(xs.min() - 2, 0), min(xs.max() + 3, alfa.shape[1]), max(ys.min() - 2, 0), min(ys.max() + 3, alfa.shape[0])


def empaquetar(ims, x0, x1, y0, y1, nombre):
    w, h = round((x1 - x0) * escala), round((y1 - y0) * escala)
    n = len(ims[CLASES[0]])
    cols = min(n, max(1, round(math.sqrt(n * h / w))))
    cols = math.ceil(n / math.ceil(n / cols))
    filas = math.ceil(n / cols)
    for c in CLASES:
        atlas = Image.new('RGBA', (cols * w, filas * h))
        for i, im in enumerate(ims[c]):
            atlas.paste(im.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS), ((i % cols) * w, (i // cols) * h))
        ruta = os.path.join(sal, nombre.format(c=c))
        atlas.save(ruta, 'WEBP', quality=82, method=6, alpha_quality=85)
        print(ruta, atlas.size, os.path.getsize(ruta), 'bytes', file=sys.stderr)
    return w, h, cols, n


barca, remero = cargar('barca'), cargar('remero')
meta = json.load(open(os.path.join(ent, f'carrera3d_barca_{CLASES[0]}', 'carrera.json')))
# La celda de la barca abarca las dos capas (como el atlas de antes); la del remero, solo su caja
bx0, bx1, by0, by1 = caja(list(barca.values()) + list(remero.values()))
rx0, rx1, ry0, ry1 = caja(list(remero.values()))
w, h, cols, n = empaquetar(barca, bx0, bx1, by0, by1, 'remero3d_{c}.webp')
rw, rh, rcols, _ = empaquetar(remero, rx0, rx1, ry0, ry1, 'remero3d_{c}_remero.webp')
print(json.dumps({
    '3d': {'w': w, 'h': h, 'cols': cols, 'n': n, 'ancla': [round((meta['ancla'][0] - bx0) * escala, 1), round((meta['ancla'][1] - by0) * escala, 1)], 'ppm': round(meta['ppm'] * escala, 2)},
    'remero3d': {'w': rw, 'h': rh, 'cols': rcols, 'n': n, 'origen': [round((rx0 - bx0) * escala, 1), round((ry0 - by0) * escala, 1)]},
}))
