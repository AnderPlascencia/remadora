# Añadir una clase en 3D

1. **Script de Blender**: copia `tools/blender/vikingo/` a `tools/blender/<clase>/`. Reutiliza `vikingo.py`
   (cuerpo y rig) cambiando `TARGETS` para el físico; reescribe `equipo.py` con la ropa de la clase. Mantén:
   - las mismas convenciones de nombres de huesos (las animaciones de `animaciones.py` sirven tal cual si el
     esqueleto es el mismo);
   - nombres de objeto únicos y estables para cada pieza que vaya a cambiar con el nivel;
   - los pies en z = 0 (`rig.location.z = -Z_SUELO`).
2. **Validar en Blender**: `--render` y revisar frente, perfil, espalda, rostro, victoria y las 4 fases del remo.
3. **Exportar**: adapta `exportar.sh` (destino `assets/personajes3d/<clase>/`) y comprueba con `medir.mjs` que queda
   por debajo de ~50k triángulos y ~1,5 MB en la versión móvil.
4. **Configurar** en `personajes3d/config.js` una entrada como la de `vikingo`: `modelos`, `altura`,
   `animaciones`, `soloEn` / `ocultarEn` y `variantes` (`desde`, `nombre`, `agrega`, `materiales`). La clave debe
   ser la de `J.CLASES` (`pirata`, `polinesio`, `romano`, `samurai`).
5. **Probar**: `node pruebas/personajes3d.test.mjs` comprueba que existen todas las piezas, materiales y
   animaciones que nombra la configuración. Mira el resultado en
   `tools/personajes3d/visor-prueba.html?clase=<clase>&anim=idle`.
6. **Service worker**: añade el GLB móvil a `VISOR_3D` en `sw.js` y sube `VERSION`.

Con eso la ficha y el panel de entrenamiento usan el modelo sin tocar `app.js`.
