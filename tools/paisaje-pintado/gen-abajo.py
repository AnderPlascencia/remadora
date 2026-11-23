import subprocess, os, sys
S="Semi-realistic detailed digital painting, realistic proportions, painterly rendering, crisp dark outline, high quality fantasy RPG art."
C=" Aerial view of a lakeshore strip seen from above at a steep angle, the viewer standing on land looking toward the water. Top edge of the image: calm water and a thin line of white foam along a straight shoreline. {} Everything stands upright. No horizon, no sky, no people, no text."
P={
'fiordo':"Just below the water: a band of grey rounded boulders. Bottom: dark green spruce forest with a few yellow birches and one red wooden cabin with a grass roof. Water: dark teal fjord.",
'laguna':"Just below the water: a band of white coral sand with a few black volcanic rocks. Bottom: coconut palms and tropical bushes, one thatched hut. Water: bright turquoise shallow lagoon.",
'canon':"Just below the water: a band of reddish sand and rocks. Bottom: red desert ground with saguaro cacti, mesquite trees, sage bushes and one adobe house. Water: jade-green calm river.",
'otono':"Just below the water: a band of grey stones and fallen leaves. Bottom: autumn forest in red, orange and gold with dark pines, one log cabin. Water: deep blue calm lake.",
'cerezos':"Just below the water: a band of grey pebbles with fallen pink petals. Bottom: pink cherry blossom trees, dark twisted pines and bamboo, one small stone lantern. Water: calm blue lake with floating petals.",
'glaciar':"Just below the water: a band of snow and broken ice. Bottom: snow-covered ground with snowy fir trees and one igloo. Water: dark cold teal water with floating ice.",
'mediterraneo':"Just below the water: a band of pale limestone rocks. Bottom: dry golden grass with olive trees, cypresses, umbrella pines and one white house. Water: deep clear blue sea.",
}
for k in (sys.argv[1:] or list(P)):
  out=f"/root/sd/p/{k}_costa_abajo.png"
  if os.path.exists(out): continue
  cmd=["/root/sd/stable-diffusion.cpp/build/bin/sd-cli","--diffusion-model","/root/sd/models/z.gguf","--vae","/root/sd/models/ae.safetensors","--llm","/root/sd/models/qwen.gguf","-p",S+C.format(P[k]),"--cfg-scale","1.0","--steps","8","-W","1024","-H","320","-s","41","-t","4","--vae-tiling","--mmap","--flash-attn","on","-o",out]
  with open(f"/root/sd/p/{k}_costa_abajo.log","w") as f: subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT)
  print("LISTA",k,flush=True)
print("FIN",flush=True)
