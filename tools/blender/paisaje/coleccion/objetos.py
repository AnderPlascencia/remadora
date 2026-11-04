# Piezas de los cinco paisajes de la colección (cañón, otoño, glaciar, cerezos y costa mediterránea), modeladas
# por código con los ayudantes de ../piezas.py. Las usan orilla.py (vista lateral para la carrera 3D) y costa.py
# (vista desde arriba para la 2D). Convención de ../laguna/tropico.py: el suelo es z = 0, la cámara de la orilla
# mira desde -Y, y las piezas que se inclinan lo hacen hacia +X (en la orilla derecha se espejan).
import bpy, bmesh, math, random, os, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import piezas  # noqa: E402
from piezas import M, material, hex_lin, nuevo, rugoso, cono, cilindro, bola, unir  # noqa: E402


def preparar():
    piezas.preparar()  # pinos, abedules y rocas del fiordo (los reusan otoño y glaciar)
    m = lambda n, h, r=0.8, s=0.0: material('MAT-' + n, hex_lin(h), r, s)
    M.update({
        # Cañón del desierto
        'saguaro': m('saguaro', '#4F7A3A', 0.7, 0.05), 'saguaro2': m('saguaro2', '#3E6630', 0.7, 0.05),
        'flor_des': m('flor-desierto', '#F2C230', 0.55, 0.2), 'flor_roja': m('flor-roja', '#D8402E', 0.55, 0.2),
        'salvia': m('salvia', '#8A9A70', 0.9, 0.05), 'arenisca': m('arenisca', '#B5562E', 0.9),
        'arenisca2': m('arenisca2', '#D9874A', 0.9), 'adobe': m('adobe', '#C98E5E', 0.95),
        'viga': m('viga', '#5A3E28', 0.9), 'mezquite': m('mezquite', '#6E7E3A', 0.8, 0.1),
        'seco': m('seco', '#B49A5A', 0.85, 0.05), 'tronco_seco': m('tronco-seco', '#5E4A3A', 0.9),
        # Lago de otoño
        'arce': m('arce', '#C2361E', 0.7, 0.15), 'arce2': m('arce2', '#E0622A', 0.7, 0.15),
        'naranja': m('naranja', '#E8902A', 0.7, 0.15), 'amarillo': m('amarillo', '#E8C23A', 0.7, 0.15),
        'tronco_osc': m('tronco-oscuro', '#3A2A22', 0.9), 'troncos': m('troncos', '#7A5634', 0.9),
        'tejado': m('tejado', '#3A3A3E', 0.85), 'piedra': m('piedra', '#7E7A74', 0.9),
        'canoa_roja': m('canoa-roja', '#B8322A', 0.45), 'helecho': m('helecho', '#A0582A', 0.85, 0.1),
        # Bahía glaciar
        'hielo': m('hielo', '#BFE6F2', 0.25, 0.4), 'hielo2': m('hielo2', '#7CC8E0', 0.2, 0.5),
        'nieve': m('nieve', '#F2F6FA', 0.6, 0.2), 'pinguino': m('pinguino', '#1A1E24', 0.5),
        'pico': m('pico', '#F0A020', 0.5), 'roca_osc': m('roca-oscura', '#3E4248', 0.85),
        # Lago de los cerezos
        'cerezo': m('cerezo', '#F4A7C0', 0.6, 0.25), 'cerezo2': m('cerezo2', '#FAD0DC', 0.6, 0.25),
        'cerezo3': m('cerezo3', '#E77FA2', 0.6, 0.25), 'corteza': m('corteza', '#3A2E2E', 0.85),
        'pino_jp': m('pino-japones', '#24452E', 0.8, 0.1), 'pino_jp2': m('pino-japones2', '#33583A', 0.8, 0.1),
        'bermellon': m('bermellon', '#D4351C', 0.55), 'negro': m('negro', '#1C1C1E', 0.6),
        'granito': m('granito', '#8C8A86', 0.9), 'bambu': m('bambu', '#6E9A3A', 0.6, 0.1),
        'iris': m('iris', '#6A4FC2', 0.55, 0.2),
        # Costa mediterránea
        'cipres': m('cipres', '#1F3A22', 0.85, 0.1), 'olivo': m('olivo', '#8A9A6A', 0.8, 0.1),
        'olivo2': m('olivo2', '#6E7E52', 0.8, 0.1), 'tronco_olivo': m('tronco-olivo', '#6A645A', 0.9),
        'cal': m('cal', '#F4F1EA', 0.7), 'azul': m('azul-egeo', '#1F5FA8', 0.5),
        'buganvilla': m('buganvilla', '#C8287A', 0.55, 0.2), 'caliza': m('caliza', '#CFC3A8', 0.9),
        'caliza2': m('caliza2', '#B4A688', 0.9), 'lavanda': m('lavanda', '#8A6FC0', 0.6, 0.15),
        'pinonero': m('pinonero', '#3A5A2C', 0.8, 0.1), 'casco': m('casco-barca', '#F2F0EA', 0.5),
        'franja_azul': m('franja-azul', '#2A6AB8', 0.5), 'tronco_rojo': m('tronco-rojizo', '#6A4030', 0.9),
    })


