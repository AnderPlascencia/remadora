# Carga el cuerpo base de MakeHuman (CC0) en Blender: malla con UV, targets, esqueleto y pesos.
# Los datos vienen de https://github.com/makehumancommunity/makehuman (makehuman/data), licencia CC0 1.0.
import bpy, gzip, json, os, math
from mathutils import Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
ESCALA = 0.1  # MakeHuman trabaja en decímetros


def _a_blender(x, y, z):
    # MakeHuman: Y arriba, mira a +Z. Blender: Z arriba, mira a -Y.
    return Vector((x * ESCALA, -z * ESCALA, y * ESCALA))


def leer_obj():
    vs, vts, caras, grupo_de_cara, grupos = [], [], [], [], {}
    actual = None
    with gzip.open(os.path.join(AQUI, 'base.obj.gz'), 'rt') as f:
        for l in f:
            if l.startswith('v '):
                vs.append(tuple(map(float, l.split()[1:4])))
            elif l.startswith('vt '):
                vts.append(tuple(map(float, l.split()[1:3])))
            elif l.startswith('g '):
                actual = l.split()[1]
            elif l.startswith('f '):
                cara = [tuple(int(p) - 1 if p else None for p in (t.split('/') + [None])[:2]) for t in l.split()[1:]]
                caras.append(cara)
                grupo_de_cara.append(actual)
                for vi, _ in cara:
                    grupos.setdefault(actual, set()).add(vi)
    return vs, vts, caras, grupo_de_cara, grupos


def aplicar_targets(vs, targets):
    vs = [list(v) for v in vs]
    for nombre, peso in targets.items():
        ruta = os.path.join(AQUI, 'targets', nombre + '.target')
        with open(ruta) as f:
            for l in f:
                if not l.strip() or l.startswith('#'):
                    continue
                i, dx, dy, dz = l.split()
                i = int(i)
                vs[i][0] += float(dx) * peso; vs[i][1] += float(dy) * peso; vs[i][2] += float(dz) * peso
    return vs


def construir(nombre='Cuerpo', targets=None, grupos_extra=('helper-tights',)):
    """Crea la malla del cuerpo (solo el grupo 'body') y devuelve (objeto, mapa_indices, posiciones_todas)."""
    vs, vts, caras, gcara, grupos = leer_obj()
    vs = aplicar_targets(vs, targets or {})
    usados = sorted(grupos['body'])
    mapa = {vi: k for k, vi in enumerate(usados)}
    me = bpy.data.meshes.new(nombre)
    me.from_pydata([_a_blender(*vs[vi]) for vi in usados], [], [[mapa[vi] for vi, _ in c] for c, g in zip(caras, gcara) if g == 'body'])
    uv = me.uv_layers.new(name='UVMap')
    k = 0
    for c, g in zip(caras, gcara):
        if g != 'body':
            continue
        pol = me.polygons[k]
        for j, (_, ti) in enumerate(c):
            uv.data[pol.loop_start + j].uv = vts[ti]
        k += 1
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(ob)
    todas = [_a_blender(*v) for v in vs]
    return ob, mapa, todas, grupos, vs


