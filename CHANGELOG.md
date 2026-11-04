# Cambios

Lo que cambia en cada versión de Rower. La versión de la app vive en `src/version.js`; esta lista empieza siempre por esa versión (lo comprueba `pruebas/version.test.mjs`).

## 0.50.0 · 2026-11-04

Misiones, talentos, monedas y atributos (etapa 12). Rige desde el 4 de noviembre (las semanales, desde el lunes 9); lo anterior no cambia, así se conservan monedas, compras, XP y títulos.

- Misiones con peso: 3 diarias de unos 90 a 110 XP cada una (una de tu plan, una de técnica o ritmo y una de juego, nunca dos casi iguales) y 4 semanales de 200 XP (plan, técnica, rival de la semana y la de tu clase).
- Técnica nueva, con la fórmula del entrenador: potencia pareja palada a palada (±8 %) y cadencia estable en ventanas de 30 s, por encima del 55 % del FTP; si el bloque pide cadencia, solo cuenta a esa cadencia. 0,6 por minuto hasta 30 min y +3 con el 70 % de la sesión pareja.
- Atributos: en pantalla, lo de las últimas 6 semanas (pueden bajar); el acumulado da los títulos.
- Clases igualadas: unos 50 XP de talentos por sesión con el perfil típico de cada clase. El Triunfo romano se gana con 4 sesiones o al llegar a tu meta semanal de km (con un aviso único).
- Monedas: la mitad por sesión y por constancia; las misiones dan 1 por cada 40 XP. Colección nueva: 6 paisajes (de 600 a 3000) y 5 velas para tu bote (de 400 a 2500).
- Los puntos de talento que ya no caben en tu árbol se cambian por monedas (150 cada uno).

## 0.49.0 · 2026-11-04

Datos que escalan y publicación (etapa 11).

- El historial ya no carga cada segundo remado para listarse: las muestras de cada sesión van en su propio almacén (base de datos versión 3, con la mudanza automática al abrir la app) y las sesiones tienen un índice por fecha.
- Las sesiones se leen una vez y se guardan en memoria hasta que guardas, borras o restauras algo; los récords de cada sesión y el estado del héroe se calculan una sola vez.
- La gráfica en vivo dibuja solo el tramo nuevo de cada segundo, sobre un eje de 5 minutos que avanza de minuto en minuto, y ya no lee los colores del tema en cada dibujo.
- Todos los ajustes están en un registro (`src/ajustes-guardados.js`) con su tipo, su valor por defecto y si van en el respaldo. El respaldo ahora incluye los rivales de referencia, el fantasma a tu medida y la vista de la carrera.
- Respaldo con formato 2 (cada ajuste con su tipo); los de antes se convierten solos. Restaurar va en una sola transacción y las sesiones dañadas no se traen.
- Service worker: solo guarda respuestas completas (ni errores ni trozos de vídeo), sirve imágenes y vídeos desde la caché primero y ya no descarga los vídeos de la vista realista si tu héroe es de otra clase.
- La versión se escribe en un solo lugar (`src/version.js`), este CHANGELOG aparte y un flujo de publicación documentado en el README.

## 0.48.0 · 2026-11-04

- Rivales justos, historia por nivel y metas largas (etapa 9).

## 0.47.0 · 2026-11-04

- Planes bien calibrados (etapa 8).

## 0.46.4 · 2026-11-03

- Pulidos de interfaz (microcopia, podio, ejes, estimaciones y estados vacíos).

## 0.46.3 · 2026-11-03

- Escalas de letra y radios en tokens; mínimo 14 px al remar.

## 0.46.2 · 2026-11-03

- Un hogar por contenido y navegación más clara.

## 0.46.1 · 2026-11-03

- Héroe y Progreso sin dorado repetido ni avisos apilados.

## 0.46.0 · 2026-11-03

- XP por carga y por cumplir el plan (etapa 6).

## 0.45.2 · 2026-11-03

- La meta del reto en vivo no aplasta el título en pantallas estrechas.

## 0.45.1 · 2026-11-03

- App.js dividido por pantalla, código en src/ y marca en assets/marca/ (etapa 5).

## 0.45.0 · 2026-11-03

- Fatiga sin falsa alarma, retos según el tipo de sesión y % en rango honesto.

