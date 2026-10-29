#!/usr/bin/env bash
# Codifica los fotogramas de remo_agua.py en clips ligeros en bucle para el móvil (sin audio).
# Uso: tools/blender/remo_agua/codificar.sh DIR_SALIDA [ANCHO]
#   deja DIR_SALIDA/remo_agua_ANCHO.webm (VP9), .mp4 (H.264, para Safari antiguo) y un póster .webp
set -euo pipefail
SAL=${1:?directorio de salida de remo_agua.py}
ANCHO=${2:-640}
F="$SAL/frames/%04d.png"
ESCALA="scale=$ANCHO:-2:flags=lanczos"
ffmpeg -y -loglevel error -framerate 30 -i "$F" -vf "$ESCALA" -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 \
  -deadline good -cpu-used 2 -pix_fmt yuv420p -an "$SAL/remo_agua_$ANCHO.webm"
ffmpeg -y -loglevel error -framerate 30 -i "$F" -vf "$ESCALA" -c:v libx264 -crf 27 -preset slow -profile:v main \
  -pix_fmt yuv420p -movflags +faststart -an "$SAL/remo_agua_$ANCHO.mp4"
ffmpeg -y -loglevel error -i "$SAL/frames/0009.png" -vf "$ESCALA" -quality 80 "$SAL/remo_agua_${ANCHO}_poster.webp"
ls -l "$SAL"/remo_agua_"$ANCHO"*
