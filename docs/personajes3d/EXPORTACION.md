# Exportación y convenciones del GLB

## Convenciones

- **Unidades**: metros. **Ejes**: glTF (Y arriba). El personaje mira hacia +Z y tiene los pies en y = 0.
- **Escala**: 1,95 m de alto.
- **Nombres**: cada pieza es un nodo con nombre estable (`Capa`, `MantoPelaje`, `HachaCabeza`, `RemoMango`…). La app
  muestra u oculta piezas por nombre, así que no se unen mallas al optimizar. Three.js quita los puntos de los
  nombres (`RemoPuno.001` → `RemoPuno001`); el visor compara con el nombre ya saneado.
- **Materiales**: nombres estables (`Oro`, `Hierro`…); las variantes cambian materiales por nombre.
- **Animaciones**: una acción de Blender = un clip glTF con el mismo nombre (`preview`, `idle`, `rowing`, `victory`).
- **Piel**: hasta 4 influencias por vértice (el exportador normaliza las demás).
- **Modificadores**: se aplican al exportar (suavizado, grosor, subdivisión); la armadura se exporta como piel.

## Optimización (`exportar.sh`)

1. Blender exporta `vikingo_fuente.glb` (texturas PNG, ~24 MB) y guarda `vikingo.blend`.
2. glTF Transform 4.5.1 (`npx @gltf-transform/cli`, MIT) con `optimize`:
   geometría con `EXT_meshopt_compression`, texturas WebP, cuantización, poda y simplificación con meshoptimizer.
   Sin `join`, `flatten`, `instance` ni `palette` para conservar los nombres de las piezas.
3. `medir.mjs` imprime las medidas.

Draco no se usa: meshopt pesa parecido, decodifica más rápido y su decodificador (`meshopt_decoder.module.js`,
~20 KB) va incluido en Three.js.

## Medidas reales (29-10-2026)

| Archivo | Tamaño | Triángulos | Texturas | VRAM aprox. de texturas |
| --- | --- | --- | --- | --- |
| `vikingo.glb` | 2,83 MB | 57 804 | 21 WebP, 1024 px | ~113 MB |
| `vikingo_movil.glb` | 1,35 MB | 47 084 | 21 WebP, 512 px | ~28 MB |

Ambos: 39 mallas, 78 huesos (69 de deformación + remo + 8 auxiliares del IK), 15 materiales, 4 animaciones.

Tiempo de carga medido en el visor Three.js que se probó (y luego se quitó de la app) (Chromium sin GPU, SwiftShader, servidor local): 1,2–1,7 s con un
visor; 3 s en la ficha de la app incluyendo Three.js. En un teléfono real con GPU debería ser menor, pero **no se
midió en un dispositivo físico**.
