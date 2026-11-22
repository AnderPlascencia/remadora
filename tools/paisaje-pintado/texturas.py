from PIL import Image
import numpy as np
def sin_costura(im):
  a=np.asarray(im).astype(np.float32); h,w,_=a.shape
  s=np.roll(np.roll(a,h//2,0),w//2,1)
  y=np.abs(np.linspace(-1,1,h))[:,None]; x=np.abs(np.linspace(-1,1,w))[None,:]
  m=np.clip((1-np.maximum(x,y))*3,0,1)[...,None]
  return Image.fromarray((a*m+s*(1-m)).clip(0,255).astype(np.uint8))
s=Image.open('/root/sd/out/suelo.png').convert('RGB')
sin_costura(s).resize((256,256),Image.LANCZOS).save('/root/sd/montaje/fiordo_suelo.webp',quality=78)
a=Image.open('/root/sd/out/agua.png').convert('RGB').crop((0,200,512,512)).resize((512,512))
sin_costura(a).resize((256,256),Image.LANCZOS).save('/root/sd/montaje/fiordo_agua.webp',quality=78)
