# Elementos de la orilla para la carrera 3D: pinos, abedules, rocas, juncos y una casa de botes nórdica.
# Cada pieza se modela por código, se ilumina como el panorama (atardecer, sol detrás a la derecha) y se
# renderiza con fondo transparente desde la altura de la cámara de la carrera. Al final se juntan en un atlas.
# Uso: python tools/blender/paisaje/orilla.py --salida DIR [--muestras 48]
import bpy, math, os, sys, argparse, json, random
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--salida', default='salida')
ap.add_argument('--muestras', type=int, default=48)
ap.add_argument('--px', type=int, default=160, help='píxeles por metro')
A = ap.parse_args([a for a in _argv if not a.endswith('.py')])
SAL = os.path.abspath(A.salida)
os.makedirs(SAL, exist_ok=True)
random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene

import piezas  # noqa: E402
from piezas import M, pino, abedul, roca, juncos, casa  # noqa: E402
piezas.preparar()
col = esc.collection


PIEZAS = [
    ('pino_alto', lambda: pino('pino_alto', 11, 1)),
    ('pino_medio', lambda: pino('pino_medio', 8, 5)),
    ('pino_bajo', lambda: pino('pino_bajo', 5.5, 9)),
    ('abedul', lambda: abedul('abedul', 8, 3, 'hoja')),
    ('abedul_verde', lambda: abedul('abedul_verde', 6.5, 7, 'hoja2')),
    ('roca', lambda: roca('roca', 1.1, 2)),
    ('roca_grande', lambda: roca('roca_grande', 1.8, 6)),
    ('juncos', lambda: juncos('juncos', 4)),
    ('casa', lambda: casa('casa')),
]

# ── Luz: la misma del panorama (cielo físico de atardecer y sol cálido detrás a la derecha) ──
SOL_ELEV, SOL_ROT = 8.0, 140.0
mundo = bpy.data.worlds.new('MUNDO')
esc.world = mundo
mundo.use_nodes = True
nt = mundo.node_tree
cielo = nt.nodes.new('ShaderNodeTexSky')
cielo.sky_type = 'MULTIPLE_SCATTERING'
cielo.sun_elevation = math.radians(SOL_ELEV)
cielo.sun_rotation = math.radians(SOL_ROT)
cielo.sun_disc = False
nt.nodes['Background'].inputs['Strength'].default_value = 0.6
nt.links.new(cielo.outputs['Color'], nt.nodes['Background'].inputs['Color'])
sd = bpy.data.lights.new('LGT-sol', 'SUN')
sd.energy = 4.0
sd.color = (1.0, 0.74, 0.5)
sd.angle = math.radians(3)
sol = bpy.data.objects.new('LGT-sol', sd)
col.objects.link(sol)
sol.rotation_euler = (math.radians(90 - 25), 0, math.radians(SOL_ROT + 180))

# ── Cámara ortográfica: la carrera ve las orillas casi de lado, un poco desde arriba ──
cd = bpy.data.cameras.new('CAM')
cd.type = 'ORTHO'
cam = bpy.data.objects.new('CAM', cd)
col.objects.link(cam)
esc.camera = cam
ELEV = math.radians(10)
esc.render.engine = 'CYCLES'
esc.cycles.device = 'CPU'
esc.cycles.samples = A.muestras
esc.cycles.use_denoising = True
esc.render.film_transparent = True
esc.view_settings.view_transform = 'AgX'
esc.view_settings.look = 'AgX - Punchy'
esc.view_settings.exposure = -0.2
esc.render.image_settings.file_format = 'PNG'
esc.render.image_settings.color_mode = 'RGBA'

info = {}
for nombre, hacer in PIEZAS:
    for o in list(col.objects):
        if o.type == 'MESH':
            bpy.data.objects.remove(o)
    ob = hacer()
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    xmin, xmax = min(p.x for p in pts), max(p.x for p in pts)
    zmin, zmax = min(p.z for p in pts), max(p.z for p in pts)
    ancho_m = (xmax - xmin) * 1.08 + 0.2
    alto_m = (zmax - max(0, zmin)) * 1.04 + 0.6
    cd.ortho_scale = max(ancho_m, alto_m)
    # Cámara a la izquierda del objeto (la orilla izquierda se ve desde el canal; la derecha se espeja)
    d = Vector((0, -math.cos(ELEV), math.sin(ELEV)))
    centro = Vector(((xmin + xmax) / 2, 0, alto_m / 2 - 0.3))
    cam.location = centro + d * 60
    cam.rotation_euler = (math.radians(90) - ELEV, 0, 0)
    esc.render.resolution_x = round(ancho_m * A.px) if ancho_m >= alto_m else round(ancho_m / alto_m * max(ancho_m, alto_m) * A.px)
    esc.render.resolution_y = round(alto_m * A.px) if alto_m >= ancho_m else round(alto_m / ancho_m * max(ancho_m, alto_m) * A.px)
    esc.render.filepath = os.path.join(SAL, nombre + '.png')
    bpy.ops.render.render(write_still=True)
    # Dónde cae el pie (z = 0, centro) dentro de la imagen, en fracción desde arriba
    from bpy_extras.object_utils import world_to_camera_view
    pie = world_to_camera_view(esc, cam, Vector(((xmin + xmax) / 2, 0, 0)))
    info[nombre] = {'alto_m': round(zmax, 2), 'pie_x': round(pie.x, 3), 'pie_y': round(1 - pie.y, 3),
                    'px': [esc.render.resolution_x, esc.render.resolution_y], 'm_por_px': round(cd.ortho_scale / max(esc.render.resolution_x, esc.render.resolution_y), 5)}
    print('PIEZA', nombre, info[nombre])
json.dump(info, open(os.path.join(SAL, 'piezas.json'), 'w'), indent=1)
