# Animaciones: preview, idle, victory (FK por claves) y rowing (IK horneado a FK).
# Convención: los giros se dan sobre ejes del esqueleto en reposo (X = izquierda del personaje, -Y = delante, Z = arriba),
# así un mismo ángulo significa lo mismo en cualquier hueso.
FPS = 30
esc.render.fps = FPS
bpy.context.view_layer.objects.active = rig
rig.animation_data_create()
PB = rig.pose.bones
HUESOS = [b.name for b in rig.data.bones]


def q(hueso_n, *giros):
    M = rig.data.bones[hueso_n].matrix_local.to_3x3()
    R = Matrix.Identity(3)
    for eje, g in giros:
        R = R @ Matrix.Rotation(math.radians(g), 3, Vector(eje))
    return (M.inverted() @ R @ M).to_quaternion()


def loc(hueso_n, delta):
    return rig.data.bones[hueso_n].matrix_local.to_3x3().inverted() @ Vector(delta)


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def _dir(n):
    b = rig.data.bones[n]
    return (b.tail_local - b.head_local).normalized()


# Ejes de bisagra calculados del esqueleto en reposo (la pose de reposo de MakeHuman ya trae codos y dedos semiflexionados).
# CODO: girar +θ flexiona el antebrazo; DEDO[n]: girar +θ cierra el dedo hacia la palma.
CODO, DEDO = {}, {}
for _s in 'LR':
    CODO[_s] = tuple(_dir('upperarm01.' + _s).cross(_dir('lowerarm01.' + _s)).normalized())
    _d = _dir('finger3-1.' + _s)
    _a = (rig.data.bones['finger2-1.' + _s].head_local - rig.data.bones['finger5-1.' + _s].head_local).normalized()
    _palma = _d.cross(_a) if _s == 'L' else _a.cross(_d)
    for _f in range(1, 6):
        for _k in (1, 2, 3):
            _n = f'finger{_f}-{_k}.{_s}'
            DEDO[_n] = tuple(_dir(_n).cross(_palma).normalized())


def puno(r, lado, g, pulgar=20):
    """Cierra los dedos g grados por falange (la primera algo menos) y el pulgar 'pulgar' grados."""
    for d in range(2, 6):
        for k in (1, 2, 3):
            n = f'finger{d}-{k}.{lado}'
            r[n] = [(DEDO[n], g * (0.8 if k == 1 else 1.0))]
    for k in (2, 3):
        n = f'finger1-{k}.{lado}'
        r[n] = [(DEDO[n], pulgar)]


def pose_base(t=0.0, respira=0.0, mirada=0.0):
    """Pose de presentación: brazos relajados, pecho abierto, peso en la pierna derecha."""
    r = {
        'root': [(Z, 4)],
        'spine05': [(Y, -1.5)],
        'spine03': [(X, -2 - 1.2 * respira)],
        'spine02': [(X, -1 - 0.8 * respira)],
        'spine01': [(X, 1)],
        'neck01': [(X, 3)],
        'head': [(Z, 7 + mirada), (X, -2)],
        'clavicle.L': [(Y, -2 - 1.0 * respira)], 'clavicle.R': [(Y, 2 + 1.0 * respira)],
        'upperarm01.L': [(Y, 36), (X, -4)], 'upperarm01.R': [(Y, -33), (X, -8)],
        'lowerarm01.L': [(CODO['L'], -34)], 'lowerarm01.R': [(CODO['R'], -24)],
        'wrist.L': [(Z, -10)], 'wrist.R': [(Z, 6)],
        'upperleg01.L': [(Y, -3)], 'upperleg01.R': [(Y, 2)],
        'lowerleg01.L': [(X, 4)],
    }
    puno(r, 'L', 25, 10)  # mano izquierda relajada
    puno(r, 'R', 60, 30)  # la derecha agarra el hacha
    return r


def clave(accion, frame, rots, locs=None):
    for n in HUESOS:
        pb = PB[n]
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = q(n, *rots[n]) if n in rots else Quaternion()
        pb.location = (locs or {}).get(n, Vector())
        pb.keyframe_insert('rotation_quaternion', frame=frame, group=n)
        pb.keyframe_insert('location', frame=frame, group=n)


def nueva(nombre):
    a = bpy.data.actions.new(nombre)
    a.use_fake_user = True
    rig.animation_data.action = a
    return a


# ---------- preview: pose de ficha con respiración muy leve (2 s, bucle) ----------
nueva('preview')
for f in range(0, 61, 15):
    t = f / 60
    clave('preview', f + 1, pose_base(respira=math.sin(t * 2 * math.pi)))

# ---------- idle: respiración, mirada y cambio de peso (4 s, bucle) ----------
nueva('idle')
for f in range(0, 121, 10):
    t = f / 120
    r = pose_base(respira=math.sin(t * 4 * math.pi), mirada=6 * math.sin(t * 2 * math.pi))
    r['root'] = [(Z, 4 + 2 * math.sin(t * 2 * math.pi))]
    r['head'] += [(Y, 2 * math.sin(t * 2 * math.pi + 1))]
    clave('idle', f + 1, r, {'root': loc('root', (0.008 * math.sin(t * 2 * math.pi), 0, 0.004 * math.sin(t * 4 * math.pi)))})

