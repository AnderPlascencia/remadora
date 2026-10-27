# Reglas de personaje

## Clases

| id | Clase | Atributo favorito | Base cultural | Periodo de referencia |
|---|---|---|---|---|
| `vikingo` | Vikingo | Fuerza | Escandinavia de la era vikinga | 793–1066 |
| `pirata` | Pirata | Agilidad | Piratería del Caribe | 1690–1730 |
| `samurai` | Samurái | Técnica | Japón Sengoku y comienzo de Edo | 1467–1640 |
| `polinesio` | Polinesio | Resistencia | Hawái antes del contacto (propuesta, ver decisiones) | hasta 1778 |
| `romano` | Romano | Voluntad | Flota imperial romana (*classis*) | siglos I–II d. C. |

El sexto atributo, Recuperación, es común a todas las clases y no tiene clase propia.

## Rangos

Vigente desde la versión 3.0.0: **9 rangos, uno cada 10 niveles**, tomados de la lámina «Clases y progresión» que aportó el usuario (`assets/characters/_source/lamina_clases_v1.png`). La lámina rotula 10 rangos pero solo dibuja 9 (falta el 6), así que se numeran de nuevo en orden. Fuente única: `RANGOS` en `tools/characters/spec.mjs`.

| id | Rango | Lema | Edad aparente | Nivel del héroe |
|---|---|---|---|---|
| `novato` | Novato | Inexperto | 18–20 | 1–9 |
| `aprendiz` | Aprendiz | En formación | 20–24 | 10–19 |
| `combatiente` | Combatiente | En acción | 24–28 | 20–29 |
| `guerrero` | Guerrero | Con experiencia | 28–33 | 30–39 |
| `veterano` | Veterano | Conocido | 33–38 | 40–49 |
| `campeon` | Campeón | Dominio | 38–43 | 50–59 |
| `elite` | Élite | Distinguido | 43–50 | 60–69 |
| `maestro` | Maestro | Leyenda local | 50–57 | 70–79 |
| `legendario` | Legendario | Inmortal | 57–65 | 80 o más |

Los ejes de pulcritud, barba, vestuario y porte de la escala anterior de 5 rangos siguen valiendo como dirección: crecen de forma gradual a lo largo de los 9. **Pendiente:** el nivel máximo de la app es 50 (`juego.js → NIVEL_MAX`); con un rango cada 10 niveles hay que subirlo al menos a 80 para llegar a Legendario.

## Reglas generales

1. **El maestro manda.** El Novato aprobado de cada clase es la referencia de los otros 8 rangos. Si un rango se desvía del maestro, se corrige el rango; el maestro no se toca.
2. **La cara no cambia de estructura.** Cráneo, orejas, nariz, ojos, tono de piel y color base del pelo son fijos. Por rango solo cambian la expresión, las arrugas, las canas y el vello.
3. **Misma pose, misma escala y mismo pivote** en los 25 personajes.
4. **Un ascenso se tiene que notar.** Entre dos rangos seguidos cambian al menos 3 de los 5 ejes (edad, pulcritud, barba o cabello, vestuario, porte).
5. **Como máximo 2 piezas nuevas por ascenso.** Lo que sube de rango es la calidad del material y el estado de conservación, no la cantidad de objetos.
6. **La pulcritud no borra la historia.** Desde Veterano puede haber cicatrices y desgaste aunque el equipo esté bien cuidado.
7. **La edad no debilita.** El Legendario tiene canas y arrugas, pero conserva la masa y la postura erguida.

## Rigor cultural

- Solo se usan elementos documentados del periodo de la clase. Si una pieza es una estilización, se anota aquí.
- No se usan cascos con cuernos ni alas en el vikingo: es un invento del siglo XIX.
- El romano Principiante es un remero libre (*remex*) de la flota. Los remeros de las galeras romanas no eran esclavos: esa imagen viene del cine.
- La clase polinesia se basa en una sola tradición. No se mezclan, por ejemplo, el *tā moko* maorí con la indumentaria hawaiana. Los motivos de tatuaje son geométricos genéricos, como dientes de tiburón (*niho manō*) y bandas, no reproducciones de diseños personales.
- El samurái Principiante lleva *maegami* (mechón de joven antes del *genpuku*). La coronilla afeitada (*sakayaki*) llega en Combatiente.

### Estilizaciones aceptadas, pendientes de confirmar

| Clase | Estilización | Motivo |
|---|---|---|
| Todas | Torso descubierto o abierto | Que se vea la progresión física (decisión 14C) |
| Romano | Sin túnica de manga ni coraza | Mismo motivo. Desde Élite se usan faleras sobre arnés de cuero, como en las condecoraciones reales. |
| Samurái | Sin *kosode* en el torso | Mismo motivo |

## Armas y accesorios por clase

| Clase | Principiante | Combatiente | Veterano | Élite | Legendario |
|---|---|---|---|---|---|
| Vikingo | Hacha de trabajo | Hacha barbada | Hacha y escudo redondo | Hacha danesa con incrustaciones | Hacha ceremonial con plata |
| Pirata | Cabilla de madera | Cuchillo de abordaje | Alfanje | Alfanje y pistola de chispa | Alfanje con guarda dorada |
| Samurái | Bokken | Yari corta | Katana | Katana y wakizashi (daishō) | Daishō con montura lacada |
| Polinesio | Remo (*hoe*) | Remo y lanza corta | Maza de madera (*lāʻau*) | *Leiomano* (dientes de tiburón) | *Leiomano* ceremonial |
| Romano | *Rudis* (espada de madera) y escudo de mimbre | Gladius y *parma* | Gladius y escudo de la flota | Gladius con vaina decorada y *vitis* | *Parazonium* de legado |

Las armas se dibujan en la mano derecha del personaje, a la izquierda en pantalla. Los escudos van en el brazo izquierdo, a la derecha en pantalla.