# ── Ayudantes ──
def tubo(nombre, puntos, radios, mat, seg=14, costillas=0, hondo=0.12):
    """Tubo a lo largo de una polilínea, cerrado en los extremos; con costillas verticales (cactus) si se pide."""
    bm = bmesh.new()
    capas = []
    for i, (p, r) in enumerate(zip(puntos, radios)):
        t = (puntos[min(i + 1, len(puntos) - 1)] - puntos[max(i - 1, 0)]).normalized()
        a = (Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 1, 0))).cross(t).normalized()
        b = t.cross(a)
        capa = []
        for k in range(seg):
            ang = 2 * math.pi * k / seg
            rr = r * (1 - hondo * (k % 2)) if costillas else r
            capa.append(bm.verts.new(p + (a * math.cos(ang) + b * math.sin(ang)) * rr))
        capas.append(capa)
    for c0, c1 in zip(capas, capas[1:]):
        for k in range(seg):
            bm.faces.new((c0[k], c0[(k + 1) % seg], c1[(k + 1) % seg], c1[k]))
    bm.faces.new(list(reversed(capas[0])))
    bm.faces.new(capas[-1])
    return nuevo(nombre, bm, mat)


def caja(nombre, tam, centro, mat):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=tam, verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=centro)
    return nuevo(nombre, bm, mat)


def elipsoide(nombre, radios, centro, mat, semilla=0, rug=0.0, sub=3):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * radios[0], v.co.y * radios[1], v.co.z * radios[2]))
    bmesh.ops.translate(bm, verts=bm.verts, vec=centro)
    ob = nuevo(nombre, bm, mat)
    if rug:
        rugoso(ob, min(radios) * rug, 1.5 / min(radios), semilla)
    return ob


def copa(nombre, centro, radios, mats, n, r_bola, semilla, rug=0.35):
    """Copa de árbol: n bolas repartidas dentro de un elipsoide (más en la superficie, para que se vea llena)."""
    rnd = random.Random(semilla)
    partes = []
    for i in range(n):
        while True:
            p = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))
            if 0.35 < p.length <= 1:
                break
        p = p.normalized() * (0.55 + 0.45 * p.length)
        c = (centro[0] + p.x * radios[0], centro[1] + p.y * radios[1], centro[2] + p.z * radios[2])
        partes.append(bola(f'{nombre}_{i}', r_bola * rnd.uniform(0.7, 1.15), c, M[mats[i % len(mats)]], semilla + i, rug=rug))
    return partes


def aplicar(o):
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def matas(nombre, semilla, mats, n=26, alto=(0.35, 0.8), ancho=0.5, flor=None):
    rnd = random.Random(semilla)
    partes = []
    for i in range(n):
        h = rnd.uniform(*alto)
        c = cilindro(f'{nombre}_{i}', 0.03, 0.004, h, M[mats[i % len(mats)]])
        c.location = (rnd.uniform(-ancho, ancho), rnd.uniform(-ancho / 2, ancho / 2), 0)
        c.rotation_euler = (rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5), 0)
        partes.append(c)
        if flor and i % 2 == 0:
            # Espiga de flores en la punta (lavanda, iris)
            e = elipsoide(f'{nombre}_e{i}', (0.035, 0.035, 0.1), (0, 0, h), M[flor])
            e.location = c.location
            e.rotation_euler = c.rotation_euler
            partes.append(e)
    bpy.context.view_layer.update()
    o = unir(nombre, partes)
    return aplicar(o)


def roca(nombre, r, semilla, mat, mat_arriba=None, escala=(1.4, 1.0, 0.7)):
    o = bola(nombre, r, (0, 0, r * 0.3), M[mat], semilla, rug=0.4)
    o.scale = escala
    if mat_arriba:
        o.data.materials.append(M[mat_arriba])
        for p in o.data.polygons:
            if p.normal.z > 0.55:
                p.material_index = 1
    return o


