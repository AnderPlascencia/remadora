# Piezas de la laguna tropical modeladas por código: palmeras, arbustos con flores, rocas volcánicas, matas de
# playa, un fare (cabaña con techo de hojas) y una canoa con balancín. Usan los ayudantes de ../piezas.py.
# Las usan orilla.py (vista lateral para la carrera 3D) y costa.py (vista desde arriba para la 2D).
import bpy, bmesh, math, random, os, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import piezas  # noqa: E402
from piezas import M, material, hex_lin, nuevo, rugoso, cilindro, bola, unir  # noqa: E402


def preparar():
    piezas.col = bpy.context.scene.collection
    M.update({
        'tronco': material('MAT-tronco-palma', hex_lin('#8A7458'), 0.9),
        'anillo': material('MAT-anillo', hex_lin('#5E4C38'), 0.95),
        'fronda': material('MAT-fronda', hex_lin('#2F7A24'), 0.6, 0.2),
        'fronda2': material('MAT-fronda2', hex_lin('#5E9A2A'), 0.6, 0.2),
        'seca': material('MAT-fronda-seca', hex_lin('#9C8A4A'), 0.8, 0.1),
        'coco': material('MAT-coco', hex_lin('#6B4A22'), 0.7),
        'hoja': material('MAT-hoja-tropical', hex_lin('#1E5A22'), 0.45, 0.15),
        'flor': material('MAT-hibisco', hex_lin('#E0303A'), 0.55, 0.2),
        'flor2': material('MAT-flor-rosa', hex_lin('#F06AA0'), 0.55, 0.2),
        'basalto': material('MAT-basalto', hex_lin('#3A3634'), 0.8),
        'mata': material('MAT-mata', hex_lin('#7EA040'), 0.75, 0.1),
        'paja': material('MAT-paja', hex_lin('#B8925A'), 0.95),
        'bambu': material('MAT-bambu', hex_lin('#C9B07A'), 0.8),
        'madera': material('MAT-madera-oscura', hex_lin('#5A3A22'), 0.85),
        'canoa': material('MAT-canoa', hex_lin('#7A4626'), 0.6),
        'franja': material('MAT-canoa-franja', hex_lin('#E8E0C8'), 0.6),
    })


def _tubo(bm, puntos, radios, seg=12, anillos=True):
    """Tubo a lo largo de una polilínea; con anillos marcados como el tronco de una palmera."""
    capas = []
    for i, (p, r) in enumerate(zip(puntos, radios)):
        t = (puntos[min(i + 1, len(puntos) - 1)] - puntos[max(i - 1, 0)]).normalized()
        a = t.orthogonal().normalized()
        b = t.cross(a)
        rr = r * (1.08 if anillos and i % 2 else 1.0)
        capas.append([bm.verts.new(p + (a * math.cos(2 * math.pi * k / seg) + b * math.sin(2 * math.pi * k / seg)) * rr) for k in range(seg)])
    for c0, c1 in zip(capas, capas[1:]):
        for k in range(seg):
            bm.faces.new((c0[k], c0[(k + 1) % seg], c1[(k + 1) % seg], c1[k]))
    bm.faces.new(list(reversed(capas[0])))
    bm.faces.new(capas[-1])


def palmera(nombre, alto, semilla, curva=1.0):
    rnd = random.Random(semilla)
    # Tronco curvado hacia el agua (-Y en la vista lateral queda hacia la cámara; se inclina en +X)
    n = 22
    pts = [Vector((curva * alto * 0.28 * (i / n) ** 2, 0, alto * i / n)) for i in range(n + 1)]
    rad = [0.24 - 0.1 * (i / n) for i in range(n + 1)]
    bm = bmesh.new()
    _tubo(bm, pts, rad)
    partes = [nuevo(nombre + '_t', bm, M['tronco'])]
    cima = pts[-1]
    # Frondas: espina que se arquea hacia abajo, con foliolos a los dos lados que cuelgan
    nf = 11
    for f in range(nf):
        az = 2 * math.pi * f / nf + rnd.uniform(-0.2, 0.2)
        sube = math.radians(rnd.uniform(15, 50))
        largo = alto * rnd.uniform(0.38, 0.5)
        seca = f == nf - 1 and rnd.random() < 0.7
        bm = bmesh.new()
        pasos = 16
        p = cima.copy()
        d = Vector((math.cos(az) * math.cos(sube), math.sin(az) * math.cos(sube), math.sin(sube)))
        lado = Vector((-math.sin(az), math.cos(az), 0))
        if seca:
            d = Vector((d.x * 0.4, d.y * 0.4, -0.9)).normalized()
        prev = None
        for i in range(pasos):
            t = i / (pasos - 1)
            q = p + d * (largo / pasos)
            d = (d + Vector((0, 0, -0.16))).normalized()
            ancho = largo * 0.22 * math.sin(math.pi * min(1, t * 1.15)) + 0.02
            caida = Vector((0, 0, -ancho * 0.55))
            # Espina como cinta fina y dos foliolos (triángulos) por paso
            v = [bm.verts.new(p + lado * 0.03), bm.verts.new(p - lado * 0.03), bm.verts.new(q - lado * 0.02), bm.verts.new(q + lado * 0.02)]
            bm.faces.new(v)
            if i > 0:
                for s in (1, -1):
                    for j in range(2):
                        base = p.lerp(q, j * 0.5)
                        punta = base + lado * s * ancho + caida + d * (largo / pasos) * 0.9
                        bm.faces.new((bm.verts.new(base), bm.verts.new(base + d * (largo / pasos) * 0.45), bm.verts.new(punta)))
            p = q
        partes.append(nuevo(f'{nombre}_f{f}', bm, M['seca' if seca else ('fronda' if f % 3 else 'fronda2')]))
    for k in range(rnd.randint(2, 4)):
        a = rnd.uniform(0, 2 * math.pi)
        partes.append(bola(f'{nombre}_c{k}', 0.13, cima + Vector((math.cos(a) * 0.22, math.sin(a) * 0.22, -0.25)), M['coco'], semilla + k, rug=0.1))
    return unir(nombre, partes)


