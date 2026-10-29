# Vikingo de ROWR: construcción completa en Blender por script (cuerpo, equipo, materiales, rig, animaciones y exportación).
# Uso (Blender 4.2+ o el módulo bpy de PyPI):
#   python tools/blender/vikingo/vikingo.py --salida DIR [--render] [--sin-glb] [--muestras 64]
#   blender --background --python tools/blender/vikingo/vikingo.py -- --salida DIR
# exportar.sh lo ejecuta y optimiza el GLB para la app.
import bpy, bmesh, math, os, sys, argparse, random
from mathutils import Vector, Matrix, Euler, Quaternion

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', 'makehuman'))
sys.path.insert(0, AQUI)
import mh  # noqa: E402

args = argparse.ArgumentParser()
args.add_argument('--salida', default='salida')
args.add_argument('--render', action='store_true')
args.add_argument('--solo-cuerpo', action='store_true')
args.add_argument('--sin-glb', action='store_true')
args.add_argument('--muestras', type=int, default=64)
_argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]  # blender --background --python vikingo.py -- ...
A = args.parse_args([a for a in _argv if not a.endswith('.py')])
SAL = os.path.abspath(A.salida)
os.makedirs(SAL, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
col = esc.collection

# ════════ 1. Cuerpo base MakeHuman: varón joven, musculoso, alto, rasgos marcados ════════
TARGETS = {
    'macrodetails_universal-male-young-maxmuscle-averageweight': 1.0,
    'macrodetails_height_male-young-maxmuscle-averageweight-maxheight': 0.4,
    'macrodetails_proportions_male-young-maxmuscle-averageweight-idealproportions': 1.0,
    'torso_torso-vshape-incr': 0.55,
    'stomach_stomach-pregnant-decr': 0.5,
    'neck_neck-scale-horiz-incr': 0.5,
    'head_head-square': 0.6,
    'head_head-age-incr': 0.25,
    'chin_chin-width-incr': 0.45,
    'chin_chin-prominent-incr': 0.35,
    'cheek_l-cheek-bones-incr': 0.5, 'cheek_r-cheek-bones-incr': 0.5,
    'eyebrows_eyebrows-angle-down': 0.55,
    'nose_nose-hump-incr': 0.35, 'nose_nose-scale-horiz-incr': 0.2,
    'armslegs_l-upperarm-muscle-incr': 0.5, 'armslegs_r-upperarm-muscle-incr': 0.5,
    'armslegs_l-lowerarm-muscle-incr': 0.4, 'armslegs_r-lowerarm-muscle-incr': 0.4,
}
cuerpo, MAPA, TODAS, GRUPOS, VS_MH = mh.construir('Cuerpo', TARGETS)

CARA = ('levator', 'oculi', 'orbicularis', 'oris', 'risorius', 'special', 'temporalis', 'tongue')
import json
_s = json.load(open(os.path.join(AQUI, '..', 'makehuman', 'default.mhskel')))
FUSION = {}
for b in _s['bones']:
    if b.startswith(CARA):
        FUSION[b] = 'head'
    elif b.startswith('breast'):
        FUSION[b] = 'spine02'
    elif b.startswith('toe'):
        FUSION[b] = 'foot' + b[-2:]
    elif b.startswith('metacarpal'):
        FUSION[b] = 'wrist' + b[-2:]
rig, JUNTAS = mh.esqueleto(cuerpo, MAPA, TODAS, 'Vikingo', FUSION)

def hueso(n):
    b = rig.data.bones[n]
    return rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local

Z_SUELO = min(v.co.z for v in cuerpo.data.vertices)  # planta de los pies (antes de borrar la piel que tapan las botas)
alto = max(v.co.z for v in cuerpo.data.vertices) - Z_SUELO
print('ALTURA', round(alto, 3), 'VERTICES', len(cuerpo.data.vertices), 'HUESOS', len(rig.data.bones))

exec(open(os.path.join(AQUI, 'escena.py')).read())
if not A.solo_cuerpo:
    exec(open(os.path.join(AQUI, 'equipo.py')).read())
    exec(open(os.path.join(AQUI, 'animaciones.py')).read())
# pies en el suelo (z = 0)
rig.location.z = -Z_SUELO
bpy.context.view_layer.update()
exec(open(os.path.join(AQUI, 'salidas.py')).read())
print('LISTO')
