# Panorama 360° del fiordo para el fondo de la carrera 3D (cielo, montañas y su reflejo en el agua).
# Orden de trabajo de cc-blender-skill (blender-pro-workflow): encuadre → luz → terreno → materiales → render → composición.
# Uso: python tools/blender/paisaje/panorama.py --salida DIR [--ancho 4096] [--muestras 64]
#      blender --background --python tools/blender/paisaje/panorama.py -- --salida DIR
import bpy, math, os, sys, argparse
import numpy as np

_argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--salida', default='salida')
ap.add_argument('--ancho', type=int, default=4096)
ap.add_argument('--muestras', type=int, default=64)
ap.add_argument('--semilla', type=int, default=7)
A = ap.parse_args([a for a in _argv if not a.endswith('.py')])
SAL = os.path.abspath(A.salida)
os.makedirs(SAL, exist_ok=True)

LAT_MIN, LAT_MAX = -7.0, 18.0  # grados bajo y sobre el horizonte que cubre la imagen
ALTO_OJO = 2.0                  # la cámara va a la altura del remero

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
rng = np.random.default_rng(A.semilla)

# ── Ruido fractal (valor) en numpy: periódico alrededor del lago porque se muestrea en coordenadas x, y ──
_TAB = rng.random((512, 512))
def _ruido(x, y):
    xi, yi = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - xi, y - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    t = lambda i, j: _TAB[(xi + i) % 512, (yi + j) % 512]
    return (t(0, 0) * (1 - fx) + t(1, 0) * fx) * (1 - fy) + (t(0, 1) * (1 - fx) + t(1, 1) * fx) * fy

def fbm(x, y, octavas=6, cresta=False, ganancia=0.5):
    v, a, s = 0.0, 0.5, 1.0
    for _ in range(octavas):
        n = _ruido(x * s + 31.7 * s, y * s - 17.3 * s)
        if cresta:
            n = 1 - abs(2 * n - 1)
            n = n * n
        v += a * n
        a *= ganancia
        s *= 2.03
    return v

# ── 2. Terreno: anillo polar alrededor del lago, con el fiordo abierto hacia delante (+Y) ──
NT, NR = 2880, 600
th = np.linspace(-math.pi, math.pi, NT, endpoint=False)
r = 240 + 2660 * np.linspace(0, 1, NR) ** 1.6  # más anillos cerca; lejos, pasos de ~7 m para que no se vean franjas
T, R = np.meshgrid(th, r, indexing='ij')
X, Y = R * np.sin(T), R * np.cos(T)  # θ = 0 mira a +Y
d = np.angle(np.exp(1j * T))          # ángulo respecto a delante
# Lomas boscosas cerca, montañas en medio y cumbres nevadas al fondo
lomas = 45 * fbm(X / 260, Y / 260, 5) * np.clip((R - 240) / 120, 0, 1)
# Deformación del dominio: crestas torcidas en lugar de surcos paralelos
WX = X + 380 * fbm(X / 900 + 3, Y / 900, 3)
WY = Y + 380 * fbm(X / 900, Y / 900 + 5, 3)
monte = 330 * fbm(WX / 700, WY / 700, 6, cresta=True, ganancia=0.45) * np.clip((R - 520) / 500, 0, 1)
cumbre = 620 * fbm(WX / 1100 + 9, WY / 1100, 5, cresta=True, ganancia=0.42) * np.clip((R - 1500) / 700, 0, 1)
H = lomas + monte + cumbre
# El fiordo: un valle de agua que sigue recto delante y se cierra con las cumbres del fondo
valle = 1 - 0.97 * np.exp(-(d / (0.16 + 0.10 * np.clip((R - 240) / 1800, 0, 1))) ** 2) * (R < 2200)
H = H * valle
H -= 6 * (1 - valle)  # orillas que bajan al agua dentro del fiordo
# Orilla del lago: el terreno nace bajo el agua
H += np.clip((R - 240) / 40, 0, 1) * 4 - 6

