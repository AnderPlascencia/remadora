# Prepara el panorama para la app: funde el borde de abajo (el agua del lienzo sigue debajo) y lo guarda en WebP.
# Uso: python3 tools/blender/paisaje/componer.py panorama_bruto.png assets/carrera/fiordo.webp
import sys
import numpy as np
from PIL import Image

ent, sal = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(ent).convert('RGB')).astype(np.float32)
h = im.shape[0]
horizonte = round(h * 18 / 25)  # LAT_MAX / (LAT_MAX - LAT_MIN) de panorama.py
alfa = np.ones(h, np.float32)
y = np.arange(h)
debajo = (y - horizonte) / (h - horizonte)
alfa = np.where(y > horizonte, np.clip(1 - debajo, 0, 1) ** 1.6, 1.0)
rgba = np.dstack([im, (alfa[:, None] * 255).repeat(im.shape[1], 1)]).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(sal, 'WEBP', quality=82, method=6)
fila = im[min(h - 1, horizonte + 6)]
print('agua_cerca_del_horizonte', '#%02X%02X%02X' % tuple(int(v) for v in fila.mean(0)), 'horizonte_fila', horizonte, 'alto', h)