## 0.44.1 · 2026-11-03

- Avisos de talento que se apagan, Estandarte honesto y «4 clases» en 4 carreras.

## 0.44.0 · 2026-11-03

- Modo remo usable y arreglos rápidos (etapa 3).

## 0.43.2 · 2026-11-03

- «Seguir remando» al recuperar una sesión (D6).

## 0.43.1 · 2026-11-03

- Etapa 2, no perder sesiones.

## 0.43.0 · 2026-11-03

- Auditoría de diseño, colores con un solo significado, menos avisos y navegación más clara.

## 0.42.3 · 2026-11-02

- Números grandes que caben en su casilla.

## 0.42.2 · 2026-11-02

- Utilidades de pantalla en ui.js y lógica del respaldo en respaldo.js, con pruebas.

## 0.42.1 · 2026-11-02

- Pausas guardadas, sin segundos en 0 W al seguir, meta exacta, datos protegidos y pruebas en cada PR.

## 0.41.1 · 2026-11-01

- Distancia según watts, como los fantasmas, y sin victoria en carreras reparadas sin meta.

## 0.25.0 · 2026-10-28

- Atributos por entrenamiento y semana de héroe.

## 0.24.0 · 2026-10-28

- Caminos claros para subir de nivel y guía de atributos.

## 0.23.0 · 2026-10-28

- Rediseño para OnePlus 13, identidad «travesía», datos avanzados y animaciones.

## 0.22.0 · 2026-10-28

- Correcciones de la auditoría de diseño, UX y casos extremos.

## 0.21.2 · 2026-10-28

- Detalles en la tarjeta Hoy; perfil verde sin rango y rayado sin tiempo fijo.

## 0.21.1 · 2026-10-28

- Esfuerzo calculado con el pulso; se pregunta solo sin pulso.

## 0.21.0 · 2026-10-28

- Inicio guiado, tarjeta Hoy con Empezar y FTP automático.

## 0.20.0 · 2026-10-28

- Detalle de entrenamientos y fantasmas en Remo libre.

## 0.19.9 · 2026-10-28

- Entrenamientos base por nivel y pestaña Planes más limpia.

## 0.19.8 · 2026-10-28

- La ficha muestra lo que dan tus talentos.

## 0.19.7 · 2026-10-28

- Pestaña Niveles del héroe y Golpe de hacha más suave.

## 0.19.6 · 2026-10-28

- Talentos nuevos por clase con números fijos.

## 0.19.5 · 2026-10-28

- Nuevo logo, escudo de tripulación.

## 0.19.4 · 2026-10-28

- Correcciones de la pasada de QA en vertical y horizontal.

## 0.19.3 · 2026-10-28

- Repara sesiones con metros falsos y la barra semanal ya no se sale.

## 0.19.2 · 2026-10-28

- Textos de parciales en una línea y etiquetas sin encimarse.

## 0.19.1 · 2026-10-28

- Carrera legible en vertical y horizontal, reloj y distancia blindada.

## 0.19.0 · 2026-10-28

- Carrera contra fantasmas más clara y viva.

## 0.18.0 · 2026-10-28

- Siempre 3 rivales por dificultad y referencias amarillas en tu carril.

## 0.17.0 · 2026-10-28

- Tripulación por FTP y dificultad Bahía, Costa y Alta mar.

## 0.16.0 · 2026-10-28

- Modos Remo libre y Por objetivo en Entrenar.

## 0.15.0 · 2026-10-28

- Asistente de plan por objetivo y entrenamientos agrupados.

## 0.14.0 · 2026-10-28

- Pantalla principal limpia, vista previa de rivales, XP estimada, radar y recomendaciones.

## 0.13.0 · 2026-10-28

- Talentos activos en la carrera y tienda de ventajas.

## 0.12.1 · 2026-10-27

- Talentos por clase y rivales de otras clases.

## 0.12.0 · 2026-10-27

- La app pasa a llamarse Rower.

## 0.11.1 · 2026-10-27

- Diarias a la mitad de XP y sin armario.

## 0.11.0 · 2026-10-27

- Misiones y bonos de experiencia según el diseño del usuario.

## 0.10.0 · 2026-10-27

- Personajes ilustrados en la app y nueva experiencia por distancia.
