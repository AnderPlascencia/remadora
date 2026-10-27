# Pipeline de assets de personajes

## 1. Contexto técnico

- **Motor:** no hay. Rower es una PWA en JavaScript sin dependencias (módulos ES, DOM, SVG y Canvas 2D), publicada en GitHub Pages.
- **Cómo se ve hoy el héroe:** `objetos.js → dibujarHeroe()` genera un SVG en tiempo real (84, 72 y 180 px).
- **Consecuencia:** el formato natural es **SVG generado por código**. El PNG se exporta para revisión, compartir, atlas y posibles usos futuros en Canvas.

## 2. Herramientas evaluadas

| Herramienta | Qué es | Requisitos | Costes y credenciales | Licencia | Estado en este proyecto |
|---|---|---|---|---|---|
| `create-game-assets` (gamedev-skills/awesome-gamedev-agent-skills) | Skill de dirección de arte: brief, manifiesto, normalización y control de calidad. No genera imágenes por sí misma. | `npx skills add …` (Node 22.20+). Sus scripts de control de calidad usan Python 3.10+ y Pillow. | Ninguno. Delega la generación en una herramienta de imagen si existe. | Apache-2.0 | **No instalada.** Leí su `SKILL.md` y su referencia de dirección de arte, y sigo su flujo a mano: brief → objetivo aprobado → familia → normalización → control de calidad → procedencia. El manifiesto adapta su plantilla. |
| `agent-sprite-forge` (0x0funky) | Plugin de Claude Code: convierte una imagen aprobada en clips de acción, los procesa con Python y FFmpeg y exporta a Godot, Aseprite o web | Plugin y marketplace, Python 3.10+ con numpy, Pillow y scipy, FFmpeg 5.1+ | Necesita clave de OpenAI, Gemini, xAI, BytePlus o fal (de pago, sin tope por defecto) o la CLI de Codex o Grok con suscripción. Tiene un modo «code art» sin proveedor. | MIT (el código; las imágenes generadas siguen los términos de cada proveedor) | **No instalada.** No hay credenciales de esos proveedores en el entorno. Hay FFmpeg, falta scipy. |
| `sprite-gen` (aldegad) | CLI en Python: quita el fondo croma, extrae fotogramas, genera atlas y `manifest.json` con rectángulos y fps | Python 3.11+, Pillow, NumPy. Para bucles de vídeo, FFmpeg e img2webp. | Proveedores Codex, Grok u OpenAI (de pago por llamada con clave). | Apache-2.0 | **No instalada.** Solo aportaría valor con imágenes rasterizadas generadas por IA. Con vectores no hace falta quitar fondo. |

**Decisión propuesta:** producir con el generador vectorial propio, que es local, gratuito, reproducible y garantiza consistencia. Si más adelante se quieren texturas pintadas o animaciones complejas, se puede autorizar un proveedor de imagen con presupuesto y usar `agent-sprite-forge` o `sprite-gen` sobre los maestros aprobados como referencia. No se ha instalado nada ni hay costes.

## 3. Estructura

```
assets/characters/
  approvals.json                 estado de aprobación por clase/rango (único lugar editable a mano)
  manifest.json                  generado; refleja los archivos que existen
  _qa/contact_<rango|clase>.png  hojas de contacto de revisión
  _source/lamina_clases_v1.png   lámina original aportada por el usuario
  <clase>/<rango>/
    <clase>_<rango>.svg          fuente vectorial (solo assets del generador v2)
    <clase>_<rango>_full.png     cuerpo entero 720×840, RGBA
    <clase>_<rango>_portrait.png retrato 256×256, RGBA
    meta.json                    parámetros, herramienta, versión del maestro, procedencia
    notes.md                     (opcional) notas de revisión
tools/
  characters/spec.mjs            clases, rangos, paletas, formato (fuente única)
  characters/generator.mjs       generador SVG
  extract-sheet.py               recorta los 45 personajes de la lámina (fuente vigente)
  render-characters.mjs          exporta SVG + PNG + meta (generador v2, respaldo)
  ingest-character.mjs           importa una imagen suelta sobre fondo croma
  build-manifest.mjs             reconstruye manifest.json
  validate-assets.mjs            validación técnica y reporte
  contact-sheet.mjs              hoja de contacto
  lib/png.mjs, lib/assets.mjs    lector PNG sin dependencias y utilidades
```

