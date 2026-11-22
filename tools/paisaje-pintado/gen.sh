#!/bin/bash
cd ~/sd
S="Semi-realistic detailed digital painting, realistic proportions, painterly rendering, crisp dark outline, high quality fantasy RPG art."
run(){ name=$1; w=$2; h=$3; seed=$4; p="$5"
  [ -f out/$name.png ] && return
  stable-diffusion.cpp/build/bin/sd-cli --diffusion-model models/z.gguf --vae models/ae.safetensors --llm models/qwen.gguf -p "$p" --cfg-scale 1.0 --steps 8 -W $w -H $h -s $seed -t 4 --vae-tiling --mmap --flash-attn on -o out/$name.png > out/$name.log 2>&1
}
run panorama 1344 448 11 "$S Ultra-wide landscape panorama of a Norwegian fjord at golden hour, seen from water level. A perfectly straight level horizon at 70% of the image height. Steep dark mountain walls of varied shapes across the whole width, their peaks with patches of snow catching warm orange-pink sunset light, pine forest on the lower slopes, a narrow valley receding into soft blue haze. Pale blue-grey sky with a few thin painted clouds. Below the horizon only a thin strip of calm dark water. Even lighting across the width, no boats, no buildings, no people, no text."
run costa 1024 320 12 "$S Top-down aerial view, straight from above, of a Nordic fjord shoreline strip. Top two thirds: dense dark green spruce forest crowns seen from above, a few yellow birch crowns, one small red wooden cabin with a grass roof seen from above. Lower part: a band of grey pebbles and boulders. Bottom edge: a straight shoreline with dark blue-green water and a thin line of foam. Golden light from the upper left. No perspective, no horizon, no people, no text."
run piezas 768 768 13 "$S Asset sheet on a plain solid flat magenta background (#FF00FF). Six separate isolated objects in a 3 by 2 grid with wide magenta gaps between them, each seen from the side at eye level, whole object visible from top to base: a tall dark Norway spruce tree, a medium spruce tree, a slender silver birch with golden autumn leaves, a small red wooden Norwegian cabin with a grass roof, a large grey mossy granite boulder, a clump of golden reeds. Warm golden-hour light from the upper left, no shadows on the background, no text."
echo LISTO > out/done
