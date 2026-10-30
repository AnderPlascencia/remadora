# Empaqueta los fotogramas del bote rival (remo_agua.py --sprite) en un atlas WebP con transparencia para la carrera.
# Uso: python3 tools/blender/remo_agua/atlas_rival.py DIR_SPRITE assets/carrera/rival_vikingo.webp [escala]
# Imprime el bloque RIVAL_REAL que va en carrera.js: tamaño de cada celda, columnas, fotogramas, ancla (dónde cae el
# punto (0, 0, flotación) del bote en la celda) y escala respecto al render.
import sys, os, json, math
import numpy as np
from PIL import Image

ent, sal = sys.argv[1], sys.argv[2]
escala = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
cam = json.load(open(os.path.join(ent, 'camara.json')))
nombres = sorted(f for f in os.listdir(os.path.join(ent, 'frames')) if f.endswith('.png'))
ims = [Image.open(os.path.join(ent, 'frames', f)).convert('RGBA') for f in nombres]
alfa = np.max([np.asarray(i)[:, :, 3] for i in ims], axis=0)
ys, xs = np.nonzero(alfa > 8)
x0, x1, y0, y1 = max(xs.min() - 4, 0), xs.max() + 5, max(ys.min() - 4, 0), ys.max() + 5
w, h = round((x1 - x0) * escala), round((y1 - y0) * escala)
cols = 8
filas = math.ceil(len(ims) / cols)
atlas = Image.new('RGBA', (cols * w, filas * h))
for i, im in enumerate(ims):
    atlas.paste(im.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS), ((i % cols) * w, (i // cols) * h))
atlas.save(sal, 'WEBP', quality=80, method=6, alpha_quality=90)


def proyectar(p):
    c = np.array(cam['camara'], float); f = np.array(cam['mira'], float) - c; f /= np.linalg.norm(f)
    r = np.cross(f, [0, 0, 1]); r /= np.linalg.norm(r); u = np.cross(r, f)
    d = np.array(p, float) - c; z = d @ f
    W, H = cam['res']; fpx = cam['lente'] / 36 * max(W, H)
    return W / 2 + fpx * (d @ r) / z, H / 2 - fpx * (d @ u) / z, z


ax, ay, z0 = proyectar((0, 0, cam['agua']))
print(json.dumps({'w': w, 'h': h, 'cols': cols, 'n': len(ims), 'ancla': [round((ax - x0) * escala, 1), round((ay - y0) * escala, 1)],
                  'escala': escala, 'camara': cam}))
print('atlas', atlas.size, os.path.getsize(sal), 'bytes')
