# Panorama 360° de la laguna tropical para el fondo de la carrera 3D: islas volcánicas verdes, arrecife con motus
# de palmeras, mar abierto al frente por el paso del arrecife, cielo con cúmulos y agua turquesa.
# Mismo orden de trabajo que el fiordo (cc-blender-skill): encuadre → luz → terreno → materiales → render.
# Uso: python tools/blender/paisaje/laguna/panorama.py --salida DIR [--ancho 4096] [--muestras 64]
#      python3 tools/blender/paisaje/componer.py DIR/panorama_bruto.png assets/carrera/laguna.webp
import bpy, math, os, sys, argparse
import numpy as np

_argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--salida', default='salida')
ap.add_argument('--ancho', type=int, default=4096)
ap.add_argument('--muestras', type=int, default=64)
ap.add_argument('--semilla', type=int, default=5)
A = ap.parse_args([a for a in _argv if not a.endswith('.py')])
SAL = os.path.abspath(A.salida)
os.makedirs(SAL, exist_ok=True)

LAT_MIN, LAT_MAX = -7.0, 18.0  # igual que el fiordo: componer.py y carrera.js cuentan con este horizonte
ALTO_OJO = 2.0

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
rng = np.random.default_rng(A.semilla)

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

# ── Terreno: rejilla polar alrededor del remero (más fina cerca) ──
NT, NR = 3072, 640
th = np.linspace(-math.pi, math.pi, NT, endpoint=False)
r = 200 + 4300 * np.linspace(0, 1, NR) ** 1.7
T, R = np.meshgrid(th, r, indexing='ij')
X, Y = R * np.sin(T), R * np.cos(T)  # θ = 0 mira a +Y (delante)
d = np.angle(np.exp(1j * T))

def isla(cx, cy, radio, alto, dentada):
    """Isla volcánica: cono empinado con crestas que bajan en abanico y picos de aguja."""
    dx, dy = X - cx, Y - cy
    dist = np.hypot(dx, dy)
    ang = np.arctan2(dy, dx)
    # Costa irregular
    borde = radio * (0.85 + 0.3 * fbm(np.cos(ang) * 2 + cx / 500, np.sin(ang) * 2 + cy / 500, 4))
    k = np.clip(1 - dist / borde, 0, 1)
    WX = X + 260 * fbm(X / 700 + 3, Y / 700, 3)
    WY = Y + 260 * fbm(X / 700, Y / 700 + 5, 3)
    crestas = fbm(WX / 330, WY / 330, 6, cresta=True, ganancia=0.5)
    perfil = k ** 1.2 * (0.35 + dentada * 1.1 * crestas)
    return alto * perfil

H = (isla(-1350, 700, 1050, 620, 1.1)      # isla grande a la izquierda, con agujas
     + isla(-300, -1500, 1100, 380, 0.9)    # detrás
     + isla(1500, -300, 900, 300, 0.8)      # a la derecha, más baja
     + isla(700, 3900, 620, 520, 1.3))      # al fondo por el paso: el pico lejano
# Pico de aguja (tipo Otemanu) sobre la isla grande
H += 380 * np.exp(-(((X + 1500) / 210) ** 2 + ((Y - 900) / 260) ** 2))
# Motus: islotes bajos de arena y palmeras sobre el anillo del arrecife, abierto delante (paso)
ARRECIFE = 2300
anillo = np.exp(-((R - ARRECIFE) / 70) ** 2)
huecos = np.clip((fbm(np.cos(T) * 6, np.sin(T) * 6, 3) - 0.42) * 6, 0, 1)
paso = 1 - np.exp(-(d / 0.42) ** 2)
H = np.maximum(H, 7 * anillo * huecos * paso + 4 * fbm(X / 40, Y / 40, 3) * anillo * huecos * paso)
H -= 2.0  # todo nace bajo el agua: la costa queda donde H cruza 0
H = np.where(R < 260, np.minimum(H, -2), H)

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

