# Guía de estilo: personajes de Rower

Estado: **propuesta, pendiente de aprobación**.

> **Versión 3.0.0 (vigente):** los 45 personajes (5 clases × 9 rangos) se extraen de la lámina «Clases y progresión» que aportó el usuario, con `tools/extract-sheet.py`. Esa lámina es ahora la referencia de estilo: ilustración pintada semirrealista con contorno oscuro. Las secciones 2 a 4 describen el generador vectorial v2, que queda como herramienta de respaldo; las reglas de color, cara, vestuario y legibilidad (secciones 5 a 8) siguen aplicándose a cualquier fuente.

Esta guía es el contrato visual de los personajes. Si un asset se ve bien por sí solo pero rompe alguna de estas reglas, se rechaza.

## 1. Dirección

Ilustración 2D vectorial **semirrealista** (versión 2 del maestro; la versión 1 era cartoon de cabeza grande y se descartó por demasiado básica).

- **Formas:** anatomía natural, sin exageraciones de cartoon. Cada miembro es un volumen cilíndrico con abultamiento muscular, y el torso es una sola pieza con clavículas, pectorales, oblicuos y abdomen modelados con luz y sombra.
- **Silueta:** la clase tiene que leerse en negro a 180 px. A 84 y 48 px se usa el **retrato**, porque con proporciones realistas la cabeza ocupa poco.
- **Valores:** degradado de cilindro en cada pieza (luz, tono medio, sombra núcleo y luz reflejada), más sombras y luces difuminadas recortadas a la forma.
- **Contorno:** fino, de 1,4 unidades, en un tono oscuro de la propia piel o del material. La piel lleva un único contorno exterior para que no se vean costuras entre piezas.
- **Textura:** ruido fractal suave en piel (12 %), tela (18 %), cuero y madera (22–25 %).
- **Detalle:** se concentra en la cara (iris, párpados, cejas pelo a pelo, labios, barba incipiente punteada), las manos y el emblema de la clase.

## 2. Proporciones y pose base

| Medida | Valor (unidades de viewBox) |
|---|---|
| Lienzo | 360 × 420 (`viewBox -30 -2 360 420`) |
| Altura total | aproximadamente 6,3 cabezas |
| Cabeza | 44 de ancho × 64 de alto, de y = 12 a y = 76, centrada en x = 150 |
| Ojos | y = 44, separación entre centros de 17 |
| Hombros | y ≈ 92; medio ancho de 45 a 64 según la masa |
| Cintura / cadera | y = 180 / y = 216 |
| Base de los pies | y = 404 (pivote 0,5 / 0,97) |

La pose base es frontal, con el peso repartido y los brazos colgando un poco separados del torso. El arma va en la mano derecha del personaje (a la izquierda en pantalla), inclinada hacia fuera. **Todos los rangos usan la misma pose base.** El porte cambia con la altura y el ancho de los hombros, la posición de la cabeza, la apertura de las piernas y la expresión.

## 3. Cuerpo paramétrico

El cuerpo depende de dos parámetros entre 0 y 1 (decisión 14C):

- **masa** (Fuerza): medio ancho de hombros 45 → 64, brazo 7,5 → 11,5 de radio, antebrazo 5,8 → 10, cuello 9 → 14 y mandíbula.
- **def** (Resistencia): medio ancho de cintura 32 → 26, abdominales visibles desde 0,3 y la panza desaparece hacia 0,5.

El nivel del héroe fija el mínimo de ambos y los atributos lo inclinan. La cara no cambia de estructura con estos parámetros; solo se ensancha un poco la mandíbula.

## 4. Luz y sombra

- La luz viene de arriba a la izquierda. Cada pieza tiene su degradado horizontal: borde con luz reflejada, luz al 12 %, tono medio al 42 % y sombra núcleo entre el 78 y el 93 %.
- Las sombras de forma (bajo el pectoral, el cuello bajo la mandíbula, el lateral derecho del torso, las cuencas de los ojos) son manchas difuminadas de 1 a 6 unidades, recortadas a la pieza.
- No hay sombras proyectadas en el asset; las pone el juego.

## 5. Color

- **Tinta:** `#231A14`. **Oro de insignias:** `#E0B44A`.
- Cada clase tiene una paleta fija de piel, pelo, tela, cuero, metal, acento e insignia, definida en `tools/characters/spec.mjs`. No se añaden colores fuera de la paleta de la clase, salvo los de las insignias comunes.
- La piel y el pelo son invariantes de identidad. Las canas son una mezcla del pelo con `#D2D2D2`: 22 % en Élite y 62 % en Legendario.
- Sobre la paleta de la app (verde táctico `#556B2F`, fondo `#111410`), el personaje debe distinguirse del fondo por valor, no solo por tono.

## 6. Cara, cabello y barba

- La estructura facial es la misma en los 5 rangos: cráneo, mandíbula, orejas, nariz y ojos almendrados con iris.
- La expresión cambia por rango: inquieta, directa, seria y controlada, serena y dominante, y contenida.
- La edad se muestra con patas de gallo (Élite), surcos nasogenianos (Élite suaves, Legendario marcados) y canas. Nunca con encorvamiento ni pérdida de masa.
- La barba incipiente es una trama de puntos finos. La barba completa es un volumen con degradado y mechones trazados, igual que el pelo.
- Las reglas de cabello y barba de cada clase están en `CHARACTER_PROGRESSION_MATRIX.md`.

## 7. Vestuario, armas y accesorios

- **Torso descubierto o abierto en todas las clases.** Es una decisión de juego: deja ver la progresión física. Está anotada como estilización histórica en las reglas de personaje.
- Las armas se agarran por el mango con la mano visible por delante. Nunca atraviesan la cabeza ni cubren la cara.
- La complejidad del vestuario crece por rango con capas y materiales nuevos, no con más ruido. Ningún rango añade más de 2 piezas nuevas sobre el anterior.
- Las insignias (medallas, falera, anillos de brazo, mon) aparecen desde Élite.

## 8. Legibilidad

| Tamaño | Uso en la app | Debe leerse |
|---|---|---|
| 180 px de alto | Armario y ficha | Clase, rango, arma y expresión |
| 84 px | Avatar de la ficha (retrato) | Clase y rango por cabeza, pelo y accesorios |
| 48 px | Listas y HUD de carrera (retrato) | Clase por color y silueta de la cabeza |

`tools/contact-sheet.mjs` genera la hoja de contacto con estos tamaños, la silueta en negro y el fondo de la app.

## 9. Referencias aprobadas

El registro vivo está en `docs/VISUAL_REFERENCES.md`. El diseño maestro de cada clase es el rango **Novato**, y los rangos superiores se derivan de él.