verts = np.stack([X.ravel(), Y.ravel(), H.ravel()], 1)
idx = np.arange(NT * NR).reshape(NT, NR)
a, b = idx, np.roll(idx, -1, axis=0)
caras = np.stack([a[:, :-1], b[:, :-1], b[:, 1:], a[:, 1:]], -1).reshape(-1, 4)
me = bpy.data.meshes.new('GEO-terreno')
me.from_pydata(verts.tolist(), [], caras.tolist())
me.validate()
for p in me.polygons:
    p.use_smooth = True
terreno = bpy.data.objects.new('GEO-terreno', me)
esc.collection.objects.link(terreno)

# Color por vértice: bosque, roca en pendiente, nieve arriba; y niebla según la distancia (perspectiva aérea)
gz_t, gz_r = np.gradient(H, th, r)
pend = np.sqrt((gz_r) ** 2 + (gz_t / R) ** 2)
var = fbm(X / 40, Y / 40, 4)
bosque = np.array([0.045, 0.085, 0.05]) * (0.75 + 0.5 * var[..., None])
roca = np.array([0.16, 0.16, 0.17]) * (0.7 + 0.6 * var[..., None])
nieve = np.array([0.85, 0.88, 0.92])
playa = np.array([0.30, 0.26, 0.20])
k_roca = np.clip((pend - 0.45) / 0.35, 0, 1) + np.clip((H - 140) / 100, 0, 1)
col = bosque * (1 - np.clip(k_roca, 0, 1))[..., None] + roca * np.clip(k_roca, 0, 1)[..., None]
lim_nieve = 150 + 60 * fbm(X / 150, Y / 150, 3)
k_nieve = np.clip((H - lim_nieve) / 50, 0, 1) * np.clip(1.3 - pend / 1.6, 0, 1)
col = col * (1 - k_nieve[..., None]) + nieve * k_nieve[..., None]
k_playa = np.clip(1 - (H + 1) / 3, 0, 1)
col = col * (1 - k_playa[..., None]) + playa * k_playa[..., None]
niebla = 0.85 * (1 - np.exp(-np.maximum(R - 300, 0) / 5200))
atr = me.color_attributes.new('color', 'FLOAT_COLOR', 'POINT')
atr.data.foreach_set('color', np.concatenate([col.reshape(-1, 3), np.ones((NT * NR, 1))], 1).ravel())
atr2 = me.attributes.new('niebla', 'FLOAT', 'POINT')
atr2.data.foreach_set('value', niebla.ravel())

# ── 3. Cámara panorámica equirectangular a la altura del remero ──
cd = bpy.data.cameras.new('CAM-panorama')
cd.type = 'PANO'
cd.panorama_type = 'EQUIRECTANGULAR'
cd.latitude_min, cd.latitude_max = math.radians(LAT_MIN), math.radians(LAT_MAX)
cd.longitude_min, cd.longitude_max = -math.pi, math.pi
cd.clip_end = 10000
cam = bpy.data.objects.new('CAM-panorama', cd)
esc.collection.objects.link(cam)
cam.location = (0, 0, ALTO_OJO)
cam.rotation_euler = (math.radians(90), 0, 0)  # mira a +Y
esc.camera = cam