def esqueleto(cuerpo, mapa, todas, nombre='Esqueleto', fusionar=None):
    """Crea la armadura MakeHuman 'default' y asigna los pesos. fusionar: {hueso: padre_destino} para simplificar."""
    s = json.load(open(os.path.join(AQUI, 'default.mhskel')))
    pos = {j: sum((todas[i] for i in idx), Vector()) / len(idx) for j, idx in s['joints'].items()}
    fusionar = fusionar or {}
    arm = bpy.data.armatures.new(nombre)
    ob = bpy.data.objects.new(nombre, arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    huesos = {}
    orden = list(s['bones'].keys())
    # padres antes que hijos
    hechos, lista = set(), []
    while len(lista) < len(orden):
        for b in orden:
            if b in hechos:
                continue
            p = s['bones'][b]['parent']
            if p is None or p in hechos:
                lista.append(b); hechos.add(b)
    for b in lista:
        if b in fusionar:
            continue
        d = s['bones'][b]
        e = arm.edit_bones.new(b)
        e.head = pos[d['head']]
        e.tail = pos[d['tail']]
        if (e.tail - e.head).length < 1e-4:
            e.tail = e.head + Vector((0, 0, 0.01))
        plano = s['planes'].get(d.get('rotation_plane') or '', None)
        if plano:
            a, b2, c = (pos[j] for j in plano)
            n = (b2 - a).cross(c - b2)
            if n.length > 1e-6:
                e.align_roll(n.normalized())
        p = d['parent']
        while p in fusionar:
            p = s['bones'][p]['parent']
        if p:
            e.parent = arm.edit_bones[p]
            if (e.head - e.parent.tail).length < 1e-4:
                e.use_connect = True
        huesos[b] = e
    bpy.ops.object.mode_set(mode='OBJECT')
    # pesos
    w = json.load(gzip.open(os.path.join(AQUI, 'default_weights.mhw.gz'), 'rt'))['weights']
    for hueso, lista_w in w.items():
        destino = hueso
        while destino in fusionar:
            destino = fusionar[destino] if fusionar[destino] not in (None, '') else s['bones'][destino]['parent']
        g = cuerpo.vertex_groups.get(destino) or cuerpo.vertex_groups.new(name=destino)
        for vi, peso in lista_w:
            if vi in mapa:
                g.add([mapa[vi]], peso, 'ADD')
    cuerpo.parent = ob
    m = cuerpo.modifiers.new('Esqueleto', 'ARMATURE')
    m.object = ob
    return ob, pos


def ajustar_mhclo(ruta_mhclo, vs_mh, nombre):
    """Coloca un proxy MakeHuman (.mhclo + .obj) sobre el cuerpo con targets aplicados. vs_mh: vértices en espacio MH."""
    base = os.path.dirname(ruta_mhclo)
    escalas, refs, obj = {}, [], None
    en_verts = False
    for l in open(ruta_mhclo):
        p = l.split()
        if not p or p[0].startswith('#'):
            continue
        if en_verts:
            if len(p) == 9 or len(p) == 1:
                refs.append(p)
                continue
            en_verts = False
        if p[0] == 'obj_file':
            obj = p[1]
        elif p[0] in ('x_scale', 'y_scale', 'z_scale'):
            a, b, s = int(p[1]), int(p[2]), float(p[3])
            eje = 'xyz'.index(p[0][0])
            escalas[eje] = abs(vs_mh[a][eje] - vs_mh[b][eje]) / s
        elif p[0] == 'verts':
            en_verts = True
    pos = []
    for r in refs:
        if len(r) == 1:
            v = vs_mh[int(r[0])]; pos.append(_a_blender(*v)); continue
        i = list(map(int, r[:3])); w = list(map(float, r[3:6])); d = list(map(float, r[6:9]))
        x = [sum(vs_mh[i[k]][e] * w[k] for k in range(3)) + d[e] * escalas.get(e, 1) for e in range(3)]
        pos.append(_a_blender(*x))
    vts, caras = [], []
    for l in open(os.path.join(base, obj)):
        if l.startswith('vt '):
            vts.append(tuple(map(float, l.split()[1:3])))
        elif l.startswith('f '):
            caras.append([tuple(int(q) - 1 for q in t.split('/')[:2]) for t in l.split()[1:]])
    me = bpy.data.meshes.new(nombre)
    me.from_pydata(pos, [], [[a for a, _ in c] for c in caras])
    uv = me.uv_layers.new(name='UVMap')
    for pol, c in zip(me.polygons, caras):
        for j, (_, t) in enumerate(c):
            uv.data[pol.loop_start + j].uv = vts[t]
        pol.use_smooth = True
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob
