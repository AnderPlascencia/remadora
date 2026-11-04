# Viste al remero del vikingo como cada clase de la carrera y da a su barca la madera y la franja de la clase.
# Lo ejecuta remo_agua.py con --clase (exec, comparte sus variables: bpy, rig, col, MAT...). Dos pasos:
#   vestir(clase)  justo después de abrir el .blend (cambia ropa, pelo y tocado, en la pose de reposo)
#   pintar_barca(clase)  después de construir el casco (madera, regala y franja)
# Solo es aspecto: la palada, los remos y las medidas son las mismas para todas las clases.
from mathutils import Vector, Matrix
import bmesh as _bm


def _tinte(nombre, rgb, nuevo=None):
    """Copia un material y multiplica su color (textura o color plano) por rgb."""
    m = bpy.data.materials[nombre].copy()
    m.name = nuevo or (nombre + 'Tinte')
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    ent = b.inputs['Base Color']
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
    mx.inputs[0].default_value = 1.0
    mx.inputs[7].default_value = (*rgb, 1)
    if ent.links:
        nt.links.new(ent.links[0].from_node.outputs[ent.links[0].from_socket.name], mx.inputs[6])
    else:
        mx.inputs[6].default_value = ent.default_value[:]
    nt.links.new(mx.outputs[2], ent)
    return m


def _lin(hexa):
    c = [int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def _tenir(nombre, hexa, nuevo=None):
    """Copia un material de tela y le cambia el color: conserva las luces y sombras de su textura (su gris,
    normalizado a su media) y les pone el color hexa. Sin textura, el color plano pasa a ser hexa."""
    m = bpy.data.materials[nombre].copy()
    m.name = nuevo or (nombre + 'Tenido')
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    ent = b.inputs['Base Color']
    col_ = (*_lin(hexa), 1)
    if not ent.links:
        ent.default_value = col_
        return m
    tex = ent.links[0].from_node
    media = 0.5
    if tex.type == 'TEX_IMAGE' and tex.image and tex.image.size[0]:
        px = np.array(tex.image.pixels[:]).reshape(-1, 4)[::97, :3]
        media = max(0.02, float((px @ np.array([0.2126, 0.7152, 0.0722])).mean()))
    gris = nt.nodes.new('ShaderNodeRGBToBW')
    nt.links.new(tex.outputs['Color'], gris.inputs['Color'])
    k = nt.nodes.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = 1 / media
    nt.links.new(gris.outputs[0], k.inputs[0])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
    mx.inputs[0].default_value = 1.0
    mx.inputs[7].default_value = col_
    nt.links.new(k.outputs[0], mx.inputs[6])
    nt.links.new(mx.outputs[2], ent)
    return m


def _plano(nombre, hexa, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    c = [int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    b.inputs['Base Color'].default_value = (*[x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


def _poner(nombre, mats):
    """Cambia el material de un objeto (todas sus ranuras)."""
    o = bpy.data.objects.get(nombre)
    if not o:
        return
    for i in range(len(o.data.materials)):
        o.data.materials[i] = mats


def _ocultar(*prefijos):
    for o in list(bpy.data.objects):
        if o.name.startswith(prefijos):
            bpy.data.objects.remove(o)


def _caja_cabeza():
    """Medidas del cuero cabelludo (malla Pelo) en reposo, en coordenadas del mundo."""
    o = bpy.data.objects['Pelo']
    pts = [o.matrix_world @ v.co for v in o.data.vertices]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def _a_hueso(o, hueso_n='head'):
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy()
    o.parent = rig; o.parent_type = 'BONE'; o.parent_bone = hueso_n
    o.matrix_world = mw
    for p in o.data.polygons:
        p.use_smooth = True


def _esfera(nombre, centro, radios, mat, corte=None, seg=32):
    """Elipsoide; con corte = z, solo la parte por encima de esa altura (gorro, casco)."""
    bm = _bm.new()
    _bm.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * radios[0], v.co.y * radios[1], v.co.z * radios[2])) + Vector(centro)
    if corte is not None:
        _bm.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < corte], context='VERTS')
    me = bpy.data.meshes.new(nombre); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(nombre, me); col.objects.link(o)
    if corte is not None:
        o.modifiers.new('grosor', 'SOLIDIFY').thickness = 0.006
    return o


def _toro(nombre, centro, r, grueso, mat, inclina=0.0):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=grueso, location=centro, major_segments=40, minor_segments=10,
                                     rotation=(inclina, 0, 0))
    o = bpy.context.active_object; o.name = nombre
    o.data.materials.append(mat)
    return o


def _vuelta_bota(hexa):
    """La vuelta de piel de las botas tapa su borde recortado: se queda, teñida como cuero o tela de la clase."""
    m = _tenir('Pelaje', hexa, 'VueltaBota')
    for n in ('PelajeBotaL', 'PelajeBotaR'):
        _poner(n, m)


def vestir(clase):
    if clase == 'vikingo':
        return
    rig.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    mn, mx = _caja_cabeza()
    c = (mn + mx) / 2
    r = (mx - mn) / 2
    if clase == 'pirata':
        # Casaca oscura, pelo y barba negros y pañuelo rojo anudado atrás
        _poner('Gambeson', _tenir('Gambeson', '#3A3440'))
        _poner('Pantalon', _tenir('Pantalon', '#2B2622'))
        pelo = _tinte('Pelo', (0.25, 0.22, 0.22))
        for n in ('Pelo', 'Barba', 'Bigote', 'Cejas', 'TrenzaBarba'):
            _poner(n, pelo)
        _ocultar('MantoPelaje', 'TrenzaL', 'TrenzaR', 'Moño', 'AnilloMoño', 'BrocheCapa')
        _vuelta_bota('#3A2A1E')
        rojo = _plano('Panuelo', '#B3261E', 0.75)
        o = _esfera('Panuelo', (c.x, c.y, c.z - r.z * 0.25), (r.x * 1.12, r.y * 1.12, r.z * 1.15), rojo, corte=c.z - r.z * 0.05)
        _a_hueso(o)
        nudo = _esfera('PanueloNudo', (c.x, mx.y + 0.01, c.z - r.z * 0.1), (0.035, 0.03, 0.03), rojo)
        _a_hueso(nudo)
        for s in (1, -1):
            cola = _esfera('PanueloCola', (c.x + s * 0.02, mx.y + 0.03, c.z - r.z * 0.6), (0.022, 0.012, 0.07), rojo)
            _a_hueso(cola)
        aro = _toro('Arete', (mn.x - 0.004, c.y, mn.z + 0.01), 0.012, 0.0025, MAT['Oro'] if 'Oro' in MAT else bpy.data.materials['Oro'])
        _a_hueso(aro)
    elif clase == 'samurai':
        # Kimono índigo, hakama gris, moño alto (chonmage) y hachimaki blanco con el disco rojo
        _poner('Gambeson', _tenir('Gambeson', '#2C3E78'))
        _poner('Pantalon', _tenir('Pantalon', '#5B5E66'))
        pelo = _tinte('Pelo', (0.12, 0.11, 0.11))
        for n in ('Pelo', 'Cejas', 'Moño'):
            _poner(n, pelo)
        _ocultar('Barba', 'Bigote', 'TrenzaBarba', 'TrenzaL', 'TrenzaR', 'MantoPelaje', 'Tatuaje', 'BrocheCapa')
        _vuelta_bota('#4A4D55')
        blanco = _plano('Hachimaki', '#F1EEE6', 0.8)
        z = c.z - r.z * 0.35
        o = _esfera('Hachimaki', (c.x, c.y, z), (r.x * 1.1, r.y * 1.1, 0.022), blanco, seg=40)
        _a_hueso(o)
        disco = _esfera('HachimakiSol', (c.x, mn.y - 0.012, z), (0.018, 0.004, 0.016), _plano('SolRojo', '#C81E1E', 0.6))
        _a_hueso(disco)
    elif clase == 'polinesio':
        # Torso descubierto con tatuajes, piel más morena, pareo rojo y collar de flores
        # El cuerpo de MakeHuman no tiene piel bajo la ropa (torso y pies): la camisa y las botas pasan a ser piel
        piel = _tinte('Piel', (0.62, 0.48, 0.38))
        for n in ('Cuerpo', 'Gambeson', 'Botas', 'Vendas'):
            _poner(n, piel)
        _poner('Pantalon', _tenir('Pantalon', '#C2410C'))
        pelo = _tinte('Pelo', (0.15, 0.13, 0.12))
        for n in ('Pelo', 'Cejas', 'Moño'):
            _poner(n, pelo)
        _ocultar('CorreaA', 'CorreaB', 'BrochePecho', 'MantoPelaje', 'Barba', 'Bigote', 'TrenzaBarba', 'TrenzaL', 'TrenzaR',
                 'PelajeBota', 'BrocheCapa', 'Brazales')
        cuello = rig.matrix_world @ rig.data.bones['neck01'].head_local
        flores = [_plano('Flor' + str(i), h, 0.6) for i, h in enumerate(('#F2C230', '#E8483A', '#F5F0E6', '#F06AA0'))]
        n = 18
        for i in range(n):
            a = 2 * math.pi * i / n
            p = (cuello.x + math.cos(a) * 0.105, cuello.y - 0.01 + math.sin(a) * 0.085, cuello.z - 0.035 - 0.03 * max(0, -math.sin(a)))
            f = _esfera('Lei%d' % i, p, (0.02, 0.02, 0.016), flores[i % 4], seg=12)
            _a_hueso(f, 'spine01')
    elif clase == 'romano':
        # Túnica roja, sin barba, y galea de bronce con cresta roja
        _poner('Gambeson', _tenir('Gambeson', '#A3201C'))
        _poner('Pantalon', _tenir('Pantalon', '#8A1C18'))
        pelo = _tinte('Pelo', (0.35, 0.28, 0.22))
        for n in ('Pelo', 'Cejas'):
            _poner(n, pelo)
        _ocultar('Barba', 'Bigote', 'TrenzaBarba', 'TrenzaL', 'TrenzaR', 'Moño', 'AnilloMoño', 'MantoPelaje', 'BrocheCapa', 'Tatuaje')
        _vuelta_bota('#5A3A22')
        bronce = _plano('Bronce', '#B07A3A', 0.35, 1.0)
        o = _esfera('Galea', (c.x, c.y + 0.005, c.z - r.z * 0.45), (r.x * 1.16, r.y * 1.14, r.z * 1.38), bronce, corte=c.z - r.z * 0.5)
        _a_hueso(o)
        borde = _toro('GaleaBorde', (c.x, c.y + 0.005, c.z - r.z * 0.5), r.x * 1.155, 0.009, bronce)
        borde.scale.y = r.y / r.x
        _a_hueso(borde)
        # Cresta de crin: media elipse de delante a atrás, apoyada en lo alto del casco
        tope = c.z + r.z * 0.93 - 0.02
        cresta = _esfera('Cresta', (c.x, c.y + 0.01, tope), (0.024, r.y * 1.15, 0.11), _plano('CrestaRoja', '#A3171B', 0.9),
                         corte=tope, seg=32)
        _a_hueso(cresta)
    rig.data.pose_position = 'POSE'
    bpy.context.view_layer.update()


