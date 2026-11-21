# Cambios

Lo que cambia en cada versión de Rower. La versión de la app vive en `src/version.js`; esta lista empieza siempre por esa versión (lo comprueba `pruebas/version.test.mjs`).

## 0.89.0 · 2026-11-21

Empezar y seguir la sesión sin pelearte con el teléfono.

- **Empezar desde el modo remo.** Con el teléfono ya en el soporte, Empezar está ahí mismo. Y si enciendes «Empezar al dar la primera palada», basta con remar.
- **Atajos en el icono.** Mantén pulsado el icono de Rower: «Entrenar hoy» y «Remo libre» abren el modo remo listo para empezar.
- **Gestos más tolerantes.** El doble toque tiene más margen (450 ms) y mantener pulsado también pausa. Cada gesto reconocido vibra.
- **Sin mirar la pantalla.** Si llevas 10 s fuera de tu rango en una serie, el teléfono vibra: tres toques cortos para subir, uno largo para bajar. En los 30 s finales de cada serie, voz y vibración propia.
- **Vista «solo un número».** Los watts a pantalla casi completa, para remar mirando por la ventana. Va después de los números grandes al cambiar de vista, y se puede elegir en Ajustes.
- **Un primer día sin ruido.** Tras la bienvenida solo ves «Hoy toca» y Empezar: sin confeti, sin consejo de la pestaña y sin Opciones de carrera hasta tu primera sesión. Las preguntas de «Antes de remar» pasan encima de Empezar, donde se ven.

## 0.88.0 · 2026-11-21

La imagen para compartir se ve antes de mandarla, habla claro y tiene los colores de la app.

- **Vista previa.** «Compartir imagen» abre primero la imagen. Ahí eliges el formato (historia 9:16, vertical 4:5 o cuadrada 1:1) y qué enseñar: el nombre de tu héroe sale, el pulso y las calorías no, hasta que los enciendas. Después, Guardar o Compartir.
- **Un dato protagonista.** Grande y según la sesión: un récord si lo hubo, el tiempo en la prueba de 2000 m, el % del tiempo en tu rango en los intervalos, o la distancia. Debajo, tres datos más (el mejor minuto en los intervalos, el split en la prueba).
- **Título honesto.** «✓ Completado», «18 de 25 min» si la dejaste a medias o «Versión corta de 15 min», y «Semana 2 de 6 · sesión 3 de 4» si era del plan.
- **Con la letra y los colores de Rower.** Barlow Condensed para los números, un solo logo y todo el texto con buen contraste (al menos 4,5:1). En historias, el texto queda lejos de los bordes, donde la app pone sus botones.

## 0.87.0 · 2026-11-21

Fallar un día o una semana ya no te saca del camino. Lo que da XP cuenta desde el lunes 23 de noviembre, y lo ganado antes de ese día no cambia.

- **«Solo tengo 15 / 20 min».** En Hoy, con la sesión del día elegida, una versión corta conserva el estímulo clave: 5 min de calentamiento, el trabajo que quepa (2 de 4 series enteras, por ejemplo, o un fondo más corto) y 3 min de enfriamiento. Cuenta como la sesión del plan hecha a medias: mantiene la racha y la semana, y paga «Sesión del plan terminada» (la mitad).
- **Protocolo de regreso.** Al volver tras un parón, la app te da la bienvenida sin reproches y adapta el plan:
  - De 5 a 9 días fuera, tu primera sesión va al 80 %.
  - De 10 a 20 días, una semana de vuelta al 65 % del trabajo y con los rangos un 5 % más bajos. Si la semana anterior quedó a medias, el plan la repite y se alarga.
  - Desde 21 días, Hoy propone rehacer el plan desde hoy.
  - Sin plan, te sugiere un fondo suave.
- **Escudos de racha.** Cada semana del plan cumplida guarda un escudo, hasta 2. Un escudo salva solo un día perdido para que la racha no se corte. Progreso muestra tus escudos y tu mejor racha, y si la racha se corta dice «hoy empieza una racha nueva».
- **Sesión de regreso.** Tras 10 días o más sin remar, tus 3 primeras sesiones pagan como la sesión del día (+150) aunque sean suaves. No es un multiplicador, para no premiar parar.

## 0.86.0 · 2026-11-21

Una cita con el remo: eliges qué días y a qué hora remas, y tu calendario te lo recuerda. Todo funciona sin servidor.

- **Tus días y tu hora.** En Ajustes › Perfil marcas tus días (de 1 a 5) y tu hora habitual. Vienen ya puestos: los días de siempre para tus días por semana y las 19:00, así la bienvenida no suma toques. Los días marcados son tus días por semana. El plan se arma en esos días, sin dos sesiones duras seguidas. Si tu plan va en otros días, Perfil te ofrece rehacerlo.
- **Tu próxima cita en Hoy:** «Tu próxima cita: el jueves, 19:00 · Fondo 45». Con plan, es su próxima sesión; sin plan, el próximo de tus días.
- **Al calendario.** «Añadir a mi calendario» baja un archivo .ics con lo que queda de tu plan (o tus días de las próximas 4 semanas), con un aviso 30 min antes. Si el plan cambia, se vuelve a añadir.
- **Cierre con cita.** El resumen de la sesión termina con «¿Cuándo remas la próxima?», el día y la hora. Puedes añadir esa cita a tu calendario o cambiarla de día y de hora.

## 0.85.0 · 2026-11-21

El plan se paga una vez. Desde el lunes 23 de noviembre las misiones piden lo que no harías de todas formas, y la XP que repetían pasa a la carga del entrenamiento. Lo ganado antes de ese día no cambia.

- **Una misión diaria por día de remo**, no tres. Sale la primera que toque de esta lista:
  - La prueba que toca, si hoy el plan tiene una prueba.
  - La cadencia del bloque, en un día con sesión del plan: minutos con la cadencia estable y la potencia pareja.
  - Un descanso de verdad tras un día de 60 puntos o más: descansa o rema solo suave.
  - Tu capacidad más floja, en un día sin sesión del plan (umbral y VO₂máx solo martes y jueves) o una carrera contra fantasmas, nunca en un día del plan.
