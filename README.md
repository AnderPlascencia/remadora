# Rower

App web (PWA) para la remadora NordicTrack RW200: métricas en vivo, entrenamientos por bloques e historial local.

## Cómo usarla

1. Abre la página en **Chrome para Android** (necesita HTTPS por el Bluetooth web).
2. Menú ⋮ → *Agregar a la pantalla principal* para instalarla como app.
3. Enciende la consola, pulsa **Conectar remadora** y elige `I_RW`.
4. Pulsa **Iniciar sesión** para grabar. Al terminar, la sesión queda en *Historial*.

Si al conectar no aparecen datos, cambia la variante del protocolo en *Ajustes* y reconecta.
El registro Bluetooth de *Ajustes* se puede descargar para diagnosticar.

## Qué hace

- Lee watts, golpes por minuto, split de 500 m, distancia y nivel de resistencia.
- Banda de pulso Bluetooth opcional.
- Entrenamientos por objetivo: calorías, distancia o paladas, con progreso y tiempo estimado.
- Entrenamientos por intervalos de tiempo con rango de potencia (o golpes por minuto), gráfica del plan completo (rango en verde, fuera de rango en gris, tu potencia encima), avisos de sube/baja y % del tiempo en rango.
- Zonas de potencia por FTP (intervalos en % del FTP) y prueba FTP de 20 min que calcula tu FTP.
- Modo remo de pantalla completa (vertical y horizontal) con watts gigantes y aviso sube/baja.
- Avisos por voz: cambio de intervalo, cuenta regresiva, fuera de rango, meta cumplida.
- Pausa automática al dejar de remar y reconexión automática si se cae el Bluetooth (la sesión no se pierde).
- Resumen al terminar: récords nuevos y comparación con la vez anterior del mismo entrenamiento.
- Progreso: racha, meta semanal, km por semana o mes, tendencia de watts y split, récords.
- Resistencia automática por intervalo (experimental, apagada por defecto).
- Intervalos que terminan por tiempo, distancia o paladas, con metas de potencia, % FTP, split o golpes/min.
- Fantasmas: rema contra hasta 3 a la vez (tu sesión anterior, tu mejor marca, principiante, intermedio, avanzado o uno a tu medida por FTP, tiempo objetivo o tu mejor + %). Los simulados reman con variación natural, cansancio en tramos largos y el oleaje de cada palada.
- Carrera animada a 60 fps: vista 2D desde arriba o 3D desde atrás de tu bote (toca para cambiar), remos al ritmo real de golpes por minuto, agua, boyas cada 250 m, orillas, estela, cámara que te sigue con zoom y proyección de llegada («A este ritmo llegas en 7:52 · 1º de 4»).
- Programas de varias semanas con calendario y "Hoy toca" (incluye plantilla para mejorar 2000 m).
- Resumen por intervalo y parciales de 500 m; esfuerzo percibido (1–10) y notas por sesión.
- Carga de cada sesión y gráfica de forma (condición, fatiga, frescura).
- Pulso: zonas por pulso máximo, tiempo en cada zona y watts por latido.
- Técnica: metros y trabajo por palada.
- Respaldo en archivo (se puede compartir a Google Drive) y restauración sin duplicados.
- Historial guardado en el teléfono (IndexedDB), exportable a CSV y TCX (Strava, Garmin).
- Funciona sin conexión una vez instalada.
- Temas oscuro, claro y alto contraste; pantalla de bienvenida.
- Celebración con confeti al lograr récords, insignias o ganarle a un fantasma; 12 insignias en Progreso.
- Tarjeta de la sesión para compartir como imagen.
- Gráfica del resumen con bandas de zonas de potencia y marcas de cada intervalo.
- Plan automático hacia una meta (por ejemplo 2000 m en 7:50 en 8 semanas).
- FTP sugerido con cualquier sesión de 20 min o más.
- Calentamiento y enfriamiento guiados opcionales en los intervalos; intervalos por pulso (lpm o % del pulso máximo).
- Pruebas de 500 m y 2000 m con predicción de otras distancias (ley de Paul) y biblioteca de entrenamientos clásicos.
- Recomendación del día según tu frescura.
- Entrenador por voz: parcial de cada 500 m, ánimo y aviso si el ritmo se cae.
- Modo remo con gestos: doble toque para pausar, deslizar para cambiar de vista.
- Héroe: elige una de 5 clases (Vikingo, Pirata, Polinesio, Samurái o Romano) y sube de nivel con tus entrenamientos; 6 atributos crecen según el tipo de entrenamiento.
- Árbol de talentos, misiones diarias y semanales, historia en 5 capítulos con jefes que son pruebas reales, hazañas, monedas y tienda de ventajas y de paisajes para la carrera (fiordo nórdico gratis, laguna tropical por 400 monedas).
- Si la app se cierra a media sesión, al volver ofrece guardarla; el botón Atrás de Android cierra lo que esté abierto en vez de salir.
- Último parcial de 500 m en pantalla (verde o rojo) y ritmo objetivo con línea en la carrera.
- Caminos para subir de nivel: cuántas sesiones faltan para el siguiente nivel y rango, misiones a tu medida (según tus últimas 4 semanas) con botón «Hacer ahora», jefes con botón «Enfrentar» y XP, y cuánto te daría cada talento con tus sesiones.
- Guía de atributos: qué sube cada uno con tus vatios, cuánto subió esta semana, qué atributos subirías con el entrenamiento elegido y un botón para entrenarlo.
- Plan «Subir de nivel» y planes de 1 a 5 días por semana; al terminar un plan, el siguiente con un poco más de carga; un plan armado sin historial se ajusta cuando ya remaste.
- Atributos por entrenamiento: en Planes eliges «Quiero subir…» y los entrenamientos se ordenan por lo que suben; cada tarjeta muestra sus puntos.
- Antes de remar: lo que ganas seguro y lo que puedes sumar («Mantén el rango el 85 % del tiempo: +3 Técnica», «Un sprint de 20 s por encima de 191 W: +1 Agilidad»).
- Mientras remas: lo que llevas de cada atributo, cuánto falta para el siguiente punto (sin sacarte de tu tramo) y un aviso al sumar; se apaga en Ajustes.
- Al terminar: lo que lograste, lo que te quedó cerca con sus puntos y qué entrenar la próxima vez.
- Semana de héroe: meta semanal para tu atributo más bajo (con XP y monedas), semana sugerida para equilibrarte y títulos por atributo («Experto de la técnica»).
- Bienvenida en 5 pasos (qué hace la app, héroe, objetivo con días y tiempo por sesión, tu perfil y conexión) que se puede repetir desde Ajustes › Ayuda.
- Guía rápida con 8 temas (primeros pasos, entrenar, modo remo, carrera, planes, héroe, progreso y ajustes) y un consejo la primera vez que abres cada pestaña.
- Puestos de la tripulación explicados: escalera de Grumete a Capitán con los watts de FTP que necesitas para cada uno, tu avance al siguiente y cómo reman los rivales de cada puesto (Ajustes › Tu perfil y Héroe).
- Vista previa del plan (Planes › Programa): lo que toca hoy con su forma de bloques, una gráfica del esfuerzo de cada semana (descargas y pruebas marcadas) y «Lo que sigue», semana a semana, con qué sesión sube respecto a la anterior. Lo futuro se marca como estimado porque el plan se ajusta solo.
- Distancia según tus watts, con la misma fórmula que los fantasmas (W = 2,8 · v³): la consola sumaba ~20 % más metros de los que dan sus propios watts. La de la consola se guarda aparte; las sesiones antiguas se pasan una vez, con marcas y carreras recalculadas.
- Tu perfil (edad, sexo, peso, altura, experiencia, días y tiempo por sesión): calorías con tu metabolismo basal, pulso máximo, FTP para empezar sin historial, puesto en la tripulación, volumen del primer plan y planes que no pasan del tiempo que tienes.

