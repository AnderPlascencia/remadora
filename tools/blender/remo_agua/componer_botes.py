# Compone los botes de la carrera (0.122.0): el casco pintado de cada clase (cascos/<clase>_2d|3d.webp, generados con
# el mismo motor que los héroes sobre fondo verde) y, encima, el remero con sus remos renderizado en Blender
# (remo_agua.py --capa sin_barca --remo-corto --paso 24 --sprite, cámaras cenital y carrera3d). El remero se encoge
# respecto al casco para que quepa en el bote con las rodillas dentro de la borda.
# Uso: python3 tools/blender/remo_agua/componer_botes.py RENDERS SALIDA
#   RENDERS tiene cenital_<clase> y carrera3d_<clase> (frames/ y carrera.json de remo_agua.py)
#   SALIDA recibe cenital_<clase> (para atlas_carrera.py) y carrera3d_barca_<clase> + carrera3d_remero_<clase>
#   (para atlas_capas.py), con los fotogramas compuestos y su carrera.json.
import sys, os, json, shutil
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
CLASES = ('vikingo', 'pirata', 'samurai', 'polinesio', 'romano')
K2D, K3D = 0.76, 0.74          # escala del remero respecto al casco en cada vista
ANCHO3D = 1.12                 # el casco de la vista 3D se ensancha un poco para que quepan las rodillas


def croma(ruta):
    a = np.asarray(Image.open(ruta).convert('RGBA')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    verde = (g > r + 35) & (g > b + 35)
    a[..., 3] = np.where(verde, 0, 255)
    borde = (g > np.maximum(r, b)) & ~verde          # quita el reflejo verde de los bordes
    a[..., 1] = np.where(borde, np.maximum(r, b), g)
    return Image.fromarray(a.astype('uint8'))


def remero(ruta, k, ancla, tam):
    im = Image.open(ruta).convert('RGBA')
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    capa = Image.new('RGBA', tam)
    capa.alpha_composite(im, (round(ancla[0] * (1 - k)), round(ancla[1] * (1 - k))))
    return capa


ent, sal = sys.argv[1], sys.argv[2]
for c in CLASES:
    # Vista 2D: el casco pintado mide 5,4 m como la barca de Blender (de la popa al escálamo 1,89 m) a 150 px/m
    d = os.path.join(ent, f'cenital_{c}')
    meta = json.load(open(os.path.join(d, 'carrera.json')))
    W, H = meta['w'], meta['h']
    casco = croma(os.path.join(AQUI, 'cascos', f'{c}_2d.webp'))
    s = meta['ppm'] * 5.4 / 660                      # el casco ocupa 660 px de largo en su imagen
    casco = casco.resize((round(casco.width * s), round(casco.height * s)), Image.LANCZOS)
    ox, oy = round(meta['ancla'][0] - 283 - 85 * s), round(meta['ancla'][1] - 224 * s)
    o = os.path.join(sal, f'cenital_{c}', 'frames'); os.makedirs(o, exist_ok=True)
    for f in sorted(os.listdir(os.path.join(d, 'frames'))):
        lienzo = Image.new('RGBA', (W, H))
        lienzo.alpha_composite(casco, (ox, oy))
        lienzo.alpha_composite(remero(os.path.join(d, 'frames', f), K2D, meta['ancla'], (W, H)))
        lienzo.save(os.path.join(o, f))
    shutil.copy(os.path.join(d, 'carrera.json'), os.path.join(sal, f'cenital_{c}'))
    # Vista 3D: el casco se pintó sobre la barca de Blender vista con la cámara de la carrera (recorte desde 105, 24)
    d = os.path.join(ent, f'carrera3d_{c}')
    meta = json.load(open(os.path.join(d, 'carrera.json')))
    W, H = meta['w'], meta['h']
    casco = croma(os.path.join(AQUI, 'cascos', f'{c}_3d.webp'))
    casco = casco.resize((round(casco.width * ANCHO3D), casco.height), Image.LANCZOS)
    capa = Image.new('RGBA', (W, H)); capa.alpha_composite(casco, (round(W / 2 - (W / 2 - 105) * ANCHO3D), 24))
    ob = os.path.join(sal, f'carrera3d_barca_{c}', 'frames'); os.makedirs(ob, exist_ok=True)
    orr = os.path.join(sal, f'carrera3d_remero_{c}', 'frames'); os.makedirs(orr, exist_ok=True)
    for f in sorted(os.listdir(os.path.join(d, 'frames'))):
        capa.save(os.path.join(ob, f))
        remero(os.path.join(d, 'frames', f), K3D, meta['ancla'], (W, H)).save(os.path.join(orr, f))
    for capa_n in ('barca', 'remero'):
        shutil.copy(os.path.join(d, 'carrera.json'), os.path.join(sal, f'carrera3d_{capa_n}_{c}'))
    print(c, file=sys.stderr)
