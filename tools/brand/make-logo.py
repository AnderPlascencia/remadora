# Genera rower-logo.svg, rower-marca.svg y rower-marca-clara.svg (los PNG salen de rower-logo.svg con tools/brand/render.cjs).
# Uso: python3 tools/brand/make-logo.py assets/fuentes/barlow-condensed-700.woff2 <carpeta de salida>
# Necesita fonttools y brotli (pip install fonttools brotli) para leer la fuente woff2 que ya trae la app.
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

# Paleta «travesía»: mar de noche, latón de los remos y agua.
NOCHE = '#0B1217'; LATON = '#E9A23B'; LATON_CLARO = '#F6C978'; AGUA = '#2E8FA8'; ESPUMA = '#9AD8E6'; TEXTO = '#EDF1F2'; TEXTO_CLARO = '#0F1A20'

# Un remo vertical centrado en (0,0): empuñadura arriba, pala abajo.
REMO = ('<rect x="-13" y="-200" width="26" height="58" rx="13"/>'
        '<rect x="-9" y="-150" width="18" height="236" rx="5"/>'
        '<rect x="-14" y="-64" width="28" height="16" rx="4"/>'
        '<path d="M-9 76 C-36 104 -40 152 -32 198 C-24 218 24 218 32 198 C40 152 36 104 9 76 Z"/>')
def remos(color, escala=1, cx=256, cy=256):
    return (f'<g fill="{color}" transform="translate({cx} {cy}) scale({escala})">'
            f'<g transform="rotate(-40)">{REMO}</g><g transform="rotate(40)">{REMO}</g></g>')

DEFS = (f'<defs><radialGradient id="f" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#1D3A4C"/><stop offset="1" stop-color="{NOCHE}"/></radialGradient>'
        f'<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{LATON_CLARO}"/><stop offset="1" stop-color="{LATON}"/></linearGradient>'
        f'<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{AGUA}"/><stop offset="1" stop-color="#103445"/></linearGradient>'
        f'<clipPath id="c"><circle cx="256" cy="256" r="176"/></clipPath></defs>')

# Sello: un sol de latón que sale sobre el horizonte, el mar abajo y los remos cruzados a contraluz.
# Todo cabe en el círculo central del 70 %, así sirve como icono maskable de Android.
def sello():
    return (f'<g clip-path="url(#c)"><circle cx="256" cy="256" r="176" fill="{NOCHE}"/>'
            f'<circle cx="256" cy="262" r="112" fill="url(#s)"/>'
            f'<path d="M60 300 Q120 284 180 300 T300 300 T420 300 T540 300 V460 H60 Z" fill="url(#m)"/>'
            f'<path d="M60 300 Q120 284 180 300 T300 300 T420 300 T540 300" fill="none" stroke="{ESPUMA}" stroke-width="8" stroke-linecap="round"/>'
            f'<path d="M150 352 Q190 342 230 352 M282 352 Q322 342 362 352" fill="none" stroke="{ESPUMA}" stroke-width="6" stroke-linecap="round" opacity=".55"/>'
            f'{remos(NOCHE, 0.7, 256, 262)}</g>'
            f'<circle cx="256" cy="256" r="172" fill="none" stroke="{LATON}" stroke-width="8"/>')

icono = (f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">{DEFS}'
         f'<rect width="512" height="512" fill="url(#f)"/>{sello()}</svg>')
open(sys.argv[2] + '/rower-logo.svg', 'w').write(icono)

# Marca horizontal: sello + ROWER con la misma letra condensada de los números de la app.
d, ancho = texto('ROWER', 0, 0, 132, espacio=6)
W = 160 + ancho + 6
k = 0.36
def marca(color):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="140" viewBox="0 0 {W:.0f} 140">{DEFS}'
            f'<g transform="translate({70 - 256*k:.1f} {70 - 256*k:.1f}) scale({k})">{sello()}</g>'
            f'<path transform="translate(156 117)" fill="{color}" d="{d}"/></svg>')
open(sys.argv[2] + '/rower-marca.svg', 'w').write(marca(TEXTO))
open(sys.argv[2] + '/rower-marca-clara.svg', 'w').write(marca(TEXTO_CLARO))
print('ok', W)
