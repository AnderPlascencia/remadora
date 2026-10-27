# Especificación de animación

Estado: **especificación. No hay animaciones producidas.** Según el plan, las animaciones empiezan cuando los diseños estáticos estén aprobados y la viabilidad esté comprobada.

## 1. Qué necesita realmente la app

Rower no es un juego de combate en tiempo real. El héroe aparece en estas pantallas:

| Pantalla | Uso actual | Animación útil |
|---|---|---|
| Ficha y armario del héroe | Avatar estático de 84 y 180 px | Idle |
| Resumen al terminar una sesión | Subida de nivel, logros | Victoria |
| Capítulos con jefe | Jefe vencido o no | Victoria, derrota, guardia |
| Carrera contra fantasmas (decisión 11 pendiente) | Bote sin personaje | Remada (no está en la lista pedida) |
| Habilidades activas (decisión 12 pendiente) | No existe | Ataque ligero, ataque pesado, reacción al impacto |

**Propuesta por prioridad:**
1. Idle, victoria y derrota. Se usan seguro.
2. Guardia, ataque ligero, ataque pesado y reacción al impacto, solo si se aprueba la opción 12C (energía y ataques) o se animan los jefes.
3. Remada, si en la decisión 11 se elige al héroe en el bote.

## 2. Formato común

| Propiedad | Valor |
|---|---|
| Lienzo de fotograma | 360 × 420 de viewBox, exportado a 360 × 420 px (1x) y 720 × 840 px (2x) |
| Pivote | Centro de los pies (0,5 / 0,97), fijo en todos los fotogramas |
| Orientación | Frontal, igual que la pose base |
| Fondo | Transparente |
| Velocidad base | 12 fps (83 ms por fotograma) |
| Atlas | Una tira horizontal por animación más un JSON de rectángulos (ver `ASSET_PIPELINE.md`) |

| Animación | Fotogramas | Bucle | Duración |
|---|---|---|---|
| Idle | 8 | Sí | 667 ms |
| Guardia | 6 | Sí | 500 ms |
| Ataque ligero | 6 | No | 500 ms |
| Ataque pesado | 9 | No | 750 ms |
| Reacción al impacto | 4 | No | 333 ms |
| Victoria | 10 | No, se queda en el último fotograma | 833 ms |
| Derrota | 8 | No, se queda en el último fotograma | 667 ms |

## 3. Cómo se producen

El personaje ya es un modelo vectorial con parámetros (hombros, cabeza, brazos y piernas calculados por código). La vía más fiable es **animar por pose en el generador**: añadir parámetros de articulación a `personaje()`, como ángulo de hombro, codo, inclinación del torso, desplazamiento de la cabeza y expresión, y renderizar cada fotograma con el mismo exportador. Ventajas:

- Identidad, escala, contorno y paleta idénticos en todos los fotogramas, porque es el mismo código.
- No hacen falta limpieza de fondo, quitar halos ni corregir deformaciones.
- Coste cero y totalmente reproducible.

Límite: los movimientos amplios (giros de 3/4, escorzos) necesitan dibujar vistas nuevas. Con vista frontal sirven idle, victoria, derrota, guardia y golpes frontales. Un ataque lateral requiere una vista de perfil aprobada aparte.

En la app también se pueden animar en tiempo real el SVG o CSS (respiración, parpadeo, rebote) sin exportar fotogramas. Para idle es la opción más ligera.

### Generación con IA (no disponible ahora)

Herramientas como `agent-sprite-forge` o `sprite-gen` generan clips con modelos de imagen o vídeo de pago (OpenAI, Gemini, xAI, fal) o con las CLI de Codex o Grok. En este entorno no hay credenciales ni CLI de esos proveedores. Además, la generación por vídeo produce deriva entre fotogramas (manos, armas, contorno), y obliga a quitar el fondo y revisar fotograma a fotograma. Solo se usaría con autorización y presupuesto, y como borrador. Ver `ASSET_PIPELINE.md`.

## 4. Validación de cada animación

- El pivote y la línea de suelo no se mueven más de 1 px, salvo en saltos intencionales.
- La altura de cabeza y el contorno son constantes, y la paleta no tiene colores nuevos.
- Manos: 1 por brazo. El arma está siempre agarrada y no cambia de largo.
- La silueta es legible a 84 px en cada fotograma clave.
- El bucle no salta entre el último y el primer fotograma.
- Revisión manual en una tira de contacto y en la app a tamaño real.