def arbol(nombre, alto, semilla, mats, tronco='tronco_osc', ancho=0.42, alto_copa=0.55, bolas=34, inclina=0.0):
    """Árbol de hoja ancha: tronco algo torcido y copa redonda de bolas."""
    rnd = random.Random(semilla)
    n = 8
    pts = [Vector((inclina * alto * (i / n) ** 2 + rnd.uniform(-0.05, 0.05) * alto * (i / n), 0, alto * 0.62 * i / n)) for i in range(n + 1)]
    partes = [tubo(nombre + '_t', pts, [alto * 0.035 * (1 - 0.5 * i / n) + 0.06 for i in range(n + 1)], M[tronco], seg=10)]
    cima = pts[-1]
    c = (cima.x, 0, alto * (1 - alto_copa / 2))
    partes += copa(nombre + '_c', c, (alto * ancho, alto * ancho * 0.8, alto * alto_copa / 2), mats, bolas, alto * 0.13, semilla)
    return unir(nombre, partes)


def canoa_simple(nombre, largo, mat, mat_borde, ancho=0.42, alto=0.45):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1)
    for v in bm.verts:
        z = v.co.z
        v.co.x *= largo / 2
        v.co.y *= ancho
        v.co.z = min(z, 0.2) * alto
        # Proa y popa levantadas
        v.co.z += 0.18 * alto * (abs(v.co.x) / (largo / 2)) ** 3
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, alto * 0.8))
    casco = nuevo(nombre + '_c', bm, M[mat])
    borde = cilindro(nombre + '_b', 0.03, 0.03, largo * 0.92, M[mat_borde])
    borde.rotation_euler = (0, math.radians(90), 0)
    borde.location = (-largo * 0.46, -ancho * 0.98, alto * 0.88)
    return unir(nombre, [casco, borde])


# ── Cañón del desierto ──
def saguaro(nombre, alto, semilla, brazos=2):
    rnd = random.Random(semilla)
    r = alto * 0.055 + 0.12
    n = 12
    tronco = [Vector((0, 0, alto * i / n)) for i in range(n + 1)]
    partes = [tubo(nombre + '_t', tronco, [r] * n + [r * 0.6], M['saguaro'], seg=20, costillas=1),
              bola(nombre + '_cima', r * 0.98, (0, 0, alto * 0.995), M['saguaro'], semilla, rug=0.02)]
    lados = [1, -1, 1][:brazos]
    for j, s in enumerate(lados):
        z0 = alto * rnd.uniform(0.35, 0.55)
        sale = alto * rnd.uniform(0.12, 0.18)
        sube = alto * rnd.uniform(0.2, 0.32)
        ang = rnd.uniform(-0.6, 0.6)
        d = Vector((math.cos(ang) * s, math.sin(ang), 0))
        pts = []
        for i in range(14):
            t = i / 13
            # Codo: sale en horizontal y luego sube
            if t < 0.4:
                q = t / 0.4
                p = d * sale * math.sin(q * math.pi / 2) + Vector((0, 0, z0 + sale * 0.3 * (1 - math.cos(q * math.pi / 2))))
            else:
                q = (t - 0.4) / 0.6
                p = d * sale + Vector((0, 0, z0 + sale * 0.3 + sube * q))
            pts.append(p)
        ra = r * 0.62
        partes.append(tubo(f'{nombre}_b{j}', pts, [ra] * 13 + [ra * 0.6], M['saguaro2' if j % 2 else 'saguaro'], seg=16, costillas=1))
        partes.append(bola(f'{nombre}_bc{j}', ra * 0.98, pts[-1], M['saguaro'], semilla + j, rug=0.02))
    for k in range(rnd.randint(2, 4)):
        a = rnd.uniform(0, 2 * math.pi)
        partes.append(bola(f'{nombre}_f{k}', r * 0.22, (math.cos(a) * r * 0.5, math.sin(a) * r * 0.5, alto + r * 0.75), M['flor_des'], semilla + 9 + k, rug=0.1))
    return unir(nombre, partes)