- Fuera «Fiel al plan», «La sesión del día», «Remo de recuperación» y «Semana fiel»: «Sesión del plan cumplida» y la semana cumplida ya pagan el plan. Con plan, tampoco sale «Semana pareja», porque la diaria ya pide la cadencia cada día. «Dominio de Roma» pide menos diarias, porque ahora hay una por día.
- La carga del entrenamiento paga el doble: 10 XP por punto hasta 30 y 5 de 30 a 60, con el mismo tope de 60 puntos por día. Con un plan de 4 días, Legendario sigue llegando hacia los 18 meses, y las misiones pasan del 43 % al 16 % de la XP. Las monedas bajan entre un 2 y un 17 % según cómo remes, así la colección dura más.
- Pruebas: el simulador de 2 años es ahora una prueba de la curva. Falla si con un plan de 4 días Legendario llega fuera de 16–20 meses, si con remo libre llega antes de 24 meses o si una diaria vale más que media sesión. Las pruebas por propiedades comprueban que la XP y el nivel nunca bajan y que las monedas nunca son negativas. Otra prueba comprueba que un historial anterior al corte da la misma XP que antes.

## 0.84.0 · 2026-11-21

La carga se calcula aunque no tengas FTP, y el FTP se mantiene al día solo con tus sesiones.

- **Carga por esfuerzo (sRPE).** Sin FTP, o si la consola no manda watts, la carga sale de cómo se sintió la sesión × sus minutos. De serie, una hora a tu FTP sentida como un 7 vale unos 100. Con 3 sesiones que tengan watts y esfuerzo a la vez, el factor se calibra a ti. La forma, el ratio de carga y la recuperación ya cuentan esas sesiones. En el resumen, con Datos avanzados, la carga dice si sale del esfuerzo.
- **FTP vivo.** La app propone cambiar tu FTP con un toque y nunca lo cambia sola:
  - Lo propone subir cuando la mediana de tus 3 mejores sesiones de los últimos 90 días pasa de tu FTP. Antes bastaba una sola sesión buena.
  - Lo propone bajar si tu potencia crítica de las últimas 6 semanas, con alguna sesión dura, cae más de un 5 %.
  - También lo propone bajar un 5 % si llevas 21 días sin una sesión dura.
  - Si aceptas o tocas «Ahora no», no vuelve a proponer nada durante 14 días.
- **Esfuerzo en 5 botones grandes:** Fácil, Moderado, Duro, Muy duro y Máximo. Se guardan como 2, 4, 6, 8 y 10 en la escala CR10, y «Afinar de 1 a 10» da la escala entera.
- «Tu constancia» muestra qué parte de tus sesiones de los últimos 28 días tiene carga conocida y cuál tiene tu esfuerzo marcado.

## 0.83.0 · 2026-11-21

Más fácil de usar con lector de pantalla y con el dedo, y un CI que vigila todas las pantallas.

- La bienvenida, el resumen de la sesión, Progreso y Planes pasan axe (WCAG 2.1 AA) con los tres temas, como ya lo hacían Entrenar, el modo remo, Héroe y Ajustes. Lo corregido:
  - Las opciones de la bienvenida y del asistente de plan se anuncian como elegidas.
  - Mejor contraste en el escalón de plata del podio, los días sin sesión del calendario, las insignias por ganar, los nombres técnicos de las capacidades, el «Hecho» del plan y las dificultades en el tema claro.
  - Las filas del historial y de tus entrenamientos son botones de verdad dentro de su lista.
  - La curva del plan es un grupo de botones con nombre, y Programa tiene sus títulos en orden.
  - El menú de abajo es una zona de navegación.
- Todo lo que se toca mide al menos 44 px: chips, botones chicos, segmentos, pestañas de Planes, enlaces y nombres de las tarjetas. Las excepciones son el «?» de ayuda, que ya tenía 44 px de zona táctil, y la escala de esfuerzo del 1 al 10, que en una fila no cabe a 44 px de ancho.
- Con una hoja, un diálogo, la bienvenida o el modo remo abiertos, lo de detrás queda inerte. El foco entra en la capa y, al cerrarla, vuelve a donde estaba, por ejemplo a la fila de la sesión que abriste.
- CI: cada PR muestra la cobertura de las pruebas unitarias en el resumen del trabajo (y el lcov como artefacto). Las acciones de GitHub van fijadas por SHA.

## 0.82.0 · 2026-11-21

La app mide tu constancia, solo en tu teléfono, para saber qué te ayuda a seguir remando.

- Nueva tarjeta «Tu constancia» en Progreso, visible con Datos avanzados. Muestra tus sesiones por semana (8 semanas), cuánto del plan cumpliste, tus pausas de 4 días o más (y las de 8 o más), cuánto tardas de normal en volver tras una pausa y la pausa más larga.
- En los últimos 28 días también muestra cuántos días abriste la app, cuántas sesiones empezaste y cuántas dejaste (muy cortas, descartadas, sin acabar el plan o cerradas sin recuperar), y cuántas imágenes compartiste.
- Quedan anotados como eventos locales abrir la app, empezar y terminar una sesión, cada paso de la bienvenida y compartir la imagen. Se guardan como mucho 3000 y nunca salen del teléfono.
- Los eventos van en el respaldo y se suman sin repetirse al restaurarlo.

## 0.81.0 · 2026-11-21

El plan «Meta 2000 m» pasa a ser un plan de verdad: sale del mismo motor que los demás planes, con sus topes y su descarga.

- Una sola sesión dura por semana, que alterna umbral (series largas a tu split meta + 10 s) y ritmo (tramos de 500 a 750 m a tu split meta). El resto son fondos suaves y un fondo con tramos firmes: cerca del 80/20.
- Mismos topes que los otros planes: la carga semanal sube como mucho un 15 %, hay semana de descarga y el trabajo por encima del umbral está limitado.
- La prueba de la distancia, a mitad y al final del plan, con afinamiento: esa semana las otras sesiones bajan un 20 % (mitad) o un 45 % (final).
- Cada bloque lleva una cadencia guía según su zona: 18–22 golpes/min en suave, 20–24 en firme, 24–28 en umbral y 28–34 a ritmo de carrera. Se ve junto a la meta del bloque y se dice por voz; los sprints no llevan.
- En un bloque suave con guía, si pasas 2 golpes del tope durante un minuto, la app te avisa con voz y un aviso corto.
- El plan se adapta a tu nivel (empezando, a veces o seguido) según tu historial.

