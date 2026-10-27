#!/usr/bin/env python3
"""Extrae los personajes de la lámina de referencia (5 clases x 9 rangos) al pipeline.

Por cada celda: separa la figura del fondo oscuro (relleno desde los bordes por color),
descarta las muestras de paleta, recorta el retrato del marco superior derecho y
normaliza ambos al formato estándar (cuerpo 720x840 con los pies en el pivote,
retrato 256x256). Escribe meta.json con la procedencia y registra el estado "pending".

Uso: python3 tools/extract-sheet.py [--sheet assets/characters/_source/lamina_clases_v1.png] [--force]
Requisitos: Python 3.10+, Pillow, NumPy.
"""
import argparse, json, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DIR = os.path.join(RAIZ, 'assets', 'characters')
CLASES = ['vikingo', 'pirata', 'samurai', 'polinesio', 'romano']
RANGOS = ['novato', 'aprendiz', 'combatiente', 'guerrero', 'veterano', 'campeon', 'elite', 'maestro', 'legendario']
# Rejilla medida sobre la lámina de 1536x1024 (separadores de columnas y filas).
COLS = [300, 437, 568, 700, 837, 977, 1115, 1254, 1387, 1536]
FILAS = [(75, 233), (245, 403), (414, 577), (587, 749), (758, 923)]
CUERPO = (720, 840)
RETRATO = 256
PIVOTE_Y = 0.97
VERSION = '3.0.0'


def reconstruir(semilla, permitido):
    """Crece la semilla dentro de 'permitido' (reconstrucción morfológica, vecindad 4)."""
    m = semilla & permitido
    while True:
        d = m.copy()
        d[1:] |= m[:-1]; d[:-1] |= m[1:]; d[:, 1:] |= m[:, :-1]; d[:, :-1] |= m[:, 1:]
        d &= permitido
        if (d == m).all():
            return m
        m = d


def dilatar(m, permitido, pasos):
    """Dilatación geodésica limitada: crece 'pasos' píxeles dentro de 'permitido'."""
    for _ in range(pasos):
        d = m.copy()
        d[1:] |= m[:-1]; d[:-1] |= m[1:]; d[:, 1:] |= m[:, :-1]; d[:, :-1] |= m[:, 1:]
        m = d & permitido
    return m


def componentes(mask):
    h, w = mask.shape
    etiqueta = np.zeros((h, w), int)
    comps = []
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not etiqueta[y, x]:
                n = len(comps) + 1
                cola = deque([(y, x)]); etiqueta[y, x] = n
                xs, ys = [], []
                while cola:
                    cy, cx = cola.popleft(); xs.append(cx); ys.append(cy)
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = cy + dy, cx + dx
                        if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not etiqueta[yy, xx]:
                            etiqueta[yy, xx] = n; cola.append((yy, xx))
                comps.append({'n': n, 'area': len(xs), 'x0': min(xs), 'x1': max(xs), 'y0': min(ys), 'y1': max(ys)})
    return etiqueta, comps


_ultimo_muestras = []
_ultima_fig = None


def celda(img, fila, col, plantilla=None):
    global _ultimo_muestras, _ultima_fig
    y0, y1 = FILAS[fila]
    x0, x1 = COLS[col] + 2, COLS[col + 1] - 2
    a = np.asarray(img.crop((x0, y0, x1, y1)).convert('RGB')).astype(int)
    h, w, _ = a.shape
    borde = np.concatenate([a[:3].reshape(-1, 3), a[-3:].reshape(-1, 3), a[:, :3].reshape(-1, 3), a[:, -3:].reshape(-1, 3)])
    fondo = np.median(borde, axis=0)
    dist = np.sqrt(((a - fondo) ** 2).sum(2))
    lum = a.mean(2)
    # Dos pasadas: el fondo seguro (muy parecido al color del borde) se inunda desde los bordes;
    # el margen tolerante solo recorta unos píxeles de halo, para no colarse en capas oscuras.
    seguro = (dist < 10) & (lum < 80)
    cand = (dist < 22) & (lum < 80)
    semilla = np.zeros((h, w), bool); semilla[0] = semilla[-1] = True; semilla[:, 0] = semilla[:, -1] = True
    bg = dilatar(reconstruir(semilla, seguro), cand, 2)
    fig = ~bg
    _ultima_fig = fig
    et, comps = componentes(fig)
    if not comps:
        raise RuntimeError('celda vacía')
    # Retrato: componente compacto arriba a la derecha.
    retrato = None
    for c in comps:
        ch, cw = c['y1'] - c['y0'] + 1, c['x1'] - c['x0'] + 1
        if c['y0'] < 30 and c['x0'] > w * 0.6 and c['y1'] < 56 and 18 <= ch <= 56 and 16 <= cw <= 50:
            retrato = c
    principal = max((c for c in comps if c is not retrato), key=lambda c: c['area'])
    _ultimo_muestras = [c for c in comps if c is not retrato and (c['x1'] - c['x0'] + 1) <= 18 and c['x0'] > w * 0.62 and c['y0'] > 28]
    keep = np.zeros((h, w), bool)
    for c in comps:
        if c is retrato:
            continue
        ch, cw = c['y1'] - c['y0'] + 1, c['x1'] - c['x0'] + 1
        muestra = cw <= 18 and c['x0'] > w * 0.62 and c['y0'] > 28
        cerca = c['x1'] >= principal['x0'] - 3 and c['x0'] <= principal['x1'] + 3 and c['y1'] >= principal['y0'] - 3 and c['y0'] <= principal['y1'] + 3
        if c is principal or (cerca and not muestra and c['area'] >= 4):
            keep |= et == c['n']
    if plantilla is not None:
        if retrato is None and plantilla['retrato']:
            dx = w - plantilla['ancho']
            retrato = {**plantilla['retrato'], 'x0': plantilla['retrato']['x0'] + dx, 'x1': plantilla['retrato']['x1'] + dx}
        a, keep = borrar_plantilla(a, keep, plantilla)
    return a, keep, retrato


