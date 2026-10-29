# Pipeline de Blender

Todo el personaje sale de scripts de Python para Blender: nada se modela a mano, así cada cambio queda en git y el
resultado es reproducible. Funciona con Blender 4.2+ o con el módulo `bpy` de PyPI (probado con bpy 5.2).

```bash
# con Blender instalado
blender --background --python tools/blender/vikingo/vikingo.py -- --salida /tmp/vikingo --render
# con el módulo bpy (pip install bpy)
python tools/blender/vikingo/vikingo.py --salida /tmp/vikingo --render --muestras 64
# construir y optimizar los GLB de la app
BLENDER=python tools/blender/vikingo/exportar.sh
```

`--render` deja en `salida/renders/` las vistas de validación: frente, perfil, espalda, tres cuartos, rostro,
retrato, victoria y cuatro fases de la palada (`remo_0..3`). `--sin-glb` omite la exportación y `--solo-cuerpo`
construye solo el cuerpo y el rig.

## 1. Cuerpo (`vikingo.py` + `makehuman/mh.py`)

- Malla base de MakeHuman 1.x (13 380 vértices del grupo `body`, topología de cuadriláteros pensada para deformar).
- Objetivos de forma (`TARGETS`): varón joven, musculatura máxima, 1,95 m, torso en V, cuello ancho, cabeza
  cuadrada, mentón y pómulos marcados, cejas bajas, nariz con caballete. Se aplican como deltas sobre la malla.
- Esqueleto `default` de MakeHuman (163 huesos) fusionado a **69**: los huesos de la cara pasan a `head`, los del
  pecho a `spine02`, dedos de los pies a `foot` y metacarpianos a `wrist`. Pesos de piel de MakeHuman.
- Ojos: proxy de MakeHuman ajustado con su `.mhclo`, iris gris azulado recoloreado.

## 2. Equipo (`equipo.py`)

La ropa se deriva de regiones del propio cuerpo: se copian sus caras, se separan por la normal y heredan los pesos
de piel exactos, así se deforman igual que el cuerpo sin repesar.

| Pieza | Técnica |
| --- | --- |
| Pelo rapado a los lados, moño y trenzas | Región del cuero cabelludo con volumen y peinado hacia atrás; trenzas de tubos retorcidos |
| Barba, bigote, cejas, trenza de la barba | Regiones de la cara con caída hacia abajo y bordes afinados |
| Gambesón acolchado | Región del torso, suavizada, con mapa normal de acolchado |
| Correas cruzadas | Cintas proyectadas sobre el gambesón con BVH |
| Falda de lana, cenefa de latón | Cilindro centrado en la cadera; pesos transferidos del cuerpo por cercanía (KDTree) |
| Pantalón, vendas, botas, rodilleras, pelaje de las botas | Regiones de las piernas y piezas rígidas por hueso |
| Brazales, tatuaje | Regiones del antebrazo y del brazo |
| Manto de pelaje, capa, broches | Región de los hombros con desplazamiento de mechones; capa con pesos de la columna |
| Hacha | Mango, empuñadura y cabeza biselada, rígidos a `wrist.R` |
| Remo (asa de la remadora) | Pieza rígida al hueso `remo`, que mueve la animación |

La piel que queda bajo la ropa se borra (menos triángulos y nada que atraviese la tela).

## 3. Materiales PBR (`escena.py`)

Texturas procedurales generadas con NumPy (1024 px, se guardan en `salida/texturas/`): piel (color, rugosidad,
normal y subsuperficie), pelo (mechones), cuero claro y oscuro, lana en sarga, metal envejecido (rugosidad y
normal), madera, pelaje, acolchado y vendas. Materiales Principled BSDF: piel, pelo, cuero, cuero oscuro, lana,
gambesón, pantalón, vendas, latón, oro, hierro, madera, pelaje, hueso y tatuaje.

Luz de validación: clave cálida, dos contraluces (frío y cálido) y relleno bajo sobre fondo `#0E1A24`, Cycles con
AgX, como la paleta oscura, nórdica y dorada de la app.

## 4. Animaciones (`animaciones.py`)

Los giros se escriben sobre los ejes del esqueleto en reposo (X = izquierda del personaje, −Y = delante, Z = arriba).
Codos y dedos usan ejes de bisagra calculados del propio esqueleto, porque la pose de reposo de MakeHuman ya los trae
flexionados.

| Acción | Duración | Qué hace |
| --- | --- | --- |
| `preview` | 2 s, bucle | Pose de ficha: brazos relajados, puño en el hacha, respiración leve |
| `idle` | 4 s, bucle | Respiración, mirada, cambio de peso |
| `rowing` | 1,6 s (37,5 golpes/min), bucle | Palada con asiento deslizante: ataque, empuje de piernas, apertura de tronco, final, recuperación |
| `victory` | 2 s, se queda al final | Alza el hacha y grita |

`rowing` se anima con IK (manos en el asa, pies en el reposapiés) y se hornea a claves FK para glTF; después se
quitan las restricciones. En la app su velocidad se ajusta a tus golpes por minuto (`spm / 37,5`).
