# Ojos, pelo, barba y equipo del vikingo. Todo deriva de la malla del cuerpo, así que hereda sus pesos de piel
# y se deforma con el mismo esqueleto. Se ejecuta dentro de vikingo.py.
from collections import defaultdict

me_c = cuerpo.data
NV = len(me_c.vertices)
CO = [v.co.copy() for v in me_c.vertices]
NO = [v.normal.copy() for v in me_c.vertices]
PESOS = defaultdict(dict)  # vértice → {grupo: peso}
NOMBRES_G = {g.index: g.name for g in cuerpo.vertex_groups}
for v in me_c.vertices:
    for g in v.groups:
        if g.weight > 0:
            PESOS[v.index][NOMBRES_G[g.group]] = g.weight


def dom(i):
    p = PESOS[i]
    return max(p, key=p.get) if p else ''


def peso_de(i, prefijos):
    return sum(w for g, w in PESOS[i].items() if g.startswith(prefijos))


J = {n: hueso(n) for n in ('root', 'spine05', 'spine03', 'spine01', 'neck01', 'head', 'jaw', 'clavicle.L', 'upperarm01.L', 'lowerarm01.L', 'wrist.L', 'upperarm01.R', 'lowerarm01.R', 'wrist.R', 'upperleg01.L', 'lowerleg01.L', 'foot.L', 'foot.R', 'lowerleg02.L', 'eye.L', 'eye.R')}
Z_CUELLO = J['neck01'][0].z
Z_HOMBRO = J['upperarm01.L'][0].z
Z_CINTURA = J['spine05'][0].z + 0.06
Z_CADERA = J['upperleg01.L'][0].z
Z_RODILLA = J['lowerleg01.L'][0].z
Z_TOBILLO = J['foot.L'][0].z
Z_OJOS = J['eye.L'][0].z
X_HOMBRO = J['upperarm01.L'][0].x
print('PUNTOS', {k: round(v, 3) for k, v in dict(cuello=Z_CUELLO, hombro=Z_HOMBRO, cintura=Z_CINTURA, cadera=Z_CADERA, rodilla=Z_RODILLA, tobillo=Z_TOBILLO, ojos=Z_OJOS, xh=X_HOMBRO).items()})


def uv_cilindro(me, escala_u=4.0, escala_v=4.0, centro=None):
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    cx, cy = centro or (0.0, 0.0)
    for pol in me.polygons:
        us = []
        for li in pol.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            us.append((math.atan2(co.x - cx, -(co.y - cy)) / (2 * math.pi) + 0.5, co.z))
        # evitar la costura: si la cara cruza u=0/1, desplazar
        if max(u for u, _ in us) - min(u for u, _ in us) > 0.5:
            us = [(u + 1 if u < 0.5 else u, z) for u, z in us]
        for li, (u, z) in zip(pol.loop_indices, us):
            uv.data[li].uv = (u * escala_u, z * escala_v)


def region(nombre, cond, desp, material, grosor=0.0, desp_extra=None, uv=(4, 4), sub=0, caras_extra=None, afinar=0, suavizar=0):
    """Copia las caras del cuerpo cuyos vértices cumplen cond(i, co), las separa desp metros por su normal
    (más desp_extra(i, co) → Vector opcional) y copia los pesos de piel."""
    sel = [p for p in me_c.polygons if all(cond(i, CO[i]) for i in p.vertices)]
    if caras_extra:
        sel = [p for p in sel if caras_extra(p)]
    usados = sorted({i for p in sel for i in p.vertices})
    m = {i: k for k, i in enumerate(usados)}
    # distancia en anillos al borde de la región (para afinar el grosor hacia la piel)
    cuenta = defaultdict(int)
    for p in sel:
        for k in range(len(p.vertices)):
            a, b = p.vertices[k], p.vertices[(k + 1) % len(p.vertices)]
            cuenta[(min(a, b), max(a, b))] += 1
    anillo = {}
    frontera = {i for (a, b), c in cuenta.items() if c == 1 for i in (a, b)}
    vecinos = defaultdict(set)
    for (a, b) in cuenta:
        vecinos[a].add(b); vecinos[b].add(a)
    actual = frontera
    for nivel in range(afinar):
        for i in actual:
            anillo.setdefault(i, nivel)
        actual = {j for i in actual for j in vecinos[i] if j not in anillo}
    pos = []
    for i in usados:
        d = desp(i, CO[i]) if callable(desp) else desp
        if afinar and i in anillo:
            d *= (anillo[i] + 0.35) / (afinar + 0.35)
        p = CO[i] + NO[i] * d
        if desp_extra:
            f = 1.0 if not (afinar and i in anillo) else (anillo[i] + 0.35) / (afinar + 0.35)
            p = p + desp_extra(i, CO[i]) * f
        pos.append(p)
    me = bpy.data.meshes.new(nombre)
    me.from_pydata(pos, [], [[m[i] for i in p.vertices] for p in sel])
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(nombre, me)
    col.objects.link(ob)
    me.materials.append(material)
    for i in usados:
        for g, w in PESOS[i].items():
            vg = ob.vertex_groups.get(g) or ob.vertex_groups.new(name=g)
            vg.add([m[i]], w, 'REPLACE')
    uv_cilindro(me, *uv)
    if suavizar:
        sm = ob.modifiers.new('Suave', 'SMOOTH'); sm.factor = 0.8; sm.iterations = suavizar
    if grosor:
        s = ob.modifiers.new('Grosor', 'SOLIDIFY'); s.thickness = grosor; s.offset = -1
    if sub:
        s = ob.modifiers.new('Suavizado', 'SUBSURF'); s.levels = s.render_levels = sub
    enlazar(ob)
    REGIONES[nombre] = set(usados)
    return ob