def gradiente(a):
    g = a.mean(2)
    m = np.zeros_like(g)
    m[1:-1, 1:-1] = np.abs(g[2:, 1:-1] - g[:-2, 1:-1]) + np.abs(g[1:-1, 2:] - g[1:-1, :-2])
    return m


def plantilla_fila(img, fila):
    """Posición de la columna de muestras y del retrato en la celda 0 de la fila,
    donde aparecen separados de la figura. Se reutiliza en las demás celdas."""
    a, keep, ret = celda(img, fila, 0, plantilla=None)
    m = _ultimo_muestras
    caja = (min(c['y0'] for c in m) - 3, max(c['y1'] for c in m) + 4, min(c['x0'] for c in m) - 3, max(c['x1'] for c in m) + 4)
    patron = gradiente(a)[caja[0]:caja[1], caja[2]:caja[3]]
    # Forma exacta de las muestras (los discos se tocan y salen como una sola columna).
    forma = np.zeros_like(_ultima_fig)
    for c in m:
        forma[c['y0']:c['y1'] + 1, c['x0']:c['x1'] + 1] = _ultima_fig[c['y0']:c['y1'] + 1, c['x0']:c['x1'] + 1]
    forma = dilatar(forma, np.ones_like(forma), 2)
    return {'retrato': ret, 'muestras': m, 'ancho': keep.shape[1], 'caja': caja, 'patron': patron, 'forma': forma}


def alinear(a, pl):
    """Desplazamiento (dy, dx) de la columna de muestras en esta celda, buscando sus bordes circulares."""
    g = gradiente(a)
    h, w = g.shape
    y0, y1, x0, x1 = pl['caja']
    base = w - pl['ancho']
    mejor = (1e18, 0, base)
    for dy in range(-4, 5):
        for dx in range(base - 16, base + 17):
            if y0 + dy < 0 or y1 + dy > h or x0 + dx < 0 or x1 + dx > w:
                continue
            d = np.abs(g[y0 + dy:y1 + dy, x0 + dx:x1 + dx] - pl['patron']).mean()
            if d < mejor[0]:
                mejor = (d, dy, dx)
    return mejor[1], mejor[2]


def borrar_plantilla(a, keep, pl):
    """Borra muestras (con su forma exacta) y retrato de la plantilla; rellena huecos interiores interpolando."""
    h, w = keep.shape
    borrado = np.zeros((h, w), bool)
    dy, dx = alinear(a, pl)
    fh, fw = pl['forma'].shape
    ys, xs = np.nonzero(pl['forma'])
    ys, xs = ys + dy, xs + dx
    ok = (ys >= 0) & (ys < h) & (xs >= 0) & (xs < w)
    borrado[ys[ok], xs[ok]] = True
    if pl['retrato']:
        r = pl['retrato']
        borrado[max(0, r['y0'] + dy - 3):r['y1'] + dy + 4, max(0, r['x0'] + dx - 3):r['x1'] + dx + 4] = True
    afectado = borrado & keep
    keep = keep & ~borrado
    # Se descartan restos sueltos (anillos de las muestras) antes de interpolar, para no unirlos a la figura.
    et, comps = componentes(keep)
    mayor = max(c['area'] for c in comps)
    keep = np.isin(et, [c['n'] for c in comps if c['area'] >= max(40, mayor * 0.01)])
    # Relleno horizontal: si hay figura a ambos lados (≤6 px), interpola el color.
    for y in range(h):
        xs = np.where(afectado[y])[0]
        if not len(xs):
            continue
        izq, der = xs.min() - 1, xs.max() + 1
        li = izq - np.argmax(keep[y, max(0, izq - 6):izq + 1][::-1]) if izq >= 0 and keep[y, max(0, izq - 6):izq + 1].any() else None
        ld = der + np.argmax(keep[y, der:min(w, der + 7)]) if der < w and keep[y, der:min(w, der + 7)].any() else None
        if li is not None and ld is not None:
            for x in range(li + 1, ld):
                t = (x - li) / (ld - li)
                a[y, x] = a[y, li] * (1 - t) + a[y, ld] * t
                keep[y, x] = True
    return a, keep


