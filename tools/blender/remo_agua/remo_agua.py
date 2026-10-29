# Vikingo remando en el fiordo: render realista en Cycles (barca, remos, agua con reflejos y salpicaduras) en bucle perfecto.
# Parte del .blend que deja vikingo.py (cuerpo, equipo, materiales y rig) y del panorama del fiordo de la carrera.
# Uso (módulo bpy o Blender 4.2+):
#   python tools/blender/vikingo/vikingo.py --salida /tmp/vk                       # deja /tmp/vk/vikingo.blend y texturas
#   python tools/blender/remo_agua/remo_agua.py --blend /tmp/vk/vikingo.blend --salida /tmp/remo [--frames 1-96] [--res 960x540]
# El agua se calcula aquí con NumPy (suma de olas periódica en espacio y tiempo) en vez del modificador Ocean: el espectro
# del Ocean no se repite en el tiempo y el clip tiene que cerrar sin salto. Dos paladas = 96 fotogramas = 3,2 s.
import bpy, bmesh, math, os, sys, argparse
import numpy as np
from mathutils import Vector, Matrix, Quaternion

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..'))
_argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--blend', required=True)
ap.add_argument('--salida', default='salida')
ap.add_argument('--frames', default='1-96')
ap.add_argument('--res', default='960x540')
ap.add_argument('--muestras', type=int, default=64)
ap.add_argument('--camara', default='lado', choices=('lado', 'popa', 'cerca'))
ap.add_argument('--paisaje', default='fiordo')
A = ap.parse_args([a for a in _argv if not a.endswith('.py')])
SAL = os.path.abspath(A.salida)
os.makedirs(os.path.join(SAL, 'frames'), exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=os.path.abspath(A.blend))
esc = bpy.context.scene
col = esc.collection
rig = bpy.data.objects['Vikingo']
PB = rig.pose.bones
FPS = 30
PALADA = 48                       # fotogramas por palada (1,6 s, 37,5 golpes/min, como la acción rowing)
BUCLE = 2 * PALADA                # el clip cierra cada dos paladas
T = BUCLE / FPS
AGUA_Z = 0.20                     # línea de flotación
VEL = 3.75                        # m/s de la barca: recorre una tesela de olas (12 m) por bucle
TESELA = 12.0
G = 9.81

for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA') or o.name.startswith(('Hacha', 'Cenefa', 'RemoMango', 'RemoPuno', 'Capa', 'BrocheCapa', 'Rodillera', 'Falda')):
        bpy.data.objects.remove(o)


# ════════ 1. Palada para el agua: las manos bajan en la recuperación para sacar la hoja ════════
# Igual que rowing de animaciones.py (IK de manos y pies horneado a FK), con la altura del puño ajustada.
def _dir(n):
    b = rig.data.bones[n]
    return (b.tail_local - b.head_local).normalized()


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
DEDO = {}
for s in 'LR':
    d = _dir('finger3-1.' + s)
    a = (rig.data.bones['finger2-1.' + s].head_local - rig.data.bones['finger5-1.' + s].head_local).normalized()
    palma = d.cross(a) if s == 'L' else a.cross(d)
    for f in range(1, 6):
        for k in (1, 2, 3):
            n = f'finger{f}-{k}.{s}'
            DEDO[n] = tuple(_dir(n).cross(palma).normalized())


def q(n, *giros):
    M = rig.data.bones[n].matrix_local.to_3x3()
    R = Matrix.Identity(3)
    for eje, g in giros:
        R = R @ Matrix.Rotation(math.radians(g), 3, Vector(eje))
    return (M.inverted() @ R @ M).to_quaternion()


def loc(n, delta):
    return rig.data.bones[n].matrix_local.to_3x3().inverted() @ Vector(delta)


def periodica(tabla, f):
    """Catmull-Rom periódico sobre una palada: tabla = [(fotograma 1..49, valor)], el último repite el primero."""
    fs = [p[0] for p in tabla[:-1]]
    vs = [np.array(p[1], float) for p in tabla[:-1]]
    n = len(fs)
    f = (f - 1) % PALADA + 1
    i = max(j for j in range(n) if fs[j] <= f)
    f0, f1 = fs[i], (fs[(i + 1) % n] if i + 1 < n else fs[0] + PALADA)
    u = (f - f0) / (f1 - f0)
    p0, p1, p2, p3 = vs[(i - 1) % n], vs[i], vs[(i + 1) % n], vs[(i + 2) % n]
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)


# (fotograma, deslizamiento del asiento, inclinación del tronco, avance del puño): las fases de animaciones.py
CUERPO = [(1, (-0.30, 24, -0.08)), (7, (-0.16, 18, 0.06)), (13, (0.06, 2, 0.30)), (18, (0.12, -14, 0.62)),
          (24, (0.10, -12, 0.42)), (33, (0.02, 12, 0.12)), (41, (-0.18, 22, -0.02)), (49, (-0.30, 24, -0.08))]
# altura del puño: alta en el empuje (hoja dentro), baja en la recuperación (hoja fuera)
ALTURA = [(1, (0.175,)), (4, (0.205,)), (16, (0.20,)), (19, (0.19,)), (22, (0.125,)), (26, (0.11,)),
          (38, (0.11,)), (44, (0.125,)), (47, (0.16,)), (49, (0.175,))]