Los ids son estables y en minúsculas: clases `vikingo|pirata|samurai|polinesio|romano`, rangos `novato|aprendiz|combatiente|guerrero|veterano|campeon|elite|maestro|legendario`. Las futuras animaciones irán en `<clase>/<rango>/anim/<animación>.png` más `.json`.

## 4. Comandos

Requisitos: Node 22 y Playwright con Chromium, que ya vienen en el entorno. No hacen falta paquetes npm del repo.

```bash
python3 tools/extract-sheet.py               # recorta los 45 personajes de la lámina (Pillow + NumPy)
node tools/render-characters.mjs             # generador vectorial v2 (respaldo)
node tools/build-manifest.mjs                # reconstruye el manifiesto
node tools/validate-assets.mjs               # valida; código 1 si hay errores
node tools/validate-assets.mjs --strict      # además exige las 45 combinaciones
node tools/contact-sheet.mjs                 # hoja de contacto de los maestros
node tools/contact-sheet.mjs --class vikingo # comparativa de los 9 rangos de una clase
```

## 5. Puertas de calidad

1. **Maestro antes que variantes.** `render-characters.mjs` no genera un rango superior si el Principiante de su clase no está `approved` en `approvals.json`.
2. **No se sobrescribe lo aprobado.** Si un asset está `approved`, se omite salvo que se use `--force`.
3. **Validación técnica** (`validate-assets.mjs`):
   - estructura y nombres;
   - archivos faltantes o inesperados;
   - dimensiones;
   - canal alfa, esquinas transparentes y transparencia mínima del 20 % (detecta fondos horneados);
   - contenido a menos de 4 px del borde (recortes);
   - base de los pies frente al pivote;
   - SVG de la clase y el rango correctos;
   - campos de `meta.json`;
   - estados válidos;
   - manifiesto coherente con el disco (rutas, dimensiones, tamaño en bytes y estado).
4. **Revisión artística manual** en la hoja de contacto: transparencia, fondo de la app, silueta en negro y tamaños de 180, 84 y 48 px. Que pasen los scripts **no** aprueba la calidad artística.
5. **Aprobación:** se cambia `estado` a `approved` en `approvals.json` (o `rejected` con notas) y se vuelve a ejecutar `build-manifest.mjs`.

Los scripts se pueden ejecutar las veces que haga falta. Los JSON se escriben de forma atómica y el manifiesto no lleva marcas de tiempo, así que la misma entrada da el mismo resultado.

## 6. Integración en la app (después de aprobar)

Hecho en la versión 0.10.0. `python3 tools/build-app-assets.py` genera en `assets/heroes/` versiones WebP ligeras de los assets aprobados (cuerpo 360×420 y busto 168×168, 1,7 MB en total). La app elige la imagen con `juego.js → rangoDe(nivel)`: el busto en la ficha y en la elección de clase, y el cuerpo entero con el aura equipada en el armario. Las prendas de cabeza, cara y torso todavía se dibujan solo en las miniaturas de objeto, no sobre la ilustración. Las clases de la app (explorador, monje y gladiador) se migran a las 5 nuevas. Eso es una decisión pendiente en `VISUAL_REFERENCES.md`.

## 7. Limitaciones

- No hay ningún proveedor de generación de imágenes ni de vídeo configurado. El arte vigente sale de la lámina que aportó el usuario; `extract-sheet.py` solo recorta, quita el fondo y escala, no genera nada.
- `extract-sheet.py` depende de la rejilla medida a mano sobre esa lámina de 1536×1024. Otra lámina necesita medir la rejilla de nuevo.
- Solo hay vista frontal. Otras vistas se diseñarán aparte cuando se necesiten.
- El lector PNG propio solo admite PNG de 8 bits no entrelazados, que es lo que exporta Chromium.
- El generador de atlas y animaciones todavía no está implementado. Se hará después de aprobar los estáticos y de elegir qué animaciones hacen falta.
