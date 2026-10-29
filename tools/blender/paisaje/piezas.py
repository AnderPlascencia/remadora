# Piezas de paisaje modeladas por código (pinos, abedules, rocas, juncos, casa de botes) y sus materiales.
# Las usan orilla.py (vista lateral para la carrera 3D) y costa.py (vista desde arriba para la 2D).
import bpy, bmesh, math, random
from mathutils import Vector, noise

M = {}
col = None


def material(nombre, color, rough=0.8, sss=0.0, metal=0.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if sss:
        p.inputs['Subsurface Weight'].default_value = sss
    return m


def hex_lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def preparar():
    """Crea los materiales (después de vaciar la escena)."""
    global col
    col = bpy.context.scene.collection
    M.update({
        'aguja': material('MAT-aguja', hex_lin('#1F3B2A'), 0.85, 0.1),
        'aguja2': material('MAT-aguja2', hex_lin('#2A4A30'), 0.85, 0.1),
        'tronco': material('MAT-tronco', hex_lin('#4A3426'), 0.9),
        'abedul': material('MAT-abedul', hex_lin('#DCD8CC'), 0.7),
        'hoja': material('MAT-hoja', hex_lin('#B98A2E'), 0.75, 0.15),
        'hoja2': material('MAT-hoja2', hex_lin('#7C8A2E'), 0.75, 0.15),
        'roca': material('MAT-roca', hex_lin('#4E5156'), 0.85),
        'musgo': material('MAT-musgo', hex_lin('#4A5A2E'), 0.95),
        'junco': material('MAT-junco', hex_lin('#8C8A4A'), 0.8, 0.1),
        'falu': material('MAT-falu', hex_lin('#7A2418'), 0.8),
        'cesped': material('MAT-cesped', hex_lin('#3E5A2A'), 0.95),
        'madera': material('MAT-madera', hex_lin('#3A2A1E'), 0.9),
        'blanco': material('MAT-blanco', hex_lin('#E8E2D4'), 0.6),
    })


def nuevo(nombre, bm, mat):
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(nombre, me)
    col.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


def rugoso(ob, fuerza, escala, semilla):
    for v in ob.data.vertices:
        n = noise.noise_vector(v.co * escala + Vector((semilla, semilla * 2, 0)))
        v.co += n * fuerza


def cono(nombre, r, h, z, mat, seg=14, semilla=0, rug=0.12):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=0.0, depth=h)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, z + h / 2))
    # Borde dentado: las ramas caen y se abren en puntas
    for v in bm.verts:
        if abs(v.co.z - z) < 1e-4 and v.co.xy.length > 0.01:
            k = 1 + 0.25 * math.sin(math.atan2(v.co.y, v.co.x) * 7 + semilla)
            v.co.x *= k
            v.co.y *= k
            v.co.z -= 0.12 * h * k
    ob = nuevo(nombre, bm, mat)
    rugoso(ob, rug, 1.8, semilla)
    return ob


def cilindro(nombre, r1, r2, h, mat, z=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r1, radius2=r2, depth=h)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, z + h / 2))
    return nuevo(nombre, bm, mat)


def bola(nombre, r, centro, mat, semilla, rug=0.25):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=r)
    bmesh.ops.translate(bm, verts=bm.verts, vec=centro)
    ob = nuevo(nombre, bm, mat)
    rugoso(ob, r * rug, 1.5 / r, semilla)
    return ob


def unir(nombre, obs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    obs[0].name = nombre
    return obs[0]


# ── Piezas ──
def pino(nombre, alto, semilla):
    partes = [cilindro(nombre + '_t', 0.18, 0.06, alto * 0.95, M['tronco'])]
    n = 7
    for i in range(n):
        f = i / (n - 1)
        z = alto * (0.18 + 0.72 * f)
        r = alto * 0.26 * (1 - f) ** 0.9 + 0.25
        partes.append(cono(f'{nombre}_c{i}', r, alto * 0.24, z - alto * 0.06, M['aguja' if i % 2 else 'aguja2'], semilla=semilla + i))
    return unir(nombre, partes)


def abedul(nombre, alto, semilla, hoja):
    rnd = random.Random(semilla)
    partes = [cilindro(nombre + '_t', 0.14, 0.05, alto, M['abedul'])]
    # Copa suelta: muchas matas pequeñas alrededor del tronco, más abiertas abajo
    for i in range(26):
        a = rnd.uniform(0, 2 * math.pi)
        zf = rnd.uniform(0.45, 0.97)
        rr = rnd.uniform(0.2, alto * 0.2 * (1.15 - zf))
        c = (math.cos(a) * rr, math.sin(a) * rr, alto * zf)
        partes.append(bola(f'{nombre}_h{i}', rnd.uniform(0.6, 1.0) * alto * 0.065, c, M[hoja if i % 4 else 'hoja2'], semilla + i, rug=0.4))
    return unir(nombre, partes)


def roca(nombre, r, semilla):
    o = bola(nombre, r, (0, 0, r * 0.35), M['roca'], semilla, rug=0.35)
    o.scale = (1.3, 1.0, 0.7)
    # Musgo encima: segundo material en las caras que miran arriba
    o.data.materials.append(M['musgo'])
    for p in o.data.polygons:
        if p.normal.z > 0.65:
            p.material_index = 1
    return o


def juncos(nombre, semilla):
    rnd = random.Random(semilla)
    partes = []
    for i in range(22):
        h = rnd.uniform(0.7, 1.4)
        c = cilindro(f'{nombre}_{i}', 0.025, 0.004, h, M['junco'])
        c.location = (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.3, 0.3), 0)
        c.rotation_euler = (rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), 0)
        partes.append(c)
    bpy.context.view_layer.update()
    for c in partes:
        c.select_set(True)
    o = unir(nombre, partes)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


def casa(nombre):
    # Casa de botes nórdica: madera roja «falu», esquinas blancas y tejado de césped
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(4.0, 6.0, 2.4), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 1.2))
    paredes = nuevo(nombre + '_p', bm, M['falu'])
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(-2.4, -3.3, 2.3), (2.4, -3.3, 2.3), (0, -3.3, 4.0), (-2.4, 3.3, 2.3), (2.4, 3.3, 2.3), (0, 3.3, 4.0)]]
    for f in [(0, 2, 5, 3), (1, 4, 5, 2), (0, 1, 2), (3, 5, 4), (0, 3, 4, 1)]:
        bm.faces.new([v[i] for i in f])
    techo = nuevo(nombre + '_t', bm, M['cesped'])
    rugoso(techo, 0.06, 3, 4)
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(-1.9, 3.01, 2.2), (1.9, 3.01, 2.2), (0, 3.01, 3.5)]]
    bm.faces.new(v)
    frontis = nuevo(nombre + '_f', bm, M['falu'])
    partes = [paredes, techo, frontis]
    for sx in (-2.02, 2.02):
        for sy in (-3.02, 3.02):
            e = cilindro(f'{nombre}_e{sx}{sy}', 0.09, 0.09, 2.4, M['blanco'])
            e.location = (sx, sy, 0)
            partes.append(e)
    puerta = cilindro(nombre + '_d', 0.01, 0.01, 0.01, M['madera'])
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(2.2, 0.08, 1.9), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 3.02, 0.95))
    portón = nuevo(nombre + '_po', bm, M['madera'])
    partes += [puerta, portón]
    o = unir(nombre, partes)
    return o


