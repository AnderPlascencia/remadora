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
- Entrenamientos por intervalos de tiempo con rango de potencia (o golpes por minuto), gráfica del plan completo (rango en verde, fuera de rango en rojo, tu potencia encima), avisos de sube/baja y % del tiempo en rango.
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
- Árbol de talentos, misiones diarias y semanales, historia en 5 capítulos con jefes que son pruebas reales, hazañas, monedas y tienda de ventajas para la carrera.
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

## Archivos

| Archivo | Para qué |
| --- | --- |
| `protocolo.js` | Decodifica los paquetes de 20 bytes de la consola |
| `variantes.js` | Secuencias de saludo y consulta de cada variante |
| `remadora.js` | Conexión Bluetooth, cola de escritura, modo demo, banda de pulso |
| `entrenamientos.js` | Lógica de objetivos, intervalos, zonas y FTP (con pruebas en `pruebas/`) |
| `estadisticas.js` | Récords, comparación con la sesión anterior, progreso semanal/mensual |
| `voz.js` | Avisos por voz |
| `programa.js` | Programas de varias semanas |
| `fantasma.js` | Fantasmas simulados por nivel o a tu medida, y proyección de llegada |
| `carrera.js` | Carrera animada 2D/3D contra los fantasmas |
| `efectos.js` | Confeti y tarjeta de la sesión para compartir |
| `consejos.js` | Qué atributos sube cada entrenamiento, extras con puntos, reto en vivo y análisis al terminar |
| `juego.js` | Héroe: clases, atributos, XP, niveles, talentos, misiones, capítulos y monedas, calculados con tu historial |
| `objetos.js` | Vestimenta, colecciones y dibujo vectorial del héroe |
| `app.js` | Interfaz, sesiones, editor e historial |
| `grafica.js` | Gráficas en canvas |
| `db.js` | Almacenamiento local |

## Seguridad

La app solo escribe en la característica `1534` del servicio iFit `1533`. Nunca escribe en el servicio de
actualización de firmware (`1530`) ni en el servicio `1400`, que solo escucha para diagnóstico.

## Créditos

El diseño de la interfaz sigue la skill [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT), incluida en `.claude/skills/`.


El formato de los mensajes se tomó como referencia del proyecto
[qdomyos-zwift](https://github.com/cagnulein/qdomyos-zwift). El código de esta app es propio.
