# Piezas de la orilla de un paisaje de la colección para la carrera 3D. Igual que ../laguna/orilla.py: cada pieza
# se ilumina como su panorama y se renderiza con fondo transparente desde la altura de la cámara de la carrera.
# Uso: python tools/blender/paisaje/coleccion/orilla.py --tema canon --salida DIR [--muestras 48]
#      python3 tools/blender/paisaje/atlas.py DIR assets/carrera/canon_orilla.webp DIR/orilla.json
import bpy, math, os, sys, argparse, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--tema', required=True)
ap.add_argument('--salida', default='salida')
ap.add_argument('--muestras', type=int, default=48)
ap.add_argument('--px', type=int, default=64, help='píxeles por metro')
A = ap.parse_args([a for a in _argv if not a.endswith('.py')])
SAL = os.path.abspath(A.salida)
os.makedirs(SAL, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
import objetos  # noqa: E402
from temas import TEMAS  # noqa: E402
objetos.preparar()
T = TEMAS[A.tema]
col = esc.collection
L = T['luz']

mundo = bpy.data.worlds.new('MUNDO')
esc.world = mundo
mundo.use_nodes = True
nt = mundo.node_tree
cielo = nt.nodes.new('ShaderNodeTexSky')
cielo.sky_type = 'MULTIPLE_SCATTERING'
cielo.sun_elevation = math.radians(L['elev'])
cielo.sun_rotation = math.radians(L['rot'])
cielo.sun_disc = False
nt.nodes['Background'].inputs['Strength'].default_value = 0.6
nt.links.new(cielo.outputs['Color'], nt.nodes['Background'].inputs['Color'])
sd = bpy.data.lights.new('LGT-sol', 'SUN')
sd.energy = L['fuerza']
sd.color = L['color']
sd.angle = math.radians(3)
sol = bpy.data.objects.new('LGT-sol', sd)
col.objects.link(sol)
sol.rotation_euler = (math.radians(90 - L['elev']), 0, math.radians(L['rot'] + 180))

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
esc.view_settings.exposure = L['exp']
esc.render.image_settings.file_format = 'PNG'
esc.render.image_settings.color_mode = 'RGBA'

info = {}
for nombre, hacer in T['piezas']:
    for ob in list(col.objects):
        if ob.type == 'MESH':
            bpy.data.objects.remove(ob)
    ob = hacer()
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    xmin, xmax = min(p.x for p in pts), max(p.x for p in pts)
    zmin, zmax = min(p.z for p in pts), max(p.z for p in pts)
    ancho_m = (xmax - xmin) * 1.08 + 0.2
    alto_m = (zmax - max(0, zmin)) * 1.04 + 0.6
    cd.ortho_scale = max(ancho_m, alto_m)
    d = Vector((0, -math.cos(ELEV), math.sin(ELEV)))
    centro = Vector(((xmin + xmax) / 2, 0, alto_m / 2 - 0.3))
    cam.location = centro + d * 60
    cam.rotation_euler = (math.radians(90) - ELEV, 0, 0)
    lado = max(ancho_m, alto_m)
    esc.render.resolution_x = round(ancho_m / lado * lado * A.px)
    esc.render.resolution_y = round(alto_m / lado * lado * A.px)
    esc.render.filepath = os.path.join(SAL, nombre + '.png')
    bpy.ops.render.render(write_still=True)
    pie = world_to_camera_view(esc, cam, Vector(((xmin + xmax) / 2, 0, 0)))
    info[nombre] = {'alto_m': round(zmax, 2), 'pie_x': round(pie.x, 3), 'pie_y': round(1 - pie.y, 3),
                    'px': [esc.render.resolution_x, esc.render.resolution_y], 'm_por_px': round(cd.ortho_scale / max(esc.render.resolution_x, esc.render.resolution_y), 5)}
    print('PIEZA', nombre, info[nombre], flush=True)
json.dump(info, open(os.path.join(SAL, 'piezas.json'), 'w'), indent=1)
