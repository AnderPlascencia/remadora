# Mide la punta de cada pala en cada fotograma de los atlas de remeros (la madera más alejada del eje) e imprime
# el bloque PALAS_ATLAS de carrera.js. Uso: python3 tools/blender/remo_agua/palas_atlas.py (desde la raíz del repo)
import json, numpy as np
from PIL import Image
# Celdas de REMEROS_ATLAS. Desde la 0.122.0 los remos de la vista 3D van en el atlas del remero (remero3d), así que se
# miden ahí y se pasan a la celda de la barca sumando su origen.
A = {'3d': ('remero3d_vikingo_remero', 170, 75, 3, (0.0, 15.3)), '2d': ('remero2d_vikingo', 266, 123, 3, (0.0, 0.0))}
out = {}
for vista, (nombre, w, h, cols, (ox, oy)) in A.items():
    im = np.asarray(Image.open(f'assets/carrera/{nombre}.webp').convert('RGBA')).astype(int)
    fr = []
    for i in range(24):
        cx, cy = (i % cols) * w, (i // cols) * h
        c = im[cy:cy + h, cx:cx + w]
        r, g, b, a = c[..., 0], c[..., 1], c[..., 2], c[..., 3]
        madera = (a > 180) & (r > g + 15) & (g > b + 5) & (r > 90)
        ys, xs = np.nonzero(madera)
        res = []
        if vista == '3d':
            for lado in (-1, 1):
                sel = xs < w / 2 if lado < 0 else xs >= w / 2
                X, Y = xs[sel], ys[sel]
                k = np.argmin(X) if lado < 0 else np.argmax(X)
                tx, ty = X[k], Y[k]
                # punto hacia dentro: centroide de la madera entre 8 y 14 px del extremo
                d = np.abs(X - tx)
                m = (d > 8) & (d < 14)
                ix, iy = (X[m].mean(), Y[m].mean()) if m.any() else (tx - lado * 10, ty)
                res.append([round(float(tx + ox), 1), round(float(ty + oy), 1), round(float(np.arctan2(ty - iy, tx - ix)), 2)])
        else:
            for lado in (-1, 1):
                sel = ys < h / 2 if lado < 0 else ys >= h / 2
                X, Y = xs[sel], ys[sel]
                k = np.argmin(Y) if lado < 0 else np.argmax(Y)
                tx, ty = X[k], Y[k]
                d = np.abs(Y - ty)
                m = (d > 8) & (d < 14)
                ix, iy = (X[m].mean(), Y[m].mean()) if m.any() else (tx, ty - lado * 10)
                res.append([round(float(tx), 1), round(float(ty), 1), round(float(np.arctan2(ty - iy, tx - ix)), 2)])
        fr.append(res)
    out[vista] = fr
print(json.dumps(out, separators=(',', ':')))
