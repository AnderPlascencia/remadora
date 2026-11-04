# Empaqueta los fotogramas de la palada de cada clase (remo_agua.py --paso N --camara carrera3d|cenital --sprite
# --remo-corto --clase C) en un atlas WebP por clase y vista para la carrera 2D y 3D.
# Uso: python3 tools/blender/remo_agua/atlas_carrera.py DIR assets/carrera [escala]
#   DIR tiene una carpeta por render: carrera3d_vikingo, cenital_vikingo, ... (cada una con frames/ y carrera.json)
# Todas las clases de una vista comparten recorte, tamaño de celda y ancla, así carrera.js usa unas medidas por vista.
# Imprime el bloque REMEROS_ATLAS que va en carrera.js.
import sys, os, json, math
import numpy as np
from PIL import Image

ent, sal = sys.argv[1], sys.argv[2]
escala = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
CLASES = ('vikingo', 'pirata', 'samurai', 'polinesio', 'romano')
VISTAS = {'carrera3d': '3d', 'cenital': '2d'}
bloque = {}
for cam, vista in VISTAS.items():
    dirs = [os.path.join(ent, f'{cam}_{c}') for c in CLASES]
    meta = json.load(open(os.path.join(dirs[0], 'carrera.json')))
    ims = {}
    for c, d in zip(CLASES, dirs):
        fr = sorted(f for f in os.listdir(os.path.join(d, 'frames')) if f.endswith('.png'))
        ims[c] = [Image.open(os.path.join(d, 'frames', f)).convert('RGBA') for f in fr]
    alfa = np.max([np.asarray(i)[:, :, 3] for l in ims.values() for i in l], axis=0)
    ys, xs = np.nonzero(alfa > 10)
    x0, x1, y0, y1 = max(xs.min() - 2, 0), min(xs.max() + 3, alfa.shape[1]), max(ys.min() - 2, 0), min(ys.max() + 3, alfa.shape[0])
    w, h = round((x1 - x0) * escala), round((y1 - y0) * escala)
    n = len(ims[CLASES[0]])
    cols = min(n, max(1, round(math.sqrt(n * h / w))))
    cols = math.ceil(n / math.ceil(n / cols))
    filas = math.ceil(n / cols)
    for c in CLASES:
        atlas = Image.new('RGBA', (cols * w, filas * h))
        for i, im in enumerate(ims[c]):
            atlas.paste(im.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS), ((i % cols) * w, (i // cols) * h))
        ruta = os.path.join(sal, f'remero{vista}_{c}.webp')
        atlas.save(ruta, 'WEBP', quality=82, method=6, alpha_quality=85)
        print(ruta, atlas.size, os.path.getsize(ruta), 'bytes', file=sys.stderr)
    bloque[vista] = {'w': w, 'h': h, 'cols': cols, 'n': n,
                     'ancla': [round((meta['ancla'][0] - x0) * escala, 1), round((meta['ancla'][1] - y0) * escala, 1)],
                     'ppm': round(meta['ppm'] * escala, 2)}
print(json.dumps(bloque))
