# Orilla 2D con la línea de costa recta y lo que sobresale encima del agua.
# Uso: python3 orilla2d.py <paisaje> <costa_arriba.png> [costa_abajo.png] [tol]
# Salida: la costa de arriba (agua abajo) y, si se da, la de abajo (agua arriba), con el agua transparente.
# La línea de costa queda siempre al 82 % del alto (arriba) o al 18 % (abajo): el resto es lo que sobresale.
import sys, numpy as np, cv2
from PIL import Image
sys.path.insert(0, '/root/sd/borde')
from agua_fuera import quitar
LINEA = 0.82
def enderezar(rgba):
    a = rgba[..., 3].astype(np.float32) / 255; h, w = a.shape
    # fila de la costa en cada columna: arriba de la última racha de agua que llega al borde de abajo
    agua = a < 0.5
    # fila de la costa en cada columna: lo más alto del agua que llega al borde de abajo (sin agua, se interpola)
    s = np.full(w, np.nan)
    for x in range(w):
        y = h - 1
        while y > 0 and agua[y, x]: y -= 1
        if y < h - 2: s[x] = y
    ok = ~np.isnan(s)
    s = np.interp(np.arange(w), np.arange(w)[ok], s[ok]) if ok.any() else np.full(w, h * 0.8)
    t3 = np.pad(s, w, mode='reflect').reshape(1, -1).astype(np.float32)
    ss = cv2.GaussianBlur(t3, (0, 0), 70).ravel()[w:2 * w]
    S = int(np.percentile(ss, 15))
    out = np.zeros_like(rgba)
    for x in range(w):
        d = int(round(ss[x] - S))  # subir la columna d filas
        if d >= 0: out[:h - d, x] = rgba[d:, x]
        else: out[-d:, x] = rgba[:h + d, x]; out[:-d, x] = rgba[0, x]
    m = int(round(S * (1 - LINEA) / LINEA))
    out = out[:min(h, S + m)]
    if out.shape[0] < S + m: out = np.concatenate([out, np.zeros((S + m - out.shape[0], w, 4), out.dtype)])
    # lo que sobresale se desvanece hacia abajo para no cortar en seco
    f = np.clip(1 - (np.arange(S + m) - S - m * 0.6) / (m * 0.4), 0, 1)[:, None]
    out[..., 3] = (out[..., 3] * f).astype(np.uint8)
    return out
def sin_costura_h(a, B=120):
    # mezcla los extremos premultiplicando por alfa (si no, el color del agua transparente se cuela en la tierra)
    h, w, _ = a.shape; a = a.astype(np.float32); t = a[:, :w - B].copy(); mm = np.linspace(0, 1, B)[None, :, None]
    L, R = a[:, :B], a[:, w - B:]
    aL, aR = L[..., 3:] / 255, R[..., 3:] / 255
    al = aL * mm + aR * (1 - mm)
    rgb = (L[..., :3] * aL * mm + R[..., :3] * aR * (1 - mm)) / np.maximum(al, 1e-3)
    al = np.clip((al - 0.5) * 3 + 0.5, 0, 1)
    t[:, :B, :3] = rgb; t[:, :B, 3:] = al * 255
    return t.clip(0, 255).astype(np.uint8)
def hacer(src, tol, abajo=False):
    rgba = quitar(src, tol=tol)
    if abajo: rgba = rgba[::-1].copy()
    out = sin_costura_h(enderezar(rgba))
    if abajo: out = out[::-1].copy()
    im = Image.fromarray(out, 'RGBA'); return im.resize((1536, round(im.height * 1536 / im.width)), Image.LANCZOS)
if __name__ == '__main__':
    k = sys.argv[1]; tol = float(sys.argv[4]) if len(sys.argv) > 4 else 26
    nombre = 'costa' if k == 'fiordo' else f'{k}_costa'
    hacer(sys.argv[2], tol).save(f'/root/sd/borde/{nombre}.webp', quality=80)
    if len(sys.argv) > 3 and sys.argv[3] != '-':
        hacer(sys.argv[3], tol, abajo=True).save(f'/root/sd/borde/{nombre}_abajo.webp', quality=80)
