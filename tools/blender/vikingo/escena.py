# Materiales PBR, texturas procedurales horneadas a imagen, luces y cámaras. Se ejecuta dentro de vikingo.py.
import numpy as np

TEX = os.path.join(SAL, 'texturas')
os.makedirs(TEX, exist_ok=True)
RES = 1024
rng = np.random.default_rng(7)


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---------- ruido y texturas con numpy ----------
def ruido(n=RES, escalas=(4, 8, 16, 32, 64), pesos=None, semilla=0):
    g = np.random.default_rng(semilla)
    pesos = pesos or [1 / (i + 1) for i in range(len(escalas))]
    acc = np.zeros((n, n), np.float32)
    for e, p in zip(escalas, pesos):
        base = g.random((e, e)).astype(np.float32)
        # interpolación bicúbica periódica (repetible sin costuras)
        idx = np.linspace(0, e, n, endpoint=False)
        i0 = np.floor(idx).astype(int); t = idx - i0
        t = t * t * (3 - 2 * t)
        a = base[np.ix_(i0 % e, i0 % e)]; b = base[np.ix_(i0 % e, (i0 + 1) % e)]
        c = base[np.ix_((i0 + 1) % e, i0 % e)]; d = base[np.ix_((i0 + 1) % e, (i0 + 1) % e)]
        tx = t[None, :]; ty = t[:, None]
        acc += p * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty)
    acc -= acc.min(); acc /= acc.max()
    return acc


def normal_de_altura(h, fuerza=2.0):
    gy, gx = np.gradient(h.astype(np.float32))
    n = np.dstack((-gx * fuerza * h.shape[0] / 256, gy * fuerza * h.shape[0] / 256, np.ones_like(h)))
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return (n * 0.5 + 0.5)


def guardar(nombre, arr, gris=False):
    from PIL import Image
    a = np.clip(arr, 0, 1)
    if gris:
        im = Image.fromarray((a * 255).astype(np.uint8), 'L')
    else:
        im = Image.fromarray((a[..., :3] * 255).astype(np.uint8), 'RGB')
    ruta = os.path.join(TEX, nombre + '.png')
    im.save(ruta)
    img = bpy.data.images.load(ruta)
    img.name = nombre
    return img


def mezcla(c1, c2, t):
    c1 = np.array(c1)[None, None, :]; c2 = np.array(c2)[None, None, :]
    return c1 * (1 - t[..., None]) + c2 * t[..., None]


def hex_lin(h):  # color lineal → para mezclar en sRGB usamos el hex directo
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