def barril(nombre, r, semilla):
    pts = [Vector((0, 0, r * 1.5 * i / 8)) for i in range(9)]
    rad = [r * math.sin(math.pi * (0.25 + 0.7 * i / 8)) for i in range(9)]
    partes = [tubo(nombre + '_c', pts, rad, M['saguaro2'], seg=22, costillas=1, hondo=0.14)]
    for k in range(6):
        a = 2 * math.pi * k / 6
        partes.append(bola(f'{nombre}_f{k}', r * 0.14, (math.cos(a) * r * 0.25, math.sin(a) * r * 0.25, r * 1.48), M['flor_roja' if k % 2 else 'flor_des'], k, rug=0.15))
    return unir(nombre, partes)


def salvia(nombre, r, semilla):
    return unir(nombre, copa(nombre, (0, 0, r * 0.55), (r * 1.3, r, r * 0.55), ['salvia', 'seco', 'salvia'], 22, r * 0.32, semilla, rug=0.45))


def mezquite(nombre, alto, semilla):
    # Árbol bajo del desierto: tronco torcido que se abre en dos y copa plana y rala
    rnd = random.Random(semilla)
    partes = []
    for j, s in enumerate((1, -1, 0.3)):
        pts = [Vector((s * alto * 0.25 * (i / 6) ** 1.4 + rnd.uniform(-0.06, 0.06), rnd.uniform(-0.05, 0.05), alto * 0.6 * i / 6)) for i in range(7)]
        partes.append(tubo(f'{nombre}_t{j}', pts, [0.16 - 0.015 * i for i in range(7)], M['tronco_seco'], seg=8))
    partes += copa(nombre + '_c', (0, 0, alto * 0.72), (alto * 0.55, alto * 0.45, alto * 0.16), ['mezquite', 'salvia'], 26, alto * 0.12, semilla, rug=0.5)
    return unir(nombre, partes)


def roca_roja(nombre, r, semilla, alto=1.0):
    # Bloque de arenisca con estratos: caja deformada y bandas de dos colores según la altura
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=6, use_grid_fill=True)
    bmesh.ops.scale(bm, vec=(r * 2.2, r * 1.5, r * alto), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, r * alto * 0.42))
    o = nuevo(nombre, bm, M['arenisca'])
    rugoso(o, r * 0.16, 1.3 / r, semilla)
    for v in o.data.vertices:
        # Más ancha abajo, cima plana
        v.co.x *= 1 + 0.18 * (0.5 - v.co.z / (r * alto))
        v.co.z = min(v.co.z, r * alto * 0.9)
    o.data.materials.append(M['arenisca2'])
    for p in o.data.polygons:
        if int(p.center.z / (r * 0.28)) % 2:
            p.material_index = 1
    return o


def adobe(nombre):
    # Casa de adobe: dos cuerpos de techo plano, vigas que asoman y puerta y ventana oscuras al frente (-Y)
    partes = [caja(nombre + '_a', (4.6, 3.6, 2.8), (0, 0, 1.4), M['adobe']),
              caja(nombre + '_b', (2.4, 3.0, 3.8), (-1.3, 0.4, 1.9), M['adobe'])]
    for p in partes:
        rugoso(p, 0.05, 2, 3)
    for i in range(6):
        v = cilindro(f'{nombre}_v{i}', 0.09, 0.09, 0.7, M['viga'])
        v.rotation_euler = (math.radians(90), 0, 0)
        v.location = (-1.9 + i * 0.75, -1.8, 2.45)
        partes.append(v)
    partes.append(caja(nombre + '_p', (0.95, 0.06, 1.75), (0.9, -1.81, 0.88), M['viga']))
    partes.append(caja(nombre + '_w', (0.7, 0.06, 0.6), (-1.3, -1.11, 2.6), M['viga']))
    return unir(nombre, partes)