## Archivos

`index.html`, `manifest.webmanifest` y `sw.js` (la caché sin conexión) quedan en la raíz. El código vive en `src/`, los logos e iconos en `assets/marca/`, las fuentes en `assets/fuentes/` y los héroes en `assets/heroes/`.

### Pantallas (`src/pantallas/`)

`src/app.js` es solo el punto de entrada: importa cada pantalla y la arranca en orden. El estado que comparten varias pantallas (la sesión en curso, el entrenamiento elegido, la sesión abierta en el detalle, la caché del historial…) vive en `src/estado.js`; lo que usa una sola pantalla se queda en su módulo.

| Pantalla | Módulo | Qué contiene |
| --- | --- | --- |
| Entrenar, antes de remar | `preparar.js` | Rivales, dificultad, ventaja y vista previa de la sesión |
| Entrenar, sesión en vivo | `vivo.js` | Carrera, números grandes, modo remo, gráficas y retos durante la sesión |
| Entrenar, ciclo de la sesión | `sesion.js` | Conexión con la remadora y la banda, grabar, pausa, tic, terminar, guardar y recuperar una sesión a medias |
| Planes | `planes.js` | Lista de entrenamientos, editor y hoja de detalle de un entrenamiento |
| Planes › Programa | `programa.js` | Asistente del plan, semanas y la sesión de hoy |
| Héroe y tienda | `heroe.js` | Personaje, nivel, atributos, árbol, tienda, paisajes y resultado de la carrera |
| Progreso (historial) | `progreso.js` | Historial, tendencia, capacidades, récords e insignias |
| Detalle de una sesión | `detalle.js` | Hoja con gráficas, notas, compartir y exportar (CSV y TCX) |
| Ajustes y respaldo | `ajustes.js` | Perfil, preferencias, zonas, prueba de nivel, tripulación, respaldo y reparaciones de datos |
| Inicio | `inicio.js` | Bienvenida de la primera visita |
| Guía y consejos | `ayuda.js` | Guía rápida y consejo de la primera visita a cada pestaña |