## 0.80.0 · 2026-11-21

El sensor, más fiable: los números llegan antes y un corte de la consola ya no deja la sesión colgada.

- Los watts, el split y los golpes se pintan en cuanto llega el dato de la consola, no en el siguiente tic de cada segundo (hasta 1 s menos de retraso visible).
- Vigilante: si la consola deja de mandar datos 4 s mientras remas con el Bluetooth aún conectado, la app dice «La consola no responde», fuerza la desconexión y reconecta sola. Antes esperaba un aviso de Chrome que, con la consola colgada, podía no llegar.
- Con una sesión en marcha la reconexión ya no se rinde a los 5 intentos (unos 15 s): sigue con una espera que crece hasta 5 s. Sin sesión, sigue rindiéndose a los 5. Cada intento de conexión tiene un límite de 10 s.
- La banda de pulso también reconecta sola si se corta, con las mismas reglas. Mientras tanto el pulso marca 0.
- El modo remo vuelve a empezar apagado (decisión de Ander): se abre con su botón o con el ajuste «Abrir modo remo al iniciar sesión».
- Pruebas que reproducen sesiones grabadas de la consola con su ritmo real (`pruebas/grabaciones`). Por ahora hay una sintética con un corte; las reales de la RW200 se añaden copiando el registro de Ajustes › Diagnóstico.

## 0.79.0 · 2026-11-21

Los números se leen remando, a 1,5 m del teléfono y en pleno esfuerzo.

- Watts de 64 px o más en todas las vistas del modo remo. En la carrera en vertical pasan de 24 a unos 74 px, con el split a 40 px al lado (el lago se encoge un poco). En horizontal, de 41 a 74 px en la carrera y de 48 a 64 px en la gráfica.
- El modo remo se abre solo al empezar la sesión. Si prefieres la vista normal, apágalo en Ajustes › «Abrir modo remo al iniciar sesión».
- Los avisos ya no tapan los números: en el modo remo salen arriba, sobre la cabecera. Van en cola, uno a la vez: el siguiente espera a que el actual lleve 1,5 s en pantalla en lugar de pisarlo. Los de seguridad (conexión, guardar) pasan primero y los del juego al final. Fuera el aviso duplicado al abrir el modo remo.
- Contraste 7:1 en el modo remo con el tema oscuro: etiquetas más claras y Terminar en un rojo más hondo.
- Carrera en 3D: la cámara va más cerca y más baja, así tu bote y los de al lado se ven unas 1,5 veces más grandes. La tabla de rivales se pliega a una línea con el más cercano («Silas Crane +1 m · 2 más»), a 14 px.
- Al terminar, la vista previa de Entrenar espera a que la sesión quede guardada antes de leer el historial, y si esa lectura falla se anota en el registro en lugar de dar un error.

## 0.78.0 · 2026-11-21

Una sola racha y un solo «qué toca»: la app ya no te pide cosas distintas a la vez.

- Una racha: los días seguidos cumpliendo tu plan (las sesiones y los descansos). Desde el 22 de noviembre la racha ya no da XP ni Voluntad, para que no compita con el plan. Remar fuerte en un día de descanso ya no la rompe (antes se perdía por entrenar de más). Progreso enseña esa racha, las semanas del plan cumplidas y tu mejor marca; sin plan, las semanas seguidas remando. Desaparece «días seguidos remando».
- «Semana perfecta» se gana al completar una semana entera de tu plan, no 7 días seguidos remando. Las insignias que ya tienes se quedan.
- El resumen al terminar dice cuál es la próxima sesión de tu plan y cuándo («Próxima de tu plan: Fondo 30 min, el sábado»), y después qué atributo sube. Sin plan sigue la recomendación por atributo.
- En los días de plan la misión del juego se cambia por una de técnica, así la sesión del plan no compite con otra cosa.
- Los atributos que aún no has entrenado dicen «Sin entrenar aún» y te dejan ver cómo subirlos, en lugar de un 0.

## 0.77.0 · 2026-11-21

Medidas del cuerpo más fiables: zonas de pulso, pulso máximo, FTP inicial y esfuerzo.

- Zonas de pulso coherentes con y sin pulso en reposo. Sin él, la app supone uno típico (el 30 % de tu máximo), así la zona 2 va del 72 al 79 % del máximo y no se mueve unos 20 lpm cuando lo escribes (con 190 de máximo pasaba de 114–133 a 138–151 lpm; ahora de 137–150 a 138–151). Lo mismo para las 5 zonas y los bloques por % de pulso, que ahora dicen el % del máximo que de verdad es. Si al escribir tu pulso en reposo la zona 2 se mueve más de 5 lpm, la app te dice cuánto.
- Pulso máximo por edad con la fórmula de Tanaka (208 − 0,7 × edad) en lugar de 220 − edad, que se quedaba corta a partir de los 40 (a los 60, 166 en vez de 160).
- FTP sin prueba: cada sesión aporta el 95 % de su mejor tramo de 20 min (o el 90 % del de 10 min), no su media con el calentamiento y los descansos, y el FTP estimado es la mediana de tus 3 mejores sesiones recientes, así un día bueno no lo infla.
- Esfuerzo: el que marcas tú y el que sale del pulso se guardan aparte (`rpe` y `rpePulso`). El del pulso se calcula con el TRIMP de Edwards (tiempo en cada zona) y el tiempo en zonas 4 y 5, así las series ya no se diluyen con sus descansos. En el resumen aparece como sugerencia y tú marcas cómo lo sentiste. La adaptación del plan solo sube tus rangos con el esfuerzo que diste tú. Las sesiones de antes conservan su dato y la XP no cambia.
- Pruebas: dos pruebas de pantalla que a veces fallaban con la máquina cargada (la del historial ilegible y la de «Antes de remar») ya no dependen de quién llega antes.

## 0.76.0 · 2026-11-21

Planes que respetan la fatiga.

