from PIL import Image
import numpy as np
im=np.asarray(Image.open('/root/sd/out/panorama.png').convert('RGB')).astype(np.float32)
h,w,_=im.shape; B=200
# hacer repetible: mezclar el final con el principio
a=np.linspace(0,1,B)[None,:,None]
t=im[:, :w-B].copy()
t[:, :B]=im[:, :B]*a+im[:, w-B:]*(1-a)
tile=np.concatenate([t,t,t],axis=1)
o=Image.fromarray(tile.clip(0,255).astype(np.uint8)).resize((4096,449),Image.LANCZOS)
o.save('/root/sd/montaje/fiordo.webp',quality=80)
o.resize((1024,112)).save('/root/sd/montaje/pan_preview.png')
al=np.load('/root/sd/montaje/alpha_fiordo.npy')
rgba=np.dstack([np.asarray(o), np.repeat(al[:,None],4096,axis=1).astype(np.uint8)])
Image.fromarray(rgba,'RGBA').save('/root/sd/montaje/fiordo.webp',quality=80)