Z_SUELO = -rig.location.z
asiento_z = Z_SUELO + 0.45
caida = asiento_z - rig.data.bones['root'].head_local.z
remo0 = rig.data.bones['remo'].head_local.copy()
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
restr = []
for lado in 'LR':
    for hueso, ik, polo in (('lowerleg02.', 'ik_pie.', 'polo_rodilla.'), ('lowerarm02.', 'ik_mano.', 'polo_codo.')):
        c = PB[hueso + lado].constraints.new('IK'); c.target = rig; c.subtarget = ik + lado
        c.pole_target = rig; c.pole_subtarget = polo + lado; c.pole_angle = math.radians(-90); c.chain_count = 4
        restr.append((hueso + lado, c))
accion = bpy.data.actions.new('rowing_agua_ik')
rig.animation_data.action = accion
HUESOS = [b.name for b in rig.data.bones]
for f in range(1, PALADA + 2):
    desliza, tronco, py = periodica(CUERPO, f)
    pz, = periodica(ALTURA, f)
    r = {'spine05': [(X, tronco * 0.45)], 'spine04': [(X, tronco * 0.25)], 'spine03': [(X, tronco * 0.2)],
         'spine02': [(X, tronco * 0.1)], 'neck01': [(X, -tronco * 0.45)], 'head': [(X, -tronco * 0.3)]}
    for s in 'LR':
        for dd in range(2, 6):
            for k in (1, 2, 3):
                n = f'finger{dd}-{k}.{s}'
                r[n] = [(DEDO[n], 75 * (0.8 if k == 1 else 1.0))]
        for k in (2, 3):
            r[f'finger1-{k}.{s}'] = [(DEDO[f'finger1-{k}.{s}'], 35)]
    l = {'root': loc('root', (0, desliza, caida)),
         'remo': loc('remo', (0, desliza - 0.25 + py, asiento_z + pz + 0.2 - remo0.z))}
    for n in HUESOS:
        pb = PB[n]
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = q(n, *r[n]) if n in r else Quaternion()
        pb.location = l.get(n, Vector())
        pb.keyframe_insert('rotation_quaternion', frame=f, group=n)
        pb.keyframe_insert('location', frame=f, group=n)
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.nla.bake(frame_start=1, frame_end=PALADA + 1, step=1, only_selected=False, visual_keying=True,
                 clear_constraints=False, use_current_action=False, bake_types={'POSE'})
rig.animation_data.action.name = 'rowing_agua'
bpy.data.actions.remove(accion)
for n, c in restr:
    PB[n].constraints.remove(c)
bpy.ops.object.mode_set(mode='OBJECT')


# ════════ 2. Barca, asiento, reposapiés, horquillas y remos ════════
MAT = bpy.data.materials


def malla(nombre, bm, mat, suave=True, padre=None):
    me = bpy.data.meshes.new(nombre); bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = suave
    me.materials.append(mat)
    o = bpy.data.objects.new(nombre, me); col.objects.link(o)
    if padre:
        o.parent = padre
    return o


def caja(nombre, centro, tam, mat, padre=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, calc_uvs=True)
    bmesh.ops.scale(bm, vec=tam, verts=bm.verts)
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=min(tam) * 0.2, segments=2, affect='EDGES')
    o = malla(nombre, bm, mat, True, padre)
    o.location = centro
    return o


def tubo(bm, a, b, r, seg=12):
    a, b = Vector(a), Vector(b)
    m = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=(b - a).length, calc_uvs=True)
    rot = (b - a).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=m['verts'])


# madera de la barca: el fresno de la ficha, oscurecido con brea
MADERA_BARCA = MAT['Madera'].copy(); MADERA_BARCA.name = 'MaderaBarca'
_nt = MADERA_BARCA.node_tree
_b = _nt.nodes['Principled BSDF']
_tex = _b.inputs['Base Color'].links[0].from_node
_mx = _nt.nodes.new('ShaderNodeMix'); _mx.data_type = 'RGBA'; _mx.blend_type = 'MULTIPLY'
_mx.inputs[0].default_value = 1.0; _mx.inputs[7].default_value = (0.42, 0.36, 0.32, 1)
_nt.links.new(_tex.outputs['Color'], _mx.inputs[6]); _nt.links.new(_mx.outputs[2], _b.inputs['Base Color'])
_b.inputs['Roughness'].default_value = 0.45

# Casco de tingladillo: popa en -Y (hacia donde mira el remero), proa en +Y (hacia donde avanza).
Y0, Y1 = -2.45, 2.95
LARGO = Y1 - Y0


def manga(y):
    s = np.clip((y - (Y0 + Y1) / 2) / (LARGO / 2), -1, 1)
    return 0.34 * (1 - s * s) ** 0.75


