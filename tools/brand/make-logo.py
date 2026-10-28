# Genera rower-logo.svg y rower-marca.svg (los PNG salen de rower-logo.svg con tools/brand/render.cjs). Uso: python3 tools/brand/make-logo.py <SairaStencilOne-Regular.ttf> <carpeta de salida>
# La fuente (OFL) se descarga de Google Fonts; no se guarda en el repo.
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

# Un remo vertical centrado en (0,0): empuñadura arriba, pala abajo.
REMO = ('<rect x="-13" y="-200" width="26" height="58" rx="13"/>'
        '<rect x="-9" y="-150" width="18" height="236" rx="5"/>'
        '<rect x="-14" y="-64" width="28" height="16" rx="4"/>'
        '<path d="M-9 76 C-36 104 -40 152 -32 198 C-24 218 24 218 32 198 C40 152 36 104 9 76 Z"/>')
def remos(color, escala=1, cx=256, cy=256):
    return (f'<g fill="{color}" transform="translate({cx} {cy}) scale({escala})">'
            f'<g transform="rotate(-40)">{REMO}</g><g transform="rotate(40)">{REMO}</g></g>')

FONDO = ('<defs><radialGradient id="f" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#3A4A24"/>'
         '<stop offset=".55" stop-color="#232C17"/><stop offset="1" stop-color="#111410"/></radialGradient>'
         '<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E6F8E"/><stop offset="1" stop-color="#123447"/></linearGradient></defs>')
AMBAR = '#F2A33A'; VERDE = '#556B2F'; CLARO = '#A3C25A'

# Escudo de tripulación: escudo con remos cruzados sobre una ola y un galón de rango arriba (en coordenadas de 512).
ESCUDO = 'M256 92 L388 136 C388 262 352 352 256 420 C160 352 124 262 124 136 Z'
def escudo(id_clip='c'):
    return (f'<path d="{ESCUDO}" fill="#1A2112" stroke="{VERDE}" stroke-width="12" stroke-linejoin="round"/>'
            f'<clipPath id="{id_clip}"><path d="{ESCUDO}"/></clipPath>'
            f'<g clip-path="url(#{id_clip})"><path d="M100 330 Q150 304 200 330 T300 330 T400 330 V440 H100 Z" fill="url(#m)"/>'
            f'<path d="M100 330 Q150 304 200 330 T300 330 T400 330" fill="none" stroke="#9BD3EA" stroke-width="7" opacity=".8"/></g>'
            f'{remos(AMBAR, 0.62, 256, 236)}'
            f'<path d="M218 128 L256 112 L294 128" fill="none" stroke="{CLARO}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>')

# Icono cuadrado (sirve como maskable: el escudo cabe en el círculo seguro del 80 % central)
icono = (f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">{FONDO}<rect width="512" height="512" fill="url(#f)"/>'
         f'{escudo()}</svg>')
open(sys.argv[2] + '/rower-logo.svg', 'w').write(icono)

# Marca horizontal: escudo + ROWER en stencil
d, ancho = texto('ROWER', 0, 0, 120, espacio=10)
W = 150 + ancho + 10
k = 0.4
marca = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="140" viewBox="0 0 {W:.0f} 140">{FONDO}'
         f'<g transform="translate({70 - 256*k:.1f} {70 - 256*k:.1f}) scale({k})">{escudo()}</g>'
         f'<path transform="translate(150 113)" fill="#EEF0E6" d="{d}"/></svg>')
open(sys.argv[2] + '/rower-marca.svg', 'w').write(marca)
print('ok', W)