# Color por vértice: selva, roca de basalto en las paredes, arena blanca en la costa, palmeras en los motus
gz_t, gz_r = np.gradient(H, th, r)
pend = np.sqrt(gz_r ** 2 + (gz_t / R) ** 2)
var = fbm(X / 35, Y / 35, 4)
selva = np.array([0.012, 0.13, 0.02]) * (0.7 + 0.6 * var[..., None])
selva_clara = np.array([0.06, 0.22, 0.02])
k_clara = np.clip((fbm(X / 120, Y / 120, 3) - 0.45) * 4, 0, 1)
col = selva * (1 - k_clara[..., None]) + selva_clara * k_clara[..., None] * (0.8 + 0.4 * var[..., None])
roca = np.array([0.09, 0.085, 0.08]) * (0.7 + 0.6 * var[..., None])
k_roca = np.clip((pend - 2.2) / 1.0, 0, 1)
col = col * (1 - k_roca[..., None]) + roca * k_roca[..., None]
arena = np.array([0.80, 0.74, 0.58])
k_arena = np.clip(1 - (H - 0.3) / 2.5, 0, 1) * np.clip(1.5 - pend, 0, 1)
col = col * (1 - k_arena[..., None]) + arena * k_arena[..., None]
niebla = 0.55 * (1 - np.exp(-np.maximum(R - 400, 0) / 9000))
atr = me.color_attributes.new('tinte', 'FLOAT_COLOR', 'POINT')
atr.data.foreach_set('color', np.concatenate([col.reshape(-1, 3), np.ones((NT * NR, 1))], 1).ravel())
atr2 = me.attributes.new('niebla', 'FLOAT', 'POINT')
atr2.data.foreach_set('value', niebla.ravel())

# ── Cámara panorámica equirectangular a la altura del remero ──
cd = bpy.data.cameras.new('CAM-panorama')
cd.type = 'PANO'
cd.panorama_type = 'EQUIRECTANGULAR'
cd.latitude_min, cd.latitude_max = math.radians(LAT_MIN), math.radians(LAT_MAX)
cd.longitude_min, cd.longitude_max = -math.pi, math.pi
cd.clip_end = 40000
cam = bpy.data.objects.new('CAM-panorama', cd)
esc.collection.objects.link(cam)
cam.location = (0, 0, ALTO_OJO)
cam.rotation_euler = (math.radians(90), 0, 0)
esc.camera = cam

