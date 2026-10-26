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
- Entrenamientos por intervalos de tiempo con rango de potencia (o golpes por minuto), banda objetivo en la gráfica, avisos de sube/baja y % del tiempo en rango.
- Historial guardado en el teléfono (IndexedDB), exportable a CSV y TCX (Strava, Garmin).
- Funciona sin conexión una vez instalada.

## Archivos

| Archivo | Para qué |
| --- | --- |
| `protocolo.js` | Decodifica los paquetes de 20 bytes de la consola |
| `variantes.js` | Secuencias de saludo y consulta de cada variante |
| `remadora.js` | Conexión Bluetooth, cola de escritura, modo demo, banda de pulso |
| `entrenamientos.js` | Lógica de objetivos e intervalos (con pruebas en `pruebas/`) |
| `app.js` | Interfaz, sesiones, editor e historial |
| `grafica.js` | Gráficas en canvas |
| `db.js` | Almacenamiento local |

## Seguridad

La app solo escribe en la característica `1534` del servicio iFit `1533`. Nunca escribe en el servicio de
actualización de firmware (`1530`) ni en el servicio `1400`, que solo escucha para diagnóstico.

## Créditos

El formato de los mensajes se tomó como referencia del proyecto
[qdomyos-zwift](https://github.com/cagnulein/qdomyos-zwift). El código de esta app es propio.
