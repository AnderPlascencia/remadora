# Renders de validación (frente, perfil, espalda, rostro) y exportación GLB. Se ejecuta dentro de vikingo.py.
def render(nombre, loc, mira, lente=85, res=(600, 900)):
    apuntar(loc, mira, lente)
    esc.render.resolution_x, esc.render.resolution_y = res
    esc.render.filepath = os.path.join(SAL, 'renders', nombre + '.png')
    bpy.ops.render.render(write_still=True)


def pose_render(accion=None, frame=1):
    if accion and rig.animation_data:
        rig.animation_data.action = bpy.data.actions[accion]
    esc.frame_set(frame)


if A.render:
    for n in REMO if 'REMO' in globals() else []:
        bpy.data.objects[n].hide_render = True
    os.makedirs(os.path.join(SAL, 'renders'), exist_ok=True)
    pose_render('preview' if 'preview' in bpy.data.actions else None, 1)
    zc = alto * 0.52
    render('frente', (0, -6.4, zc), (0, 0, zc))
    render('perfil', (6.4, 0, zc), (0, 0, zc))
    render('espalda', (0, 6.4, zc), (0, 0, zc))
    render('tres_cuartos', (-3.6, -5.2, zc + 0.3), (0, 0, zc))
    hc = hueso('head')[0].z + 0.08
    render('rostro', (0.25, -1.45, hc + 0.02), (0, 0, hc - 0.02), 85, (600, 600))
    render('retrato', (0.2, -1.9, hc - 0.05), (0, 0, hc - 0.12), 85, (512, 512))
    if 'victory' in bpy.data.actions:
        pose_render('victory', 28)
        render('victoria', (-3.6, -5.2, zc + 0.3), (0, 0, zc + 0.15))
    if 'rowing' in bpy.data.actions:
        for n in REMO:
            bpy.data.objects[n].hide_render = False
        for o in bpy.data.objects:  # el hacha no se lleva al remo
            if o.name.startswith(('Hacha', 'Cenefa')):
                o.hide_render = True
        for k, f in enumerate((1, 9, 17, 25)):
            pose_render('rowing', f)
            render(f'remo_{k}', (-4.2, -4.6, 0.75), (0, -0.3, 0.6), 85, (600, 600))

if not A.sin_glb:  # export_apply aplica suavizado, grosor y subdivisión; la armadura se exporta como piel
    for o in bpy.data.objects:
        o.select_set(o.type in ('MESH', 'ARMATURE'))
    ruta = os.path.join(SAL, 'vikingo_fuente.glb')
    bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True, export_apply=True,
                              export_animations=True, export_animation_mode='ACTIONS', export_skins=True,
                              export_morph=False, export_lights=False, export_cameras=False, export_yup=True,
                              export_image_format='AUTO', export_extras=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SAL, 'vikingo.blend'), compress=True)
    print('GLB', ruta, os.path.getsize(ruta))