def casco():
    bm = bmesh.new()
    NY, NT = 90, 26
    uv = bm.loops.layers.uv.new()
    filas = []
    for i in range(NY + 1):
        y = Y0 + LARGO * i / NY
        s = (y - (Y0 + Y1) / 2) / (LARGO / 2)
        w = max(0.34 * (1 - s * s) ** 0.75, 0.004)
        d = 0.36 * max(1 - s * s, 0.0) ** 0.3 + 0.04
        borda = 0.40 + 0.10 * s ** 4
        fila = []
        for j in range(NT + 1):
            t = math.pi * j / NT
            tinglado = 0.006 * ((j * 6 // NT) % 2)  # tracas solapadas
            fila.append(bm.verts.new((math.cos(t) * (w + tinglado), y, borda - d * abs(math.sin(t)) ** 0.8)))
        filas.append(fila)
    for i in range(NY):
        for j in range(NT):
            f = bm.faces.new((filas[i][j], filas[i + 1][j], filas[i + 1][j + 1], filas[i][j + 1]))
            for lp, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uv].uv = (b / NT * 3, a / NY * 1.5)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.003)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = malla('Casco', bm, MADERA_BARCA)
    o.modifiers.new('grosor', 'SOLIDIFY').thickness = 0.018
    o.modifiers.new('sub', 'SUBSURF').levels = 1
    return o


barca = casco()
# regala (borde) y quilla
bm = bmesh.new()
for s in (1, -1):
    pts = [(s * manga(y) * 1.02, y, 0.40 + 0.10 * ((y - (Y0 + Y1) / 2) / (LARGO / 2)) ** 4 + 0.01) for y in np.linspace(Y0 + 0.08, Y1 - 0.08, 40)]
    for a, b in zip(pts, pts[1:]):
        tubo(bm, a, b, 0.018, 8)
malla('Regala', bm, MAT['CueroOscuro'])
# asiento corredizo: sigue a la cadera (hueso root) en Y
asiento = caja('Asiento', (0, 0, 0.345), (0.30, 0.26, 0.05), MAT['Madera'])
c = asiento.constraints.new('COPY_LOCATION'); c.target = rig; c.subtarget = 'root'; c.use_x = c.use_z = False
for s in (1, -1):
    caja('Riel', (s * 0.12, -0.1, 0.30), (0.03, 0.95, 0.04), MAT['Hierro'])
caja('Bancada', (0, -0.1, 0.27), (0.5, 1.0, 0.03), MAT['Madera'])
pies = caja('Reposapies', (0, -0.84, 0.20), (0.42, 0.04, 0.26), MAT['Madera'])
pies.rotation_euler.x = math.radians(-35)
caja('Proa', (0, 1.6, 0.40), (0.46, 1.6, 0.02), MAT['Madera'])
caja('Popa', (0, -1.7, 0.38), (0.36, 1.1, 0.02), MAT['Madera'])

# muestreo de las manos para colocar las horquillas (perno donde el remo queda perpendicular a mitad de palada)
rig.animation_data.action = bpy.data.actions['rowing_agua']
manos = []
for f in range(1, PALADA + 1):
    esc.frame_set(f)
    manos.append(rig.matrix_world @ PB['ik_mano.L'].head)
manos = np.array(manos)
DENTRO, FUERA, PALA = 0.90, 1.95, 0.48   # interior (perno-puño), exterior hasta la pala, largo de la pala
alto_empuje = manos[3:16, 2].mean()
r_palanca = (FUERA + PALA * 0.5) / 0.75
PERNO = {'L': Vector((0.80, -0.48, 0.0)), 'R': Vector((-0.80, -0.48, 0.0))}
# la pala en el empuje: centro 4 cm bajo la flotación. Pala = perno - (mano - perno)·r → perno = (pala + r·mano)/(1+r)
pz = (AGUA_Z - 0.04 + r_palanca * alto_empuje) / (1 + r_palanca)
PERNO['L'].z, PERNO['R'].z = pz + 0.015, pz - 0.015   # el remo izquierdo pasa por encima en el cruce de puños
print('PERNO z', round(pz, 3), 'manos z', manos[:, 2].min().round(3), manos[:, 2].max().round(3))