- El tope de subida semanal de los planes por objetivo ahora mide también la carga planificada (como el TSS), no solo los minutos de trabajo: el trabajo intenso pesa más. La semana que vuelve de una descarga sube como mucho un 5 % sobre la última semana normal, y las semanas con prueba ya no sirven de referencia para la siguiente. Antes la vuelta de la descarga podía subir la carga un 40–50 % de golpe; ahora ninguna semana pasa de 1,15 × la última normal y el ratio agudo:crónico simulado se queda en 1,3 o menos (lo comprueba una prueba nueva con 480 planes).
- Si el siguiente paso no cabe en el tope, el plan avanza igual con un poco menos de volumen (hasta un 20 %) en lugar de quedarse varias semanas en la misma sesión.
- Con 1 o 2 días por semana, la prueba ocupa el lugar de la sesión dura: la semana de la prueba ya no tiene dos sesiones duras.
- Plan hacia una meta (por ejemplo 2000 m): las sesiones escritas en split ahora se reconocen como umbral, series o fondo comparándolas con el split de la meta. Así «nunca dos duras seguidas», el cambio por un fondo cuando vas cansado y las casillas del modo remo funcionan también en estos planes. Los planes ya guardados se reconocen por su calentamiento.
- Antes de una sesión dura o de una prueba van siempre al menos 5 min de calentamiento: si el entrenamiento no los trae, se añade un calentamiento progresivo al principio y la voz explica por qué.
- El asistente de metas parte de tu marca real de los últimos 90 días en esa distancia; si no la hay, de la predicción desde la distancia más cercana que hayas remado (tus 3 mejores, pesando más las recientes), y ya no de la predicción más optimista de todas. La mejora sugerida depende de cuánto remas (6 % si empiezas, 4 % o 2,5 % si ya entrenas, en 8 semanas) y de las semanas del plan, en lugar de un 4 % fijo.

## 0.75.0 · 2026-11-21

Ninguna sesión se pierde por culpa de la app, y la app mide cómo va mientras remas.

- Al terminar, la sesión se guarda **antes** de leer el historial para los récords y el resumen. Si leer el historial falla (por ejemplo, sin memoria con cientos de sesiones), la sesión ya está a salvo y se avisa de que el resumen completo estará en el historial.
- Una versión nueva de la app ya no se activa a mitad de una sesión: espera instalada hasta que la terminas (antes borraba la caché de la versión anterior con la pantalla abierta y los paisajes que se pidieran después ya no estaban).
- Bluetooth: si la consola tarda en contestar, la siguiente consulta se salta en lugar de amontonarse en la cola, así el retraso de los datos ya no crece durante la sesión. Las escrituras lentas (más de 150 ms) quedan anotadas.
- Registro de diagnóstico: los paquetes de la consola van a un búfer binario de unos 30 min (antes, unos 8 min de texto que se escribía más de 10 veces por segundo en pleno remo). El texto solo se arma al descargar. Se guardan el registro y los paquetes de las 3 últimas sesiones, y la descarga los incluye.
- Ajustes › Diagnóstico muestra cuánto tarda un dato de la consola en verse en pantalla (mediana y peor 5 %), los cuadros por segundo de cada vista de la carrera y cómo fue el Bluetooth. Cada sesión lo guarda en `diagnostico`, así que sale en el respaldo. Nada sale del teléfono.

## 0.74.0 · 2026-11-21

La carrera, más fluida en teléfonos de pantalla muy densa.

- La carrera 2D y 3D pinta como mucho a densidad 2 (la realista ya iba a 1,5), igual que las gráficas. En un teléfono de densidad 4, como el CPH2653, pintaba 4 veces más píxeles que a densidad 2 y rendía la mitad, sin que se note la diferencia a la distancia de la remadora.
- Si aun así el teléfono no llega, la densidad baja sola por escalones (2, 1,5 y 1,25) cuando dos tercios de 60 cuadros seguidos van lentos, y vuelve al máximo al cambiar de vista.
- Las variantes de color de los paisajes (invierno, atardecer, tormenta, luna, aurora y dorada) ya no aplican su filtro en cada cuadro y a cada pieza de la orilla: la imagen se colorea una vez y se dibuja la copia.
- Pruebas: la de cuadros por segundo y una nueva de densidad corren también con la pantalla del CPH2653 (densidad 4), y el presupuesto de la primera carga mide los bytes comprimidos, como los sirve GitHub Pages (436 KB; tope 520 KB, con topes para JS, CSS y HTML).

## 0.73.4 · 2026-11-20

El polinesio completo, con ilustraciones nuevas.

- Los 8 rangos del polinesio que faltaban (de Aprendiz a Legendario) estrenan ilustración semirrealista pintada, a juego con el novato nuevo. Conservan su cara, el moño y la pose, y suben según la matriz de progresión: flor en el moño, primer kākau, malo teñido y luego rojo, lanza, lāʻau y leiomano con dientes de tiburón, y el mahiole con capa de plumas en Legendario.
- Generadas con Open Generative AI en modo local (stable-diffusion.cpp con Z-Image Turbo), cada rango a partir de la imagen del novato, e importadas con `tools/ingest-character.mjs`.

## 0.73.3 · 2026-11-20

El polinesio novato, con ilustración nueva.

- El polinesio de nivel 1 (Novato) estrena ilustración semirrealista pintada, en la misma línea que el vikingo y el pirata: moño atado con cordel, lei de hojas de ti, malo de tapa y remo de pala en forma de hoja. Sustituye al recorte borroso de la lámina original.
- Generada con Open Generative AI en modo local (stable-diffusion.cpp con Z-Image Turbo) e importada con `tools/ingest-character.mjs`; el resto de rangos del polinesio no cambia.

## 0.73.2 · 2026-11-11

La bandera de popa, bien puesta.

- En la carrera realista 3D, la bandera va en un asta en la popa, dentro de tu calle y por encima de los remos. Guarda su proporción (el sashimono alto, el gallardete largo) y ondea más rápido cuanto más rápido remas.
- En la vista desde arriba sale de la borda, junto a la popa, ondeando hacia atrás por encima de la vela, en lugar de flotar suelta fuera del bote.
- En la vista desde arriba, la vela de tu bote es más grande, para que se lea su dibujo, y el aro discontinuo pasa por debajo de ella en lugar de tacharla.
- Los mascarones ilustrados (la Piña de Potosí y el espolón de la flota del Rin) se ven más grandes en la proa, porque al ser alargados se perdían.

