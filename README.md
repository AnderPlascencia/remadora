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
- Árbol de talentos, misiones diarias y semanales, historia en 5 capítulos con jefes que son pruebas reales, hazañas, monedas y tienda de ventajas y de paisajes para la carrera (fiordo nórdico gratis, laguna tropical por 400 monedas, variantes de color y cinco paisajes propios: cañón, otoño, cerezos, glaciar y costa mediterránea).
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
- Sesión del día: con plan, la de hoy (o en un día libre, una de la semana que quedó sin hacer, sin juntar dos duras); sin plan, una sugerida con un esquema 80/20 según tu semana y tu cansancio. Siempre dice por qué toca.
- Planes ordenados: nunca dos sesiones duras en días seguidos, la prueba sustituye a una dura, y en Programa ves la semana actual con su estado. Las variantes de cada semana ya no llenan tu lista y los restos de planes anteriores se borran solos.
- Cada sesión guarda sus pausas (hora de inicio y fin), la hora real de fin y la versión de la app; el detalle muestra el tiempo parado. Al pulsar Seguir no se graban segundos hasta que vuelves a remar.
- La meta se marca en el instante exacto en que la cruzas, no en el segundo siguiente.
- La app pide a Chrome que no borre tus sesiones aunque falte espacio; Ajustes › Respaldo dice si lo consiguió.
- Colores con un solo significado: dorado para actuar, verde agua para XP y nivel, amarillo para monedas, azul para consejos y novedades. Los consejos de cada pestaña no salen a media sesión ni en horizontal, y el primer día tras la bienvenida propone remar en vez de «Hoy descansas».
- Sesiones que no se pierden: la copia de la sesión en curso vive en IndexedDB y solo se borra cuando la sesión quedó guardada; si guardar falla, la app avisa y ofrece intentarlo otra vez. El tiempo y los metros salen del reloj, así que no se pierden aunque Chrome frene la app en segundo plano. Los errores quedan en el registro de Ajustes y las reparaciones del historial corren una sola vez.
- Al recuperar una sesión que quedó a medias, además de guardarla o descartarla puedes seguir remando: lo nuevo se suma a la misma sesión y el rato con la app cerrada cuenta como pausa.

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
| `respaldo.js` | Qué guarda un respaldo, su formato y su conversión, la validación de cada sesión y cómo se combina al restaurar |
| `db.js` | Almacenamiento local (IndexedDB): sesiones, sus muestras aparte, entrenamientos y estado (sesión en curso, versión de los datos), con las migraciones de cada versión de la base |
| `historial.js` | Única puerta a las sesiones guardadas: las junta con sus muestras, las guarda en memoria hasta el próximo cambio y calcula el estado del héroe una vez |
| `ajustes-guardados.js` | Registro de los ajustes de localStorage: tipo, valor por defecto y si van en el respaldo |
| `reloj.js` | Segundos de la sesión según la hora del sistema (no se pierden con la app en segundo plano) |
| `version.js` | La versión de la app, en un solo lugar: la ve Ajustes, la lleva la URL del service worker y abre el CHANGELOG |
| `estilos.css` | Estilos de toda la app |

## Versiones y publicación

La versión vive solo en `src/version.js`. `src/app.js` registra `sw.js?v=<versión>`, así que cada versión nueva instala un service worker nuevo con su propia caché, y `CHANGELOG.md` empieza siempre por esa versión (lo comprueba `pruebas/version.test.mjs`). Al cambiar algo: sube la versión en `src/version.js` y añade su entrada arriba en `CHANGELOG.md`.

Para publicar:

1. `npm run test:todo` en verde.
2. `npm run publicar` arma la carpeta `publicar/` (no se sube al repo) con solo lo que carga el teléfono: `index.html`, `manifest.webmanifest`, `sw.js`, `src/` y `assets/`. Deja fuera `assets/characters/` (fuentes de arte), `tools/`, `docs/`, `.claude/` y `pruebas/`.
3. Sube el contenido de `publicar/` al hosting con HTTPS (por ejemplo, GitHub Pages). Nada se publica ni se despliega solo: es un paso a mano y lo decide Ander.

Las fuentes de arte nuevas (`.blend`, `.psd`, `.kra`, `.exr`, `.fbx`, `.glb`, `.wav`, `assets/characters/_source/`…) van por Git LFS según `.gitattributes`: instala Git LFS una vez (`git lfs install`) y haz `git add` como siempre. Lo que ya estaba en el historial se queda como estaba; no se reescribe.