# ── Lago de otoño ──
def cabana(nombre):
    # Cabaña de troncos: paredes de troncos apilados, tejado a dos aguas oscuro y chimenea de piedra
    partes = []
    for i in range(9):
        z = 0.15 + i * 0.27
        for sy in (-1.6, 1.6):
            t = cilindro(f'{nombre}_x{i}{sy}', 0.15, 0.15, 5.0, M['troncos'])
            t.rotation_euler = (0, math.radians(90), 0)
            t.location = (-2.5, sy, z)
            partes.append(t)
        for sx in (-2.2, 2.2):
            t = cilindro(f'{nombre}_y{i}{sx}', 0.15, 0.15, 3.8, M['troncos'])
            t.rotation_euler = (math.radians(90), 0, 0)
            t.location = (sx, 1.9, z + 0.13)
            partes.append(t)
    partes.append(caja(nombre + '_n', (4.3, 3.1, 2.4), (0, 0, 1.25), M['troncos']))
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(-2.9, -2.2, 2.5), (2.9, -2.2, 2.5), (2.9, 0, 4.1), (-2.9, 0, 4.1), (-2.9, 2.2, 2.5), (2.9, 2.2, 2.5)]]
    for f in [(0, 1, 2, 3), (3, 2, 5, 4)]:
        bm.faces.new([v[i] for i in f])
    techo = nuevo(nombre + '_t', bm, M['tejado'])
    sol = techo.modifiers.new('grosor', 'SOLIDIFY')
    sol.thickness = 0.18
    partes.append(techo)
    for sx in (-2.2, 2.2):
        bm = bmesh.new()
        v = [bm.verts.new(p) for p in [(sx, -1.6, 2.5), (sx, 1.6, 2.5), (sx, 0, 3.9)]]
        bm.faces.new(v)
        partes.append(nuevo(f'{nombre}_f{sx}', bm, M['troncos']))
    ch = caja(nombre + '_ch', (0.8, 0.8, 4.6), (1.6, 0.9, 2.3), M['piedra'])
    rugoso(ch, 0.04, 3, 5)
    partes.append(ch)
    partes.append(caja(nombre + '_p', (0.9, 0.06, 1.8), (-0.6, -1.77, 0.9), M['tronco_osc']))
    partes.append(caja(nombre + '_w', (0.8, 0.06, 0.7), (1.0, -1.77, 1.5), M['amarillo']))
    bpy.context.view_layer.objects.active = techo
    bpy.ops.object.select_all(action='DESELECT')
    techo.select_set(True)
    bpy.ops.object.modifier_apply(modifier='grosor')
    return unir(nombre, partes)


# ── Bahía glaciar ──
def tempano(nombre, ancho, alto, semilla):
    # Témpano: bloque de hielo facetado (pocas subdivisiones para que se vean las caras) con vetas azules abajo
    o = elipsoide(nombre, (ancho * 0.6, ancho * 0.45, alto * 0.6), (0, 0, alto * 0.4), M['hielo'], semilla, rug=0.0, sub=2)
    rugoso(o, ancho * 0.18, 0.9 / ancho, semilla)
    rnd = random.Random(semilla)
    pico = Vector((rnd.uniform(-0.3, 0.3) * ancho, 0, 0))
    for v in o.data.vertices:
        # Una cresta afilada arriba, hacia un lado, para que no parezca una bola
        if v.co.z > alto * 0.45:
            k = max(0, 1 - abs(v.co.x - pico.x) / (ancho * 0.45))
            v.co.z += alto * 0.45 * k ** 2
        v.co.z = max(v.co.z, 0)
    o.data.materials.append(M['hielo2'])
    o.data.materials.append(M['nieve'])
    for p in o.data.polygons:
        if p.center.z < alto * 0.22:
            p.material_index = 1
        elif p.normal.z > 0.6:
            p.material_index = 2
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def iglu(nombre):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=14, radius=2.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.01], context='VERTS')
    cupula = nuevo(nombre + '_c', bm, M['nieve'])
    # Juntas de los bloques: anillos algo más oscuros
    partes = [cupula]
    for i, z in enumerate((0.5, 1.0, 1.45, 1.8)):
        rr = math.sqrt(max(0.01, 4.0 - z * z)) + 0.015
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=False, segments=28, radius1=rr, radius2=rr, depth=0.05)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, z))
        partes.append(nuevo(f'{nombre}_j{i}', bm, M['hielo2']))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.75, radius2=0.75, depth=1.4)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(math.radians(90), 3, 'X'))
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.01], context='VERTS')
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0.3, -2.0, 0))
    partes.append(nuevo(nombre + '_e', bm, M['nieve']))
    partes.append(elipsoide(nombre + '_p', (0.5, 0.05, 0.6), (0.3, -2.71, 0), M['negro'], sub=2))
    return unir(nombre, partes)


def pinguinos(nombre, semilla, n=4):
    rnd = random.Random(semilla)
    partes = []
    for i in range(n):
        x, y = (i - (n - 1) / 2) * 0.42 + rnd.uniform(-0.08, 0.08), rnd.uniform(-0.2, 0.2)
        h = rnd.uniform(0.55, 0.75)
        partes.append(elipsoide(f'{nombre}_c{i}', (h * 0.3, h * 0.26, h * 0.5), (x, y, h * 0.5), M['pinguino'], sub=3))
        partes.append(elipsoide(f'{nombre}_v{i}', (h * 0.22, h * 0.1, h * 0.36), (x, y - h * 0.19, h * 0.46), M['nieve'], sub=3))
        partes.append(elipsoide(f'{nombre}_k{i}', (h * 0.2, h * 0.18, h * 0.18), (x, y, h * 1.0), M['pinguino'], sub=2))
        partes.append(elipsoide(f'{nombre}_p{i}', (h * 0.04, h * 0.1, h * 0.03), (x, y - h * 0.2, h * 0.98), M['pico'], sub=1))
    return unir(nombre, partes)


