# Fichas de prompt para generación con IA

Estado: **borrador**. Sirven tanto si genera el usuario con su herramienta como si se configura una API. Solo cubren los 5 maestros (Novato). Hoy no se usan: los 45 personajes vigentes salen de la lámina del usuario. Quedan para regenerar con más resolución si se autoriza una herramienta. Los rangos superiores se escriben cuando los maestros estén aprobados: para conservar la identidad, cada rango se genera **editando la imagen del maestro aprobado**, no desde cero.

Referencia de estilo: la lámina «Clases y progresión» que envió el usuario. Su acabado es el objetivo. Su composición, fondos y numeración no lo son.

## Bloque fijo (igual en todas las imágenes)

```text
ROLE/PURPOSE: production character asset for a 2D mobile fitness RPG, single character, full body.
VIEW: front view, very slight three-quarter turn to the viewer's left, eye-level camera, orthographic feel.
POSE: standing neutral combat-ready pose, weight on both feet, feet shoulder-width apart, arms relaxed
  slightly away from the torso, weapon held in the character's RIGHT hand (viewer's left) pointing down
  and outward; left hand empty or holding a shield. Same pose for every character.
ART DIRECTION: painted semi-realistic dark-fantasy illustration, clean confident linework, rich material
  rendering (cloth weave, leather grain, worn metal), warm key light from upper left, soft cool rim light
  from the right, realistic adult anatomy around 7 heads tall, no exaggerated chibi proportions.
GAME-SCALE READ: silhouette, head shape, hair and weapon must stay readable at 180 px tall.
TECHNICAL OUTPUT: portrait canvas 3:4 (for example 1536x2048), character centered, top of head at 6 %
  and soles of feet at 96 % of the height, nothing cropped, plain flat chroma green background
  #00B140 with no gradient, no floor, no cast shadow, no vignette.
EXCLUDE: text, labels, numbers, frames, UI, logos, watermarks, signatures, scenery, extra characters,
  extra limbs or fingers, duplicated weapons, cropped feet or hands.
```

Si la herramienta tiene opción de fondo transparente, se usa esa en lugar del verde croma, y después se comprueba el alfa.

## Bloque variable por clase: maestro Novato · Inexperto

Para todas las clases: edad aparente de 18 a 22 años; cuerpo sin entrenar, delgado, con algo de blandura y sin definición muscular; postura algo insegura con hombros ligeramente caídos; mirada inquieta, alerta; aspecto descuidado, ropa sencilla, gastada y sin mantenimiento.

### Vikingo
```text
SUBJECT: young Norse man, 19 years old, pale freckled skin, long loose unkempt copper-red hair past the
  shoulders, patchy thin stubble, light brown eyes. Bare torso. Baggy undyed wool trousers with a
  visible patch on the right thigh, wool leg wraps (winingas) from knee to ankle, simple leather
  turnshoes, plain leather belt with a small iron buckle. Holds a small wood-chopping hand axe.
LOCKS: copper-red hair color, freckles, face shape, axe in right hand.
AVOID: horned or winged helmets, fur cloak, armor, braids, full beard, tattoos.
```

### Pirata
```text
SUBJECT: young Caribbean sailor, early 1700s, 20 years old, tanned olive skin, messy dark-brown hair
  tied in a short ponytail, sparse stubble, small brass hoop earring in the left ear. Open, torn,
  untucked off-white linen shirt showing the chest, faded red neckerchief, rolled canvas trousers
  with patches, rope belt, barefoot. Holds a wooden belaying pin as a club.
LOCKS: brass earring, ponytail, red neckerchief, belaying pin in right hand.
AVOID: tricorn hat, eyepatch, coat, sword, pistol, parrot, skull symbols.
```

### Samurái
```text
SUBJECT: young Japanese man of the Sengoku period, 18 years old, light skin, black hair in the youth
  style (maegami forelock in front, hair tied back in a small tail, crown NOT shaved), clean-shaven.
  White cotton headband (hachimaki) with a small red circle. Bare torso. Short loose patched cotton
  trousers (momohiki) to mid-calf, rope belt, straw sandals (waraji). Holds a wooden practice sword
  (bokken).
LOCKS: maegami hairstyle, white hachimaki, bokken in right hand.
AVOID: armor, katana, topknot with shaved crown, kimono covering the torso, cherry blossoms.
```

### Polinesio (propuesta: Hawái antes del contacto)
```text
SUBJECT: young native Hawaiian man, 19 years old, warm brown skin, thick black hair tied in a simple
  topknot with a plant-fiber cord, clean-shaven. Bare torso, no tattoos yet. Plain undyed kapa-cloth
  malo (loincloth wrapped at the waist with a front flap), green ti-leaf lei around the neck,
  barefoot. Holds a long wooden canoe paddle (hoe) with a leaf-shaped blade.
LOCKS: topknot, ti-leaf lei, paddle in right hand.
AVOID: feather war bonnet or any Native American headdress, Maori ta moko face tattoo, grass skirt,
  tiki masks, hibiscus shirt, weapons with shark teeth (reserved for higher ranks).
```

### Romano
```text
SUBJECT: young free oarsman of the Roman imperial fleet (classis), 1st-2nd century AD, 19 years old,
  olive skin, short messy dark-brown hair with a ragged fringe, light youthful beard (barba prima).
  Bare torso. Short undyed wool tunic skirt to above the knee tied with a rope, worn sandals.
  Holds a wooden training sword (rudis) in the right hand and a round woven wicker training shield
  on the left arm.
LOCKS: short fringe hairstyle, wicker shield, rudis in right hand.
AVOID: helmet, armor, red cape, gladius, slave chains, Colosseum, Asian buildings.
```

## Después de generar

1. Guardar cada imagen como `entrada/<clase>_<rango>.png` (PNG o JPG sin compresión fuerte).
2. `node tools/ingest-character.mjs entrada/<archivo> --class <clase> --rank <rango>` quita el fondo verde, recorta, escala al lienzo de 720×840 con el pivote en los pies y escribe el retrato y `meta.json`, registrando la herramienta y el prompt usados.
3. `node tools/build-manifest.mjs && node tools/validate-assets.mjs` y `node tools/contact-sheet.mjs`.
4. Revisión manual: manos, dedos, arma, identidad y rigor cultural.