REGIONES = {}


def enlazar(ob, hueso_rigido=None):
    """Hace hijo del esqueleto: deformado por pesos o rígido a un hueso."""
    if hueso_rigido:
        bpy.context.view_layer.update()
        mw = ob.matrix_world.copy()
        ob.parent = rig; ob.parent_type = 'BONE'; ob.parent_bone = hueso_rigido
        ob.matrix_world = mw
    else:
        ob.parent = rig
        a = ob.modifiers.new('Esqueleto', 'ARMATURE'); a.object = rig
        # el modificador de esqueleto va primero (antes de grosor y suavizado)
        while ob.modifiers[0] != a:
            bpy.context.view_layer.objects.active = ob
            with bpy.context.temp_override(object=ob, active_object=ob):
                bpy.ops.object.modifier_move_up(modifier=a.name)


def rigido(ob, hueso_n):
    for p in ob.data.polygons:
        p.use_smooth = True
    enlazar(ob, hueso_n)
    return ob


def prim(tipo, nombre, material, **kw):
    getattr(bpy.ops.mesh, 'primitive_' + tipo + '_add')(**kw)
    o = bpy.context.active_object
    o.name = nombre
    o.data.materials.append(material)
    return o


# ════════ OJOS (proxy MakeHuman de alta resolución) ════════
ojos = mh.ajustar_mhclo(os.path.join(AQUI, '..', 'makehuman', 'ojos', 'high-poly.mhclo'), VS_MH, 'Ojos')
img_ojo = bpy.data.images.load(os.path.join(AQUI, '..', 'makehuman', 'ojos', 'ojo_gris_azul.png'))
MAT['ojo'] = material('Ojo', mapa_color=img_ojo, rough=0.08, alfa=True)
MAT['ojo'].blend_method = 'CLIP' if hasattr(MAT['ojo'], 'blend_method') else None
ojos.data.materials.append(MAT['ojo'])
for v in ojos.data.vertices:
    lado = 'eye.L' if v.co.x > 0 else 'eye.R'
    g = ojos.vertex_groups.get(lado) or ojos.vertex_groups.new(name=lado)
    g.add([v.index], 1.0, 'REPLACE')
enlazar(ojos)

# ════════ PELO: masa peinada hacia atrás, rapado lateral, moño y trenzas ════════
cab = J['head'][0]
Z_FRENTE = Z_OJOS + 0.055  # línea del pelo
def es_cuero_cabelludo(i, co):
    if peso_de(i, ('head',)) < 0.6 or co.z < Z_OJOS - 0.01:
        return False
    delante = co.y < cab.y - 0.04
    # línea del pelo curva: más alta en las entradas
    linea = Z_FRENTE + 0.012 * min(1.0, abs(co.x) / 0.04) ** 2
    if delante and co.z < linea:
        return False
    # sienes: el pelo baja hasta la parte alta de la oreja
    if abs(co.x) > 0.062 and co.z < Z_OJOS + 0.005 and co.y < cab.y + 0.01:
        return False
    return True


def volumen_pelo(i, co):
    arriba = max(0.0, (co.z - Z_OJOS) / 0.12)
    atras = max(0.0, (co.y - cab.y) / 0.1)
    return 0.007 + 0.02 * min(1.0, arriba) + 0.016 * min(1.0, atras)


def peinado(i, co):
    # se peina hacia atrás y hacia el moño
    atras = max(0.0, (co.y - cab.y + 0.05)) * 0.0
    return Vector((0, 0.012 * max(0.0, (co.z - Z_FRENTE)) / 0.08, 0))