def abeto_nevado(nombre, alto, semilla):
    o = piezas.pino(nombre, alto, semilla)
    o.data.materials.append(M['nieve'])
    for p in o.data.polygons:
        if p.normal.z > 0.45 and p.center.z > alto * 0.15:
            p.material_index = len(o.data.materials) - 1
    return o


# ── Lago de los cerezos ──
def cerezo(nombre, alto, semilla, inclina=0.3):
    rnd = random.Random(semilla)
    partes = []
    n = 7
    pts = [Vector((inclina * alto * 0.2 * (i / n) ** 1.5, 0, alto * 0.45 * i / n)) for i in range(n + 1)]
    partes.append(tubo(nombre + '_t', pts, [alto * 0.04 * (1 - 0.4 * i / n) + 0.05 for i in range(n + 1)], M['corteza'], seg=10))
    cima = pts[-1]
    nubes = []
    # Ramas que se abren en abanico; en la punta de cada una, una nube de flores
    for j in range(5):
        a = math.pi * (0.1 + 0.8 * j / 4) + rnd.uniform(-0.15, 0.15)
        d = Vector((math.cos(a), rnd.uniform(-0.5, 0.5), math.sin(a) * 0.7 + 0.25)).normalized()
        largo = alto * rnd.uniform(0.28, 0.38)
        p2 = cima + d * largo
        pm = cima + d * largo * 0.5 + Vector((0, 0, alto * 0.05))
        partes.append(tubo(f'{nombre}_r{j}', [cima, pm, p2], [alto * 0.03, alto * 0.02, alto * 0.01], M['corteza'], seg=8))
        nubes.append(p2)
    for j, p in enumerate(nubes + [cima + Vector((0, 0, alto * 0.38))]):
        partes += copa(f'{nombre}_n{j}', p, (alto * 0.2, alto * 0.18, alto * 0.13), ['cerezo', 'cerezo2', 'cerezo', 'cerezo3'], 9, alto * 0.08, semilla + j * 20, rug=0.4)
    return unir(nombre, partes)


def pino_jp(nombre, alto, semilla):
    # Pino japonés: tronco sinuoso y copas en «nubes» planas a distintas alturas
    rnd = random.Random(semilla)
    n = 10
    pts = [Vector((alto * 0.12 * math.sin(i / n * 3.2), 0, alto * 0.82 * i / n)) for i in range(n + 1)]
    partes = [tubo(nombre + '_t', pts, [alto * 0.035 * (1 - 0.55 * i / n) + 0.05 for i in range(n + 1)], M['tronco_rojo'], seg=10)]
    for j, f in enumerate((0.45, 0.62, 0.8, 0.98)):
        i = min(n, round(f * n))
        c = pts[i].copy()
        lado = (-1) ** j * alto * rnd.uniform(0.12, 0.22)
        c.x += lado * (0 if j == 3 else 1)
        c.z = alto * f * 0.88
        rx = alto * (0.26 - 0.04 * j)
        if j < 3:
            partes.append(tubo(f'{nombre}_r{j}', [pts[i], (pts[i] + c) / 2 + Vector((0, 0, 0.2)), c], [0.1, 0.07, 0.05], M['tronco_rojo'], seg=6))
        partes += copa(f'{nombre}_n{j}', (c.x, 0, c.z + alto * 0.03), (rx, rx * 0.75, alto * 0.06), ['pino_jp', 'pino_jp2'], 12, alto * 0.07, semilla + j * 11, rug=0.45)
    return unir(nombre, partes)