def tapar_cuerpo(prendas=('Gambeson', 'Pantalon'), debajo=('Cuerpo', 'Botas', 'Vendas')):
    """Oculta lo que queda bajo la ropa (piel del torso y los muslos, caña de las botas) para que no la atraviese al
    doblar hombros y rodillas en la palada. Se mide en la pose de reposo: un vértice se oculta si está dentro de una
    prenda o a menos de 3,5 cm por debajo de ella, y no cerca de su borde (allí se vería el hueco)."""
    from mathutils.bvhtree import BVHTree
    from mathutils.kdtree import KDTree
    rig.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    arboles = []
    for n in prendas:
        o = bpy.data.objects.get(n)
        if not o:
            continue
        me = o.data
        vs = [o.matrix_world @ v.co for v in me.vertices]
        arboles.append(BVHTree.FromPolygons(vs, [tuple(p.vertices) for p in me.polygons]))
        caras = {}
        for p in me.polygons:
            for e in p.edge_keys:
                caras[e] = caras.get(e, 0) + 1
        bordes = {i for e, c in caras.items() if c == 1 for i in e}
        kd = KDTree(max(1, len(bordes)))
        for i in bordes:
            kd.insert(vs[i], i)
        kd.balance()
        arboles[-1] = (arboles[-1], kd if bordes else None)
    for n in debajo:
        o = bpy.data.objects.get(n)
        if not o or not arboles:
            continue
        ocultos = []
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            for bvh, kd in arboles:
                loc, nor, _, d = bvh.find_nearest(w, 0.035)
                if loc is None or (w - loc).dot(nor) > 0.002:
                    continue
                if kd and kd.find(w)[2] < 0.012:
                    continue
                ocultos.append(v.index)
                break
        if not ocultos:
            continue
        g = o.vertex_groups.new(name='BajoLaRopa')
        g.add(ocultos, 1.0, 'REPLACE')
        m = o.modifiers.new('BajoLaRopa', 'MASK')
        m.vertex_group = g.name
        m.invert_vertex_group = True
        print('TAPAR', n, len(ocultos), 'de', len(o.data.vertices), flush=True)
    rig.data.pose_position = 'POSE'
    bpy.context.view_layer.update()


