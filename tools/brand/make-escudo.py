# Genera el logo «escudo de las clases» (0.94): rower-logo.svg, rower-marca.svg y rower-marca-clara.svg.
# Los PNG salen de rower-logo.svg con tools/brand/render.cjs.
# Uso: python3 tools/brand/make-escudo.py tools/brand/cinzel-700-rower.woff2 assets/marca
# La fuente es Cinzel 700 (licencia OFL, Google Fonts) recortada a las letras de ROWER: solo sirve para
# convertir la palabra en trazos, la app no la carga. Necesita fonttools y brotli (pip install fonttools brotli).
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
F = TTFont(sys.argv[1]); gs = F.getGlyphSet(); cmap = F.getBestCmap(); upm = F['head'].unitsPerEm
def texto(t, x, y, tam, espacio=0):
    k = tam / upm; pen = SVGPathPen(gs); cx = x
    for c in t:
        g = gs[cmap[ord(c)]]; g.draw(TransformPen(pen, (k, 0, 0, -k, cx, y))); cx += g.width * k + espacio
    return pen.getCommands(), cx - espacio - x

# Paleta de siempre: azul noche de la laguna y ámbar.
NOCHE = '#0B1217'; AMBAR = '#E9A23B'; AMBAR_CLARO = '#F6C978'; ESCUDO_ARRIBA = '#245A73'; ESCUDO_ABAJO = '#0E2532'
TEXTO = '#F6C978'; TEXTO_CLARO = '#8A520C'

REMO = ('<rect x="-13" y="-200" width="26" height="58" rx="13"/>'
        '<rect x="-9" y="-150" width="18" height="236" rx="5"/>'
        '<rect x="-14" y="-64" width="28" height="16" rx="4"/>'
        '<path d="M-9 76 C-36 104 -40 152 -32 198 C-24 218 24 218 32 198 C40 152 36 104 9 76 Z"/>')
ESCUDO = 'M256 44 L428 98 V250 C428 356 348 426 256 468 C164 426 84 356 84 250 V98 Z'
def estrella(cx, cy, r):
    import math
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5; rr = r * .45 if i % 2 else r
        pts.append(f'{cx + rr * math.cos(a):.1f} {cy + rr * math.sin(a):.1f}')
    return 'M' + ' L'.join(pts) + 'Z'

DEFS = (f'<defs><radialGradient id="f" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#1D3A4C"/><stop offset="1" stop-color="{NOCHE}"/></radialGradient>'
        f'<linearGradient id="e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{ESCUDO_ARRIBA}"/><stop offset="1" stop-color="{ESCUDO_ABAJO}"/></linearGradient></defs>')

# Escudo con remos cruzados y tres estrellas de rango.
def escudo():
    return (f'<path d="{ESCUDO}" fill="url(#e)" stroke="{AMBAR}" stroke-width="16" stroke-linejoin="round"/>'
            f'<g fill="{AMBAR}" transform="translate(256 250) scale(.62)"><g transform="rotate(-40)">{REMO}</g><g transform="rotate(40)">{REMO}</g></g>'
            + ''.join(f'<path d="{estrella(x, y, 20)}" fill="{AMBAR_CLARO}"/>' for x, y in ((206, 392), (256, 408), (306, 392))))

# Ícono: el escudo al 80 % para que quepa en la zona segura de un ícono maskable de Android.
icono = (f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">{DEFS}'
         f'<rect width="512" height="512" fill="url(#f)"/><g transform="translate(51.2 51.2) scale(.8)">{escudo()}</g></svg>')
open(sys.argv[2] + '/rower-logo.svg', 'w').write(icono)

# Marca horizontal: escudo + ROWER en Cinzel.
d, ancho = texto('ROWER', 0, 0, 100, espacio=9)
W = 142 + ancho + 6
k = 0.27
def marca(color):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="140" viewBox="0 0 {W:.0f} 140">{DEFS}'
            f'<g transform="translate({64 - 256*k:.1f} {70 - 256*k:.1f}) scale({k})">{escudo()}</g>'
            f'<path transform="translate(140 106)" fill="{color}" d="{d}"/></svg>')
open(sys.argv[2] + '/rower-marca.svg', 'w').write(marca(TEXTO))
open(sys.argv[2] + '/rower-marca-clara.svg', 'w').write(marca(TEXTO_CLARO))
print('ok', W)
