#!/usr/bin/env python3
"""Genera las imágenes ligeras que usa la app a partir de los assets aprobados.

Por cada clase/rango aprobado en assets/characters/approvals.json escribe en assets/heroes/:
  <clase>_<rango>.webp          cuerpo entero 360x420 (la mitad del master)
  <clase>_<rango>_retrato.webp  busto 168x168
Los masters PNG no se tocan. Uso: python3 tools/build-app-assets.py
Requisitos: Python 3.10+, Pillow.
"""
import json, os, sys
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'assets', 'characters')
DESTINO = os.path.join(RAIZ, 'assets', 'heroes')


def main():
    aprob = json.load(open(os.path.join(ORIGEN, 'approvals.json')))['registros']
    os.makedirs(DESTINO, exist_ok=True)
    n = 0
    for k, r in sorted(aprob.items()):
        if r.get('estado') != 'approved':
            continue
        clase, rango = k.split('/')
        d = os.path.join(ORIGEN, clase, rango)
        cuerpo = Image.open(os.path.join(d, f'{clase}_{rango}_full.png')).resize((360, 420), Image.LANCZOS)
        cuerpo.save(os.path.join(DESTINO, f'{clase}_{rango}.webp'), 'WEBP', quality=85, method=6)
        retrato = Image.open(os.path.join(d, f'{clase}_{rango}_portrait.png')).resize((168, 168), Image.LANCZOS)
        retrato.save(os.path.join(DESTINO, f'{clase}_{rango}_retrato.webp'), 'WEBP', quality=85, method=6)
        n += 1
    if not n:
        sys.exit('✗ no hay ningún asset aprobado')
    print(f'✓ {n} personajes en assets/heroes/')


if __name__ == '__main__':
    main()
