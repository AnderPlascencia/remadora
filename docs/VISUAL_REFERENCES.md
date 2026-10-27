# Referencias visuales y aprobaciones

El estado de cada asset se guarda en `assets/characters/approvals.json`. Este documento resume las decisiones de dirección y lo que está aprobado.

## Decisiones ya aprobadas por el proyecto

| Decisión | Elección |
|---|---|
| Nombre de la app | Rower |
| Paleta de la app (15) | B: verde táctico `#556B2F`, acento ámbar `#F2A33A`, fondo `#111410` |
| Logo (16) | A: remos cruzados con letra stencil |
| Estilo de personaje | El de la lámina «Clases y progresión» aportada por el usuario (v3). Antes: vectorial semirrealista (v2) y cartoon de cabeza grande (v1), descartados. |
| Ritmo de rangos | Un rango cada 10 niveles, 9 rangos (los que dibuja la lámina); nivel máximo 90 |
| Progresión del cuerpo (14) | C: el nivel marca la base y los atributos la inclinan (Fuerza → masa, Resistencia → definición) |
| Progresión de rango | Edad, pulcritud, barba y cabello, vestuario y porte, al estilo de los rangos de *AdVenture Communist* |
| Clases | Vikingo, Pirata, Samurái, Polinesio, Romano |

## Personajes extraídos de la lámina, versión 3.0.0

Fuente: `assets/characters/_source/lamina_clases_v1.png` (1536×1024, generada externamente; la herramienta no consta). Los 45 assets están en `assets/characters/<clase>/<rango>/` y todos figuran como **pendientes** en `approvals.json`.

Hojas de contacto por clase: `assets/characters/_qa/contact_<clase>.png`.

Limitaciones conocidas de la fuente:

- Cada figura mide entre 140 y 165 px en la lámina; los PNG de 720×840 están ampliados unas 5 veces y se ven blandos de cerca.
- La cara cambia entre rangos de una misma clase (no es el mismo personaje envejeciendo).
- Las muestras de color de la lámina tapan parte del escudo romano y del timón pirata en los rangos altos; se borraron y queda un corte en esas piezas.
- Mezclas culturales: el polinesio de Élite y Legendario lleva un tocado de plumas de estilo nativo americano.

## Decisiones pendientes

1. Aprobar o pedir cambios en los 45 personajes extraídos.
2. **Cultura polinesia de referencia.** Propuesta: Hawái (malo, kākau, mahiole, ʻahu ʻula, leiomano). La alternativa es Aotearoa, con estética maorí (tā moko, korowai, taiaha). No se mezclan.
3. Confirmar las estilizaciones de torso descubierto (`CHARACTER_RULES.md`).
4. Migración de clases en la app: explorador, monje y gladiador desaparecen. Propuesta para los héroes ya creados: gladiador pasa a romano, explorador a polinesio y monje a samurái, conservando XP, talentos y objetos.
5. Animaciones necesarias, que dependen de las decisiones 11 y 12 (`ANIMATION_SPEC.md`).
6. Si se autoriza algún proveedor de imagen o vídeo de pago (hoy no se usa ninguno).

## Exploraciones previas (no son referencia)

Las páginas de propuestas anteriores (estilo realista, estilo cartoon con niveles) sirvieron para elegir la dirección. No son referencias aprobadas y no deben usarse para derivar assets.
