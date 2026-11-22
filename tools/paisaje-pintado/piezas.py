from PIL import Image
import numpy as np, colorsys
im=np.asarray(Image.open('/root/sd/out/piezas.png').convert('RGB')).astype(np.float32)
bg=np.median(np.concatenate([im[:8].reshape(-1,3),im[-8:].reshape(-1,3),im[:,:8].reshape(-1,3)]),axis=0)
print('fondo',bg)
d=np.sqrt(((im-bg)**2).sum(-1))
alpha=np.clip((d-60)/50,0,1)
# quitar el tinte magenta de los bordes
sp=im.copy(); g=sp[...,1]; lim=np.maximum(sp[...,0],sp[...,2])
m=(1-alpha)[...,None]*0.0
mx=np.minimum(sp[...,0],sp[...,2]); exceso=np.clip(mx-g,0,None)
w=(alpha<0.98)
sp[...,0]-=exceso*1.0; sp[...,2]-=exceso*1.0
rgba=np.dstack([sp.clip(0,255),alpha*255]).astype(np.uint8)
I=Image.fromarray(rgba,'RGBA')
objs={}
names=[['abeto1','abeto2','abedul'],['casa','roca','juncos']]
for r in range(2):
  for c in range(3):
    cell=rgba[r*520:(r+1)*520 if r==0 else 768, c*256:(c+1)*256]
    ys,xs=np.where(cell[...,3]>40)
    box=(c*256+xs.min(), r*520+ys.min(), c*256+xs.max()+1, r*520+ys.max()+1)
    cr=np.asarray(I.crop(box)).copy()
    import cv2
    n,lab,st,_=cv2.connectedComponentsWithStats((cr[...,3]>20).astype(np.uint8),8)
    if n>1:
      big=1+int(np.argmax(st[1:,cv2.CC_STAT_AREA]))
      keep=np.isin(lab,[i for i in range(1,n) if st[i,cv2.CC_STAT_AREA]>=0.02*st[big,cv2.CC_STAT_AREA]])
      cr[...,3]=np.where(keep,cr[...,3],0)
    objs[names[r][c]]=Image.fromarray(cr,'RGBA')
# abedul verde: girar el tono del follaje
b=np.asarray(objs['abedul']).astype(np.float32)/255
import colorsys
hsv=np.array(Image.fromarray((b[...,:3]*255).astype(np.uint8)).convert('HSV')).astype(np.int32)
hsv[...,0]=np.where(hsv[...,1]>80,(hsv[...,0]+30)%256,hsv[...,0])
v=np.array(Image.fromarray(hsv.astype(np.uint8),'HSV').convert('RGB'))
v=(v*0.8+np.array(Image.fromarray(v).convert('L'))[...,None]*0.2).astype(np.uint8)
objs['abedul_verde']=Image.fromarray(np.dstack([v,(b[...,3]*255).astype(np.uint8)]),'RGBA')
P={'pino_alto':('abeto1',0,0,410,825,.5,.97),'pino_medio':('abeto2',412,0,332,601,.5,.97),'abedul':('abedul',746,0,176,575,.5,.985),
 'abedul_verde':('abedul_verde',0,827,142,460,.5,.985),'pino_bajo':('abeto1',144,827,213,412,.5,.965),'casa':('casa',359,827,529,334,.5,.9),
 'roca_grande':('roca',0,1289,355,158,.5,.82),'juncos':('juncos',357,1289,84,102,.5,.95),'roca':('roca',443,1289,211,96,.5,.86)}
at=Image.new('RGBA',(1024,1447),(0,0,0,0))
for k,(o,x,y,W,H,px,py) in P.items():
  ob=objs[o]
  if k=='roca_grande': ob=ob.resize((int(ob.width*1.8),ob.height))
  if k in('abedul','abedul_verde'): ob=ob.resize((int(ob.width*0.7),ob.height))
  if k=='roca': ob=ob.resize((int(ob.width*1.6),int(ob.height*0.8)))
  s=min(W/ob.width, H*py/ob.height)
  ob=ob.resize((max(1,int(ob.width*s)),max(1,int(ob.height*s))),Image.LANCZOS)
  ox=x+int(W*px-ob.width/2); oy=y+int(H*py)-ob.height
  at.alpha_composite(ob,(ox,oy))
at.save('/root/sd/montaje/orilla.webp',quality=74)
prev=Image.new('RGBA',at.size,(40,60,50,255)); prev.alpha_composite(at); prev.convert('RGB').resize((512,723)).save('/root/sd/montaje/orilla_prev.png')