def torii(nombre):
    partes = []
    for sx in (-2.0, 2.0):
        partes.append(cilindro(f'{nombre}_p{sx}', 0.24, 0.2, 5.0, M['bermellon']))
        partes[-1].location = (sx, 0, 0)
        partes.append(cilindro(f'{nombre}_b{sx}', 0.3, 0.3, 0.45, M['negro']))
        partes[-1].location = (sx, 0, 0)
    partes.append(caja(nombre + '_n', (5.0, 0.3, 0.32), (0, 0, 3.9), M['bermellon']))
    partes.append(caja(nombre + '_g', (0.3, 0.22, 0.7), (0, 0, 4.3), M['bermellon']))
    # Kasagi: viga alta algo curvada hacia arriba en las puntas, con remate negro
    bm = bmesh.new()
    seg = 16
    capas = []
    for i in range(seg + 1):
        x = -3.3 + 6.6 * i / seg
        z = 4.7 + 0.25 * (abs(x) / 3.3) ** 2.5
        capas.append([bm.verts.new((x, y, z + dz)) for y, dz in ((-0.32, 0), (0.32, 0), (0.32, 0.34), (-0.32, 0.34))])
    for c0, c1 in zip(capas, capas[1:]):
        for k in range(4):
            bm.faces.new((c0[k], c0[(k + 1) % 4], c1[(k + 1) % 4], c1[k]))
    bm.faces.new(list(reversed(capas[0])))
    bm.faces.new(capas[-1])
    partes.append(nuevo(nombre + '_k', bm, M['bermellon']))
    bm = bmesh.new()
    capas = []
    for i in range(seg + 1):
        x = -3.5 + 7.0 * i / seg
        z = 5.04 + 0.3 * (abs(x) / 3.5) ** 2.5
        capas.append([bm.verts.new((x, y, z + dz)) for y, dz in ((-0.38, 0), (0.38, 0), (0.38, 0.18), (-0.38, 0.18))])
    for c0, c1 in zip(capas, capas[1:]):
        for k in range(4):
            bm.faces.new((c0[k], c0[(k + 1) % 4], c1[(k + 1) % 4], c1[k]))
    bm.faces.new(list(reversed(capas[0])))
    bm.faces.new(capas[-1])
    partes.append(nuevo(nombre + '_r', bm, M['negro']))
    return unir(nombre, partes)


def linterna(nombre):
    # Linterna de piedra (tōrō): base, columna, caja de la luz, tejadillo y remate
    g = M['granito']
    partes = [cilindro(nombre + '_b', 0.42, 0.38, 0.25, g), cilindro(nombre + '_c', 0.16, 0.16, 0.85, g, z=0.25),
              cilindro(nombre + '_s', 0.38, 0.32, 0.15, g, z=1.1), caja(nombre + '_l', (0.5, 0.5, 0.42), (0, 0, 1.46), g),
              caja(nombre + '_v', (0.24, 0.52, 0.2), (0, 0, 1.48), M['amarillo']),
              cilindro(nombre + '_t', 0.62, 0.12, 0.38, g, z=1.66), bola(nombre + '_r', 0.11, (0, 0, 2.1), g, 3, rug=0.05)]
    return unir(nombre, partes)


def bambu(nombre, alto, semilla):
    rnd = random.Random(semilla)
    partes = []
    for i in range(9):
        x, y = rnd.uniform(-0.7, 0.7), rnd.uniform(-0.4, 0.4)
        h = alto * rnd.uniform(0.75, 1.0)
        c = cilindro(f'{nombre}_{i}', 0.06, 0.045, h, M['bambu'])
        c.location = (x, y, 0)
        c.rotation_euler = (rnd.uniform(-0.08, 0.08), rnd.uniform(-0.08, 0.08), 0)
        partes.append(c)
        partes += copa(f'{nombre}_h{i}', (x, y, h * 0.85), (0.6, 0.45, h * 0.18), ['bambu', 'pino_jp2'], 6, 0.22, semilla + i * 7, rug=0.5)
    o = unir(nombre, partes)
    return aplicar(o)


# ── Costa mediterránea ──
def cipres(nombre, alto, semilla):
    partes = [cilindro(nombre + '_t', 0.14, 0.08, alto * 0.25, M['tronco_osc'])]
    o = elipsoide(nombre + '_c', (alto * 0.11, alto * 0.11, alto * 0.47), (0, 0, alto * 0.53), M['cipres'], semilla, sub=4)
    rugoso(o, alto * 0.018, 6 / alto, semilla)
    for v in o.data.vertices:
        # Punta afilada arriba
        k = max(0, (v.co.z - alto * 0.6) / (alto * 0.4))
        v.co.x *= 1 - 0.55 * k
        v.co.y *= 1 - 0.55 * k
    partes.append(o)
    return unir(nombre, partes)


