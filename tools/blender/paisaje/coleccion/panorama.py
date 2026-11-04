# Panorama 360° de un paisaje de la colección para el fondo de la carrera 3D. Mismo encuadre y horizonte que el
# fiordo y la laguna (componer.py y carrera.js cuentan con él): terreno por código, color por vértice con bruma,
# cielo físico con nubes y agua con degradado.
# Uso: python tools/blender/paisaje/coleccion/panorama.py --tema canon --salida DIR [--ancho 4096] [--muestras 64]
#      python3 tools/blender/paisaje/componer.py DIR/panorama_bruto.png assets/carrera/canon.webp
import bpy, math, os, sys, argparse
import numpy as np

_argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--tema', required=True)
ap.add_argument('--salida', default='salida')
ap.add_argument('--ancho', type=int, default=4096)
ap.add_argument('--muestras', type=int, default=64)
ap.add_argument('--semilla', type=int, default=9)
A = ap.parse_args([a for a in _argv if not a.endswith('.py')])
SAL = os.path.abspath(A.salida)
os.makedirs(SAL, exist_ok=True)

LAT_MIN, LAT_MAX = -7.0, 18.0
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

def suave(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def mezclar(col, otro, k):
    return col * (1 - k[..., None]) + np.asarray(otro) * k[..., None]

NT, NR = 3072, 640
th = np.linspace(-math.pi, math.pi, NT, endpoint=False)
r = 200 + 4300 * np.linspace(0, 1, NR) ** 1.7
T, R = np.meshgrid(th, r, indexing='ij')
X, Y = R * np.sin(T), R * np.cos(T)  # θ = 0 mira a +Y (delante)
d = np.angle(np.exp(1j * T))
lados = np.abs(np.sin(d))           # 0 delante y detrás, 1 a los lados
frente = np.exp(-(d / 0.5) ** 2)    # el canal se abre delante
WX = X + 260 * fbm(X / 700 + 3, Y / 700, 3)
WY = Y + 260 * fbm(X / 700, Y / 700 + 5, 3)
var = fbm(X / 35, Y / 35, 4)


def pendiente(H):
    gz_t, gz_r = np.gradient(H, th, r)
    return np.sqrt(gz_r ** 2 + (gz_t / R) ** 2)


# ── Terreno y color de cada tema ──
def canon():
    # Mesetas de arenisca con paredes verticales y estratos, sobre un llano de arena con matas
    f = fbm(WX / 900, WY / 900, 5)
    mesa = suave(0.47, 0.5, f + 0.12 * lados - 0.3 * frente * (1 - suave(2400, 3400, R)))
    alto = 170 + 110 * fbm(X / 1500 + 7, Y / 1500, 3)
    # Escalones: la meseta tiene dos niveles
    esc2 = suave(0.55, 0.57, f) * 0.35
    H = alto * (mesa * 0.7 + esc2) + 12 * fbm(X / 200, Y / 200, 4)
    # Agujas sueltas (buttes) por el llano
    for cx, cy, rr, hh in [(-900, 1400, 70, 210), (1200, 2200, 90, 260), (-1700, -600, 80, 180), (600, -1800, 60, 220), (300, 3200, 110, 240)]:
        H = np.maximum(H, hh * suave(1.0, 0.75, np.hypot(X - cx, Y - cy) / rr))
    H = H * suave(800, 1200, R) - 1.5
    p = pendiente(H)
    llano = np.array([0.40, 0.19, 0.07]) * (0.85 + 0.3 * var[..., None])
    col = mezclar(llano, [0.30, 0.30, 0.12], np.clip((fbm(X / 18, Y / 18, 2) - 0.62) * 6, 0, 1) * (p < 0.4))
    banda = suave(0.35, 0.65, np.abs(((H + 18 * fbm(X / 300, Y / 300, 3)) / 26) % 2 - 1))
    pared = mezclar(np.array([0.30, 0.07, 0.025]) * (0.8 + 0.4 * var[..., None]), [0.48, 0.19, 0.06], banda * 0.6)
    col = mezclar(col, pared, np.clip((p - 0.5) / 0.6, 0, 1))
    cima = mezclar(np.array([0.38, 0.15, 0.05]), [0.4, 0.38, 0.18], np.clip((var - 0.55) * 4, 0, 1))
    col = mezclar(col, cima, (H > 60) * np.clip(1.2 - p, 0, 1))
    return H, col * 0.5


def otono():
    # Colinas suaves cubiertas de bosque de otoño y montañas azuladas al fondo
    colinas = 220 * fbm(WX / 900, WY / 900, 6) ** 1.8 * suave(450, 900, R) * (0.5 + 0.5 * lados)
    montes = 600 * fbm(WX / 1300, WY / 1300, 6, cresta=True, ganancia=0.45) ** 1.4 * suave(2400, 3600, R)
    H = colinas + montes - 2.0
    p = pendiente(H)
    manchas = fbm(X / 30, Y / 30, 3)
    paleta = np.array([[0.20, 0.03, 0.01], [0.30, 0.08, 0.01], [0.34, 0.18, 0.02], [0.03, 0.06, 0.025], [0.24, 0.05, 0.015]])
    i = np.clip((manchas * 1.6 - 0.3) * len(paleta), 0, len(paleta) - 1).astype(int)
    col = 1.35 * paleta[i] * (0.75 + 0.5 * var[..., None])
    # Laderas de pinos oscuros en las zonas altas
    col = mezclar(col, [0.03, 0.06, 0.03], np.clip((fbm(X / 400, Y / 400, 3) - 0.55) * 5, 0, 1))
    roca = np.array([0.09, 0.085, 0.08]) * (0.8 + 0.4 * var[..., None])
    col = mezclar(col, roca, np.clip((p - 1.0) / 0.8, 0, 1) * (montes > 50))
    col = mezclar(col, [0.06, 0.07, 0.06], suave(200, 400, montes))
    col = mezclar(col, [0.30, 0.26, 0.18], np.clip(1 - (H - 0.3) / 2, 0, 1))
    return H, col


def glaciar():
    # Cordillera afilada nevada, lenguas de glaciar que llegan al agua y témpanos flotando
    crestas = fbm(WX / 420, WY / 420, 7, cresta=True)
    H = 520 * crestas ** 1.5 * suave(1000, 1800, R) * (0.5 + 0.4 * lados + 0.4 * suave(2600, 3600, R))
    # Lengua de glaciar: un valle liso y blanco que baja hasta el agua delante a la izquierda
    lengua = np.exp(-((d + 0.35) / 0.12) ** 2) * suave(900, 1500, R)
    H = H * (1 - 0.7 * lengua) + lengua * 60 * suave(900, 2600, R)
    # Témpanos y placas de hielo sueltos por el agua
    hielo = np.clip((fbm(X / 45, Y / 45, 3) - 0.68) * 12, 0, 1) * suave(300, 450, R) * (R < 1500)
    H = np.maximum(H, 5 * hielo) - 1.5
    p = pendiente(H)
    roca = np.array([0.11, 0.115, 0.13]) * (0.75 + 0.5 * var[..., None])
    nieve = np.array([0.85, 0.89, 0.94]) * (0.92 + 0.12 * var[..., None])
    k_nieve = np.clip((1.6 - p) / 0.6, 0, 1) * suave(10, 60, H) + suave(220, 380, H) * 0.7 + lengua
    col = mezclar(roca, nieve, np.clip(k_nieve, 0, 1))
    col = mezclar(col, [0.55, 0.78, 0.88], (hielo > 0.1) * (H < 8) * 0.6)
    return H, col


def cerezos():
    # Volcán cónico nevado al fondo, colinas verdes con manchas rosas de cerezos y bosque más oscuro
    cx, cy = -700, 3700
    dist = np.hypot(X - cx, Y - cy)
    volcan = 1250 * np.clip(1 - dist / 2600, 0, 1) ** 1.7
    volcan *= 1 - 0.06 * fbm(np.arctan2(Y - cy, X - cx) * 4, dist / 300, 3, cresta=True)
    colinas = 170 * fbm(WX / 600, WY / 600, 6) ** 1.5 * suave(500, 900, R) * (0.4 + 0.6 * lados)
    H = np.maximum(volcan, colinas) - 2.0
    p = pendiente(H)
    verde = np.array([0.06, 0.16, 0.04]) * (0.75 + 0.5 * var[..., None])
    col = mezclar(verde, [0.02, 0.07, 0.03], np.clip((fbm(X / 90, Y / 90, 3) - 0.5) * 4, 0, 1))
    rosa = np.clip((fbm(X / 40 + 9, Y / 40, 3) - 0.54) * 6, 0, 1) * (colinas > volcan) * (R < 2500)
    col = mezclar(col, [0.55, 0.22, 0.32], rosa)
    ladera = np.array([0.22, 0.20, 0.22]) * (0.8 + 0.3 * var[..., None])
    col = mezclar(col, ladera, suave(380, 700, volcan) * (volcan > colinas))
    nieve = np.array([0.88, 0.9, 0.94])
    linea = 700 + 90 * fbm(np.arctan2(Y - cy, X - cx) * 6, 0.5, 3)
    col = mezclar(col, nieve, suave(linea - 30, linea + 30, volcan) * (volcan > colinas))
    return H, col * 0.75


def mediterraneo():
    # Acantilados de caliza con mesetas de matorral, pueblos blancos en las laderas y mar abierto al frente
    f = fbm(WX / 800, WY / 800, 5)
    tierra = suave(0.4, 0.46, f + 0.15 * lados - 0.3 * frente)
    H = tierra * (60 + 120 * fbm(X / 900 + 4, Y / 900, 4) ** 1.2) + tierra * 25 * fbm(X / 120, Y / 120, 4)
    H = H + tierra * 170 * fbm(X / 700 + 8, Y / 700, 5) ** 1.3 * suave(2300, 3300, R)
    H = H * suave(900, 1400, R) - 2.0
    p = pendiente(H)
    caliza = np.array([0.62, 0.52, 0.36]) * (0.8 + 0.35 * var[..., None])
    matorral = mezclar(np.array([0.16, 0.20, 0.07]) * (0.7 + 0.6 * var[..., None]), [0.30, 0.30, 0.12], np.clip((fbm(X / 50, Y / 50, 3) - 0.5) * 4, 0, 1))
    col = mezclar(caliza, matorral, np.clip((0.9 - p) / 0.5, 0, 1) * suave(4, 20, H))
    # Pueblos: racimos de casas blancas en laderas suaves a media altura
    pueblo = np.clip((fbm(X / 260 + 2, Y / 260, 3) - 0.55) * 8, 0, 1) * suave(15, 40, H) * (p < 0.9)
    casas = (fbm(X / 6, Y / 6, 2) > 0.5) * pueblo
    col = mezclar(col, [0.92, 0.9, 0.86], casas)
    col = mezclar(col, [0.75, 0.68, 0.52], np.clip(1 - (H - 0.3) / 2, 0, 1))
    return H, col * 0.45


# Cielo: multiplicador del azul arriba, nubes (0 sin, 1 muchas), sol; agua: colores del degradado cerca → lejos
CIELO = {
    'canon': {'elev': 30, 'rot': 120, 'azul': (0.75, 0.9, 1.2), 'nubes': 0.35, 'haze': (0.8, 0.62, 0.48), 'bruma': 0.5, 'tinte_sol': (1.0, 0.88, 0.72),
              'agua': [(0.0, (0.06, 0.16, 0.12)), (0.06, (0.08, 0.20, 0.18)), (1.0, (0.06, 0.10, 0.12))], 'exp': -0.35},
    'otono': {'elev': 26, 'rot': 140, 'azul': (0.7, 0.85, 1.15), 'nubes': 0.8, 'haze': (0.5, 0.6, 0.8), 'bruma': 0.75, 'tinte_sol': (1.0, 0.9, 0.78),
              'agua': [(0.0, (0.02, 0.06, 0.10)), (0.06, (0.03, 0.08, 0.14)), (1.0, (0.02, 0.05, 0.10))], 'exp': -0.3},
    'glaciar': {'elev': 22, 'rot': 150, 'azul': (0.65, 0.85, 1.2), 'nubes': 0.5, 'haze': (0.62, 0.72, 0.85), 'bruma': 0.45, 'tinte_sol': (1.0, 0.97, 0.94),
                'agua': [(0.0, (0.01, 0.10, 0.14)), (0.06, (0.02, 0.12, 0.18)), (1.0, (0.01, 0.05, 0.10))], 'exp': -0.5},
    'cerezos': {'elev': 34, 'rot': 130, 'azul': (0.75, 0.88, 1.15), 'nubes': 0.55, 'haze': (0.72, 0.74, 0.88), 'bruma': 0.6, 'tinte_sol': (1.0, 0.95, 0.9),
                'agua': [(0.0, (0.03, 0.14, 0.20)), (0.06, (0.05, 0.18, 0.26)), (1.0, (0.03, 0.09, 0.16))], 'exp': -0.35},
    'mediterraneo': {'elev': 45, 'rot': 150, 'azul': (0.5, 0.8, 1.3), 'nubes': 0.2, 'haze': (0.55, 0.68, 0.88), 'bruma': 0.45, 'tinte_sol': (1.0, 0.96, 0.88),
                     'agua': [(0.0, (0.01, 0.16, 0.30)), (0.05, (0.01, 0.12, 0.32)), (1.0, (0.003, 0.03, 0.14))], 'exp': -0.4},
}
H, col = {'canon': canon, 'otono': otono, 'glaciar': glaciar, 'cerezos': cerezos, 'mediterraneo': mediterraneo}[A.tema]()
C = CIELO[A.tema]
H = np.where(R < 260, np.minimum(H, -2), H)

verts = np.stack([X.ravel(), Y.ravel(), H.ravel()], 1)
idx = np.arange(NT * NR).reshape(NT, NR)
a, b = idx, np.roll(idx, -1, axis=0)
caras = np.stack([a[:, :-1], b[:, :-1], b[:, 1:], a[:, 1:]], -1).reshape(-1, 4)
me = bpy.data.meshes.new('GEO-terreno')
me.from_pydata(verts.tolist(), [], caras.tolist())
me.validate()
me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
terreno = bpy.data.objects.new('GEO-terreno', me)
esc.collection.objects.link(terreno)
niebla = C['bruma'] * (1 - np.exp(-np.maximum(R - 400, 0) / 9000))
atr = me.color_attributes.new('tinte', 'FLOAT_COLOR', 'POINT')
atr.data.foreach_set('color', np.concatenate([np.clip(col, 0, 1).reshape(-1, 3), np.ones((NT * NR, 1))], 1).ravel())
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

# ── Cielo físico con nubes proyectadas sobre un plano (como la laguna) ──
mundo = bpy.data.worlds.new('MUNDO')
esc.world = mundo
mundo.use_nodes = True
nt = mundo.node_tree
n, l = nt.nodes, nt.links
cielo = n.new('ShaderNodeTexSky')
cielo.sky_type = 'MULTIPLE_SCATTERING'
cielo.sun_elevation = math.radians(C['elev'])
cielo.sun_rotation = math.radians(C['rot'])
cielo.air_density = 1.0
cielo.aerosol_density = 0.7
cielo.sun_disc = False
tc = n.new('ShaderNodeTexCoord')
sep = n.new('ShaderNodeSeparateXYZ'); l.new(tc.outputs['Generated'], sep.inputs['Vector'])
zc = n.new('ShaderNodeMath'); zc.operation = 'MAXIMUM'; zc.inputs[1].default_value = 0.03; l.new(sep.outputs['Z'], zc.inputs[0])
px = n.new('ShaderNodeMath'); px.operation = 'DIVIDE'; l.new(sep.outputs['X'], px.inputs[0]); l.new(zc.outputs['Value'], px.inputs[1])
py = n.new('ShaderNodeMath'); py.operation = 'DIVIDE'; l.new(sep.outputs['Y'], py.inputs[0]); l.new(zc.outputs['Value'], py.inputs[1])
pl = n.new('ShaderNodeCombineXYZ'); l.new(px.outputs['Value'], pl.inputs['X']); l.new(py.outputs['Value'], pl.inputs['Y'])
nz = n.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.55; nz.inputs['Detail'].default_value = 10
nz.inputs['Roughness'].default_value = 0.62
l.new(pl.outputs['Vector'], nz.inputs['Vector'])
umbral = 0.62 - 0.14 * C['nubes']
forma = n.new('ShaderNodeMapRange'); forma.inputs['From Min'].default_value = umbral; forma.inputs['From Max'].default_value = umbral + 0.1
l.new(nz.outputs['Fac'], forma.inputs['Value'])
alt = n.new('ShaderNodeMapRange'); alt.inputs['From Min'].default_value = 0.0; alt.inputs['From Max'].default_value = 0.2
l.new(sep.outputs['Z'], alt.inputs['Value'])
lejos = n.new('ShaderNodeMapRange'); lejos.inputs['From Min'].default_value = 0.0; lejos.inputs['From Max'].default_value = 0.35
lejos.inputs['To Min'].default_value = 0.55; lejos.inputs['To Max'].default_value = 1.0
l.new(sep.outputs['Z'], lejos.inputs['Value'])
m1 = n.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; l.new(forma.outputs['Result'], m1.inputs[0]); l.new(alt.outputs['Result'], m1.inputs[1])
m2 = n.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; l.new(m1.outputs['Value'], m2.inputs[0]); l.new(lejos.outputs['Result'], m2.inputs[1])
sombra = n.new('ShaderNodeMix'); sombra.data_type = 'RGBA'
ts = C['tinte_sol']
sombra.inputs['A'].default_value = (1.1, 1.15, 1.25, 1); sombra.inputs['B'].default_value = (2.6 * ts[0], 2.6 * ts[1], 2.6 * ts[2], 1)
fac_sombra = n.new('ShaderNodeMapRange'); fac_sombra.inputs['From Min'].default_value = umbral; fac_sombra.inputs['From Max'].default_value = umbral + 0.3
l.new(nz.outputs['Fac'], fac_sombra.inputs['Value']); l.new(fac_sombra.outputs['Result'], sombra.inputs['Factor'])
mezcla = n.new('ShaderNodeMix'); mezcla.data_type = 'RGBA'
l.new(m2.outputs['Value'], mezcla.inputs['Factor'])
azul = n.new('ShaderNodeMix'); azul.data_type = 'RGBA'; azul.blend_type = 'MULTIPLY'
azul.inputs['B'].default_value = (*C['azul'], 1)
l.new(alt.outputs['Result'], azul.inputs['Factor'])
l.new(cielo.outputs['Color'], azul.inputs['A'])
l.new(azul.outputs['Result'], mezcla.inputs['A'])
l.new(sombra.outputs['Result'], mezcla.inputs['B'])
fondo = n['Background']
fondo.inputs['Strength'].default_value = 0.42
l.new(mezcla.outputs['Result'], fondo.inputs['Color'])
sol_d = bpy.data.lights.new('LGT-sol', 'SUN')
sol_d.energy = 4.0
sol_d.color = ts
sol_d.angle = math.radians(1.0)
sol = bpy.data.objects.new('LGT-sol', sol_d)
esc.collection.objects.link(sol)
sol.rotation_euler = (math.radians(90 - C['elev']), 0, math.radians(C['rot'] + 180))

# ── Materiales: terreno con bruma y agua ──
mt = bpy.data.materials.new('MAT-terreno')
mt.use_nodes = True
n, l = mt.node_tree.nodes, mt.node_tree.links
pb = n['Principled BSDF']
pb.inputs['Roughness'].default_value = 0.9
c_at = n.new('ShaderNodeAttribute'); c_at.attribute_name = 'tinte'
n_at = n.new('ShaderNodeAttribute'); n_at.attribute_name = 'niebla'
l.new(c_at.outputs['Color'], pb.inputs['Base Color'])
em = n.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (*C['haze'], 1); em.inputs['Strength'].default_value = 1.0
mix = n.new('ShaderNodeMixShader')
l.new(n_at.outputs['Fac'], mix.inputs['Fac'])
l.new(pb.outputs['BSDF'], mix.inputs[1])
l.new(em.outputs['Emission'], mix.inputs[2])
l.new(mix.outputs['Shader'], n['Material Output'].inputs['Surface'])
terreno.data.materials.append(mt)

bpy.ops.mesh.primitive_circle_add(vertices=512, radius=30000, fill_type='NGON', location=(0, 0, 0))
agua = bpy.context.active_object
ma = bpy.data.materials.new('MAT-agua')
ma.use_nodes = True
n, l = ma.node_tree.nodes, ma.node_tree.links
pa = n['Principled BSDF']
pa.inputs['Roughness'].default_value = 0.22
pa.inputs['Specular IOR Level'].default_value = 0.2
pa.inputs['IOR'].default_value = 1.33
tc = n.new('ShaderNodeTexCoord')
lg = n.new('ShaderNodeVectorMath'); lg.operation = 'LENGTH'; l.new(tc.outputs['Object'], lg.inputs[0])
rampa = n.new('ShaderNodeValToRGB')
el = rampa.color_ramp.elements
(p0, c0), *medio, (p1, c1) = C['agua']
el[0].position = p0; el[0].color = (*c0, 1)
el[1].position = p1; el[1].color = (*c1, 1)
for pos, c in medio:
    el.new(pos).color = (*c, 1)
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

esc.render.engine = 'CYCLES'
esc.cycles.device = 'CPU'
esc.cycles.samples = A.muestras
esc.cycles.use_denoising = True
esc.cycles.max_bounces = 4
esc.view_settings.view_transform = 'AgX'
esc.view_settings.look = 'AgX - Punchy'
esc.view_settings.exposure = C['exp']
esc.render.resolution_x = A.ancho
esc.render.resolution_y = round(A.ancho * (LAT_MAX - LAT_MIN) / 360)
esc.render.image_settings.file_format = 'PNG'
esc.render.filepath = os.path.join(SAL, 'panorama_bruto.png')
bpy.ops.render.render(write_still=True)
print('PANORAMA', esc.render.filepath, esc.render.resolution_x, esc.render.resolution_y,
      'horizonte_fila', round(esc.render.resolution_y * LAT_MAX / (LAT_MAX - LAT_MIN)), flush=True)