PALAS, REMOS = {}, {}
for s, lado in ((1, 'L'), (-1, 'R')):
    mano = bpy.data.objects.new('Mano.' + lado, None); col.objects.link(mano)
    c = mano.constraints.new('COPY_LOCATION'); c.target = rig; c.subtarget = 'ik_mano.' + lado
    piv = bpy.data.objects.new('Perno.' + lado, None); col.objects.link(piv)
    piv.location = PERNO[lado]
    piv.rotation_euler.z = 0 if lado == 'L' else math.pi
    c = piv.constraints.new('DAMPED_TRACK'); c.target = mano; c.track_axis = 'TRACK_NEGATIVE_X'
    bm = bmesh.new()
    tubo(bm, (-DENTRO, 0, 0), (-DENTRO + 0.28, 0, 0), 0.019, 12)        # puño
    tubo(bm, (-DENTRO + 0.28, 0, 0), (FUERA, 0, 0), 0.022, 12)          # caña
    tubo(bm, (-0.06, 0, 0), (0.06, 0, 0), 0.03, 12)                     # tope del perno
    m = bmesh.ops.create_cube(bm, size=1.0, calc_uvs=True)              # pala (cuadrada = vertical)
    bmesh.ops.scale(bm, vec=(PALA, 0.014, 0.20), verts=m['verts'])
    bmesh.ops.translate(bm, vec=(FUERA + PALA / 2 - 0.04, 0, -0.02), verts=m['verts'])
    remo = malla('Remo.' + lado, bm, MAT['Madera'], True, piv)
    remo.modifiers.new('bisel', 'BEVEL').width = 0.004
    REMOS[lado] = remo
    PALAS[lado] = Vector((FUERA + PALA / 2 - 0.04, 0, -0.02))
    # punta pintada
    bm = bmesh.new()
    m = bmesh.ops.create_cube(bm, size=1.0, calc_uvs=True)
    bmesh.ops.scale(bm, vec=(0.12, 0.018, 0.205), verts=m['verts'])
    bmesh.ops.translate(bm, vec=(FUERA + PALA - 0.10, 0, -0.02), verts=m['verts'])
    malla('PuntaPala.' + lado, bm, MAT['Laton'], True, remo)
    # giro de la pala (plumeo): plana en la recuperación
    for f, g in ((1, 0), (19, 0), (24, 88), (38, 88), (44, 0), (49, 0)):
        remo.rotation_euler.x = math.radians(g * s)
        remo.keyframe_insert('rotation_euler', index=0, frame=f)
    for fc in remo.animation_data.action.fcurves if hasattr(remo.animation_data.action, 'fcurves') else []:
        for k in fc.keyframe_points:
            k.interpolation = 'SINE'


def pala(lado):
    return REMOS[lado].matrix_world @ PALAS[lado]


def remo_frame(t):
    """Fotograma de la acción (1..49) para el tiempo t en segundos."""
    return (t * FPS) % PALADA + 1


# trayectoria de las palas en una palada (para salpicaduras, charcos y estela); se ajusta la altura de los pernos
# hasta que la pala quede sumergida en el empuje
TT = np.arange(0, PALADA, 0.5) / FPS
EMPUJE = (TT * FPS > 3) & (TT * FPS < 16)


def trayectoria():
    tr = {'L': [], 'R': []}
    for t in TT:
        f = remo_frame(t)
        esc.frame_set(int(f), subframe=f - int(f))
        for lado in 'LR':
            tr[lado].append(tuple(pala(lado)))
    return {k: np.array(v) for k, v in tr.items()}


for _ in range(4):
    TRAY = trayectoria()
    for lado in 'LR':
        err = TRAY[lado][EMPUJE, 2].mean() - (AGUA_Z - 0.06)
        PERNO[lado].z -= err / (1 + r_palanca)
        bpy.data.objects['Perno.' + lado].location.z = PERNO[lado].z
TRAY = trayectoria()
print('PERNO z', round(PERNO['L'].z, 3), round(PERNO['R'].z, 3))
# horquillas: brazos de hierro desde la regala
bm = bmesh.new()
for s, lado in ((1, 'L'), (-1, 'R')):
    p = PERNO[lado]
    for dy in (-0.32, 0.30):
        tubo(bm, (s * 0.30, p.y + dy, 0.41), (p.x, p.y, p.z - 0.03), 0.014, 8)
    tubo(bm, (s * 0.30, p.y + 0.30, 0.41), (s * 0.30, p.y - 0.32, 0.41), 0.012, 8)
    tubo(bm, (p.x, p.y, p.z - 0.05), (p.x, p.y, p.z + 0.07), 0.012, 8)
malla('Horquillas', bm, MAT['Hierro'])

dentro = TRAY['L'][:, 2] < AGUA_Z + 0.02
i_ent = int(np.argmax(dentro & ~np.roll(dentro, 1)))
i_sal = int(np.argmax(~dentro & np.roll(dentro, 1)))
T_ENT, T_SAL = TT[i_ent], TT[i_sal]
print('pala: entra', round(T_ENT * FPS, 1), 'sale', round(T_SAL * FPS, 1), 'z min/max', TRAY['L'][:, 2].min().round(3), TRAY['L'][:, 2].max().round(3))


def pala_en(lado, t):
    """Posición del centro de la pala en el tiempo t (interpolada de la trayectoria)."""
    u = (t % (PALADA / FPS)) / (0.5 / FPS)
    i = int(u) % len(TT); j = (i + 1) % len(TT); w = u - int(u)
    return TRAY[lado][i] * (1 - w) + TRAY[lado][j] * w


# ════════ 3. Agua: malla densa cerca de la barca, olas periódicas, charcos de las palas, estela ════════
def eje(a, b, paso, n_fuera, lejos):
    core = np.arange(a, b + 1e-6, paso)
    k = np.geomspace(paso * 1.15, lejos / n_fuera * 4, n_fuera)
    izq = a - np.cumsum(k)
    der = b + np.cumsum(k)
    return np.concatenate([izq[::-1], core, der])


XS = eje(-16.0, 9.0, 0.05, 55, 900.0)
YS = eje(-16.0, 14.0, 0.05, 55, 900.0)
NX, NYa = len(XS), len(YS)
GX, GY = np.meshgrid(XS, YS, indexing='ij')
PX = np.gradient(XS)[:, None] * np.ones_like(GX)
PY = np.ones_like(GX) * np.gradient(YS)[None, :]
PASO = np.maximum(PX, PY)
print('agua', NX, 'x', NYa, '=', GX.size, 'vértices')