def olivo(nombre, alto, semilla):
    rnd = random.Random(semilla)
    partes = []
    for j, s in enumerate((-1, 1, 0.2)):
        pts = [Vector((s * alto * 0.18 * (i / 6) ** 1.3 + 0.12 * math.sin(i + semilla + j), rnd.uniform(-0.08, 0.08), alto * 0.5 * i / 6)) for i in range(7)]
        partes.append(tubo(f'{nombre}_t{j}', pts, [0.28 - 0.03 * i for i in range(7)], M['tronco_olivo'], seg=9))
    partes += copa(nombre + '_c', (0, 0, alto * 0.68), (alto * 0.5, alto * 0.42, alto * 0.25), ['olivo', 'olivo2', 'olivo'], 34, alto * 0.11, semilla, rug=0.5)
    return unir(nombre, partes)


def pinonero(nombre, alto, semilla):
    # Pino piñonero: tronco alto algo inclinado y copa ancha y plana como un paraguas
    n = 8
    pts = [Vector((alto * 0.12 * (i / n) ** 2, 0, alto * 0.78 * i / n)) for i in range(n + 1)]
    partes = [tubo(nombre + '_t', pts, [0.3 - 0.02 * i for i in range(n + 1)], M['tronco_rojo'], seg=10)]
    partes += copa(nombre + '_c', (pts[-1].x, 0, alto * 0.86), (alto * 0.42, alto * 0.36, alto * 0.1), ['pinonero', 'cipres'], 30, alto * 0.08, semilla, rug=0.45)
    return unir(nombre, partes)


def casa_blanca(nombre):
    # Casita encalada de las islas: dos cubos blancos, cúpula azul, puerta y contraventanas azules
    partes = [caja(nombre + '_a', (4.0, 3.4, 3.0), (0, 0, 1.5), M['cal']), caja(nombre + '_b', (2.2, 2.6, 1.8), (2.6, 0.2, 0.9), M['cal']),
              caja(nombre + '_c', (4.2, 3.6, 0.15), (0, 0, 3.07), M['cal'])]
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1.15)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.01], context='VERTS')
    bmesh.ops.translate(bm, verts=bm.verts, vec=(-0.6, 0.2, 3.6))
    partes.append(nuevo(nombre + '_d', bm, M['azul']))
    partes.append(cilindro(nombre + '_tb', 1.18, 1.18, 0.5, M['cal'], z=3.12))
    partes[-1].location = (-0.6, 0.2, 0)
    partes.append(cilindro(nombre + '_cr', 0.04, 0.04, 0.6, M['cal'], z=4.7))
    partes[-1].location = (-0.6, 0.2, 0)
    partes.append(caja(nombre + '_p', (0.9, 0.06, 1.9), (0.6, -1.72, 0.95), M['azul']))
    partes.append(caja(nombre + '_w', (0.7, 0.06, 0.7), (-1.0, -1.72, 1.7), M['azul']))
    partes.append(caja(nombre + '_w2', (0.6, 0.06, 0.55), (2.6, -1.12, 1.0), M['azul']))
    # Buganvilla trepando por la esquina
    partes += copa(nombre + '_bg', (1.9, -1.6, 1.6), (0.5, 0.3, 1.3), ['buganvilla', 'olivo2', 'buganvilla'], 14, 0.28, 7, rug=0.5)
    return unir(nombre, partes)


def buganvilla(nombre, r, semilla):
    rnd = random.Random(semilla)
    partes = copa(nombre + '_h', (0, 0, r * 0.6), (r * 1.2, r * 0.9, r * 0.6), ['olivo2', 'pinonero'], 16, r * 0.35, semilla)
    for i in range(18):
        a, e = rnd.uniform(0, 2 * math.pi), rnd.uniform(0.1, 1.2)
        partes.append(bola(f'{nombre}_f{i}', r * 0.16, (math.cos(a) * math.cos(e) * r * 1.2, math.sin(a) * math.cos(e) * r * 0.9, r * 0.6 + math.sin(e) * r * 0.6), M['buganvilla'], semilla + 40 + i, rug=0.3))
    return unir(nombre, partes)


def barca(nombre):
    o = canoa_simple(nombre + '_c', 5.0, 'casco', 'franja_azul', ancho=0.9, alto=0.7)
    franja = caja(nombre + '_f', (4.2, 1.85, 0.12), (0, 0, 0.62), M['franja_azul'])
    asiento = caja(nombre + '_s', (0.3, 1.5, 0.08), (0.4, 0, 0.75), M['viga'])
    return unir(nombre, [o, franja, asiento])