pelo = region('Pelo', es_cuero_cabelludo, volumen_pelo, MAT['pelo'], uv=(10, 6), sub=1, desp_extra=peinado, afinar=3)
# rapado de los laterales: banda corta y oscura (tatuaje sobre la piel)
lat = None and region('Rapado', lambda i, co: peso_de(i, ('head',)) > 0.6 and abs(co.x) > 0.066 and Z_OJOS - 0.005 < co.z < Z_FRENTE + 0.03 and cab.y - 0.04 < co.y < cab.y + 0.07, 0.0015, MAT['tatuaje'], uv=(20, 20))

top = max(CO[i].z for i in REGIONES['Pelo'])
moño = prim('uv_sphere', 'Moño', MAT['pelo'], radius=0.042, location=(0, cab.y + 0.065, top - 0.005), segments=24, ring_count=12)
moño.scale = (1.0, 0.9, 0.95)
uv_cilindro(moño.data, 8, 20)
anillo = prim('torus', 'AnilloMoño', MAT['laton'], major_radius=0.026, minor_radius=0.007, location=(0, cab.y + 0.04, top - 0.02), rotation=(math.radians(70), 0, 0), major_segments=24, minor_segments=8)
rigido(moño, 'head'); rigido(anillo, 'head')


def trenza(nombre, a, b, r0, cuentas=(), hueso_n='head', seg=12):
    a, b = Vector(a), Vector(b)
    d = (b - a)
    piezas = []
    for k in range(seg):
        t = k / (seg - 1)
        p = a.lerp(b, t)
        rr = r0 * (1 - 0.35 * t)
        o = prim('uv_sphere', f'{nombre}_{k}', MAT['pelo'], radius=rr, location=p, segments=12, ring_count=8)
        o.scale = (1.0, 0.8, 1.45)
        o.rotation_euler = (0, math.radians(35 if k % 2 else -35), 0)
        piezas.append(o)
    for t in cuentas:
        p = a.lerp(b, t)
        o = prim('cylinder', f'{nombre}_cuenta', MAT['laton'], radius=r0 * 0.85, depth=0.022, location=p, vertices=16)
        o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
        piezas.append(o)
    # unir en una sola malla
    bpy.ops.object.select_all(action='DESELECT')
    for o in piezas:
        o.select_set(True)
    bpy.context.view_layer.objects.active = piezas[0]
    bpy.ops.object.join()
    t = bpy.context.active_object; t.name = nombre
    uv_cilindro(t.data, 6, 30, (a.x, a.y))
    return rigido(t, hueso_n)


for s in (-1, 1):
    x = s * 0.075
    trenza(f'Trenza{"L" if s > 0 else "R"}', (x, cab.y - 0.035, Z_OJOS - 0.0), (s * 0.088, cab.y - 0.075, Z_OJOS - 0.2), 0.0135, (0.82,))

# ════════ BARBA ════════
z_boca = Z_OJOS - 0.075
def es_barba(i, co):
    if peso_de(i, ('head', 'jaw', 'neck')) < 0.5:
        return False
    if co.y > cab.y + 0.02 - max(0.0, co.z - (Z_OJOS - 0.06)) * 0.8:  # delante de las orejas
        return False
    if co.z > Z_OJOS - 0.04 - 0.25 * max(0.0, 0.03 - abs(co.x)):  # por debajo de los pómulos
        return False
    if abs(co.x) < 0.026 and z_boca - 0.014 < co.z < z_boca + 0.012 and co.y < cab.y - 0.07:  # boca y labios
        return False
    if co.z < J['neck01'][0].z - 0.01 or (co.y > cab.y - 0.03 and co.z < J['neck01'][0].z + 0.04):
        return False
    return True


def masa_barba(i, co):
    baja = max(0.0, (Z_OJOS - 0.04 - co.z) / 0.08)
    return 0.006 + 0.02 * min(1.0, baja)


def caida_barba(i, co):
    baja = max(0.0, (z_boca - 0.01 - co.z) / 0.06)
    centro = max(0.0, 1 - abs(co.x) / 0.075)
    return Vector((0, -0.03 * baja * centro, -0.075 * min(1.6, baja) ** 2 * centro))


barba = region('Barba', es_barba, masa_barba, MAT['pelo'], uv=(14, 8), sub=1, desp_extra=caida_barba, afinar=2)
bigote = region('Bigote', lambda i, co: peso_de(i, ('head', 'jaw')) > 0.5 and abs(co.x) < 0.034 and z_boca - 0.003 < co.z < z_boca + 0.016 and co.y < cab.y - 0.075, 0.006, MAT['pelo'], uv=(10, 10), sub=1,
                desp_extra=lambda i, co: Vector((0, 0, -0.004 - 0.05 * abs(co.x) ** 1.0)))