me = bpy.data.meshes.new('Agua')
vi = np.arange(GX.size).reshape(NX, NYa)
quads = np.stack([vi[:-1, :-1], vi[1:, :-1], vi[1:, 1:], vi[:-1, 1:]], -1).reshape(-1, 4)
me.vertices.add(GX.size)
me.loops.add(quads.size)
me.polygons.add(len(quads))
me.vertices.foreach_set('co', np.stack([GX, GY, np.full_like(GX, AGUA_Z)], -1).ravel().astype(np.float32))
me.loops.foreach_set('vertex_index', quads.ravel().astype(np.int32))
me.polygons.foreach_set('loop_start', (np.arange(len(quads)) * 4).astype(np.int32))
me.polygons.foreach_set('use_smooth', np.ones(len(quads), bool))
me.update(calc_edges=True)
me.attributes.new('espuma', 'FLOAT', 'POINT')
agua = bpy.data.objects.new('Agua', me); col.objects.link(agua)

# espectro: olas cortas de viento sobre un mar de fiordo casi en calma; vectores de onda enteros en la tesela,
# frecuencias redondeadas a múltiplos de 2π/T (bucle exacto)
rng = np.random.default_rng(3)
OLAS = []
while len(OLAS) < 110:
    lam = math.exp(rng.uniform(math.log(0.12), math.log(11.0)))
    ang = math.radians(35 + rng.normal(0, 40))
    nx, ny = round(math.cos(ang) * TESELA / lam), round(math.sin(ang) * TESELA / lam)
    if nx == 0 and ny == 0:
        continue
    kx, ky = 2 * math.pi * nx / TESELA, 2 * math.pi * ny / TESELA
    k = math.hypot(kx, ky)
    m = max(1, round(math.sqrt(G * k) * T / (2 * math.pi)))
    lam = 2 * math.pi / k
    a = min(0.035 * lam / (2 * math.pi), 0.01) / math.sqrt(110 / 12)
    OLAS.append((kx, ky, k, 2 * math.pi * m / T, a, rng.uniform(0, 2 * math.pi)))


def suave(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def agua_en(t):
    """Alturas y espuma de la malla en el tiempo t, en el marco de la barca (el agua corre hacia -Y a VEL)."""
    y_agua = GY + VEL * t
    z = np.zeros_like(GX); dx = np.zeros_like(GX); dy = np.zeros_like(GX)
    for kx, ky, k, w, a, ph in OLAS:
        filtro = suave((2 * math.pi / k) / (4 * PASO) - 1)
        fase = kx * GX + ky * y_agua - w * t + ph
        z += a * filtro * np.cos(fase)
        s = 0.7 * a * filtro * np.sin(fase) / k   # Gerstner: crestas algo más agudas
        dx -= s * kx; dy -= s * ky
    espuma = np.zeros_like(GX)
    # estela: uve de Kelvin detrás de la popa y espuma pegada al casco
    yb = GY - Y0
    detras = yb < 0
    r = np.hypot(GX, yb)
    ang = np.abs(np.arctan2(GX, -yb))
    brazo = np.exp(-((ang - math.radians(19.5)) / 0.05) ** 2) * detras * np.exp(-r / 9)
    z += 0.018 * brazo * np.sin(r * 9 - VEL * t * 9 * 0.0)
    espuma += 0.45 * brazo * np.exp(-r / 3)
    centro = detras * np.exp(-(GX / (0.12 + 0.04 * r)) ** 2) * np.exp(-r / 2.5)
    espuma += 0.55 * centro
    w_casco = manga(np.clip(GY, Y0, Y1))
    junto = (GY > Y0) & (GY < Y1)
    dist = np.abs(GX) - w_casco
    proa = np.clip((GY - 0.5) / (Y1 - 0.5), 0, 1)
    z += junto * 0.03 * proa * np.exp(-np.clip(dist, 0, None) / 0.12) * (dist > 0)
    espuma += junto * (0.25 + 0.5 * proa) * np.exp(-np.clip(dist, 0, None) / 0.05) * (dist > -0.01)
    # charcos de las palas (remolinos que se quedan en el agua y se alejan por la popa)
    P = PALADA / FPS
    for lado in 'LR':
        for kk in range(-3, 1):
            for ts, fuerza in ((T_SAL, 1.0), (T_ENT, 0.4)):
                t0 = (math.floor(t / P) + kk) * P + ts
                edad = t - t0
                if edad < 0 or edad > 3.2:
                    continue
                cx, cy, _ = pala_en(lado, ts)
                cy -= VEL * edad
                rr = np.hypot(GX - cx, (GY - cy) * 0.8)
                caida_c = math.exp(-edad / 1.1) * fuerza
                anillo = 0.12 + 0.55 * edad
                z += caida_c * (-0.035 * np.exp(-(rr / 0.16) ** 2) + 0.012 * np.exp(-((rr - anillo) / 0.07) ** 2))
                giro = 0.5 + 0.5 * np.sin(np.arctan2(GY - cy, GX - cx) * 3 + rr * 18 - edad * 6)
                espuma += caida_c * (0.9 * np.exp(-(rr / 0.28) ** 2) * (0.5 + 0.5 * giro) + 0.35 * np.exp(-((rr - anillo) / 0.05) ** 2))
    # la pala dentro del agua: remolino y espuma alrededor durante el empuje
    tp = t % P
    if T_ENT <= tp <= T_SAL:
        hondo = math.sin(math.pi * (tp - T_ENT) / (T_SAL - T_ENT))
        for lado in 'LR':
            cx, cy, _ = pala_en(lado, tp)
            rr = np.hypot((GX - cx) * 0.7, GY - cy)
            z += hondo * (-0.025 * np.exp(-(rr / 0.2) ** 2) + 0.015 * np.exp(-((rr - 0.3) / 0.08) ** 2))
            espuma += hondo * 0.9 * np.exp(-(rr / 0.3) ** 2)
    # dentro del casco no hay agua
    z = np.where(junto & (dist < -0.015), -0.6, z)
    return np.stack([GX + dx, GY + dy, AGUA_Z + z], -1), np.clip(espuma, 0, 1)


m_agua = bpy.data.materials.new('Agua')
m_agua.use_nodes = True
nt = m_agua.node_tree
b = nt.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.004, 0.016, 0.02, 1)
b.inputs['Roughness'].default_value = 0.04
b.inputs['IOR'].default_value = 1.333
at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'espuma'
ruido = nt.nodes.new('ShaderNodeTexNoise'); ruido.inputs['Scale'].default_value = 9; ruido.inputs['Detail'].default_value = 8
tc = nt.nodes.new('ShaderNodeTexCoord')
nt.links.new(tc.outputs['Object'], ruido.inputs['Vector'])
mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
nt.links.new(at.outputs['Fac'], mul.inputs[0]); nt.links.new(ruido.outputs['Fac'], mul.inputs[1])
rampa = nt.nodes.new('ShaderNodeValToRGB')
rampa.color_ramp.elements[0].position = 0.22; rampa.color_ramp.elements[1].position = 0.55
nt.links.new(mul.outputs[0], rampa.inputs['Fac'])
espuma_bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
espuma_bsdf.inputs['Base Color'].default_value = (0.8, 0.85, 0.86, 1); espuma_bsdf.inputs['Roughness'].default_value = 0.6
# rizos finos: mapa de altura periódico (tesela de 1,5 m, cabe 8 veces en la de las olas) que corre con el agua
RIZO = 1.5
g = np.random.default_rng(11)
uu, vv = np.meshgrid(np.arange(512) / 512, np.arange(512) / 512, indexing='xy')
alt = np.zeros((512, 512))
for _ in range(90):
    lam = math.exp(g.uniform(math.log(0.025), math.log(0.35)))
    an = math.radians(35 + g.normal(0, 50))
    nx, ny = round(math.cos(an) * RIZO / lam), round(math.sin(an) * RIZO / lam)
    alt += (lam ** 0.8) * np.cos(2 * math.pi * (nx * uu + ny * vv) + g.uniform(0, 6.3))
