# Uso: python3 procesar.py <paisaje> <fila_horizonte_generado> <fila_orilla_costa>
import sys, re, json, os, numpy as np, cv2
from PIL import Image
k=sys.argv[1]; HZ=int(sys.argv[2]); ORI=int(sys.argv[3])
R='/home/user/remadora/'; G='/root/sd/p/'; O=f'/root/sd/montaje/{k}/'
os.makedirs(O,exist_ok=True)
src=open(R+'src/carrera.js').read()
pan_h={'laguna':388}.get(k,204)
MAPA={'laguna':'palmera_alta A0 palmera_curva A1 palmera_baja A2 fare A3 arbusto A4 roca_grande A5 arbusto_rosa B0 roca B1 canoa B2 matas B3',
'canon':'saguaro_alto A0 saguaro A1 mezquite A2 adobe A3 roca_grande A4 salvia A5 roca B0 barril B1 matas B2',
'otono':'pino A0 arce_rojo A1 arce_naranja A2 abedul A3 cabana A4 roca_grande A5 roca B0 helechos B1 canoa B2',
'cerezos':'cerezo A0 pino A1 bambu A2 torii A3 cerezo_chico A4 linterna A5 roca_grande B0 roca B1 iris B2',
'glaciar':'tempano_alto A0 abeto A1 abeto_bajo A2 tempano A3 iglu A4 roca_grande A5 roca B0 pinguinos B1 hielo B2',
'mediterraneo':'cipres_alto A0 pinonero A1 cipres A2 olivo A3 casa A4 buganvilla A5 roca_grande B0 roca B1 barca B2 lavanda B3'}[k].split()
MAPA=dict(zip(MAPA[::2],MAPA[1::2]))
REJ={0:(128,260),1:(384,260),2:(640,260),3:(128,640),4:(384,640),5:(640,640)}
PUNTOS={n:(v[0],)+REJ[int(v[1])] for n,v in MAPA.items()}
if os.path.exists(f'/root/sd/puntos_{k}.json'): PUNTOS.update({n:tuple(v) for n,v in json.load(open(f'/root/sd/puntos_{k}.json')).items()})
def sin_costura_h(a,B):
  h,w,_=a.shape; m=np.linspace(0,1,B)[None,:,None]
  t=a[:, :w-B].copy(); t[:, :B]=a[:, :B]*m+a[:, w-B:]*(1-m); return t
# panorama
orig=Image.open(R+f'assets/carrera/{k}.webp'); W0,H0=orig.size
al=np.asarray(orig.convert('RGBA'))[...,3].astype(float).mean(axis=1)
g=np.asarray(Image.open(G+f'{k}_pan.png').convert('RGB')).astype(np.float32)
# escala para que el horizonte generado caiga en pan_h y el alto sea H0
s=pan_h/HZ; top=0
gi=Image.fromarray(sin_costura_h(g,200).astype(np.uint8))
gw=int(gi.width*s); gh=int(gi.height*s); gi=gi.resize((gw,gh),Image.LANCZOS)
canvas=Image.new('RGB',(gw,H0)); canvas.paste(gi.crop((0,0,gw,min(gh,H0))),(0,0))
if gh<H0:
  fila=gi.crop((0,gh-1,gw,gh)).resize((gw,H0-gh)); canvas.paste(fila,(0,gh))