# trenza de la barba bajo el mentón
zb = min(CO[i].z for i in REGIONES['Barba']) - 0.03
yb = min(CO[i].y for i in REGIONES['Barba'] if abs(CO[i].x) < 0.02 and CO[i].z < zb + 0.06)
trenza('TrenzaBarba', (0, yb - 0.01, zb + 0.03), (0, yb - 0.02, zb - 0.1), 0.014, (0.6,), 'jaw', 8)

# cejas pobladas
cejas = region('Cejas', lambda i, co: peso_de(i, ('head',)) > 0.8 and 0.012 < abs(co.x) < 0.056 and Z_OJOS + 0.014 - abs(co.x) * 0.05 < co.z < Z_OJOS + 0.027 - abs(co.x) * 0.05 and co.y < cab.y - 0.065, 0.0025, MAT['pelo'], uv=(30, 30))

# ════════ ROPA ════════
def en_torso(i, co, margen=0.0):
    brazo = peso_de(i, ('upperarm', 'lowerarm', 'wrist', 'finger', 'shoulder01'))
    return brazo < 0.45 and Z_CADERA - 0.03 - margen < co.z < Z_CUELLO - 0.01 + margen and peso_de(i, ('head', 'neck02', 'neck03')) < 0.2


gambeson = region('Gambeson', lambda i, co: en_torso(i, co), lambda i, co: 0.012 + 0.006 * max(0, 1 - abs(co.z - Z_HOMBRO + 0.15) / 0.2) + (0.016 * math.exp(-(co.x / 0.055) ** 2) * max(0, 1 - abs(co.z - Z_HOMBRO + 0.14) / 0.12) if co.y < 0 else 0), MAT['cueroOsc'], grosor=0.006, uv=(6, 10), suavizar=6)
# acolchado vertical: normal map dedicada
canal = (np.sin(xx * 2 * math.pi / (RES / 24)) * 0.5 + 0.5) ** 0.6
IMG['acolchado_n'] = guardar('acolchado_normal', normal_de_altura(canal * 0.8 + grano * 0.2, 2.0))
MAT['gambeson'] = material('Gambeson', mapa_color=IMG['cueroOsc_c'], mapa_normal=IMG['acolchado_n'], mapa_rough=IMG['cuero_r'], fuerza_normal=1.2)
gambeson.data.materials[0] = MAT['gambeson']

# correas cruzadas: cortes del torso por dos planos diagonales
def banda_plano(nombre, p0, p1, ancho, desp):
    eje = (p1 - p0).normalized()
    n = eje.cross(Vector((0, 1, 0))).normalized()
    def cond(i, co):
        return en_torso(i, co, 0.02) and abs((co - p0).dot(n)) < ancho
    return region(nombre, cond, desp, MAT['cuero'], grosor=0.004, uv=(20, 20))


hl = Vector((X_HOMBRO * 0.62, 0, Z_HOMBRO + 0.02)); hr = Vector((-X_HOMBRO * 0.62, 0, Z_HOMBRO + 0.02))
cl = Vector((X_HOMBRO * 0.75, 0, Z_CADERA + 0.05)); cr = Vector((-X_HOMBRO * 0.75, 0, Z_CADERA + 0.05))
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
_dg = bpy.context.evaluated_depsgraph_get()
BVH_G = BVHTree.FromObject(gambeson.evaluated_get(_dg), _dg)