# ── 4/7. Luz de atardecer nórdico: cielo físico + sol bajo y cálido delante a la izquierda ──
SOL_ELEV, SOL_ROT = 8.0, 140.0
mundo = bpy.data.worlds.new('MUNDO-atardecer')
esc.world = mundo
mundo.use_nodes = True
nt = mundo.node_tree
cielo = nt.nodes.new('ShaderNodeTexSky')
cielo.sky_type = 'MULTIPLE_SCATTERING'
cielo.sun_elevation = math.radians(SOL_ELEV)
cielo.sun_rotation = math.radians(SOL_ROT)
cielo.air_density = 1.3
cielo.aerosol_density = 2.2
cielo.sun_disc = True
fondo = nt.nodes['Background']
fondo.inputs['Strength'].default_value = 0.5
nt.links.new(cielo.outputs['Color'], fondo.inputs['Color'])
sol_d = bpy.data.lights.new('LGT-sol', 'SUN')
sol_d.energy = 4.5
sol_d.color = (1.0, 0.72, 0.45)
sol_d.angle = math.radians(1.5)
sol = bpy.data.objects.new('LGT-sol', sol_d)
esc.collection.objects.link(sol)
# El sol de Blender apunta por -Z: inclinarlo 90° − elevación y girarlo hacia la dirección del cielo
sol.rotation_euler = (math.radians(90 - SOL_ELEV), 0, math.radians(SOL_ROT + 180))
HAZE = (0.30, 0.40, 0.55)

# ── 6. Materiales: terreno (color por vértice + niebla) y agua oscura que refleja ──
mt = bpy.data.materials.new('MAT-terreno')
mt.use_nodes = True
n = mt.node_tree.nodes
l = mt.node_tree.links
pb = n['Principled BSDF']
pb.inputs['Roughness'].default_value = 0.9
c_at = n.new('ShaderNodeAttribute'); c_at.attribute_name = 'color'
n_at = n.new('ShaderNodeAttribute'); n_at.attribute_name = 'niebla'
l.new(c_at.outputs['Color'], pb.inputs['Base Color'])
em = n.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (*HAZE, 1); em.inputs['Strength'].default_value = 1.0
mix = n.new('ShaderNodeMixShader')
l.new(n_at.outputs['Fac'], mix.inputs['Fac'])
l.new(pb.outputs['BSDF'], mix.inputs[1])
l.new(em.outputs['Emission'], mix.inputs[2])
l.new(mix.outputs['Shader'], n['Material Output'].inputs['Surface'])
terreno.data.materials.append(mt)

bpy.ops.mesh.primitive_circle_add(vertices=256, radius=3200, fill_type='NGON', location=(0, 0, 0))
agua = bpy.context.active_object
agua.name = 'GEO-agua'
ma = bpy.data.materials.new('MAT-agua')
ma.use_nodes = True
n = ma.node_tree.nodes
l = ma.node_tree.links
pa = n['Principled BSDF']
pa.inputs['Base Color'].default_value = (0.01, 0.025, 0.04, 1)
pa.inputs['Roughness'].default_value = 0.035
pa.inputs['IOR'].default_value = 1.33
# Ondas finas: bump con ruido estirado a lo ancho
tc = n.new('ShaderNodeTexCoord')
mp = n.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.4, 3.0, 1.0)
nz = n.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.5; nz.inputs['Detail'].default_value = 6
bp = n.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.06
l.new(tc.outputs['Object'], mp.inputs['Vector'])
l.new(mp.outputs['Vector'], nz.inputs['Vector'])
l.new(nz.outputs['Fac'], bp.inputs['Height'])
l.new(bp.outputs['Normal'], pa.inputs['Normal'])
agua.data.materials.append(ma)

# ── 9. Render ──
esc.render.engine = 'CYCLES'
esc.cycles.device = 'CPU'
esc.cycles.samples = A.muestras
esc.cycles.use_denoising = True
esc.cycles.max_bounces = 4
esc.view_settings.view_transform = 'AgX'
esc.view_settings.look = 'AgX - Punchy'
esc.view_settings.exposure = 0.4
esc.render.resolution_x = A.ancho
esc.render.resolution_y = round(A.ancho * (LAT_MAX - LAT_MIN) / 360)
esc.render.image_settings.file_format = 'PNG'
esc.render.filepath = os.path.join(SAL, 'panorama_bruto.png')
bpy.ops.render.render(write_still=True)
print('PANORAMA', esc.render.filepath, esc.render.resolution_x, esc.render.resolution_y,
      'horizonte_fila', round(esc.render.resolution_y * LAT_MAX / (LAT_MAX - LAT_MIN)))
