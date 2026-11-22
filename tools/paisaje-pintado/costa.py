from PIL import Image
import numpy as np
im=np.asarray(Image.open('/root/sd/out/costa.png').convert('RGB'))[:240].astype(np.float32)
h,w,_=im.shape; B=120
a=np.linspace(0,1,B)[None,:,None]
t=im[:, :w-B].copy(); t[:, :B]=im[:, :B]*a+im[:, w-B:]*(1-a)
Image.fromarray(t.astype(np.uint8)).resize((1536,345),Image.LANCZOS).save('/root/sd/montaje/costa.webp',quality=80)