En `src/` junto a `app.js` y `estado.js`: `navegacion.js` (cambio de pestaña y ayudas emergentes) y `registro.js` (registro de diagnóstico y errores).

### Lógica sin pantalla (`src/`)

| Archivo | Para qué |
| --- | --- |
| `protocolo.js` | Decodifica los paquetes de 20 bytes de la consola |
| `variantes.js` | Secuencias de saludo y consulta de cada variante |
| `remadora.js` | Conexión Bluetooth, cola de escritura, modo demo, banda de pulso |
| `entrenamientos.js` | Lógica de objetivos, intervalos, zonas y FTP (con pruebas en `pruebas/`) |
| `estadisticas.js` | Récords, comparación con la sesión anterior, progreso semanal/mensual |
| `capacidades.js` | Capacidades físicas: qué entrenó cada sesión y cómo va cada capacidad en el tiempo |
| `adaptacion.js` | Adaptación automática del plan según tus sesiones, con la frase que lo explica |
| `base.js` | Entrenamientos base por sección y dificultad, ajustados a tu FTP y tu rango |
| `voz.js` | Avisos por voz |
| `programa.js` | Programas de varias semanas |
| `fantasma.js` | Fantasmas simulados por nivel o a tu medida, y proyección de llegada |
| `carrera.js` | Carrera animada 2D/3D contra los fantasmas |
| `efectos.js` | Confeti y tarjeta de la sesión para compartir |
| `consejos.js` | Qué atributos sube cada entrenamiento, extras con puntos, reto en vivo y análisis al terminar |
| `juego.js` | Héroe: clases, atributos, XP, niveles, talentos, misiones, capítulos y monedas, calculados con tu historial |
| `xp-carga.js` | XP por carga con tope diario, sesión del plan cumplida, descansos y semana del plan (acuerdo D1) y el calendario del plan |
| `talentos.js` | Talentos de cada clase (dan XP o ventaja en la carrera, nunca cambian tus métricas) |
| `ventajas.js` | Ventajas en la carrera: talentos de carrera y objetos de un solo uso de la tienda |
| `objetos.js` | Vestimenta, colecciones y dibujo vectorial del héroe |
| `perfil.js` | Tu perfil: basal, FTP inicial, qué falta y lo que aporta al plan |
| `guia.js` | Temas de la guía rápida y consejos de cada pestaña |
| `grafica.js` | Gráficas en canvas |
| `ui.js` | Utilidades de interfaz: `$`, ajustes guardados, avisos, iconos y `escaparHtml` (todo texto del usuario o de un respaldo que va en HTML pasa por aquí) |
| `respaldo.js` | Qué guarda un respaldo y cómo se combina al restaurar |
| `db.js` | Almacenamiento local (IndexedDB): sesiones, entrenamientos y estado (sesión en curso, versión de los datos) |
| `reloj.js` | Segundos de la sesión según la hora del sistema (no se pierden con la app en segundo plano) |
| `version.js` | Número de versión que se ve en Ajustes (va junto con el de `sw.js`) |
| `estilos.css` | Estilos de toda la app |

