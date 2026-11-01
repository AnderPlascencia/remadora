# Bienvenida, guía rápida y perfil

Cómo aprende la app quién eres y cómo aprendes tú a usar la app, sin pantallas de texto largo.

## 1. Estrategia en tres capas

| Capa | Cuándo sale | Qué hace |
| --- | --- | --- |
| **Bienvenida** (5 pasos) | La primera vez que abres la app. Se repite desde Ajustes › Ayuda. | Explica la app en 4 tarjetas y pide lo justo para dejarla a tu medida. |
| **Consejo de la pestaña** | La primera vez que abres cada pestaña. | Una tarjeta arriba: qué hay aquí, con «Cómo funciona» (abre la guía en ese tema) y «Entendido». |
| **Guía rápida** | Cuando quieras: Ajustes › Ayuda o desde un consejo. | 8 temas cortos (3 a 5 frases) con botón para ir a esa pestaña. |

El modo remo, que es de pantalla completa, avisa sus gestos con un aviso breve la primera vez.

Principios: todo se puede saltar, nada se pregunta dos veces (la bienvenida y Ajustes escriben los mismos datos),
y cada dato pedido dice para qué sirve.

## 2. Bienvenida

1. **Qué es Rower**: rema y mira tus números, sigue tu plan, haz crecer a tu héroe, mira cómo mejoras.
2. **Héroe**: clase y nombre.
3. **Objetivo**: uno de los 5 planes o «Solo remar», con **días por semana** y **tiempo por sesión**.
4. **Tu perfil**: experiencia, sexo, edad, peso, altura y FTP si lo sabes. Debajo se ve en vivo lo que la app
   calcula con eso (pulso máximo, FTP de arranque y gasto en reposo).
5. **Conectar** la remadora, o modo demo. Al repetir la bienvenida este paso no sale.

Al repetirla, el plan solo se rehace si cambias el objetivo, los días o el tiempo por sesión.

## 3. Perfil y para qué se usa

| Dato | Dónde se usa |
| --- | --- |
| Edad | Pulso máximo (220 − edad) y zonas de pulso; metabolismo basal. |
| Sexo | Metabolismo basal; FTP de arranque; referencias de W/kg de la tripulación (−18 % para mujeres). |
| Peso | W/kg, metabolismo basal y FTP de arranque. |
| Altura | Metabolismo basal (Mifflin-St Jeor). |
| Experiencia | Volumen del plan mientras no hay 3 sesiones de historial; FTP de arranque. |
| Días por semana | Plan de la bienvenida y del asistente de Planes. |
| Tiempo por sesión | Ninguna sesión del plan pasa de ese tiempo (las pruebas sí, porque miden siempre lo mismo). |

- **Calorías**: cada segundo suma lo de los watts más el basal de tu perfil. Si falta edad, sexo o altura,
  se usa 1 kcal por kg y hora, como antes.
- **FTP de arranque**: sin sesiones ni FTP, W/kg típicos según experiencia (1.3 / 1.8 / 2.4), un 18 % menos para
  mujeres y un 0.5 % menos por año después de los 35. Queda como «estimado» y la primera sesión de 10 min o más lo
  reemplaza, aunque sea más bajo.
- **Tope de minutos**: si una sesión no cabe, se le baja el volumen; luego se acortan el calentamiento (5 min) y el
  enfriamiento (3 min); y si aún no cabe, se cambia por la versión corta del mismo tipo (umbral largo → umbral corto,
  fondo con tempo → fondo).
- Si cambias los días o el tiempo en Ajustes y no coinciden con tu plan, Ajustes ofrece «Rehacer plan».

## 4. Archivos

- `perfil.js`: basal, FTP inicial, factor de la tripulación, qué falta y lo que aporta al plan.
- `guia.js`: temas de la guía y el consejo de cada pestaña.
- `programa.js`: `duracionPlan` y el tope `ctx.minutosMax` en `planPorObjetivo`.
- `pruebas/perfil.test.mjs`: pruebas de todo lo anterior.