# ---------- victory: alza el hacha y grita (2 s, se queda en la última pose) ----------
nueva('victory')
def victoria(k):
    r = pose_base()
    e = lambda a, b: a + (b - a) * k
    r['upperarm01.R'] = [(Y, e(-33, 128)), (X, e(-8, -18))]
    r['lowerarm01.R'] = [(CODO['R'], e(-24, -10))]
    r['upperarm01.L'] = [(Y, e(36, 18)), (X, e(-4, -30))]
    r['lowerarm01.L'] = [(CODO['L'], e(-34, 50))]
    r['spine03'] = [(X, e(-2, -9))]
    r['spine02'] = [(X, e(-1, -6))]
    r['head'] = [(Z, e(7, -4)), (X, e(-2, -16))]
    r['jaw'] = [(X, e(0, 14))]
    puno(r, 'L', e(25, 80), e(10, 40))
    return r
for f, k in ((1, 0.0), (8, 0.15), (16, 0.75), (22, 1.05), (28, 1.0), (60, 1.0)):
    clave('victory', f, victoria(k), {'root': loc('root', (0, 0, -0.03 * math.sin(min(1, k) * math.pi)))})

# ---------- rowing: palada completa con asiento deslizante (1,6 s ≈ 37 golpes/min, bucle) ----------
# Se anima con IK (manos en el puño del remo, pies en el reposapiés) y se hornea a FK para glTF.
bpy.ops.object.mode_set(mode='EDIT')
eb = rig.data.edit_bones
raiz = eb['root'].head.copy()
def nuevo_hueso(nombre, cabeza, padre=None):
    b = eb.new(nombre); b.head = cabeza; b.tail = Vector(cabeza) + Vector((0, 0, 0.08)); b.use_deform = False
    if padre:
        b.parent = eb[padre]
    return b
eb['remo'].parent = None
asiento_z = Z_SUELO + 0.45  # cadera sentada; coordenadas del esqueleto (los pies aún no están en z = 0)
for s, lado in ((1, 'L'), (-1, 'R')):
    nuevo_hueso('ik_pie.' + lado, (s * 0.13, raiz.y - 0.82, Z_SUELO + 0.16))
    nuevo_hueso('polo_rodilla.' + lado, (s * 0.16, raiz.y - 0.9, Z_SUELO + 1.4))
    nuevo_hueso('ik_mano.' + lado, (s * 0.2, eb['remo'].head.y, eb['remo'].head.z), 'remo')
    nuevo_hueso('polo_codo.' + lado, (s * 0.7, raiz.y + 0.4, Z_SUELO + 0.5))
bpy.ops.object.mode_set(mode='POSE')
restricciones = []
for lado in 'LR':
    c = PB['lowerleg02.' + lado].constraints.new('IK'); c.target = rig; c.subtarget = 'ik_pie.' + lado
    c.pole_target = rig; c.pole_subtarget = 'polo_rodilla.' + lado; c.pole_angle = math.radians(-90); c.chain_count = 4
    restricciones.append(c)
    c = PB['lowerarm02.' + lado].constraints.new('IK'); c.target = rig; c.subtarget = 'ik_mano.' + lado
    c.pole_target = rig; c.pole_subtarget = 'polo_codo.' + lado; c.pole_angle = math.radians(-90); c.chain_count = 4
    restricciones.append(c)
HUESOS = [b.name for b in rig.data.bones]
nueva('rowing_ik')
remo0 = rig.data.bones['remo'].head_local.copy()
# fases: (frame, deslizamiento del asiento, inclinación del tronco, puño del remo (y, z) relativo, flexión de muñeca)
FASES = [
    (1, -0.30, 24, (-0.08, 0.18)),   # ataque: rodillas al pecho, brazos estirados
    (7, -0.16, 18, (0.06, 0.17)),    # empuje de piernas
    (13, 0.06, 2, (0.30, 0.15)),     # tronco abre
    (18, 0.12, -14, (0.62, 0.20)),   # final: manos al pecho, inclinado atrás
    (24, 0.10, -12, (0.42, 0.16)),   # salida de manos
    (33, 0.02, 12, (0.12, 0.16)),    # tronco adelante
    (41, -0.18, 22, (-0.02, 0.17)),  # recuperación
    (49, -0.30, 24, (-0.08, 0.18)),
]
caida = asiento_z - rig.data.bones['root'].head_local.z
for f, desliza, tronco, (py, pz) in FASES:
    r = {
        'spine05': [(X, tronco * 0.45)], 'spine04': [(X, tronco * 0.25)], 'spine03': [(X, tronco * 0.2)],
        'spine02': [(X, tronco * 0.1)], 'neck01': [(X, -tronco * 0.45)], 'head': [(X, -tronco * 0.3)],
    }
    puno(r, 'L', 75, 35)
    puno(r, 'R', 75, 35)
    l = {
        'root': loc('root', (0, desliza, caida)),
        'remo': loc('remo', (0, desliza - 0.25 + py, asiento_z + pz + 0.2 - remo0.z)),
    }
    clave('rowing_ik', f, r, l)
for c in restricciones:
    pass
esc.frame_start, esc.frame_end = 1, 49
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.nla.bake(frame_start=1, frame_end=49, step=2, only_selected=False, visual_keying=True, clear_constraints=False, use_current_action=False, bake_types={'POSE'})
horneada = rig.animation_data.action
horneada.name = 'rowing'
horneada.use_fake_user = True
bpy.data.actions.remove(bpy.data.actions['rowing_ik'])
for lado in 'LR':
    for b in ('lowerleg02.', 'lowerarm02.'):
        for c in list(PB[b + lado].constraints):
            PB[b + lado].constraints.remove(c)
bpy.ops.object.mode_set(mode='OBJECT')
rig.animation_data.action = bpy.data.actions['preview']
for a in bpy.data.actions:
    print('ACCION', a.name, tuple(int(x) for x in a.frame_range))
