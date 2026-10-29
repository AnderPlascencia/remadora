# Playa de la laguna vista desde arriba para la carrera 2D: una tira que se repite sin costuras (arena blanca,
# palmeras, arbustos con flores, fares y canoas varadas) con la luz de media mañana. y = 0 es el borde del agua.
# Uso: python tools/blender/paisaje/laguna/costa.py --salida DIR [--px 8] [--muestras 32]
#      (después: convertir DIR/costa.png a assets/carrera/laguna_costa.webp, calidad 80)
import bpy, math, os, sys, argparse, random
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--salida', default='salida')
ap.add_argument('--px', type=float, default=8, help='píxeles por metro')
ap.add_argument('--muestras', type=int, default=32)
A = ap.parse_args([a for a in _argv if not a.endswith('.py')])
SAL = os.path.abspath(A.salida)
os.makedirs(SAL, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
import tropico  # noqa: E402
from tropico import palmera, arbusto, roca, matas, fare, canoa  # noqa: E402
from piezas import material, hex_lin  # noqa: E402
tropico.preparar()

L, W = 96.0, 18.0  # largo de la tira (se repite) y fondo de tierra en metros
rnd = random.Random(33)

# ── Suelo: arena blanca ancha junto al agua y suelo de selva más atrás ──
bpy.ops.mesh.primitive_plane_add(size=1, location=(L / 2, W / 2 - 0.4, 0))
suelo = bpy.context.active_object
suelo.scale = (L + 0.01, W + 0.8, 1)
ms = material('MAT-suelo', hex_lin('#3E6A2C'), 0.95)
nt = ms.node_tree
n, l = nt.nodes, nt.links
pb = n['Principled BSDF']
tc = n.new('ShaderNodeTexCoord')
sep = n.new('ShaderNodeSeparateXYZ')
l.new(tc.outputs['Object'], sep.inputs['Vector'])
# Ruido que se repite cada L metros: se muestrea sobre un cilindro (seno y coseno de x)
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
rampa.color_ramp.elements[0].color = (*hex_lin('#2C5A22'), 1)
rampa.color_ramp.elements[1].position = 0.7
rampa.color_ramp.elements[1].color = (*hex_lin('#5E7A30'), 1)
l.new(nz.outputs['Fac'], rampa.inputs['Fac'])
# Arena junto al agua (y local < ~0.4 del ancho del plano), con el borde ondulado por el ruido
borde = n.new('ShaderNodeMapRange')
borde.inputs['From Min'].default_value = -0.12
borde.inputs['From Max'].default_value = -0.02
# El límite de la arena ondula con el mismo ruido periódico del suelo
ond = n.new('ShaderNodeMath'); ond.operation = 'MULTIPLY_ADD'
ond.inputs[1].default_value = 0.35; ond.inputs[2].default_value = -0.17
l.new(nz.outputs['Fac'], ond.inputs[0])
sumay = n.new('ShaderNodeMath'); sumay.operation = 'ADD'
l.new(sep.outputs['Y'], sumay.inputs[0]); l.new(ond.outputs['Value'], sumay.inputs[1])
l.new(sumay.outputs['Value'], borde.inputs['Value'])
arena = n.new('ShaderNodeMix'); arena.data_type = 'RGBA'
arena.inputs['B'].default_value = (*hex_lin('#C9A26C'), 1)
l.new(borde.outputs['Result'], arena.inputs['Factor'])
l.new(rampa.outputs['Color'], arena.inputs['B'])
arena.inputs['A'].default_value = (*hex_lin('#D9B47E'), 1)
l.new(arena.outputs['Result'], pb.inputs['Base Color'])
suelo.data.materials.append(ms)


# ── Reparto: palmeras por toda la tira, selva al fondo, fares y canoas en la arena ──
def poner(hacer, x, y, rot=None, esc_=1.0):
    obs = []
    for dx in (-L, 0, L):  # copias a los lados para que la tira empalme sin costura
        xx = x + dx
        if -12 < xx < L + 12:
            o = hacer()
            o.location = (xx, y, 0)
            o.rotation_euler = (0, 0, rot if rot is not None else rnd.uniform(0, 2 * math.pi))
            o.scale = (esc_, esc_, esc_)
            obs.append(o)
    return obs


k = 0
fares = [L * 0.18, L * 0.63]
for cx in fares:
    poner(lambda: fare(f'fare{k}'), cx, 8.5, rot=math.radians(rnd.uniform(-10, 10)))
for cx in (L * 0.4, L * 0.86):
    poner(lambda: canoa(f'canoa{cx}'), cx, 2.2, rot=math.radians(rnd.uniform(-15, 15)))
for i in range(70):
    x, y = rnd.uniform(0, L), rnd.uniform(3, W + 3)
    if any(abs(x - cx) < 5 and 5 < y < 12 for cx in fares):
        continue
    k += 1
    # Los tamaños se sortean antes: las copias de los lados deben ser idénticas para que la tira empalme
    if y > 10 and rnd.random() < 0.55:
        r, fl = rnd.uniform(1.0, 1.8), 'flor' if rnd.random() < 0.6 else 'flor2'
        poner(lambda: arbusto(f'ar{k}', r, k, fl), x, y)
    else:
        h, cv = rnd.uniform(6, 12), rnd.uniform(0.4, 1.8)
        poner(lambda: palmera(f'pa{k}', h, k, cv), x, y)
for i in range(30):
    k += 1
    r = rnd.uniform(1.2, 2.0)
    poner(lambda: arbusto(f'ar{k}', r, k, 'flor'), rnd.uniform(0, L), rnd.uniform(12, W + 2))
for i in range(5):
    k += 1
    r = rnd.uniform(0.4, 0.8)
    poner(lambda: roca(f'ro{k}', r, k), rnd.uniform(0, L), rnd.uniform(0.0, 1.5))
for i in range(22):
    k += 1
    poner(lambda: matas(f'ma{k}', k), rnd.uniform(0, L), rnd.uniform(3.5, 7))

# ── Luz y cámara ortográfica cenital ──
mundo = bpy.data.worlds.new('MUNDO')
esc.world = mundo
mundo.use_nodes = True
w = mundo.node_tree
cielo = w.nodes.new('ShaderNodeTexSky')
cielo.sky_type = 'MULTIPLE_SCATTERING'
cielo.sun_elevation = math.radians(50)
cielo.sun_rotation = math.radians(145)
cielo.sun_disc = False
w.nodes['Background'].inputs['Strength'].default_value = 0.5
w.links.new(cielo.outputs['Color'], w.nodes['Background'].inputs['Color'])
sd = bpy.data.lights.new('LGT-sol', 'SUN')
sd.energy = 5
sd.color = (1.0, 0.95, 0.86)
sd.angle = math.radians(2)
sol = bpy.data.objects.new('LGT-sol', sd)
esc.collection.objects.link(sol)
sol.rotation_euler = (math.radians(40), 0, math.radians(-35))  # sombras cortas de media mañana

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
esc.view_settings.exposure = -0.45
esc.render.image_settings.file_format = 'PNG'
esc.render.image_settings.color_mode = 'RGBA'
esc.render.filepath = os.path.join(SAL, 'costa.png')
bpy.ops.render.render(write_still=True)
print('COSTA', esc.render.filepath, esc.render.resolution_x, esc.render.resolution_y)
