# Guía de estilo: personajes de Rower

Estado: **propuesta, pendiente de aprobación** (versión de maestro 1.0.0).

Esta guía es el contrato visual de los 25 personajes (5 clases × 5 rangos). Si un asset se ve bien por sí solo pero rompe alguna de estas reglas, se rechaza.

## 1. Dirección

Es una ilustración 2D vectorial de estilo cartoon retro. La referencia es la familia visual de los juegos *AdVenture* que pidió el proyecto, pero la definen las propiedades de abajo, no el parecido con esos juegos:

- **Formas:** redondeadas y macizas, sin ángulos agresivos en el cuerpo. Los objetos duros (metal, armas) pueden llevar esquinas.
- **Silueta:** cada clase se reconoce en negro puro a 84 px. La identidad la llevan la cabeza (pelo o casco) y el arma o accesorio de la mano.
- **Valores:** tres por superficie: luz, sombra propia (32 % hacia `#4A2414`) y contorno.
- **Contorno:** un solo contorno exterior de 7 unidades de viewBox (3,5 px a 720 px), color `#231A14`. Los detalles interiores llevan entre 2 y 3,5 unidades.
- **Detalle:** se concentra en la cara, las manos y el emblema de la clase. El resto va en planos de color.

## 2. Proporciones y pose base

| Medida | Valor (unidades de viewBox) |
|---|---|
| Lienzo | 360 × 420 (`viewBox -30 -2 360 420`) |
| Altura total | aproximadamente 3,6 cabezas |
| Cabeza | 100 de ancho × 130 de alto, centrada en x = 150 |
| Ojos | y = 94, separación entre centros de 36 |
| Base de los pies | y = 404 (pivote 0,5 / 0,97) |

La pose base es frontal, con el peso repartido y los brazos abajo, un poco separados del torso. El arma o herramienta va en la mano derecha del personaje (a la izquierda en pantalla), inclinada hacia fuera y hacia abajo. **Todos los rangos usan la misma pose base.** El porte cambia mediante la altura de los hombros, la posición de la cabeza, la apertura de piernas y la expresión, nunca con otra pose. Así los rangos se pueden comparar y las animaciones se reutilizan.

## 3. Cuerpo paramétrico

El cuerpo depende de dos parámetros entre 0 y 1 (decisión 14C):

- **masa** (Fuerza): ancho de hombros 56 → 106, brazo 20 → 42, cuello 15 → 30 y mandíbula.
- **def** (Resistencia): cintura y panza 72 → 50, abdominales visibles a partir de 0,35 y la panza desaparece hacia 0,45.

El nivel del héroe fija el mínimo de ambos y los atributos lo inclinan. La cara no cambia de estructura con estos parámetros; solo se ensancha un poco la mandíbula.

## 4. Luz y sombra

- La luz viene de arriba a la izquierda. La sombra propia es un borde desplazado (−7, −4) dentro de la silueta.
- No hay sombras proyectadas en el asset; las sombras de suelo las pone el juego.
- Los brillos solo van en metal y en la nariz: un trazo blanco al 45–55 %.

## 5. Color

- **Tinta:** `#231A14`. **Oro de insignias:** `#E0B44A`.
- Cada clase tiene una paleta fija de piel, pelo, tela, cuero, metal, acento e insignia, definida en `tools/characters/spec.mjs`. No se añaden colores fuera de la paleta de la clase, salvo los de las insignias comunes.
- La piel y el pelo son invariantes de identidad. Las canas son una mezcla del pelo con `#D2D2D2`: 22 % en Élite y 62 % en Legendario.
- Sobre la paleta de la app (verde táctico `#556B2F`, fondo `#111410`), el personaje debe distinguirse del fondo por valor, no solo por tono.

## 6. Cara, cabello y barba

- La estructura facial es la misma en los 5 rangos: cráneo, orejas, nariz grande y ojos ovalados.
- La expresión cambia por rango: alerta, decidido, confiado, dominante y sereno.
- La edad se muestra con patas de gallo (Élite), surcos nasogenianos (Élite suaves, Legendario marcados) y canas. Nunca con encorvamiento ni pérdida de masa.
- El vello de barba incipiente es una trama de puntos. La barba completa es una forma plana con contorno.
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
| 84 px | Avatar de la ficha | Clase (silueta y color) y rango aproximado |
| 48 px | Listas y HUD de carrera | Clase por color y silueta de la cabeza |

`tools/contact-sheet.mjs` genera la hoja de contacto con estos tamaños, la silueta en negro y el fondo de la app.

## 9. Referencias aprobadas

El registro vivo está en `docs/VISUAL_REFERENCES.md`. El diseño maestro de cada clase es el rango **Principiante**, y los rangos superiores se derivan de él.
