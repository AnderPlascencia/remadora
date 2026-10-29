# Limitaciones y decisiones

## Qué es y qué no es

- El modelo es **un personaje nuevo construido en Blender por script** sobre la malla base de MakeHuman; no es una
  conversión de la ilustración 2D ni de las propuestas de la fase 1, que solo sirvieron de referencia de estilo.
- No hay escultura a mano ni texturas pintadas: el nivel de detalle es el de un personaje de juego estilizado y
  correcto, no el de un héroe esculpido por un artista. Para subir de nivel visual, el `.blend` está listo para
  retocar a mano (esculpir cara y manos, pintar texturas) y volver a exportar.

## Defectos conocidos

- El gambesón marca demasiado el pecho de la malla base (sombreado algo blando en el torso).
- El borde del pelo se ve como un casco a distancia corta; la barba y el pelo son mallas, no pelo por tarjetas.
- La capa es rígida (sin simulación de tela) y en la espalda la falda asoma por los cortes de su borde.
- Los pulgares no siempre cierran bien sobre el hacha y el asa.
- En `rowing` no hay máquina de remo: el personaje se sienta en el aire con el asa. La cenefa dorada (nivel 20)
  se oculta al remar porque es rígida y no sigue a la falda.
- La animación `rowing` es una aproximación técnica de la palada, no captura de movimiento.
- La versión alta queda en 57 804 triángulos, algo por encima del objetivo de 50k; la móvil (47k) es la que se usa
  por defecto.
- Las otras cuatro clases siguen con ilustraciones WebP. El retrato pequeño del vikingo (cabecera del héroe,
  carriles de la carrera) también sigue siendo la ilustración: se puede sustituir por renders del modelo, pero se
  perderían las 9 variantes por rango que tiene hoy.

## Variantes por nivel

Se pidió 1, 5, 10, 15 y 20. Los rangos del juego van cada 10 niveles (1, 10, 20 … 80), así que las variantes no
coinciden con los rangos: quedan configurables en `config.js` (`desde`). A partir del 20 se mantiene la última.

| Nivel | Nombre | Añade |
| --- | --- | --- |
| 1 | Recluta | Cuerpo, pelo, barba, gambesón, falda, cinturón, vendas, botas, hacha |
| 5 | Remero de la saga | Correas cruzadas, broche del pecho, brazales |
| 10 | Guerrero del fiordo | Capa con broches, rodilleras, pelaje de las botas |
| 15 | Jarl | Manto de pelaje, tatuaje, trenza de la barba |
| 20 | Leyenda del norte | Cenefa de latón, anillo del moño, hacha dorada |

## Lo que no se pudo comprobar

- Solo se probó con Chromium sin GPU (WebGL por SwiftShader) en 412×915 y 915×412. **No se probó en un teléfono
  real**, ni en Safari/iOS ni en Firefox.
- No se midieron fps reales ni consumo de batería en el entrenamiento.
- El panel de entrenamiento no se vio con una remadora conectada (no hay Bluetooth aquí); se comprobó por separado
  en el banco de pruebas con la animación `rowing` y la cámara `remo`.

## Decisiones

- **Fuera de la app (29-10-2026)**: se probó un visor Three.js en la ficha y en el entrenamiento y se quitó a
  petición de Ander: la ficha vuelve a las ilustraciones 2D. El visor está en el historial de git
  (commit «Visor 3D del héroe en la ficha y en el entrenamiento») por si se retoma.
- **MakeHuman** como base anatómica: topología limpia para deformar y licencia CC0. Los archivos incluidos en
  `tools/blender/makehuman/` (malla base, objetivos, esqueleto `default`, pesos y ojos) son de MakeHuman
  1.x (makehumancommunity.org), dominio público CC0 1.0.
- **glTF Transform** (MIT) para optimizar, ejecutado con `npx`; no se añade al proyecto como dependencia.
- **Sin servicios de pago ni APIs de generación de modelos.**