# ── Luz de media mañana tropical: sol alto detrás a la derecha, cielo limpio con cúmulos ──
SOL_ELEV, SOL_ROT = 38.0, 145.0
mundo = bpy.data.worlds.new('MUNDO-tropico')
esc.world = mundo
mundo.use_nodes = True
nt = mundo.node_tree
n, l = nt.nodes, nt.links
cielo = n.new('ShaderNodeTexSky')
cielo.sky_type = 'MULTIPLE_SCATTERING'
cielo.sun_elevation = math.radians(SOL_ELEV)
cielo.sun_rotation = math.radians(SOL_ROT)
cielo.air_density = 1.0
cielo.aerosol_density = 0.6
cielo.sun_disc = False
# Cúmulos: ruido proyectado sobre un plano de nubes (dir.xy / dir.z), solo sobre el horizonte
tc = n.new('ShaderNodeTexCoord')
sep = n.new('ShaderNodeSeparateXYZ'); l.new(tc.outputs['Generated'], sep.inputs['Vector'])
zc = n.new('ShaderNodeMath'); zc.operation = 'MAXIMUM'; zc.inputs[1].default_value = 0.03; l.new(sep.outputs['Z'], zc.inputs[0])
px = n.new('ShaderNodeMath'); px.operation = 'DIVIDE'; l.new(sep.outputs['X'], px.inputs[0]); l.new(zc.outputs['Value'], px.inputs[1])
py = n.new('ShaderNodeMath'); py.operation = 'DIVIDE'; l.new(sep.outputs['Y'], py.inputs[0]); l.new(zc.outputs['Value'], py.inputs[1])
pl = n.new('ShaderNodeCombineXYZ'); l.new(px.outputs['Value'], pl.inputs['X']); l.new(py.outputs['Value'], pl.inputs['Y'])
nz = n.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.55; nz.inputs['Detail'].default_value = 10
nz.inputs['Roughness'].default_value = 0.62
l.new(pl.outputs['Vector'], nz.inputs['Vector'])
forma = n.new('ShaderNodeMapRange'); forma.inputs['From Min'].default_value = 0.5; forma.inputs['From Max'].default_value = 0.6
l.new(nz.outputs['Fac'], forma.inputs['Value'])
alt = n.new('ShaderNodeMapRange'); alt.inputs['From Min'].default_value = 0.0; alt.inputs['From Max'].default_value = 0.2
l.new(sep.outputs['Z'], alt.inputs['Value'])
lejos = n.new('ShaderNodeMapRange'); lejos.inputs['From Min'].default_value = 0.0; lejos.inputs['From Max'].default_value = 0.35
lejos.inputs['To Min'].default_value = 0.55; lejos.inputs['To Max'].default_value = 1.0
l.new(sep.outputs['Z'], lejos.inputs['Value'])
m1 = n.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; l.new(forma.outputs['Result'], m1.inputs[0]); l.new(alt.outputs['Result'], m1.inputs[1])
m2 = n.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; l.new(m1.outputs['Value'], m2.inputs[0]); l.new(lejos.outputs['Result'], m2.inputs[1])
# Base de la nube algo gris, cima blanca
sombra = n.new('ShaderNodeMix'); sombra.data_type = 'RGBA'
sombra.inputs['A'].default_value = (1.1, 1.15, 1.25, 1); sombra.inputs['B'].default_value = (2.6, 2.55, 2.45, 1)
l.new(nz.outputs['Fac'], sombra.inputs['Factor'])
fac_sombra = n.new('ShaderNodeMapRange'); fac_sombra.inputs['From Min'].default_value = 0.52; fac_sombra.inputs['From Max'].default_value = 0.8
l.new(nz.outputs['Fac'], fac_sombra.inputs['Value']); l.new(fac_sombra.outputs['Result'], sombra.inputs['Factor'])
mezcla = n.new('ShaderNodeMix'); mezcla.data_type = 'RGBA'
l.new(m2.outputs['Value'], mezcla.inputs['Factor'])
# Azul tropical más intenso que el cielo físico, sobre todo hacia arriba
azul = n.new('ShaderNodeMix'); azul.data_type = 'RGBA'; azul.blend_type = 'MULTIPLY'
azul.inputs['B'].default_value = (0.55, 0.85, 1.25, 1)
l.new(alt.outputs['Result'], azul.inputs['Factor'])
l.new(cielo.outputs['Color'], azul.inputs['A'])
l.new(azul.outputs['Result'], mezcla.inputs['A'])
l.new(sombra.outputs['Result'], mezcla.inputs['B'])
fondo = n['Background']
fondo.inputs['Strength'].default_value = 0.42
l.new(mezcla.outputs['Result'], fondo.inputs['Color'])
sol_d = bpy.data.lights.new('LGT-sol', 'SUN')
sol_d.energy = 4.0
sol_d.color = (1.0, 0.95, 0.86)
sol_d.angle = math.radians(1.0)
sol = bpy.data.objects.new('LGT-sol', sol_d)
esc.collection.objects.link(sol)
sol.rotation_euler = (math.radians(90 - SOL_ELEV), 0, math.radians(SOL_ROT + 180))
HAZE = (0.42, 0.6, 0.85)