## 0.73.1 · 2026-11-11

- La XP que se calcula antes de remar ya no suma por error el ajuste del cambio de curva de niveles (salía de más al estimar con sesiones anteriores al 11 de noviembre).

## 0.73.0 · 2026-11-11

Premios de jefe: ya se ganan.

- Al vencer al jefe de los capítulos 1, 2 o 3 ganas, además de la insignia de siempre, la pieza del bote de la clase con la que remabas: la bandera de popa, las palas o el mascarón, y la vela. Aparece en la colección de tu bote y en el aviso de «¡Jefe vencido!».
- Si ya habías vencido a esos jefes, las piezas son tuyas desde ahora, de la clase que llevabas entonces.
- Si cambias de clase, cada pieza es de la clase con la que venciste a su jefe. El polinesio sigue con la insignia sola hasta la revisión cultural de su saga.

## 0.72.0 · 2026-11-11

Premios de jefe, primera tanda: las piezas ilustradas de los capítulos 1 a 3.

- Cada jefe de los capítulos 1 a 3 tendrá su pieza propia para el bote del vikingo, el pirata, el samurái y el romano: una bandera de popa (capítulo 1), unas palas o un mascarón (capítulo 2) y una vela (capítulo 3). Son ilustraciones nuevas, como la Vela de la hafgufa, el Gallardete de la fragata, el Sashimono del rōnin o el Vexillum de Pompeyo.
- La bandera de popa es un tipo de pieza nuevo: ondea en un asta a un lado de la popa, sin tapar a tu remero. No da ventaja, es tu trofeo. La vela y el mascarón dan la misma ventaja que los de su tipo.
- Las piezas aún no se pueden ganar: se conectan a los jefes en la siguiente versión. El polinesio espera la revisión cultural de su saga.

## 0.71.0 · 2026-11-11

Séptima etapa del rediseño del héroe: maestría de clase, para quien rema años.

- Cada clase tiene su propia maestría, del 1 al 10, que sube con las sesiones de 10 min o más remadas con ella: de Aprendiz a Gran maestro. Con 4 sesiones por semana, la maestría 10 llega en unos 15 meses.
- Cambiar de clase no borra nada: cada una guarda la suya, así que probar otra cultura no cuesta lo ganado. Al elegir clase ves la maestría de las que ya remaste.
- Cada nivel de maestría da monedas (50 por nivel: el 10 da 500). Las sesiones de antes cuentan para el nivel, pero las monedas solo se pagan por los niveles alcanzados desde hoy.
- La maestría se ve en la ficha del héroe, con lo que falta para el siguiente nivel.

## 0.70.0 · 2026-11-11

Sexta etapa del rediseño del héroe, primera parte: cada cultura vive su propia saga.

- Los 9 capítulos mantienen sus requisitos, niveles, pruebas y premios, pero la historia y el jefe salen de la mitología o la historia naval de tu clase. El vikingo cruza la red de Rán y le gana la carrera a Naglfar, el pirata se enfrenta a Woodes Rogers, el cazapiratas de 1718, el samurái vence a Yamata no Orochi y el romano llega a Accio.
- Los dioses de culturas vivas no son enemigos: el samurái cruza la tormenta de Raijin y visita el palacio de Ryūjin, no los vence.
- El polinesio sigue con la historia común hasta que su saga la revise alguien de esa cultura, igual que sus títulos.
- Los premios propios de cada cultura llegarán con su dibujo en la segunda parte.

## 0.69.0 · 2026-11-11

Quinta etapa del rediseño del héroe: cada clase tiene una habilidad en carrera que se activa sola cuando remas como lo haría su cultura, sin tocar la pantalla.

- Vikingo: Timonel (2 min de palada un 5 % más larga que tu media, con cadencia de 24 o menos). Con la senda Berserker, Furia del berserker (20 s por encima del 110 % de tu FTP con cadencia de 30 o menos, hasta 2 por carrera con 3 min entre ellas).
- Pirata: ¡Al abordaje! (a menos de 15 m detrás de un fantasma, 15 s un 10 % más fuerte que tu media). Hasta 3 por carrera, compartidas con Mano rápida, con 90 s entre ellas, y no cuenta si te dejaste caer a propósito.
- Samurái: Zanshin (los últimos 250 m con la cadencia estable y sin aflojar). Polinesio: Estrella guía (4 min con el ritmo parejo). Romano: Ritmo del pausarius (3 min con la cadencia de tus 2 primeros minutos).
- Límites del entrenador: vale en carreras y Remo libre, nunca en pruebas ni en sesiones del plan. Paga plano, como mucho 15 m por carrera y dentro de los 40 m de los talentos. La Furia y el Abordaje son de intensidad: con el cuerpo cargado, tras 2 sesiones duras en la semana o sin calentar en los primeros 5 min, descansan y usas la de constancia (Timonel o Estrella guía). Mano rápida pasa a seguir esas mismas reglas.
- La habilidad de tu clase se ve en Héroe › Talentos.

## 0.68.0 · 2026-11-11

Cuarta etapa del rediseño del héroe: dos sendas por clase desde el nivel 20.

- Al llegar al nivel 20 eliges senda, gratis y con cambio libre cuando quieras. Las mejoras 1 y 2 son de toda la clase; la senda cambia las mejoras 3, 4 y la maestría. Tus grados se quedan donde están y valen para la senda que sigas. La senda A son los talentos de siempre, así que si no eliges nada no cambia nada.
- Las sendas B: el vikingo Berserker (una salida furiosa por carrera, XP por las sesiones clave del plan y por fantasmas en carreras cortas), el pirata Intendente (victorias reñidas, botín y Alta mar), el samurái de la Senda de la espada (precisión en tu rango de vatios y remo parejo), el polinesio Remero de carrera (remontada final y regatas ganadas) y el romano Harpax (el arpón de Agripa: metros al adelantar y la Corona naval en Alta mar). Todas quedan igualadas con las demás (unos 50 XP por sesión con el árbol completo) y dentro de los topes de 150 XP y 40 m.
- Los talentos de intensidad (Furia de salida, Remontada y Harpax) siguen los límites del entrenador: descansan con el cuerpo cargado o agotado, con 12 h o más de recuperación pendiente, en las pruebas, en las sesiones del plan, en los días de descanso y cuando ya llevas 2 sesiones duras en la semana. Sin calentar, nada de intensidad en los primeros 5 min; las primeras 4 semanas, una sola activación por carrera; y como mucho 15 m por carrera entre todos ellos.