def cinta(nombre, p0, p1, ancho, separa, material, n=28, frente=True):
    """Cinta plana que recorre el gambesón por delante de p0 a p1 (proyección frontal)."""
    bm = bmesh.new(); pares = []
    eje = (p1 - p0)
    lado = Vector((eje.z, 0, -eje.x)).normalized() * (ancho / 2)
    for k in range(n + 1):
        t = k / n
        q = p0.lerp(p1, t)
        fila = []
        for d in (-1, 1):
            o = Vector((q.x + lado.x * d, -1.0, q.z + lado.z * d))
            hit = BVH_G.ray_cast(o, Vector((0, 1, 0)))
            pos = hit[0] if hit[0] else Vector((o.x, 0, o.z))
            nrm = hit[1] if hit[1] else Vector((0, -1, 0))
            fila.append(bm.verts.new(pos + nrm * separa))
        pares.append(fila)
    for k in range(n):
        bm.faces.new((pares[k][0], pares[k][1], pares[k + 1][1], pares[k + 1][0]))
    me = bpy.data.meshes.new(nombre); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(nombre, me); col.objects.link(ob); me.materials.append(material)
    for p in me.polygons:
        p.use_smooth = True
    uv = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index
            uv.data[li].uv = ((vi % 2) * 0.3, (vi // 2) / n * 3)
    for v in me.vertices:
        acc = defaultdict(float)
        for co, i, d in kd.find_n(v.co, 4):
            for g, w in PESOS[i].items():
                acc[g] += w / (d + 0.005)
        tot = sum(acc.values()) or 1
        for g, w in acc.items():
            vg = ob.vertex_groups.get(g) or ob.vertex_groups.new(name=g)
            vg.add([v.index], w / tot, 'REPLACE')
    s = ob.modifiers.new('Grosor', 'SOLIDIFY'); s.thickness = 0.005; s.offset = 1
    enlazar(ob)
    return ob


from mathutils.kdtree import KDTree
kd = KDTree(NV)
for i, c in enumerate(CO):
    kd.insert(c, i)
kd.balance()
cinta('CorreaA', hl, cr, 0.042, 0.004, MAT['cuero'])
cinta('CorreaB', hr, cl, 0.042, 0.009, MAT['cuero'])
REGIONES['CorreaA'] = set()

# cinturón
cinturon = region('Cinturon', lambda i, co: en_torso(i, co, 0.05) and abs(co.z - (Z_CADERA + 0.06)) < 0.032, 0.03, MAT['cuero'], grosor=0.008, uv=(16, 16))

# pantalón (muslos) y vendas (pantorrillas)
pantalon = region('Pantalon', lambda i, co: peso_de(i, ('upperleg', 'pelvis', 'root')) > 0.5 and Z_RODILLA - 0.02 < co.z < Z_CADERA + 0.02, 0.01, material('Pantalon', color='#3B2F26', mapa_normal=IMG['lana_n'], rough=0.85, fuerza_normal=0.7), uv=(8, 10))
yv = (np.sin((xx + yy * 0.35) * 2 * math.pi / (RES / 10)) * 0.5 + 0.5) ** 0.4
IMG['vendas_n'] = guardar('vendas_normal', normal_de_altura(yv * 0.7 + fibra * 0.3, 2.5))
MAT['vendas'] = material('Vendas', mapa_color=IMG['cueroOsc_c'], mapa_normal=IMG['vendas_n'], rough=0.85, fuerza_normal=1.4)
vendas = region('Vendas', lambda i, co: peso_de(i, ('lowerleg',)) > 0.4 and Z_TOBILLO + 0.06 < co.z < Z_RODILLA + 0.03, 0.011, MAT['vendas'], uv=(3, 5))
# rodilleras rígidas
for s, lado in ((1, 'L'), (-1, 'R')):
    k = hueso('lowerleg01.' + lado)[0]
    yk = min(CO[i].y for i in range(NV) if abs(CO[i].z - k.z) < 0.02 and peso_de(i, ('lowerleg01.' + lado, 'upperleg02.' + lado)) > 0.5)
    o = prim('uv_sphere', 'Rodillera' + lado, MAT['cuero'], radius=0.062, location=(k.x, yk + 0.012, k.z), segments=20, ring_count=12)
    o.scale = (0.9, 0.42, 1.0)
    uv_cilindro(o.data, 6, 6)
    rigido(o, 'lowerleg01.' + lado)

# botas
botas = region('Botas', lambda i, co: peso_de(i, ('foot', 'toe', 'lowerleg02')) > 0.5 and co.z < Z_TOBILLO + 0.07, lambda i, co: 0.014 + 0.01 * (co.z < Z_SUELO + 0.035), MAT['cueroOsc'], uv=(6, 6), suavizar=8)
for s, lado in ((1, 'L'), (-1, 'R')):
    a = hueso('foot.' + lado)[0]
    o = prim('torus', 'PelajeBota' + lado, MAT['pelaje'], major_radius=0.06, minor_radius=0.024, location=(a.x, a.y + 0.005, Z_TOBILLO + 0.07), major_segments=24, minor_segments=10)
    o.scale = (1.0, 1.15, 0.8)
    uv_cilindro(o.data, 8, 8, (a.x, a.y))
    rigido(o, 'lowerleg02.' + lado)

# brazales
brazales = region('Brazales', lambda i, co: peso_de(i, ('lowerarm',)) > 0.5 and peso_de(i, ('wrist', 'finger')) < 0.3 and (co - J['wrist.L' if co.x > 0 else 'wrist.R'][0]).length < 0.19, 0.012, MAT['cuero'], grosor=0.004, uv=(6, 8))
# tatuaje en el brazo: dos anillos de nudos
tatuaje = region('Tatuaje', lambda i, co: peso_de(i, ('upperarm',)) > 0.6 and (0.4 < ((co - J['upperarm01.L' if co.x > 0 else 'upperarm01.R'][0]).length / 0.3) < 0.48), 0.0012, MAT['tatuaje'], uv=(20, 20))

# falda de lana: cono plegado con pesos transferidos de cadera y muslos
anillos, segm = 12, 64
_cad = [CO[i] for i in range(NV) if abs(CO[i].z - (Z_CADERA - 0.02)) < 0.02 and peso_de(i, ('upperarm', 'lowerarm', 'wrist', 'finger')) < 0.1]
CY_CAD = sum(c.y for c in _cad) / len(_cad)
RX_CAD = max(abs(c.x) for c in _cad) + 0.025
RY_CAD = max(abs(c.y - CY_CAD) for c in _cad) + 0.03
bm = bmesh.new()
filas = []
for k in range(anillos):
    v = k / (anillos - 1)
    z = Z_CADERA + 0.09 - v * (Z_CADERA + 0.09 - (Z_RODILLA + 0.09))
    fila = []
    for j in range(segm):
        ang = 2 * math.pi * j / segm
        pl = 1 + 0.07 * v * math.sin(ang * 9) + 0.025 * v * math.sin(ang * 23)
        rx = (RX_CAD + 0.09 * v) * pl; ry = (RY_CAD + 0.06 * v) * pl
        fila.append(bm.verts.new((math.sin(ang) * rx, -math.cos(ang) * ry + CY_CAD, z + 0.01 * math.sin(ang * 5) * v)))
    filas.append(fila)
for k in range(anillos - 1):
    for j in range(segm):
        bm.faces.new((filas[k][j], filas[k][(j + 1) % segm], filas[k + 1][(j + 1) % segm], filas[k + 1][j]))
mef = bpy.data.meshes.new('Falda'); bm.to_mesh(mef); bm.free()
falda = bpy.data.objects.new('Falda', mef); col.objects.link(falda); mef.materials.append(MAT['lana'])
for p in mef.polygons:
    p.use_smooth = True
uv_cilindro(mef, 6, 6)
# pesos: cada vértice toma los del punto más cercano del cuerpo, repartidos entre ambas piernas y la cadera
from mathutils.kdtree import KDTree
kd = KDTree(NV)
for i, c in enumerate(CO):
    kd.insert(c, i)
kd.balance()
for v in mef.vertices:
    vecinos = kd.find_n(v.co, 6)
    acc = defaultdict(float)
    for co, i, d in vecinos:
        for g, w in PESOS[i].items():
            if g.startswith(('upperleg', 'pelvis', 'root', 'spine05')):
                acc[g] += w / (d + 0.01)
    t = max(0.0, min(1.0, (Z_CADERA + 0.05 - v.co.z) / 0.25))  # arriba sigue a la cadera, abajo a las piernas
    acc['root'] += (1 - t) * 4 * sum(acc.values()) / max(1, len(acc))
    tot = sum(acc.values()) or 1
    for g, w in acc.items():
        vg = falda.vertex_groups.get(g) or falda.vertex_groups.new(name=g)
        vg.add([v.index], w / tot, 'REPLACE')
s = falda.modifiers.new('Grosor', 'SOLIDIFY'); s.thickness = 0.006
enlazar(falda)
# cenefa de latón y paño de cuero
cen = prim('torus', 'Cenefa', MAT['laton'], major_radius=1, minor_radius=0.011, location=(0, CY_CAD, Z_RODILLA + 0.093), major_segments=96, minor_segments=6)
cen.scale = (RX_CAD + 0.092, RY_CAD + 0.062, 0.9)
pano = None and prim('plane', 'Pano', MAT['cuero'], size=1, location=(0, CY_CAD - RY_CAD - 0.04, (Z_CADERA + Z_RODILLA) / 2 + 0.06))
for o in (cen,):
    # se deforman con la cadera y las piernas como la falda
    enlazar(o, 'root')

# hebillas y broches de latón (rígidos)
def broche(nombre, loc, r, hueso_n, normal=(0, -1, 0), prof=0.016):
    rot = Vector((0, 0, 1)).rotation_difference(Vector(normal)).to_euler()
    a = prim('cylinder', nombre, MAT['laton'], radius=r, depth=prof, location=loc, vertices=32, rotation=rot)
    b = a.modifiers.new('b', 'BEVEL'); b.width = prof * 0.4; b.segments = 3
    n = prim('torus', nombre + 'Nudo', MAT['oro'], major_radius=r * 0.6, minor_radius=r * 0.12, location=Vector(loc) + Vector(normal) * prof * 0.6, rotation=rot, major_segments=24, minor_segments=6)
    rigido(a, hueso_n); rigido(n, hueso_n)
    return a


ycin = min(CO[i].y for i in REGIONES['Cinturon']) - 0.03
broche('Hebilla', (0, ycin - 0.006, Z_CADERA + 0.06), 0.042, 'spine05')
_ix = hl.lerp(cr, 0.5)
_h = BVH_G.ray_cast(Vector((0, -1, _ix.z)), Vector((0, 1, 0)))
broche('BrochePecho', (0, _h[0].y - 0.016, _ix.z), 0.034, 'spine02')

# ════════ MANTO DE PELAJE SOBRE LOS HOMBROS ════════
def es_hombros(i, co):
    if peso_de(i, ('head', 'neck02', 'neck03')) > 0.3:
        return False
    r = math.hypot(co.x, co.y - J['neck01'][0].y)
    return co.z > Z_HOMBRO - 0.04 and r < X_HOMBRO + 0.03 and peso_de(i, ('lowerarm', 'wrist', 'upperarm02')) < 0.1


pelaje_desp = lambda i, co: 0.022 + 0.018 * ruido_puntual(co)
_rp = ruido(n=64, escalas=(4, 8, 16), semilla=21)
def ruido_puntual(co):
    return float(_rp[int((co.x * 300) % 64), int((co.y * 300 + co.z * 200) % 64)])


manto = region('MantoPelaje', es_hombros, pelaje_desp, MAT['pelaje'], uv=(12, 12), sub=1, afinar=2)
_t = bpy.data.textures.new('MechonesPelaje', 'CLOUDS'); _t.noise_scale = 0.012; _t.noise_depth = 2
_d = manto.modifiers.new('Mechones', 'DISPLACE'); _d.texture = _t; _d.strength = 0.022; _d.mid_level = 0.35
# capa que cae por la espalda: lámina curva con pesos de la columna
bm = bmesh.new()
filas = []
nf, nc = 14, 18
for k in range(nf):
    v = k / (nf - 1)
    fila = []
    for j in range(nc):
        u = j / (nc - 1)
        ang = math.radians(-78 + 156 * u)
        rad = X_HOMBRO - 0.01 + 0.07 * v
        x = math.sin(ang) * rad
        y = J['neck01'][0].y + math.cos(ang) * (0.12 + 0.08 * v) + 0.035
        z = Z_HOMBRO + 0.03 - v * (Z_HOMBRO - Z_RODILLA - 0.05)
        fila.append(bm.verts.new((x, y + 0.03 * math.sin(u * 15) * v, z)))
    filas.append(fila)
for k in range(nf - 1):
    for j in range(nc - 1):
        bm.faces.new((filas[k][j], filas[k][j + 1], filas[k + 1][j + 1], filas[k + 1][j]))
mec = bpy.data.meshes.new('Capa'); bm.to_mesh(mec); bm.free()
capa = bpy.data.objects.new('Capa', mec); col.objects.link(capa); mec.materials.append(MAT['pelaje'])
for p in mec.polygons:
    p.use_smooth = True
uv_cilindro(mec, 8, 8)
for v in mec.vertices:
    t = (Z_HOMBRO - v.co.z) / (Z_HOMBRO - Z_RODILLA)
    pesos_c = {'spine01': max(0, 1 - t * 2.5), 'spine03': max(0, 1 - abs(t - 0.35) * 3), 'spine05': max(0, 1 - abs(t - 0.6) * 3), 'root': max(0, (t - 0.55) * 2.5)}
    lado = 'clavicle.L' if v.co.x > 0 else 'clavicle.R'
    pesos_c[lado] = max(0, 0.6 - t * 3) * min(1, abs(v.co.x) / X_HOMBRO)
    tot = sum(pesos_c.values()) or 1
    for g, w in pesos_c.items():
        if w > 0:
            vg = capa.vertex_groups.get(g) or capa.vertex_groups.new(name=g)
            vg.add([v.index], w / tot, 'REPLACE')
s = capa.modifiers.new('Grosor', 'SOLIDIFY'); s.thickness = 0.018
enlazar(capa)
for s, lado in ((1, 'L'), (-1, 'R')):
    broche('BrocheCapa' + lado, (s * 0.12, J['neck01'][0].y - 0.085, Z_HOMBRO + 0.01), 0.024, 'spine01')

# ════════ HACHA (mano derecha) y REMO ════════
mano = J['wrist.R'][0]
dmano = (J['wrist.R'][0] - J['lowerarm01.R'][0]).normalized()
agarre = mano + dmano * 0.075 + Vector((0, -0.012, 0))
eje_h = Vector((-0.12, -0.05, -1)).normalized()
L_mango = 0.78
c0 = agarre - eje_h * 0.12
mango = prim('cylinder', 'HachaMango', MAT['madera'], radius=0.016, depth=L_mango, location=c0 + eje_h * L_mango / 2, vertices=12)
mango.rotation_euler = Vector((0, 0, 1)).rotation_difference(eje_h).to_euler()
uv_cilindro(mango.data, 2, 3)
emp = prim('cylinder', 'HachaEmpunadura', MAT['cuero'], radius=0.019, depth=0.14, location=agarre + eje_h * 0.02, vertices=12)
emp.rotation_euler = mango.rotation_euler
perfil = [(0.0, 0.05), (-0.03, 0.06), (-0.075, 0.078), (-0.12, 0.105), (-0.152, 0.065), (-0.168, 0.0), (-0.162, -0.065), (-0.142, -0.115), (-0.11, -0.145), (-0.07, -0.085), (-0.035, -0.035), (0.0, -0.03), (0.026, -0.02), (0.026, 0.045)]
bm = bmesh.new()
sup = [bm.verts.new((x, 0.013, z)) for x, z in perfil]
inf = [bm.verts.new((x, -0.013, z)) for x, z in perfil]
bm.faces.new(sup); bm.faces.new(list(reversed(inf)))
for k in range(len(perfil)):
    bm.faces.new((sup[k], sup[(k + 1) % len(perfil)], inf[(k + 1) % len(perfil)], inf[k]))
for v in sup + inf:
    filo = max(0.0, min(1.0, (-v.co.x - 0.1) / 0.06))
    v.co.y *= 1 - 0.85 * filo
meh = bpy.data.meshes.new('HachaCabeza'); bm.to_mesh(meh); bm.free()
hacha = bpy.data.objects.new('HachaCabeza', meh); col.objects.link(hacha); meh.materials.append(MAT['hierro'])
b = hacha.modifiers.new('b', 'BEVEL'); b.width = 0.003; b.segments = 2
uv_cilindro(meh, 4, 4)
fin = c0 + eje_h * (L_mango - 0.06)
hacha.location = fin
hacha.rotation_euler = Euler((0, math.radians(-8), 0))
for o in (mango, emp, hacha):
    rigido(o, 'wrist.R')

# hueso del remo (lo mueve la animación de remo) y remo con pala
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = rig.data.edit_bones.new('remo')
eb.head = (0, J['root'][0].y - 0.55, Z_CADERA); eb.tail = (0, J['root'][0].y - 0.55, Z_CADERA + 0.1)
eb.parent = rig.data.edit_bones['root']
eb.use_deform = False
bpy.ops.object.mode_set(mode='OBJECT')
remo_z = Z_CADERA
pal = prim('cylinder', 'RemoMango', MAT['madera'], radius=0.018, depth=0.62, location=(0, J['root'][0].y - 0.55, remo_z), vertices=12, rotation=(0, math.radians(90), 0))
uv_cilindro(pal.data, 2, 3)
for s in (-1, 1):
    pu = prim('cylinder', 'RemoPuno', MAT['cuero'], radius=0.022, depth=0.13, location=(s * 0.2, J['root'][0].y - 0.55, remo_z), vertices=12, rotation=(0, math.radians(90), 0))
    rigido(pu, 'remo')
rigido(pal, 'remo')
REMO = ['RemoMango', 'RemoPuno', 'RemoPuno.001']

# ════════ Ocultar la piel que queda bajo la ropa (menos triángulos y nada que atraviese) ════════
cubierto = REGIONES['Gambeson'] | REGIONES['Pantalon'] | REGIONES['Vendas'] | REGIONES['Botas']
borde = set()
for p in me_c.polygons:
    vs_ = set(p.vertices)
    if not vs_ <= cubierto and vs_ & cubierto:
        borde |= vs_
# dos anillos de margen
for _ in range(2):
    nuevo = set()
    for p in me_c.polygons:
        if set(p.vertices) & borde:
            nuevo |= set(p.vertices)
    borde |= nuevo
bm = bmesh.new(); bm.from_mesh(me_c)
bm.verts.ensure_lookup_table()
borrar = [f for f in bm.faces if all(v.index in cubierto and v.index not in borde for v in f.verts)]
bmesh.ops.delete(bm, geom=borrar, context='FACES')
bm.to_mesh(me_c); bm.free()
print('PIEL OCULTA', len(borrar))

# nombres estables para el visor (variantes por nivel y animaciones)
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.name = o.name
