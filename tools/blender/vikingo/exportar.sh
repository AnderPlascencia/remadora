#!/usr/bin/env bash
# Construye el vikingo en Blender y genera los GLB optimizados que usa la app.
# Requisitos (gratuitos): Blender 4.2+ (o `pip install bpy`) y Node 18+ (usa npx @gltf-transform/cli).
#   BLENDER="blender --background --python" tools/blender/vikingo/exportar.sh    # con Blender instalado
#   BLENDER=python tools/blender/vikingo/exportar.sh                              # con el módulo bpy
set -euo pipefail
cd "$(dirname "$0")/../../.."
BLENDER=${BLENDER:-python}
TMP=$(mktemp -d)
DEST=assets/personajes3d/vikingo
GT="npx --yes @gltf-transform/cli@4.5.1"
mkdir -p "$DEST"

# 1. Blender: malla, equipo, materiales, rig y animaciones -> GLB sin comprimir (texturas PNG) + .blend
if [[ $BLENDER == *blender* ]]; then $BLENDER tools/blender/vikingo/vikingo.py -- --salida "$TMP"; else $BLENDER tools/blender/vikingo/vikingo.py --salida "$TMP"; fi
cp "$TMP/vikingo.blend" tools/blender/vikingo/vikingo.blend

# 2. glTF Transform: geometría meshopt, texturas WebP. Sin unir mallas: la app muestra u oculta piezas por nombre.
OPC="--compress meshopt --texture-compress webp --join false --flatten false --instance false --palette false"
# Simplificación con meshoptimizer: error máximo 0,04 % del tamaño en la alta y 0,1 % en la móvil (no se nota a tamaño de ficha).
$GT optimize "$TMP/vikingo_fuente.glb" "$DEST/vikingo.glb" $OPC --simplify true --simplify-error 0.0004 --simplify-ratio 0.7 --texture-size 1024
$GT optimize "$TMP/vikingo_fuente.glb" "$DEST/vikingo_movil.glb" $OPC --simplify true --simplify-error 0.001 --simplify-ratio 0.5 --texture-size 512
node tools/blender/vikingo/medir.mjs "$DEST"/*.glb
rm -rf "$TMP"