## Seguridad

La app solo escribe en la característica `1534` del servicio iFit `1533`. Nunca escribe en el servicio de
actualización de firmware (`1530`) ni en el servicio `1400`, que solo escucha para diagnóstico.

## Créditos

El diseño de la interfaz sigue la skill [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT), incluida en `.claude/skills/`.


El pipeline experimental del vikingo en 3D (`tools/blender/`, no se usa en la app) parte de la malla base, el
esqueleto y los ojos de [MakeHuman](https://makehumancommunity.org) (CC0) y optimiza con [glTF Transform](https://gltf-transform.dev) (MIT).

El formato de los mensajes se tomó como referencia del proyecto
[qdomyos-zwift](https://github.com/cagnulein/qdomyos-zwift). El código de esta app es propio.
- Sesión del día: con plan, la de hoy (o en un día libre, una de la semana que quedó sin hacer, sin juntar dos duras); sin plan, una sugerida con un esquema 80/20 según tu semana y tu cansancio. Siempre dice por qué toca.
- Planes ordenados: nunca dos sesiones duras en días seguidos, la prueba sustituye a una dura, y en Programa ves la semana actual con su estado. Las variantes de cada semana ya no llenan tu lista y los restos de planes anteriores se borran solos.
- Cada sesión guarda sus pausas (hora de inicio y fin), la hora real de fin y la versión de la app; el detalle muestra el tiempo parado. Al pulsar Seguir no se graban segundos hasta que vuelves a remar.
- La meta se marca en el instante exacto en que la cruzas, no en el segundo siguiente.
- La app pide a Chrome que no borre tus sesiones aunque falte espacio; Ajustes › Respaldo dice si lo consiguió.
- Colores con un solo significado: dorado para actuar, verde agua para XP y nivel, amarillo para monedas, azul para consejos y novedades. Los consejos de cada pestaña no salen a media sesión ni en horizontal, y el primer día tras la bienvenida propone remar en vez de «Hoy descansas».
- Sesiones que no se pierden: la copia de la sesión en curso vive en IndexedDB y solo se borra cuando la sesión quedó guardada; si guardar falla, la app avisa y ofrece intentarlo otra vez. El tiempo y los metros salen del reloj, así que no se pierden aunque Chrome frene la app en segundo plano. Los errores quedan en el registro de Ajustes y las reparaciones del historial corren una sola vez.
- Al recuperar una sesión que quedó a medias, además de guardarla o descartarla puedes seguir remando: lo nuevo se suma a la misma sesión y el rato con la app cerrada cuenta como pausa.

## Pruebas

`npm test` corre las pruebas unitarias de `pruebas/` (también lo hace GitHub en cada PR). Una de ellas comprueba que la versión de `src/version.js` y la de la caché en `sw.js` coincidan, y que todo módulo que importa la app esté en esa caché.

`npm run test:e2e` abre la app en Chromium con tamaño de teléfono, en modo demo y con el reloj simulado, y recorre los flujos que no pueden fallar: bienvenida, sesión terminada y guardada, recuperar una sesión tras cerrar la app, respaldo de ida y vuelta, modo remo en vertical y horizontal, y uso sin conexión (`pruebas/e2e/`). La primera vez hace falta `npm ci` y `npx playwright install chromium`. GitHub las corre en cada PR y, si fallan, deja el informe con capturas y trazas en los artefactos del trabajo «e2e».

La conexión Bluetooth se prueba sin la remadora con un `navigator.bluetooth` falso (`pruebas/remadora.test.mjs`): saludo inicial, consultas, cambio de resistencia, reconexión y modo demo.
