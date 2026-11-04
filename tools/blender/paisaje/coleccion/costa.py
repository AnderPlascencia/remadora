# Orilla de un paisaje de la colección vista desde arriba para la carrera 2D: una tira que se repite sin costuras,
# como ../laguna/costa.py. y = 0 es el borde del agua (abajo en la imagen).
# Uso: python tools/blender/paisaje/coleccion/costa.py --tema canon --salida DIR [--px 8] [--muestras 32]
#      (después: convertir DIR/costa.png a assets/carrera/canon_costa.webp, calidad 80)
import bpy, math, os, sys, argparse, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--tema', required=True)
ap.add_argument('--salida', default='salida')
ap.add_argument('--px', type=float, default=8, help='píxeles por metro')
ap.add_argument('--muestras', type=int, default=32)
A = ap.parse_args([a for a in _argv if not a.endswith('.py')])
SAL = os.path.abspath(A.salida)
os.makedirs(SAL, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
import objetos  # noqa: E402
from piezas import material, hex_lin  # noqa: E402
from temas import TEMAS  # noqa: E402
objetos.preparar()
T = TEMAS[A.tema]
K = T['costa']

L, W = 96.0, 18.0
rnd = random.Random(33)

# ── Suelo: dos tonos de tierra con ruido que se repite cada L metros y una franja junto al agua ──
bpy.ops.mesh.primitive_plane_add(size=1, location=(L / 2, W / 2 - 0.4, 0))
suelo = bpy.context.active_object
suelo.scale = (L + 0.01, W + 0.8, 1)
oscuro, claro, orilla = T['suelo']
ms = material('MAT-suelo', hex_lin(oscuro), 0.95)
n, l = ms.node_tree.nodes, ms.node_tree.links
pb = n['Principled BSDF']
tc = n.new('ShaderNodeTexCoord')
sep = n.new('ShaderNodeSeparateXYZ')
l.new(tc.outputs['Object'], sep.inputs['Vector'])
mp = n.new('ShaderNodeMath'); mp.operation = 'MULTIPLY'; mp.inputs[1].default_value = 2 * math.pi
l.new(sep.outputs['X'], mp.inputs[0])
sn = n.new('ShaderNodeMath'); sn.operation = 'SINE'; l.new(mp.outputs['Value'], sn.inputs[0])
cs = n.new('ShaderNodeMath'); cs.operation = 'COSINE'; l.new(mp.outputs['Value'], cs.inputs[0])
cmb = n.new('ShaderNodeCombineXYZ')
l.new(sn.outputs['Value'], cmb.inputs['X']); l.new(cs.outputs['Value'], cmb.inputs['Y']); l.new(sep.outputs['Y'], cmb.inputs['Z'])
nz = n.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 6; nz.inputs['Detail'].default_value = 8
l.new(cmb.outputs['Vector'], nz.inputs['Vector'])
rampa = n.new('ShaderNodeValToRGB')
rampa.color_ramp.elements[0].position = 0.35
rampa.color_ramp.elements[0].color = (*hex_lin(oscuro), 1)
rampa.color_ramp.elements[1].position = 0.7
rampa.color_ramp.elements[1].color = (*hex_lin(claro), 1)
l.new(nz.outputs['Fac'], rampa.inputs['Fac'])
borde = n.new('ShaderNodeMapRange')
borde.inputs['From Min'].default_value = -0.3
borde.inputs['From Max'].default_value = -0.22
ond = n.new('ShaderNodeMath'); ond.operation = 'MULTIPLY_ADD'
ond.inputs[1].default_value = 0.2; ond.inputs[2].default_value = -0.1
l.new(nz.outputs['Fac'], ond.inputs[0])
sumay = n.new('ShaderNodeMath'); sumay.operation = 'ADD'
l.new(sep.outputs['Y'], sumay.inputs[0]); l.new(ond.outputs['Value'], sumay.inputs[1])
l.new(sumay.outputs['Value'], borde.inputs['Value'])
mezcla = n.new('ShaderNodeMix'); mezcla.data_type = 'RGBA'
mezcla.inputs['A'].default_value = (*hex_lin(orilla), 1)
l.new(borde.outputs['Result'], mezcla.inputs['Factor'])
l.new(rampa.outputs['Color'], mezcla.inputs['B'])
l.new(mezcla.outputs['Result'], pb.inputs['Base Color'])
suelo.data.materials.append(ms)


def poner(hacer, x, y, rot=None, esc_=1.0):
    for dx in (-L, 0, L):  # copias a los lados para que la tira empalme sin costura
        xx = x + dx
        if -12 < xx < L + 12:
            o = hacer()
            o.location = (xx, y, 0)
            o.rotation_euler = (0, 0, rot if rot is not None else rnd.uniform(0, 2 * math.pi))
            o.scale = (esc_, esc_, esc_)


# ── Reparto: dos casas, una barca varada (si el tema la tiene), árboles, relleno, rocas y el borde del agua ──
k = 0
casas = [L * 0.2, L * 0.66]
_, hacer_casa = K['casas']
for cx in casas:
    k += 1
    poner(lambda: hacer_casa(k), cx, 9.0, rot=math.radians(rnd.uniform(-10, 10)))
if K['barca']:
    for cx in (L * 0.43, L * 0.9):
        k += 1
        poner(lambda: K['barca'](k), cx, 1.8, rot=math.radians(rnd.uniform(-15, 15)))
for i in range(K['n_grandes']):
    x, y = rnd.uniform(0, L), rnd.uniform(4, W + 3)
    if any(abs(x - cx) < 5.5 and 4.5 < y < 13 for cx in casas):
        continue
    k += 1
    # Lo que va en cada sitio se sortea antes: las copias de los lados deben ser idénticas
    u, rr = rnd.random(), rnd.random()
    hacer = next(h for lim, h in K['grandes'] if u <= lim)
    poner(lambda: hacer(k, rr), x, y)
for i in range(K['n_relleno']):
    x, y = rnd.uniform(0, L), rnd.uniform(3, W + 2)
    if any(abs(x - cx) < 5.5 and 4.5 < y < 13 for cx in casas):
        continue
    k += 1
    rr = rnd.random()
    poner(lambda: K['relleno'](k, rr), x, y)
for i in range(K['n_rocas']):
    k += 1
    rr = rnd.random()
    poner(lambda: K['rocas'](k, rr), rnd.uniform(0, L), rnd.uniform(0.2, 2.5))
for i in range(K['n_borde']):
    k += 1
    poner(lambda: K['borde'](k), rnd.uniform(0, L), rnd.uniform(1.5, 4.5))

# ── Luz del tema y cámara ortográfica cenital ──
Lz = T['luz']
mundo = bpy.data.worlds.new('MUNDO')
esc.world = mundo
mundo.use_nodes = True
w = mundo.node_tree
cielo = w.nodes.new('ShaderNodeTexSky')
cielo.sky_type = 'MULTIPLE_SCATTERING'
cielo.sun_elevation = math.radians(50)
cielo.sun_rotation = math.radians(Lz['rot'])
cielo.sun_disc = False
w.nodes['Background'].inputs['Strength'].default_value = 0.5
w.links.new(cielo.outputs['Color'], w.nodes['Background'].inputs['Color'])
sd = bpy.data.lights.new('LGT-sol', 'SUN')
sd.energy = Lz['fuerza'] + 1
sd.color = Lz['color']
sd.angle = math.radians(2)
sol = bpy.data.objects.new('LGT-sol', sd)
esc.collection.objects.link(sol)
sol.rotation_euler = (math.radians(40), 0, math.radians(-35))

cd = bpy.data.cameras.new('CAM')
cd.type = 'ORTHO'
cd.ortho_scale = L
cam = bpy.data.objects.new('CAM', cd)
esc.collection.objects.link(cam)
cam.location = (L / 2, W / 2, 80)
esc.camera = cam
esc.render.resolution_x = round(L * A.px)
esc.render.resolution_y = round(W * A.px)
esc.render.engine = 'CYCLES'
esc.cycles.device = 'CPU'
esc.cycles.samples = A.muestras
esc.cycles.use_denoising = True
esc.render.film_transparent = True
esc.view_settings.view_transform = 'AgX'
esc.view_settings.look = 'AgX - Punchy'
esc.view_settings.exposure = Lz['exp'] - 0.1
esc.render.image_settings.file_format = 'PNG'
esc.render.image_settings.color_mode = 'RGBA'
esc.render.filepath = os.path.join(SAL, 'costa.png')
bpy.ops.render.render(write_still=True)
print('COSTA', esc.render.filepath, esc.render.resolution_x, esc.render.resolution_y, flush=True)