def a_rgba(a, mask, suave=0.8):
    alfa = Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(suave))
    im = Image.fromarray(a.astype('uint8')).convert('RGBA')
    im.putalpha(alfa)
    return im


def normalizar_cuerpo(im, mask):
    ys, xs = np.where(mask)
    caja = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    fig = im.crop(caja)
    fw, fh = fig.size
    alto = CUERPO[1] * (PIVOTE_Y - 0.05)
    esc = min(alto / fh, (CUERPO[0] - 24) / fw)
    fig = fig.resize((round(fw * esc), round(fh * esc)), Image.LANCZOS)
    lienzo = Image.new('RGBA', CUERPO, (0, 0, 0, 0))
    lienzo.alpha_composite(fig, (round(CUERPO[0] / 2 - fig.width / 2), round(CUERPO[1] * PIVOTE_Y - fig.height)))
    return lienzo, esc, caja


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet', default=os.path.join(DIR, '_source', 'lamina_clases_v1.png'))
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()
    img = Image.open(args.sheet)
    if img.size != (1536, 1024):
        sys.exit(f'✗ la lámina mide {img.size}; la rejilla está medida para 1536x1024')
    ruta_ap = os.path.join(DIR, 'approvals.json')
    aprob = json.load(open(ruta_ap)) if os.path.exists(ruta_ap) else {'version': 1, 'registros': {}}
    rel_sheet = os.path.relpath(args.sheet, RAIZ)
    for f, clase in enumerate(CLASES):
        pl = plantilla_fila(img, f)
        for c, rango in enumerate(RANGOS):
            k = f'{clase}/{rango}'
            if aprob['registros'].get(k, {}).get('estado') == 'approved' and not args.force:
                print(f'· {k}: aprobado, se omite'); continue
            a, mask, ret = celda(img, f, c, plantilla=pl)
            d = os.path.join(DIR, clase, rango)
            os.makedirs(d, exist_ok=True)
            cuerpo, esc, caja = normalizar_cuerpo(a_rgba(a, mask), mask)
            cuerpo.save(os.path.join(d, f'{clase}_{rango}_full.png'))
            # Retrato: cabeza y hombros recortados de la propia figura (más nítido que la miniatura).
            al = np.asarray(cuerpo)[:, :, 3]
            filas = np.where(al.max(1) > 24)[0]
            fh = filas.max() - filas.min()
            # La cabeza empieza en la primera fila ancha: ignora puntas finas de lanzas o astas.
            ancho_fila = (al > 24).sum(1)
            top = int(np.where(ancho_fila > 30)[0].min())
            banda = al[top:top + int(fh * 0.12)] > 24
            ys, xs = np.nonzero(banda)
            hx = float(np.median(xs))
            lado = int(fh * 0.30)
            caja_r = (int(hx - lado / 2), int(top - lado * 0.06), int(hx + lado / 2), int(top - lado * 0.06) + lado)
            cuerpo.crop(caja_r).resize((RETRATO, RETRATO), Image.LANCZOS).save(os.path.join(d, f'{clase}_{rango}_portrait.png'))
            for viejo in (f'{clase}_{rango}.svg',):
                if os.path.exists(os.path.join(d, viejo)):
                    os.remove(os.path.join(d, viejo))
            meta = {
                'clase': clase, 'rango': rango, 'versionMaestro': VERSION,
                'herramienta': {'nombre': 'tools/extract-sheet.py', 'motor': 'Pillow + NumPy (fondo por relleno desde bordes, componentes conexos)',
                                'parametros': {'celda': [COLS[c], FILAS[f][0], COLS[c + 1], FILAS[f][1]], 'escala': round(esc, 3), 'cajaFigura': [int(v) for v in caja], 'retrato': bool(ret)}},
                'fuente': {'tipo': 'imagen generada externamente', 'archivo': None, 'lamina': rel_sheet, 'generador': 'sin indicar (lámina aportada por el usuario)',
                           'licencia': 'según los términos del generador', 'resolucionOrigen': [int(caja[2] - caja[0]), int(caja[3] - caja[1])]},
                'pivote': {'x': 0.5, 'y': PIVOTE_Y},
            }
            json.dump(meta, open(os.path.join(d, 'meta.json'), 'w'), ensure_ascii=False, indent=2)
            aprob['registros'][k] = {'estado': 'pending', 'version': VERSION, 'notas': '' if ret else 'sin retrato detectado'}
            print(f'✓ {k} (figura {caja[2]-caja[0]}x{caja[3]-caja[1]} px, escala {esc:.2f}{"" if ret else ", sin retrato"})')
    json.dump(aprob, open(ruta_ap + '.tmp', 'w'), ensure_ascii=False, indent=2); os.replace(ruta_ap + '.tmp', ruta_ap)


if __name__ == '__main__':
    main()