## Seguridad

La app solo escribe en la característica `1534` del servicio iFit `1533`. Nunca escribe en el servicio de
actualización de firmware (`1530`) ni en el servicio `1400`, que solo escucha para diagnóstico.

## Créditos

El diseño de la interfaz sigue la skill [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT), incluida en `.claude/skills/`.


El pipeline experimental del vikingo en 3D (`tools/blender/`, no se usa en la app) parte de la malla base, el
esqueleto y los ojos de [MakeHuman](https://makehumancommunity.org) (CC0) y optimiza con [glTF Transform](https://gltf-transform.dev) (MIT).

El formato de los mensajes se tomó como referencia del proyecto
[qdomyos-zwift](https://github.com/cagnulein/qdomyos-zwift). El código de esta app es propio.

## Pruebas

`npm test` corre las pruebas unitarias de `pruebas/` (también lo hace GitHub en cada PR). Entre ellas: que la versión esté en un solo lugar, que la caché de `sw.js` coincida con los import de `src/`, que toda clave de localStorage esté en el registro de ajustes, cómo guarda y sirve el service worker (`pruebas/sw.test.mjs`) y qué entra en lo publicado.

`npm run test:e2e` abre la app en Chromium con tamaño de teléfono, en modo demo y con el reloj simulado, y recorre los flujos que no pueden fallar: bienvenida, sesión terminada y guardada, recuperar una sesión tras cerrar la app, respaldo de ida y vuelta, modo remo en vertical y horizontal, y uso sin conexión (`pruebas/e2e/`). La primera vez hace falta `npm ci` y `npx playwright install chromium`. GitHub las corre en cada PR y, si fallan, deja el informe con capturas y trazas en los artefactos del trabajo «e2e».

`pruebas/e2e/rendimiento.spec.mjs` es el presupuesto de rendimiento: la primera carga no pasa de 1,25 MB ni de 70 archivos y no baja videos; la carrera da un mínimo de cuadros por segundo en 2D, 3D, realista y modo remo con la CPU 4 veces más lenta, sin pasar su tope (60 en 2D, 30 en 3D y realista); no se pinta fuera de la pantalla ni detrás del modo remo, y 2 h simuladas remando no hacen crecer la memoria, los nodos del DOM ni lo que cuesta cada minuto, con la gráfica en vivo al día. `pruebas/e2e/accesibilidad.spec.mjs` pasa axe-core (WCAG 2.1 A y AA) por Entrenar, el modo remo en sus tres vistas, Héroe y Ajustes con los temas oscuro, claro y alto contraste, y comprueba que en el modo remo ningún texto baja de 14 px.

### Prueba en el teléfono (30 min, a mano)

Lo que las pruebas automáticas no ven: el teléfono real, la remadora y la batería. Una vez por etapa grande, con el teléfono cargado por encima del 80 %, brillo automático y la app instalada desde la página publicada:

1. Anota la batería y abre Rower sin conexión de datos (modo avión con Bluetooth encendido). Debe abrir igual.
2. Conecta la RW200, elige un entrenamiento de 30 min con carrera contra el fantasma y empieza.
3. Minutos 0 a 10, en Entrenar: cambia la carrera a 2D, 3D y realista (toca el lienzo). Ninguna debe dar tirones visibles; la realista puede ir más suave, pero el bote no salta.
4. Minutos 10 a 20, en modo remo: pasa por números, gráfica y carrera (desliza a los lados). Los números se leen a la distancia del brazo y cambian cada segundo; doble toque pausa y reanuda.
5. Minutos 20 a 25: apaga la pantalla 1 min y vuelve; cambia a otra app 1 min y vuelve. La sesión sigue contando y la gráfica no tiene un hueco más largo que esa pausa.
6. Minutos 25 a 30: cambia el tema a claro y a alto contraste en Ajustes y vuelve al modo remo; todo debe seguir legible con luz de día.
7. Termina. Revisa que la sesión quedó guardada con su distancia y que el teléfono no está caliente al tacto.
8. Anota la batería: más de un 10 % en 30 min es para reportarlo, con el modelo del teléfono y la vista de carrera que más usaste.

La conexión Bluetooth se prueba sin la remadora con un `navigator.bluetooth` falso (`pruebas/remadora.test.mjs`): saludo inicial, consultas, cambio de resistencia, reconexión y modo demo.