## 0.67.0 · 2026-11-11

Tercera etapa del rediseño del héroe: cada clase tiene la identidad de su cultura.

- Títulos propios por rango, cargos reales de su flota o su sociedad, junto al número de rango: el vikingo va de Dreng a Einherjar (Jarl es el rango 7), el pirata de Polizón a Leyenda del Caribe, el samurái de Komono a Kensei y el romano de Tiro a Praefectus classis. El polinesio sigue con el rango común hasta que sus títulos hawaianos los revise alguien de esa cultura.
- El vikingo premia la palada larga y potente, que es lo que mide su atributo Fuerza, en vez de contar paladas: Brazos de hacha da XP por kilómetro si tu palada media es al menos tan larga como la habitual, Saga de fuerza si es un 3 % más larga, y Botín de la saga si remas 5 km o más con ella. Remar corto y rápido para sumar paladas ya no da más. Las sesiones anteriores siguen contando como antes, y el vikingo sigue igualado con las demás clases (unos 50 XP por sesión con el árbol completo).

## 0.66.0 · 2026-11-11

Segunda etapa del rediseño del héroe: una curva de niveles pensada para durar 18 meses hasta Legendario.

- Los niveles se miden en sesiones: al empezar sube 1 nivel por sesión, hacia el 40 hacen falta unas 3 y cerca del 80 unas 8. Remando 4 veces por semana con tu plan, Legendario (nivel 80) llega en unos 18 meses y el 90 unos meses después. Antes, el primer mes daba 30 niveles y al final hacían falta 20 sesiones por nivel.
- Nadie pierde nada: el día del cambio conservas tu nivel y lo que llevabas hacia el siguiente. Como la curva nueva pide más XP por nivel, se te suma la diferencia; nunca se quita XP. Las sesiones anteriores siguen contando con la curva de antes.
- Los jefes de la historia también se vencen cumpliendo una semana entera de tu plan, así avanza quien no compite ni hace pruebas.

## 0.65.0 · 2026-11-10

Primera etapa del rediseño del héroe: cada clase usa nombres fieles a su cultura y a su época. Solo cambian nombres, textos y dos dibujos; nadie pierde piezas, talentos ni XP.

- Samurái: la vela de rango pasa a ser el Hinomaru, el disco rojo sin rayos (la bandera con rayos es de 1870). La Gran ola de Hokusai, dos siglos posterior, pasa a ser el Seigaiha, el patrón tradicional de olas en escamas, con dibujo nuevo. Su bote es la kobaya de las flotas de clan.
- Polinesio: el mascarón se llama Kiʻi, como en hawaiano, y su versión dorada pasa a ser de madera de koa y nácar (en la Polinesia no había jade ni oro). La vela Tapa se llama Kapa. El rival Keoni, nombre de la época misionera, pasa a ser Kekoa. Los talentos Travesía y Gran travesía se llaman Más allá del horizonte y Viaje de altura, para no repetir nombres de logros.
- Romano: lo que era de la legión pasa a ser de la flota (Ley de la flota, Boga de la liburna, Escudo y Águila de la flota). La vela legendaria Sol invicto, culto del año 274, pasa a ser Sol Indiges. El talento Pax romana se llama Semana de la flota, para no repetir el nombre de la hazaña. Las insignias de gladiador pasan a ser el Casco de infante de marina y la Corona naval.
- Pirata: el talento Tesoro del capitán se llama Reparto del botín, como en los artículos de los barcos piratas. Lo de corsario pasa a ser de bucanero (Botín del bucanero, Chaleco de bucanero).
- Vikingo: el casco de cuernos, un invento de ópera del siglo XIX, pasa a ser el Yelmo de Gjermundbu dorado.

## 0.64.2 · 2026-11-10

- Probar resistencia explica por qué no se confirmó: si la consola no mandó datos de potencia (por ejemplo, porque no estás remando) o qué nivel sigue informando. El registro de diagnóstico guarda cada prueba con el byte crudo que manda la consola, para ajustar la lectura del nivel en cada modelo.

## 0.64.1 · 2026-11-10

- Probar resistencia (Ajustes > Diagnóstico) ahora espera la respuesta de la consola: avisa «La consola está en resistencia N» cuando el nivel llega, o que no lo confirmó (y que revises la variante) si en 4 s no lo ve.
- La resistencia automática ya no se pierde si la señal se corta justo al cambiar de intervalo: el nivel se guarda y se manda al reconectar. Al desconectar a mano se olvida el cambio pendiente, para no aplicarlo en la próxima conexión.
- El registro de diagnóstico dice cuándo un nivel de resistencia no se pudo pedir.

## 0.64.0 · 2026-11-09

- La laguna tropical se renueva con imágenes realistas: islas volcánicas cubiertas de selva y motus con palmeras sobre una laguna turquesa, cocoteros, una cabaña con techo de pandano, uveros, buganvillas, rocas volcánicas y una canoa con balancín a los lados del canal. En la vista 2D, playa de arena blanca vista desde arriba, agua transparente con el fondo de arena y la luz moviéndose, y espuma donde el agua toca la orilla. Las variantes de atardecer, luna y dorada lo heredan.

## 0.63.1 · 2026-11-08

- La racha del plan sigue la semana flexible: hacer una sesión otro día de su semana ya no la corta. Cada semana tiene tantos descansos como días sin sesión planeada; un día de más sin remar queda pendiente (no suma ni corta) mientras la semana sigue abierta, y solo corta si la semana termina sin hacer esa sesión. Remar fuerte algo que no es del plan en un día de descanso sigue cortándola.

## 0.63.0 · 2026-11-08

Los planes ya no te atan a días concretos: lo que cuenta es hacer las sesiones de la semana.