# ---------- material PBR con mapas ----------
def material(nombre, color=None, rough=0.6, metal=0.0, mapa_color=None, mapa_normal=None, mapa_rough=None, fuerza_normal=1.0, sss=0.0, alfa=None, emision=None):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    if color:
        b.inputs['Base Color'].default_value = (*srgb(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if sss:
        b.inputs['Subsurface Weight'].default_value = sss
        b.inputs['Subsurface Radius'].default_value = (1.0, 0.4, 0.25)
        b.inputs['Subsurface Scale'].default_value = 0.01
    if mapa_color:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = mapa_color
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
        if alfa:
            nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
            m.blend_method = 'HASHED' if hasattr(m, 'blend_method') else None
    if mapa_rough:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = mapa_rough; mapa_rough.colorspace_settings.name = 'Non-Color'
        nt.links.new(t.outputs['Color'], b.inputs['Roughness'])
    if mapa_normal:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = mapa_normal; mapa_normal.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = fuerza_normal
        nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m


# Piel: tono cálido curtido, poros y rubor en la UV de MakeHuman
n1 = ruido(escalas=(8, 32, 128, 256), pesos=(0.4, 0.3, 0.2, 0.1), semilla=1)
n2 = ruido(escalas=(256, 512), pesos=(0.6, 0.4), semilla=2)
piel_c = mezcla(hex_lin('#B97E5E'), hex_lin('#93583E'), n1 * 0.8)
piel_c = piel_c * (0.94 + 0.08 * n2[..., None])
IMG = {}
IMG['piel_c'] = guardar('piel_color', piel_c)
IMG['piel_n'] = guardar('piel_normal', normal_de_altura(n2 * 0.6 + n1 * 0.4, 0.6))
IMG['piel_r'] = guardar('piel_rugosidad', 0.5 + 0.15 * n2, gris=True)

# Cuero: grano + arañazos
grano = ruido(escalas=(64, 128, 256), pesos=(0.3, 0.4, 0.3), semilla=3)
manchas = ruido(escalas=(4, 8, 16), semilla=4)
ara = np.zeros((RES, RES), np.float32)
for _ in range(140):
    x, y = rng.integers(0, RES, 2); L = rng.integers(10, 60); ang = rng.random() * math.pi
    for k in range(L):
        xx = int(x + math.cos(ang) * k) % RES; yy = int(y + math.sin(ang) * k) % RES
        ara[yy, xx] = 1
cuero_h = grano * 0.7 - ara * 0.5 + manchas * 0.3
def cuero_color(c1, c2):
    return mezcla(hex_lin(c1), hex_lin(c2), np.clip(manchas * 0.9 + grano * 0.3 - ara * 0.3, 0, 1))
IMG['cuero_c'] = guardar('cuero_color', cuero_color('#7A4E2E', '#4A2D1A'))
IMG['cueroOsc_c'] = guardar('cuero_oscuro_color', cuero_color('#4A3628', '#251A12'))
IMG['cuero_n'] = guardar('cuero_normal', normal_de_altura(cuero_h, 1.2))
IMG['cuero_r'] = guardar('cuero_rugosidad', 0.45 + 0.35 * grano - 0.15 * ara, gris=True)

# Lana: tejido de sarga
yy, xx = np.mgrid[0:RES, 0:RES].astype(np.float32)
sarga = (np.sin((xx + yy) * 2 * math.pi / 12) * 0.5 + 0.5) * 0.6 + (np.sin(xx * 2 * math.pi / 6) * 0.5 + 0.5) * 0.4
fibra = ruido(escalas=(128, 512), semilla=5)
IMG['lana_c'] = guardar('lana_color', mezcla(hex_lin('#2F4F80'), hex_lin('#1A2C4C'), np.clip(sarga * 0.4 + manchas * 0.5 + fibra * 0.2, 0, 1)))
IMG['lana_n'] = guardar('lana_normal', normal_de_altura(sarga * 0.7 + fibra * 0.3, 0.8))

# Metal envejecido (latón y hierro): pulido en relieves, sucio en huecos
IMG['metal_r'] = guardar('metal_rugosidad', np.clip(0.25 + 0.35 * manchas + 0.2 * ara, 0, 1), gris=True)
IMG['metal_n'] = guardar('metal_normal', normal_de_altura(grano * 0.3 - ara * 0.6, 0.6))

# Pelo: mechones en la dirección V
fibras = ruido(n=RES, escalas=(256, 512), semilla=6)
mech = np.repeat(rng.random((1, RES)).astype(np.float32), RES, axis=0)
mech = 0.6 * mech + 0.4 * np.repeat(ruido(escalas=(64,), semilla=8)[:1, :], RES, axis=0)
pelo_h = mech * 0.8 + fibras * 0.2
IMG['pelo_c'] = guardar('pelo_color', mezcla(hex_lin('#8C4A24'), hex_lin('#3E1A0A'), np.clip(1 - mech * 0.9 + manchas * 0.2, 0, 1)))
IMG['pelo_n'] = guardar('pelo_normal', normal_de_altura(pelo_h, 1.5))
IMG['pelo_r'] = guardar('pelo_rugosidad', 0.35 + 0.3 * (1 - mech), gris=True)

# Pelaje: mechones cortos en todas direcciones
pel = ruido(escalas=(32, 128, 512), pesos=(0.3, 0.4, 0.3), semilla=9)
IMG['pelaje_c'] = guardar('pelaje_color', mezcla(hex_lin('#A08A70'), hex_lin('#463829'), np.clip(1 - pel * 1.1 + manchas * 0.3, 0, 1)))
IMG['pelaje_n'] = guardar('pelaje_normal', normal_de_altura(pel, 2.5))

# Madera de fresno
veta = np.sin(xx * 2 * math.pi / 40 + ruido(escalas=(4, 16), semilla=10) * 12) * 0.5 + 0.5
IMG['madera_c'] = guardar('madera_color', mezcla(hex_lin('#9A6A3E'), hex_lin('#5A3A1E'), np.clip(veta * 0.7 + grano * 0.3, 0, 1)))
IMG['madera_n'] = guardar('madera_normal', normal_de_altura(veta * 0.5 + grano * 0.5, 0.8))

MAT = {
    'piel': material('Piel', mapa_color=IMG['piel_c'], mapa_normal=IMG['piel_n'], mapa_rough=IMG['piel_r'], fuerza_normal=0.35, sss=0.15),
    'pelo': material('Pelo', mapa_color=IMG['pelo_c'], mapa_normal=IMG['pelo_n'], mapa_rough=IMG['pelo_r'], fuerza_normal=1.0),
    'cuero': material('Cuero', mapa_color=IMG['cuero_c'], mapa_normal=IMG['cuero_n'], mapa_rough=IMG['cuero_r']),
    'cueroOsc': material('CueroOscuro', mapa_color=IMG['cueroOsc_c'], mapa_normal=IMG['cuero_n'], mapa_rough=IMG['cuero_r']),
    'lana': material('Lana', mapa_color=IMG['lana_c'], mapa_normal=IMG['lana_n'], rough=0.9),
    'laton': material('Laton', color='#D8A04A', metal=1.0, mapa_rough=IMG['metal_r'], mapa_normal=IMG['metal_n'], fuerza_normal=0.5),
    'oro': material('Oro', color='#F2C46A', metal=1.0, rough=0.22, mapa_normal=IMG['metal_n'], fuerza_normal=0.3),
    'hierro': material('Hierro', color='#9AA4AA', metal=1.0, mapa_rough=IMG['metal_r'], mapa_normal=IMG['metal_n'], fuerza_normal=0.6),
    'madera': material('Madera', mapa_color=IMG['madera_c'], mapa_normal=IMG['madera_n'], rough=0.6),
    'pelaje': material('Pelaje', mapa_color=IMG['pelaje_c'], mapa_normal=IMG['pelaje_n'], rough=0.95, fuerza_normal=1.4),
    'tela': material('Lino', color='#B8A888', rough=0.9, mapa_normal=IMG['lana_n'], fuerza_normal=0.4),
    'hueso': material('Hueso', color='#D9CDB0', rough=0.5, mapa_normal=IMG['cuero_n'], fuerza_normal=0.3),
    'tatuaje': material('Tatuaje', color='#1E3550', rough=0.6),
}
cuerpo.data.materials.append(MAT['piel'])

# ---------- luces de estudio coherentes con ROWR ----------
mundo = bpy.data.worlds.new('Mundo'); esc.world = mundo
mundo.use_nodes = True
mundo.node_tree.nodes['Background'].inputs['Color'].default_value = (*srgb('#0E1A24'), 1)
mundo.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8


def luz(nombre, tipo, loc, energia, color, tam=1.0, mira=(0, 0, 1.1)):
    l = bpy.data.lights.new(nombre, tipo); l.energy = energia; l.color = color
    if tipo == 'AREA':
        l.size = tam
    o = bpy.data.objects.new(nombre, l); col.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(mira) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


luz('Clave', 'AREA', (-2.4, -3.2, 3.4), 1000, srgb('#FFEBD2'), 2.2)
luz('Contra', 'AREA', (2.4, 2.8, 2.6), 1300, srgb('#8FC0F2'), 1.5)
luz('ContraCalida', 'AREA', (-2.6, 2.6, 2.0), 600, srgb('#F4BE6A'), 1.2)
luz('Relleno', 'AREA', (2.8, -3.4, 1.2), 220, srgb('#A9C8E8'), 3.0)

cam_d = bpy.data.cameras.new('Camara'); cam_d.lens = 85
CAM = bpy.data.objects.new('Camara', cam_d); col.objects.link(CAM); esc.camera = CAM


def apuntar(loc, mira, lente=85):
    CAM.location = loc; cam_d.lens = lente
    CAM.rotation_euler = (Vector(mira) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


esc.render.engine = 'CYCLES'
esc.cycles.device = 'CPU'
esc.cycles.samples = A.muestras
esc.cycles.use_denoising = True
esc.render.film_transparent = True
esc.render.image_settings.file_format = 'PNG'
esc.render.image_settings.color_mode = 'RGBA'
esc.view_settings.view_transform = 'AgX'
esc.view_settings.look = 'AgX - Medium High Contrast'
