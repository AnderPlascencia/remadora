#!/bin/bash
cd ~/sd
S="Semi-realistic detailed digital painting, painterly rendering, high quality fantasy RPG art."
run(){ name=$1; w=$2; h=$3; seed=$4; p="$5"
  [ -f out/$name.png ] && return
  stable-diffusion.cpp/build/bin/sd-cli --diffusion-model models/z.gguf --vae models/ae.safetensors --llm models/qwen.gguf -p "$p" --cfg-scale 1.0 --steps 8 -W $w -H $h -s $seed -t 4 --vae-tiling --mmap --flash-attn on -o out/$name.png > out/$name.log 2>&1
}
run suelo 512 512 21 "$S Seamless tileable texture seen straight from above: Nordic forest floor with short green grass, patches of moss, fallen pine needles, small ferns, a few small grey stones and tiny yellow leaves. Even soft warm golden-hour light, no shadows of large objects, no horizon, no perspective, uniform density across the whole image, no text."
run agua 512 512 22 "$S Seamless tileable texture seen straight from above: calm dark blue-green fjord water surface with gentle small ripples and soft sky reflections, subtle warm orange highlights on ripple crests. Uniform across the whole image, no shore, no objects, no horizon, no perspective, no text."
echo LISTO > out/done2