# ── Materiales: terreno (color por vértice + bruma) y agua turquesa en la laguna, azul fuera del arrecife ──
mt = bpy.data.materials.new('MAT-terreno')
mt.use_nodes = True
n, l = mt.node_tree.nodes, mt.node_tree.links
pb = n['Principled BSDF']
pb.inputs['Roughness'].default_value = 0.9
c_at = n.new('ShaderNodeAttribute'); c_at.attribute_name = 'tinte'
n_at = n.new('ShaderNodeAttribute'); n_at.attribute_name = 'niebla'
l.new(c_at.outputs['Color'], pb.inputs['Base Color'])
em = n.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (*HAZE, 1); em.inputs['Strength'].default_value = 1.0
mix = n.new('ShaderNodeMixShader')
l.new(n_at.outputs['Fac'], mix.inputs['Fac'])
l.new(pb.outputs['BSDF'], mix.inputs[1])
l.new(em.outputs['Emission'], mix.inputs[2])
l.new(mix.outputs['Shader'], n['Material Output'].inputs['Surface'])
terreno.data.materials.append(mt)

bpy.ops.mesh.primitive_circle_add(vertices=512, radius=30000, fill_type='NGON', location=(0, 0, 0))
agua = bpy.context.active_object
agua.name = 'GEO-agua'
ma = bpy.data.materials.new('MAT-agua')
ma.use_nodes = True
n, l = ma.node_tree.nodes, ma.node_tree.links
pa = n['Principled BSDF']
pa.inputs['Roughness'].default_value = 0.25
pa.inputs['Specular IOR Level'].default_value = 0.15
pa.inputs['IOR'].default_value = 1.33
tc = n.new('ShaderNodeTexCoord')
# Turquesa dentro del arrecife, azul profundo fuera, espuma blanca sobre el arrecife
lg = n.new('ShaderNodeVectorMath'); lg.operation = 'LENGTH'; l.new(tc.outputs['Object'], lg.inputs[0])
rampa = n.new('ShaderNodeValToRGB')
el = rampa.color_ramp.elements
el[0].position = 0.0; el[0].color = (0.02, 0.42, 0.40, 1)
el[1].position = 1.0; el[1].color = (0.004, 0.045, 0.13, 1)
for pos, c in [(0.035, (0.015, 0.30, 0.34, 1)), (0.072, (0.04, 0.38, 0.40, 1)), (0.0765, (0.75, 0.82, 0.85, 1)),
               (0.079, (0.01, 0.10, 0.20, 1))]:
    e = el.new(pos); e.color = c
dv = n.new('ShaderNodeMath'); dv.operation = 'DIVIDE'; dv.inputs[1].default_value = 30000
l.new(lg.outputs['Value'], dv.inputs[0]); l.new(dv.outputs['Value'], rampa.inputs['Fac'])
l.new(rampa.outputs['Color'], pa.inputs['Base Color'])
mp = n.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.5, 2.5, 1.0)
nz = n.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.2; nz.inputs['Detail'].default_value = 6
bp = n.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.08
l.new(tc.outputs['Object'], mp.inputs['Vector'])
l.new(mp.outputs['Vector'], nz.inputs['Vector'])
l.new(nz.outputs['Fac'], bp.inputs['Height'])
l.new(bp.outputs['Normal'], pa.inputs['Normal'])
agua.data.materials.append(ma)

# ── Render ──
esc.render.engine = 'CYCLES'
esc.cycles.device = 'CPU'
esc.cycles.samples = A.muestras
esc.cycles.use_denoising = True
esc.cycles.max_bounces = 4
esc.view_settings.view_transform = 'AgX'
esc.view_settings.look = 'AgX - Punchy'
esc.view_settings.exposure = -0.35
esc.render.resolution_x = A.ancho
esc.render.resolution_y = round(A.ancho * (LAT_MAX - LAT_MIN) / 360)
esc.render.image_settings.file_format = 'PNG'
esc.render.filepath = os.path.join(SAL, 'panorama_bruto.png')
bpy.ops.render.render(write_still=True)
print('PANORAMA', esc.render.filepath, esc.render.resolution_x, esc.render.resolution_y,
      'horizonte_fila', round(esc.render.resolution_y * LAT_MAX / (LAT_MAX - LAT_MIN)))
