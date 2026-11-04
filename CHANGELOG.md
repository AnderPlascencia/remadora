# Cambios

Lo que cambia en cada versión de Rower. La versión de la app vive en `src/version.js`; esta lista empieza siempre por esa versión (lo comprueba `pruebas/version.test.mjs`).

## 0.55.0 · 2026-11-04

Colección de bote por clase (etapa 15).

- Cada clase tiene su colección de 8 piezas en Héroe › Tienda: 5 velas con emblema de su cultura, un mascarón de proa (y su versión dorada) y unas palas de remo. Las 5 clases siguen la misma escalera: la vela clásica es gratis, la vela de rango se gana en el nivel 20 y el mascarón en el 40, las palas, la vela de taller y la épica se compran (600, 1200 y 2200 monedas) y la vela legendaria y el mascarón dorado se ganan con la hazaña de clase.
- Hazañas de clase (1000 XP nominales y 300 monedas): 75 000 paladas (vikingo), 60 fantasmas vencidos (pirata), 400 minutos técnicos (samurái), 750 km (polinesio) y 10 semanas del plan cumplidas (romano). Cuenta todo tu historial; quien ya la cumplía la cobra en su siguiente sesión.
- El bote de cada clase guarda su propio equipo, así que al cambiar de clase no pierdes nada. Las velas de color siguen a la venta y valen para cualquier bote. La que tenías elegida sigue puesta.
- En la carrera, los rivales de Alta mar llevan la vela épica de su clase y los legendarios, la legendaria. Las piezas son solo de aspecto: no dan metros, XP ni ventajas.

## 0.54.0 · 2026-11-04

Cinco paisajes nuevos para la carrera.

- En Héroe › Tienda hay cinco paisajes propios para comprar con monedas, cada uno con su fondo 3D, su orilla con piezas y su costa vista desde arriba en 2D: Cañón del desierto (700), Lago de otoño (1100), Lago de los cerezos (1500), Bahía glaciar (2100) y Costa mediterránea (2700).
- Los paisajes de la tienda salen ordenados por precio, del fiordo gratis al más caro.
- Las imágenes nuevas se guardan para usarlas sin conexión. Se renderizan en Blender con `tools/blender/paisaje/coleccion`.

## 0.53.0 · 2026-11-04

Racha del plan.

- La racha cuenta ahora días seguidos cumpliendo el plan: un día de plan con su sesión terminada y un día de descanso respetado (sin remar o con remo suave) suman. Remar fuerte en un descanso o saltarse la sesión de un día de plan la cortan; un día de plan que aún no has hecho no la corta mientras dure el día. Fuera del calendario del plan vale remar ese día, como antes.
- Con esa racha se calculan la voluntad (+0,5 por día, hasta 7), el bono de XP de racha, los talentos romanos (Ley y Marcha de la legión) y el requisito de «Mar abierto» (4 días seguidos cumpliendo el plan).
- Las sesiones anteriores al 4 de noviembre conservan su racha de días seguidos remando: no cambia la XP ya ganada.

## 0.52.0 · 2026-11-04

Rendimiento y accesibilidad (etapa 14).

- La carrera se pinta como mucho a 60 cuadros por segundo en 2D y a 30 en 3D y realista, y la realista dibuja a una resolución de 1,5× como máximo: en un teléfono de 120 Hz gasta la mitad o menos.
- La carrera no se pinta si queda fuera de la pantalla (al bajar en Entrenar) ni detrás del modo remo; vuelve sola al verse.
- Contraste: los botones rojos con texto (Terminar) usan un rojo más oscuro (en alto contraste, texto negro), y en el tema claro el verde del estado y el ámbar de «favorito» se leen mejor. Las subpestañas del Héroe se anuncian como pestañas.
- Pruebas nuevas en CI: presupuesto de rendimiento (primera carga, cuadros por segundo, 2 h simuladas sin fugas) y accesibilidad con axe-core en tres temas, más la letra mínima de 14 px en el modo remo. Los pasos de la prueba de 30 min en el teléfono están en el README.

## 0.51.1 · 2026-11-04

- Hoy: cuando la única fila del plegable es el aviso de riesgo, dice «Un aviso antes de empezar» en vez de «0 retos para sumar más».

## 0.51.0 · 2026-11-04

Pulso y métricas (etapa 13).

- Una sola zona 2 en toda la app: del 60 al 70 % de tu reserva de pulso si das tu pulso en reposo (campo nuevo en Ajustes › Pulso y zonas), o de tu pulso máximo si no. El aviso de «pulso alto» en los fondos, el gráfico «Mi motor» y los bloques por % de pulso usan la misma.
- Pulso máximo: el más alto que alcanzas en tus sesiones (media de 5 s, sin picos sueltos) en vez de 220 − edad, en cuanto llega al 92 % de lo que da tu edad. Ajustes avisa si es «estimado» u «observado»; el que escribes a mano manda.
- El FTP también baja: Hoy propone repetir la prueba a las 6 semanas y bajar el FTP cuando 3 de tus últimas 4 sesiones fuertes se quedan cortas (a lo que de verdad sostuviste, como mucho un 15 % menos). El FTP estimado ya no se infla con un 500 m: solo cuentan sesiones de 10 min o más.
- Desacople medido solo en el tramo principal estable (sin calentamiento ni enfriamiento); el fondo se alarga solo con 40 min estables. La recuperación de pulso a 60 s se toma tras el último bloque de trabajo y se compara con sesiones del mismo tipo.
- Antes de remar (opcional, debajo de Empezar): «¿Cómo dormiste?» y «¿Algún dolor o malestar?». Dormir mal o una molestia pasan la sesión dura a suave; con dolor o malestar, descanso. La variabilidad del pulso (RMSSD del calentamiento) también cuenta si baja del 80 % de lo normal en ti.
- «Índice de VO₂» en vez de VO₂máx: es para compararte contigo. 1 kJ ≈ 1,2 kcal. Bandas UT2, UT1, AT, TR y AN con sus watts y su split. Los watts de la RW200 no se comparan con un Concept2 (lo explica la ayuda del FTP).
- Prueba FTP 20 min con arranques en el calentamiento y consejo de reparto por voz.

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