- Cada sesión del plan tiene un día sugerido, pero cuenta como hecha si la remas cualquier día de su semana (de lunes a domingo), antes o después. Solo se da por perdida cuando acaba la semana sin hacerla. Dos sesiones iguales en la semana piden dos remadas.
- La sesión del día ofrece lo que te falta de la semana, empezando por lo atrasado, siempre que quepa en los días que quedan: una por día, nunca dos duras en días seguidos (aunque no tengas FTP, una dura del plan ayer cuenta) y ninguna dura si vienes cargado.
- Si vas al día y hay margen, hoy descansas, pero puedes adelantar la próxima con un botón. Si ya no hay margen, te dice que la hagas hoy.
- Si quedan más sesiones que días, avisa de cuál se queda fuera esta semana: primero sobran las duras de más (la prueba se respeta) y luego las suaves.
- El plan ya no cambia una sesión perdida de día: la semana flexible la ofrece sola. Y el cansancio ya no cambia por un fondo una sesión dura que adelantaste y ya remaste.
- En Programa, la semana muestra el día en que hiciste cada sesión, «Pendiente, cuando puedas» para las atrasadas y cuántas llevas y cuántos días te quedan.

## 0.62.0 · 2026-11-08

- El fiordo nórdico, el paisaje gratis de la carrera, se renueva con imágenes realistas: un valle en V con montañas nevadas iluminadas por el atardecer y un glaciar al fondo, pinos, abedules otoñales, rocas con musgo, juncos y una casa roja con tejado de hierba a los lados del canal, y una orilla de bosque y piedras en la vista 2D. Las variantes de invierno, tormenta y aurora lo heredan.

## 0.61.3 · 2026-11-07

- El pirata estrena ilustraciones nuevas para sus 9 rangos, de Novato a Legendario: de grumete descalzo con pañuelo a capitán con abrigo, loro, capa roja y, en Legendario, armadura con runas turquesa y bandera. Se ven en la pantalla Héroe, en la lista de niveles y en el retrato de arriba.

## 0.61.2 · 2026-11-06

- El vikingo estrena ilustraciones nuevas para sus 9 rangos, de Novato a Legendario: pasa de joven con hacha a guerrero con casco, escudo y capa de piel. Se ven en la pantalla Héroe, en la lista de niveles y en el retrato de arriba.
- La herramienta que importa personajes sobre fondo verde ajusta el recorte al tono del verde, para que un fondo verde apagado no deje velo alrededor de la figura.

## 0.61.1 · 2026-11-06

- Toca a tu héroe en la pantalla Héroe (el retrato de arriba o la figura grande) y dice una de sus frases con su propia voz. Sirve para oír tu personaje cuando quieras y para comprobar que sus audios están instalados.

## 0.61.0 · 2026-11-05

Cada clase habla con su propia voz.

- Con clase elegida, sus frases de ánimo («Cada palada, un hachazo», «Un romano no se rinde. Nunca»…) suenan con la voz grabada del personaje: el vikingo grave, rasposo y con autoridad; el romano firme y resonante, como un comandante; el polinesio cálido y pausado, como un guía ancestral; el samurái sereno y controlado; el pirata, un capitán cavernoso y amenazante. Los datos (watts, ritmo, tiempo) siguen con la voz de siempre. Si el audio no se puede reproducir, la frase la dice la voz de siempre.
- Las grabaciones se guardan al instalar la app, así que también suenan sin conexión.

## 0.60.0 · 2026-11-05

Tu clase y el juego también hablan (etapa 2 de la voz).

- Con clase elegida, los ánimos de la voz son de tu personaje y se eligen según el momento: de esfuerzo en las series y las metas («Cada palada, un hachazo», «Al abordaje, que se escapan», «Un romano no se rinde. Nunca») y de calma en fondos, recuperaciones, técnica y descansos («Forma perfecta, mente en calma», «Sigue las estrellas, navegante»). No se repiten en la sesión. Sin clase siguen los ánimos de siempre.
- Avisos del juego por voz, como mucho uno cada 5 minutos y nunca en recuperación, pruebas, el trabajo de VO2 o sprints ni los últimos segundos de un esfuerzo. Al empezar se oye el jefe si hoy lo enfrentas, y si no, tu racha. Durante la sesión se oyen los hitos de la hazaña de tu clase (25, 50, 75 y 100 %), «la misión Fiel al plan está cerca» al 75 % de la sesión del plan y, en el último 20 % de una carrera, «Tu rival está a 12 metros. Lo tienes». Las piezas del bote nunca se dicen por voz.
- Al terminar, después de «Sesión terminada», la voz resume el juego: misiones cumplidas, jefe vencido, hito de hazaña, experiencia ganada y si subes de nivel.
- Nueva línea de XP «Atento al entrenador» (+20 XP), una vez por sesión: respondiste a 3 o más correcciones de la voz volviendo a tu rango en menos de 20 segundos. No cuenta en las pruebas.

## 0.59.0 · 2026-11-05

La voz del entrenador habla según el tipo de sesión (etapa 1 de la voz).

- Al empezar, la voz dice para qué es la sesión y cómo debe sentirse: «Fondo de 40 minutos. Debes poder hablar mientras remas. Hoy gana quien se contiene», «Umbral, 3 series. Incómodo pero sostenible», «VO2, 5 series. Duras de verdad»… Cada tipo tiene su guion: fondo, recuperación, umbral, VO2, sprints, técnica, gasto calórico, metas de distancia y pruebas.
- Serie a serie: «Serie 3 de 5», con frase propia en la penúltima y la última («Última. Todo lo que queda»), «Mitad» en las series de 90 s o más y «Prepárate» a 10 s del final del descanso. Tras una serie de umbral o VO2 dice cómo fue («Buena serie, 2 05 de media. Suelta brazos, respira») y tras un sprint, su pico de watts.
- Las correcciones van con el foco de cada tipo: en un fondo o una recuperación nunca pide apretar («Demasiado fuerte para recuperar. Suelta»); en umbral avisa si sales muy fuerte el primer minuto; en VO2 calla en las 2 primeras series si vas por encima y luego pide dosificar; en técnica dice tu cadencia y la meta; en el descanso de los sprints, que descanses de verdad. Los calentamientos y descansos ya no se corrigen, y la misma corrección se repite como mucho una vez por minuto. Si el pico de los sprints cae más de un 15 % dos veces seguidas, lo avisa.
- Al terminar dice si se cumplió el propósito: «Fondo bien hecho: 88 por ciento en rango», «VO2 terminado: 4 de 5 series en rango», «Pico de 640 watts, 9 por ciento de caída al final».
- Menos voz donde estorba: el parcial va cada 1000 m en fondo y técnica, y no se dice en series cortas, VO2, sprints ni recuperación. Los ánimos de cada 4 minutos son consejos del tipo de sesión («Relaja hombros y manos», «Vuelta lenta: el doble de tiempo que la palada») y no suenan en VO2, sprints ni pruebas.
- La voz ordena lo que dice en tres capas: datos, correcciones y ánimos. Lo importante corta lo menos importante, una corrección suena como mucho cada 20 s y un ánimo cada 3 min, y en los últimos 10 s de un esfuerzo duro solo suena la cuenta atrás.
- Nuevo en Ajustes › Durante el entrenamiento: «Cantidad de voz», con Completa (por defecto), Entrenador (datos y correcciones) o Solo datos.
- A la mitad de una meta, la voz también dice cuánto te queda a tu ritmo, y en un fondo avisa si remas a más de 24 paladas por minuto.

