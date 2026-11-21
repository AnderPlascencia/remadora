# Grabaciones de la consola

Sesiones grabadas para reproducirlas en las pruebas (`pruebas/sensor.test.mjs`). Cada archivo es el texto de
«Paquetes de la consola» tal como sale del registro de Ajustes › Diagnóstico: una línea por paquete con su hora,
la dirección (`<<` de la consola, `>>` a la consola) y los bytes.

- `sintetica-corte.txt`: generada con los paquetes del modo demo. Son 30 s remando, 7 s sin datos (la consola se
  cuelga) y 20 s más. Sirve de base hasta tener grabaciones reales.

Para añadir una real: rema con la RW200, copia el registro desde Ajustes, guarda solo el bloque de paquetes en un
`.txt` aquí y añade su caso en `sensor.test.mjs`. Lo más útil es grabar una sesión con un corte de Bluetooth, otra con
la banda de pulso y otra con un cambio de resistencia.
