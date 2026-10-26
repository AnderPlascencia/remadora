# Remadora

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
- Historial guardado en el teléfono (IndexedDB), exportable a CSV y TCX (Strava, Garmin).
- Funciona sin conexión una vez instalada.

## Archivos

| Archivo | Para qué |
| --- | --- |
| `protocolo.js` | Decodifica los paquetes de 20 bytes de la consola |
| `variantes.js` | Secuencias de saludo y consulta de cada variante |
| `remadora.js` | Conexión Bluetooth, cola de escritura, modo demo, banda de pulso |
| `entrenamientos.js` | Lógica de objetivos, intervalos, zonas y FTP (con pruebas en `pruebas/`) |
| `estadisticas.js` | Récords, comparación con la sesión anterior, progreso semanal/mensual |
| `voz.js` | Avisos por voz |
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