## 0.58.1 · 2026-11-05

- En 3D, los botes de las calles de los extremos vuelven a inclinarse hacia el punto de fuga, pero el remero va recto encima: la barca y el remero se pintan por separado, así el remero ya no se ve aplastado.

## 0.58.0 · 2026-11-05

- En la carrera 3D y 2D, las palas de tu colección se ven en la barca realista: tus remos llevan la pintura de la pieza (los escudos vikingos, las calaveras piratas, la laca roja samurái, las olas talladas polinesias o los rayos de la legión) en cada momento de la palada.

## 0.57.0 · 2026-11-05

Las velas de la colección se ven en la carrera.

- En la carrera 3D, cada bote realista lleva a proa una vela cuadrada con el emblema de su vela: los 25 emblemas de las cinco colecciones, de las franjas del norte al sol invicto, y los legendarios animados (brasas que suben, estrellas que titilan, el sol que gira). La tela ondea con el avance, más rápido cuanto más rápido vas.
- Tu bote lleva su vela opaca y a un lado, para que no tape a tu remero, y un aro blanco discontinuo sobre el agua: se reconoce sin depender del color. Si tienes mascarón, se ve en la proa.
- En 2D, la vela se ve tumbada, ondeando detrás de la popa, con el emblema a la vista.

## 0.56.0 · 2026-11-04

Colección de bote por clase (etapa 15).

- Cada clase tiene su colección de 8 piezas en Héroe › Tienda: 5 velas con emblema de su cultura, un mascarón de proa (y su versión dorada) y unas palas de remo. Las 5 clases siguen la misma escalera: la vela clásica es gratis, la vela de rango se gana en el nivel 20 y el mascarón en el 40, las palas, la vela de taller y la épica se compran (600, 1200 y 2200 monedas) y la vela legendaria y el mascarón dorado se ganan con la hazaña de clase.
- Hazañas de clase (1000 XP nominales y 300 monedas): 75 000 paladas (vikingo), 60 fantasmas vencidos (pirata), 400 minutos técnicos (samurái), 750 km (polinesio) y 10 semanas del plan cumplidas (romano). Cuenta todo tu historial; quien ya la cumplía la cobra en su siguiente sesión.
- El bote de cada clase guarda su propio equipo, así que al cambiar de clase no pierdes nada. Las velas de color siguen a la venta y valen para cualquier bote. La que tenías elegida sigue puesta.
- En la carrera, los rivales de Alta mar llevan la vela épica de su clase y los legendarios, la legendaria.
- Cada pieza da una ventaja pequeña en las carreras contra fantasmas, con un tope de 25 m por carrera entre todas y nunca en las pruebas. Las velas dan de 5 a 15 m de salida según su escalón, y la legendaria suma un efecto de su clase. El mascarón da un 1 % más de distancia en los primeros 2 min (el dorado, un 2 %) y las palas, 1 m cada 100 paladas. Las velas de color dan de 4 a 12 m de salida.
- Tienda de ventajas revisada: pasan de 6 a 12 y se ofrecen 6 cada semana (antes 4), y cada una se puede comprar en lote de 3 por el precio de 2,5. Las de siempre son más fuertes: Salida adelantada 20 m, Viento de cola 3 %, Segunda oportunidad hasta 15 m, Estandarte +25 XP y 10 monedas, y el Mapa baja a 40 monedas. Las nuevas son Corriente favorable, Segundo aire, Cuerno de guerra, Botín del corsario, Bitácora del capitán y Talismán de la clase.

## 0.55.0 · 2026-11-04

Botes, remeros y remos realistas en la carrera.

- En la carrera 2D y 3D, tu bote y los rivales llevan el remero, la barca y los remos realistas de su clase, renderizados en Blender: vikingo, pirata (pañuelo rojo y barba negra), samurái (kimono índigo y hachimaki), polinesio (pareo y collar de flores) y romano (túnica roja y casco de bronce con cresta). Cada barca lleva la madera y la franja de su clase; mástiles, velas y adornos se siguen dibujando encima.
- La palada se ve como en un bote de dos remos de verdad, revisada con el entrenador: brazos rectos mientras empujan las piernas, el tronco abre cuando las manos pasan las rodillas y los codos se doblan al final, por detrás del tronco y a la altura del mango; las manos agarran el puño de su remo, se cruzan a mitad de palada y la muñeca va plana. En la recuperación, brazos, tronco y asiento, por ese orden, y la pala se pluma al salir del agua.
- En la vista 3D los botes de las calles laterales se inclinan hacia el centro siguiendo la perspectiva de la pista.
- Las imágenes de cada clase se descargan la primera vez que sale un bote de esa clase (mientras, se ve el bote dibujado de antes); las de tu clase se guardan para usarlas sin conexión.

## 0.54.1 · 2026-11-04

- La app pesa ~730 KB menos al instalarse: solo se precargan las miniaturas de la tienda y el fiordo gratis. Cada paisaje de pago (la laguna y los cinco de la colección) se descarga al comprarlo, y al abrir la app si ya lo tenías, para correr sin conexión.

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