alt = (alt - alt.min()) / (alt.max() - alt.min())
im_r = bpy.data.images.new('rizos', 512, 512, float_buffer=True)
im_r.pixels.foreach_set(np.dstack([alt, alt, alt, np.ones_like(alt)]).astype(np.float32).ravel())
im_r.colorspace_settings.name = 'Non-Color'
im_r.pack()
mapa = nt.nodes.new('ShaderNodeMapping')
mapa.inputs['Scale'].default_value = (1 / RIZO, 1 / RIZO, 1)
nt.links.new(tc.outputs['Object'], mapa.inputs['Vector'])
t_r = nt.nodes.new('ShaderNodeTexImage'); t_r.image = im_r; t_r.interpolation = 'Cubic'
nt.links.new(mapa.outputs['Vector'], t_r.inputs['Vector'])
bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.5; bump.inputs['Distance'].default_value = 0.01
nt.links.new(t_r.outputs['Color'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
MAPA_RIZOS = mapa
mix = nt.nodes.new('ShaderNodeMixShader')
nt.links.new(rampa.outputs['Color'], mix.inputs['Fac'])
nt.links.new(b.outputs['BSDF'], mix.inputs[1]); nt.links.new(espuma_bsdf.outputs['BSDF'], mix.inputs[2])
nt.links.new(mix.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
me.materials.append(m_agua)


# ════════ 4. Gotas: salpicadura al entrar, cortina al sacar la pala y goteo en la recuperación ════════
m_gota = bpy.data.materials.new('Gota')
m_gota.use_nodes = True
bg = m_gota.node_tree.nodes['Principled BSDF']
bg.inputs['Base Color'].default_value = (0.85, 0.92, 0.95, 1)
bg.inputs['Roughness'].default_value = 0.08
bg.inputs['Transmission Weight'].default_value = 0.75
bg.inputs['IOR'].default_value = 1.333
ico = bmesh.new(); bmesh.ops.create_icosphere(ico, subdivisions=1, radius=1.0)
ICO_V = np.array([v.co[:] for v in ico.verts]); ICO_F = np.array([[v.index for v in f.verts] for f in ico.faces]); ico.free()
gotas_me = bpy.data.meshes.new('Gotas'); gotas_me.materials.append(m_gota)
gotas = bpy.data.objects.new('Gotas', gotas_me); col.objects.link(gotas)

EVENTOS = []   # (instante en la palada, n, velocidad media, dispersión, radio, hacia arriba)
EVENTOS.append((T_ENT + 0.02, 22, (0.0, -0.6, 0.9), (0.5, 0.5, 0.5), 0.006))
EVENTOS.append((T_SAL - 0.02, 46, (0.0, -1.6, 1.5), (0.45, 0.8, 0.6), 0.008))


def gotas_en(t):
    P = PALADA / FPS
    pos, vel, rad = [], [], []
    for lado, s in (('L', 1), ('R', -1)):
        for kk in range(-2, 1):
            n_palada = math.floor(t / P) + kk
            for e, (ts, n, v0, disp, r0) in enumerate(EVENTOS):
                g = np.random.default_rng(1000 * e + (n_palada % 2) * 7 + (s > 0))
                t0 = n_palada * P + ts + g.uniform(-0.03, 0.06, n)
                p0 = pala_en(lado, ts)[None, :] + g.normal(0, 1, (n, 3)) * (0.15, 0.06, 0.03)
                p0[:, 2] = np.maximum(p0[:, 2], AGUA_Z + 0.01)
                v = np.array(v0)[None, :] + g.normal(0, 1, (n, 3)) * disp
                v[:, 0] *= s
                v[:, 0] += s * np.abs(g.normal(0, 0.4, n))
                v[:, 1] -= VEL * 0.85   # el agua soltada queda casi quieta respecto al agua: se aleja hacia popa
                r = r0 * g.uniform(0.4, 1.4, n)
                tau = t - t0
                p = p0 + v * tau[:, None] + 0.5 * np.array([0, 0, -G])[None, :] * tau[:, None] ** 2
                vv = v + np.array([0, 0, -G])[None, :] * tau[:, None]
                vivo = (tau > 0) & ((p[:, 2] > AGUA_Z - 0.01) | (vv[:, 2] > 0))
                pos.append(p[vivo]); vel.append(vv[vivo]); rad.append(r[vivo])
            # goteo de la pala en la recuperación
            g = np.random.default_rng(77 + (s > 0) + (n_palada % 2) * 3)
            nd = 26
            ts = T_SAL + np.sort(g.uniform(0.05, 0.75, nd))
            t0 = n_palada * P + ts
            p0 = np.array([pala_en(lado, x) for x in ts]) + g.normal(0, 1, (nd, 3)) * (0.12, 0.01, 0.0) - (0, 0, 0.1)
            v = np.zeros((nd, 3)); v[:, 1] = -VEL * 0.9
            tau = t - t0
            p = p0 + v * tau[:, None] + 0.5 * np.array([0, 0, -G])[None, :] * tau[:, None] ** 2
            vv = v + np.array([0, 0, -G])[None, :] * tau[:, None]
            vivo = (tau > 0) & (p[:, 2] > AGUA_Z - 0.01)
            pos.append(p[vivo]); vel.append(vv[vivo]); rad.append(g.uniform(0.003, 0.006, nd)[vivo])
    return np.concatenate(pos), np.concatenate(vel), np.concatenate(rad)


def actualizar_gotas(t):
    p, v, r = gotas_en(t)
    gotas_me.clear_geometry()
    if not len(p):
        return
    # cada gota se estira en la dirección de su velocidad (desenfoque de 1/60 s)
    vn = np.linalg.norm(v, axis=1, keepdims=True) + 1e-6
    d = v / vn
    estira = 1 + vn[:, 0] * (1 / 60) / (2 * r)
    proy = ICO_V[None, :, :] @ d[:, :, None]                                  # (n, 42, 1)
    verts = ICO_V[None] + (estira[:, None, None] - 1) * proy * d[:, None, :]
    verts = verts * r[:, None, None] + p[:, None, :]
    caras = (ICO_F[None] + (np.arange(len(p)) * len(ICO_V))[:, None, None]).reshape(-1, 3)
    gotas_me.from_pydata(verts.reshape(-1, 3).tolist(), [], caras.tolist())
    for pl in gotas_me.polygons:
        pl.use_smooth = True


# ════════ 5. Cielo, paisaje y sol ════════
LAT_MIN, LAT_MAX = -7.0 * 0.5, 18.0 * 0.5   # el panorama de la app, a media altura: montañas lejanas
mundo = bpy.data.worlds.new('Fiordo'); esc.world = mundo
mundo.use_nodes = True
wn, wl = mundo.node_tree.nodes, mundo.node_tree.links
for n in list(wn):
    if n.type != 'OUTPUT_WORLD':
        wn.remove(n)


def nodo(tipo, **kw):
    n = wn.new(tipo)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def mate(op, a, b=None, c=None):
    n = nodo('ShaderNodeMath', operation=op)
    for i, x in enumerate((a, b, c)):
        if x is None:
            continue
        if isinstance(x, (int, float)):
            n.inputs[i].default_value = x
        else:
            wl.new(x, n.inputs[i])
    return n.outputs[0]


tcw = nodo('ShaderNodeTexCoord')
sep = nodo('ShaderNodeSeparateXYZ'); wl.new(tcw.outputs['Generated'], sep.inputs[0])
lon = mate('ARCTAN2', sep.outputs['Y'], sep.outputs['X'])
lat = mate('ARCSINE', mate('MINIMUM', mate('MAXIMUM', sep.outputs['Z'], -1.0), 1.0))
GIRO = 0.36
u = mate('FRACT', mate('ADD', mate('DIVIDE', lon, 2 * math.pi), 0.5 + GIRO))
v = mate('DIVIDE', mate('SUBTRACT', lat, math.radians(LAT_MIN)), math.radians(LAT_MAX - LAT_MIN))
uv = nodo('ShaderNodeCombineXYZ'); wl.new(u, uv.inputs[0]); wl.new(mate('MINIMUM', v, 0.999), uv.inputs[1])
img = bpy.data.images.load(os.path.join(RAIZ, 'assets', 'carrera', A.paisaje + '.webp'))
img.alpha_mode = 'NONE'
pano = nodo('ShaderNodeTexImage', image=img, interpolation='Cubic', extension='EXTEND'); wl.new(uv.outputs[0], pano.inputs[0])
# por encima del panorama: degradado de su borde superior a un azul de cénit
cielo = nodo('ShaderNodeValToRGB')
cielo.color_ramp.elements[0].color = (0.58, 0.64, 0.70, 1)
cielo.color_ramp.elements[1].color = (0.12, 0.24, 0.45, 1)
wl.new(mate('DIVIDE', mate('SUBTRACT', lat, math.radians(LAT_MAX)), math.radians(35)), cielo.inputs[0])
fac = mate('MINIMUM', mate('MAXIMUM', mate('DIVIDE', mate('SUBTRACT', lat, math.radians(LAT_MAX - 1.5)), math.radians(1.5)), 0.0), 1.0)
mz = nodo('ShaderNodeMix', data_type='RGBA')
wl.new(fac, mz.inputs[0]); wl.new(pano.outputs['Color'], mz.inputs[6]); wl.new(cielo.outputs['Color'], mz.inputs[7])
fondo = nodo('ShaderNodeBackground'); fondo.inputs['Strength'].default_value = 1.4
wl.new(mz.outputs[2], fondo.inputs['Color'])
wl.new(fondo.outputs[0], wn['World Output'].inputs['Surface'])

sol_d = bpy.data.lights.new('Sol', 'SUN'); sol_d.energy = 4.5; sol_d.angle = math.radians(1.2)
sol_d.color = (1.0, 0.88, 0.72)
sol = bpy.data.objects.new('Sol', sol_d); col.objects.link(sol)
sol.rotation_euler = (Vector((0, 0, 0)) - Vector((3.0, -4.0, 2.6))).to_track_quat('-Z', 'Y').to_euler()

# ════════ 6. Cámara y render ════════
cam_d = bpy.data.cameras.new('Camara')
cam = bpy.data.objects.new('Camara', cam_d); col.objects.link(cam); esc.camera = cam
VISTAS = {
    'lado': ((6.0, -3.3, 2.0), (0.0, -0.05, 0.80), 46),
    'popa': ((3.2, -6.2, 1.35), (0.0, -0.3, 0.60), 40),
    'cerca': ((3.4, -2.6, 1.05), (0.0, -0.35, 0.70), 40),
}
cl, mira, lente = VISTAS[A.camara]
cam.location = cl; cam_d.lens = lente
cam.rotation_euler = (Vector(mira) - Vector(cl)).to_track_quat('-Z', 'Y').to_euler()
cam_d.clip_end = 2000

w, h = (int(x) for x in A.res.split('x'))
esc.render.resolution_x, esc.render.resolution_y = w, h
esc.render.resolution_percentage = 100
esc.render.engine = 'CYCLES'
esc.render.film_transparent = False
cy = esc.cycles
cy.device = 'CPU'
cy.samples = A.muestras
cy.use_adaptive_sampling = True
cy.use_denoising = True
cy.max_bounces, cy.glossy_bounces, cy.transmission_bounces, cy.diffuse_bounces = 8, 4, 8, 2
cy.caustics_reflective = cy.caustics_refractive = False
esc.view_settings.view_transform = 'AgX'
esc.view_settings.look = 'AgX - Medium High Contrast'
esc.view_settings.exposure = 0.5
esc.render.image_settings.file_format = 'PNG'

a, b_ = (int(x) for x in A.frames.split('-'))
for f in range(a, b_ + 1):
    t = (f - 1) / FPS
    fr = remo_frame(t)
    esc.frame_set(int(fr), subframe=fr - int(fr))
    co, espuma = agua_en(t)
    me.vertices.foreach_set('co', co.reshape(-1).astype(np.float32))
    me.attributes['espuma'].data.foreach_set('value', espuma.ravel().astype(np.float32))
    me.update()
    actualizar_gotas(t)
    MAPA_RIZOS.inputs['Location'].default_value = (0, VEL * t / RIZO, 0)
    esc.render.filepath = os.path.join(SAL, 'frames', f'{f:04d}.png')
    bpy.ops.render.render(write_still=True)
    print('FOTOGRAMA', f, flush=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SAL, 'remo_agua.blend'), compress=True)
print('LISTO')