n=int(np.ceil(W0/gw))+1; tira=Image.new('RGB',(gw*n,H0))
for i in range(n): tira.paste(canvas,(i*gw,0))
reps=max(1,round(W0/gw)); tira=tira.crop((0,0,gw*reps,H0)).resize((W0,H0),Image.LANCZOS)
rgba=np.dstack([np.asarray(tira),np.repeat(al[:,None],W0,axis=1).astype(np.uint8)])
Image.fromarray(rgba,'RGBA').save(O+f'{k}.webp',quality=80)
# costa
c0=Image.open(R+f'assets/carrera/{k}_costa.webp'); cw,ch=c0.size
c=np.asarray(Image.open(G+f'{k}_costa.png').convert('RGB'))[:ORI].astype(np.float32)
ci=Image.fromarray(sin_costura_h(c,120).astype(np.uint8)); ci.resize((1536,round(ci.height*1536/ci.width)),Image.LANCZOS).save(O+f'{k}_costa.webp',quality=80)
# piezas
RGBA={}
# Hojas cuyo fondo se parece a las piezas (cerezos rosas sobre fondo rosa): el fondo se toma por relleno desde el borde.
RELLENO={('cerezos','A')}
def objetos(path, hoja=''):
  im=np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
  bg=np.median(np.concatenate([im[:8].reshape(-1,3),im[-8:].reshape(-1,3),im[:,:8].reshape(-1,3),im[:,-8:].reshape(-1,3)]),axis=0)
  d=np.sqrt(((im-bg)**2).sum(-1)); alpha=np.clip((d-60)/50,0,1)
  if bg[0]>bg[1] and bg[2]>bg[1]:
    # Fondo magenta: se mide por lo «magenta» (min(R,B) − G), no por la distancia al color. Así las rocas rojas
    # y el adobe rosado no se toman por fondo (antes salían transparentes a medias y verdosos).
    M=np.minimum(im[...,0],im[...,2])-im[...,1]; bM=min(bg[0],bg[2])-bg[1]
    alpha=np.maximum(np.clip((0.6*bM-M)/(0.5*bM),0,1),np.clip((d-100)/40,0,1))  # lo claro (flores) se aleja del fondo aunque sea rosa
  if (k,hoja) in RELLENO:
    u8=im.astype(np.uint8).copy(); hh,ww=u8.shape[:2]; fondo=np.zeros((hh+2,ww+2),np.uint8)
    for sx,sy in [(0,0),(ww-1,0),(0,hh-1),(ww-1,hh-1),(ww//2,0),(ww//2,hh-1),(0,hh//2),(ww-1,hh//2)]:
      cv2.floodFill(u8,fondo,(sx,sy),0,(28,28,28),(28,28,28),cv2.FLOODFILL_MASK_ONLY|cv2.FLOODFILL_FIXED_RANGE|(1<<8)|8)
    fondo=fondo[1:-1,1:-1].astype(bool)
    # Lo claro (flores) se queda; lo oscuro que tira a rosa (borde de pinos) se recorta por croma.
    da=np.clip((d-25)/30,0,1); lum=im.mean(-1)
    alpha=np.where(fondo,0.0,np.where(lum>140,da,np.minimum(da,alpha)))
    alpha=cv2.GaussianBlur(alpha.astype(np.float32),(3,3),0)
  alpha=np.minimum(alpha,cv2.erode(alpha.astype(np.float32),np.ones((3,3),np.uint8)))
  a3=np.clip(alpha,0.05,1)[...,None]
  sp=np.where(alpha[...,None]<1,(im-(1-a3)*bg)/a3,im)
  ex=np.clip(np.minimum(sp[...,0],sp[...,2])-sp[...,1],0,None)
  if bg[0]>bg[1] and bg[2]>bg[1]: sp[...,0]-=ex; sp[...,2]-=ex
  rgba=np.dstack([sp.clip(0,255),alpha*255]).astype(np.uint8); RGBA[hoja]=rgba
  mask=(alpha>0.08).astype(np.uint8)
  mask=cv2.dilate(mask,np.ones((9,9),np.uint8))
  n,lab,st,cen=cv2.connectedComponentsWithStats(mask,8)
  objs=[]
  for i in range(1,n):
    x,y,w,h=st[i,:4]; area=st[i,cv2.CC_STAT_AREA]
    if area<1500: continue
    cr=rgba[y:y+h,x:x+w].copy(); cr[...,3]=np.where(lab[y:y+h,x:x+w]==i,cr[...,3],0)
    ys,xs=np.where(cr[...,3]>40)
    if len(ys)==0: continue
    objs.append((x+w/2,y+h/2,Image.fromarray(cr[ys.min():ys.max()+1, xs.min():xs.max()+1],'RGBA')))
  return objs
L={'A':objetos(G+f'{k}_piezasA.png','A'),'B':objetos(G+f'{k}_piezasB.png','B')}
ini=src.index(f"  {k}: "); j=src.index('piezas: {',ini); e=src.index('}\n      },',j)
pz={m.group(1):tuple(float(v) for v in m.group(2,3,4,5,6,7)) for m in re.finditer(r"(\w+): \{ x: (\d+), y: (\d+), w: (\d+), h: (\d+), pie: \[([\d.]+), ([\d.]+)\]",src[j:e])}
a0=Image.open(R+f'assets/carrera/{k}_orilla.webp'); at=Image.new('RGBA',a0.size,(0,0,0,0))
for nombre,(x,y,W,H,px,py) in pz.items():
  hoja,px0,py0=PUNTOS[nombre][:3]
  if len(PUNTOS[nombre])==7:  # recorte a mano: piezas que se tocan en la hoja (bambú y linterna)
    x0,y0,x1,y1=PUNTOS[nombre][3:]; cr=RGBA[hoja][y0:y1,x0:x1]; ys,xs=np.where(cr[...,3]>40)
    ob=Image.fromarray(cr[ys.min():ys.max()+1, xs.min():xs.max()+1],'RGBA')
  else: ob=min(L[hoja],key=lambda o:(o[0]-px0)**2+(o[1]-py0)**2)[2]
  s1=min(W/ob.width,H*py/ob.height)
  if W/ob.width < H*py/ob.height:  # limitado por el ancho: aplastar un poco para ganar alto
    sq=max(0.72,(W/ob.width)/(H*py/ob.height)); ob=ob.resize((max(1,int(ob.width*sq)),ob.height)); s1=min(W/ob.width,H*py/ob.height)
  ob=ob.resize((max(1,int(ob.width*s1)),max(1,int(ob.height*s1))),Image.LANCZOS)
  aa=np.asarray(ob)[...,3]; filas=aa[-max(3,ob.height//25):]; xs=np.where(filas.max(axis=0)>60)[0]
  bx=xs.mean() if len(xs) else ob.width/2
  ox=int(x+W*px-bx); ox=max(int(x),min(int(x+W-ob.width),ox))
  at.alpha_composite(ob,(ox,int(y+H*py)-ob.height))
at.save(O+f'{k}_orilla.webp',quality=74)
prev=Image.new('RGBA',at.size,(40,60,50,255)); prev.alpha_composite(at); prev.convert('RGB').save(O+'atlas_prev.png')
# texturas
def sin_costura(im):
  a=np.asarray(im).astype(np.float32); h,w,_=a.shape
  # igualar el brillo: quitar los cambios lentos de luz para que las franjas no se noten
  bl=cv2.GaussianBlur(a,(0,0),w/6); a=(a/np.maximum(bl,1))*a.reshape(-1,3).mean(0)
  s_=np.roll(np.roll(a,h//2,0),w//2,1)
  yy=np.abs(np.linspace(-1,1,h))[:,None]; xx=np.abs(np.linspace(-1,1,w))[None,:]
  m=np.clip((1-np.maximum(xx,yy))*3,0,1)[...,None]
  return Image.fromarray((a*m+s_*(1-m)).clip(0,255).astype(np.uint8))
sin_costura(Image.open(G+f'{k}_suelo.png').convert('RGB')).resize((256,256),Image.LANCZOS).save(O+f'{k}_suelo.webp',quality=78)
CAJA_AGUA={'canon':(120,70,512,430)}.get(k,(0,200,512,512))
a=Image.open(G+f'{k}_agua.png').convert('RGB').crop(CAJA_AGUA).resize((512,512))
ag=np.asarray(sin_costura(a)).astype(np.float32); cf={'canon':2.2,'otono':2.4,'glaciar':2.2}.get(k,1.0)
ag=(ag-ag.reshape(-1,3).mean(0))*cf+ag.reshape(-1,3).mean(0)
Image.fromarray(ag.clip(0,255).astype(np.uint8)).resize((256,256),Image.LANCZOS).save(O+f'{k}_agua3d.webp',quality=78)
for f in sorted(os.listdir(O)): print(f, os.path.getsize(O+f))