def arbusto(nombre, r, semilla, flor='flor'):
    rnd = random.Random(semilla)
    partes = []
    for i in range(18):
        a = rnd.uniform(0, 2 * math.pi)
        rr = rnd.uniform(0, r * 0.7)
        c = (math.cos(a) * rr * 1.3, math.sin(a) * rr, r * 0.35 + rnd.uniform(0, r * 0.6) * (1 - rr / r))
        partes.append(bola(f'{nombre}_h{i}', r * rnd.uniform(0.32, 0.5), c, M['hoja'], semilla + i, rug=0.35))
    for i in range(14):
        a = rnd.uniform(0, 2 * math.pi)
        e = rnd.uniform(0.2, 1.2)
        c = (math.cos(a) * math.cos(e) * r * 0.9 * 1.3, math.sin(a) * math.cos(e) * r * 0.9, r * 0.4 + math.sin(e) * r * 0.75)
        partes.append(bola(f'{nombre}_f{i}', r * 0.09, c, M[flor if i % 3 else 'flor2'], semilla + 50 + i, rug=0.2))
    return unir(nombre, partes)


def roca(nombre, r, semilla):
    o = bola(nombre, r, (0, 0, r * 0.3), M['basalto'], semilla, rug=0.45)
    o.scale = (1.4, 1.0, 0.65)
    return o


def matas(nombre, semilla):
    rnd = random.Random(semilla)
    partes = []
    for i in range(28):
        h = rnd.uniform(0.35, 0.8)
        c = cilindro(f'{nombre}_{i}', 0.03, 0.004, h, M['mata' if i % 4 else 'seca'])
        c.location = (rnd.uniform(-0.5, 0.5), rnd.uniform(-0.25, 0.25), 0)
        c.rotation_euler = (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), 0)
        partes.append(c)
    bpy.context.view_layer.update()
    o = unir(nombre, partes)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


def fare(nombre):
    # Cabaña polinesia: suelo elevado sobre pilotes, paredes de bambú y techo de hojas a cuatro aguas muy volado
    partes = []
    for sx in (-1.9, 1.9):
        for sy in (-1.4, 1.4):
            p = cilindro(f'{nombre}_p{sx}{sy}', 0.09, 0.09, 0.6, M['madera'])
            p.location = (sx, sy, 0)
            partes.append(p)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(4.2, 3.2, 0.15), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 0.67))
    partes.append(nuevo(nombre + '_s', bm, M['madera']))
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(3.6, 2.6, 1.8), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 0.75 + 0.9))
    partes.append(nuevo(nombre + '_m', bm, M['bambu']))
    # Puerta oscura en el frente que mira a la cámara (-Y)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(0.9, 0.05, 1.35), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0.6, -1.31, 0.75 + 0.68))
    partes.append(nuevo(nombre + '_d', bm, M['madera']))
    bm = bmesh.new()
    z0, z1, ox, oy = 2.35, 4.9, 2.7, 2.05
    v = [bm.verts.new(p) for p in [(-ox, -oy, z0), (ox, -oy, z0), (ox, oy, z0), (-ox, oy, z0), (-0.7, 0, z1), (0.7, 0, z1)]]
    for f in [(0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4), (0, 3, 2, 1)]:
        bm.faces.new([v[i] for i in f])
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=6, use_grid_fill=True)
    techo = nuevo(nombre + '_t', bm, M['paja'])
    rugoso(techo, 0.07, 4, 9)
    partes.append(techo)
    return unir(nombre, partes)


def canoa(nombre):
    # Va'a: casco alargado con franja clara, balancín (ama) y dos brazos (iato)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1)
    for v in bm.verts:
        v.co.x *= 3.2
        v.co.y *= 0.38
        v.co.z = min(v.co.z, 0.15) * 0.45
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 0.32))
    casco = nuevo(nombre + '_c', bm, M['canoa'])
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=1)
    for v in bm.verts:
        v.co.x *= 1.8
        v.co.y *= 0.13
        v.co.z *= 0.12
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 1.7, 0.14))
    ama = nuevo(nombre + '_a', bm, M['franja'])
    partes = [casco, ama]
    for x in (-0.9, 0.9):
        b = cilindro(f'{nombre}_i{x}', 0.04, 0.04, 1.9, M['madera'])
        b.rotation_euler = (math.radians(-90), 0, 0)
        b.location = (x, -0.1, 0.42)
        partes.append(b)
    return unir(nombre, partes)