# Madera de cada barca (multiplica la del vikingo) y color de la regala y de la franja bajo la borda
BARCAS = {
    'vikingo': {'madera': (1, 1, 1), 'regala': None, 'franja': None},
    'pirata': {'madera': (0.35, 0.33, 0.33), 'regala': '#D9D4C7', 'franja': '#E8E2D2'},
    'samurai': {'madera': (2.1, 1.85, 1.5), 'regala': '#2A1E1A', 'franja': None},
    'polinesio': {'madera': (1.35, 0.9, 0.7), 'regala': '#E7D3A8', 'franja': '#2A1A12'},
    'romano': {'madera': (0.9, 0.75, 0.7), 'regala': '#C9A227', 'franja': '#6B1E8C'},
}


def pintar_barca(clase):
    d = BARCAS[clase]
    if d['madera'] != (1, 1, 1):
        bpy.data.objects['Casco'].data.materials[0] = _tinte('MaderaBarca', d['madera'], 'MaderaClase')
    if d['regala']:
        _poner('Regala', _plano('RegalaClase', d['regala'], 0.5, 0.6 if clase == 'romano' else 0.0))
    if d['franja']:
        # Franja pintada justo bajo la borda, a lo largo de todo el casco
        bm = _bm.new()
        for s in (1, -1):
            ys = np.linspace(Y0 + 0.25, Y1 - 0.25, 60)
            filas = []
            for y in ys:
                sy = (y - (Y0 + Y1) / 2) / (LARGO / 2)
                w = manga(y) * 1.012 + 0.004
                zb = 0.40 + 0.10 * sy ** 4
                filas.append((bm.verts.new((s * w, y, zb - 0.015)), bm.verts.new((s * (w - 0.004), y, zb - 0.075))))
            for (a0, b0), (a1, b1) in zip(filas, filas[1:]):
                bm.faces.new((a0, a1, b1, b0) if s > 0 else (a0, b0, b1, a1))
        malla('Franja', bm, _plano('FranjaClase', d['franja'], 0.55))
