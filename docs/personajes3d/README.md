# Personajes 3D (experimental, fuera de la app)

Pipeline para construir el vikingo en Blender por script y exportarlo a GLB. **La app no lo usa**: se probó un visor
Three.js en la ficha del héroe y se quitó a favor de las ilustraciones 2D. Queda aquí para retomarlo o para
generar renders.

| Documento | Contenido |
| --- | --- |
| [PIPELINE.md](PIPELINE.md) | Cómo se construye el personaje en Blender: cuerpo, equipo, materiales, rig y animaciones |
| [EXPORTACION.md](EXPORTACION.md) | Convenciones del GLB, optimización y medidas reales |
| [LIMITACIONES.md](LIMITACIONES.md) | Lo que falta y decisiones tomadas |

![Vistas frente, perfil, espalda y victoria (Cycles)](img/vistas_blender.webp)
![Palada completa (rowing)](img/remo_blender.webp)

## Archivos

| Ruta | Qué es |
| --- | --- |
| `tools/blender/makehuman/` | Malla base, objetivos de forma, esqueleto, pesos y ojos de MakeHuman (CC0) y `mh.py`, que los lee sin instalar MakeHuman |
| `tools/blender/vikingo/vikingo.py` | Script principal: cuerpo y rig; ejecuta `escena.py`, `equipo.py`, `animaciones.py` y `salidas.py` |
| `tools/blender/vikingo/vikingo.blend` | Escena de Blender resultante, para retocar a mano |
| `tools/blender/vikingo/exportar.sh` | Construye y optimiza los GLB (en `tools/blender/vikingo/salida/`, ignorado por git) |
| `tools/blender/vikingo/medir.mjs` | Mide un GLB (MB, triángulos, huesos, texturas, animaciones) |
