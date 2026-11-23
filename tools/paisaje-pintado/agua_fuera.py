# Quita el agua de la costa generada (la que toca el borde de abajo) y deja la tierra con su espuma y rocas.
import sys, numpy as np, cv2
from PIL import Image
def quitar(path, th=28, tol=26):
    im=np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    R,G,B=im[...,0],im[...,1],im[...,2]
    agua=(np.maximum(G,B)-R)
    sat=im.max(-1)-im.min(-1)
    lab_=cv2.cvtColor(im.astype(np.uint8),cv2.COLOR_RGB2LAB).astype(np.float32)
    ref=np.median(lab_[-6:].reshape(-1,3),axis=0)
    d=np.sqrt(((lab_-ref)**2).sum(-1))
    m=(((agua>th)&(sat>35)&(im.max(-1)<235))|(d<tol)).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(m,8)
    abajo=set(lab[-3:].ravel())-{0}
    m=np.isin(lab,list(abajo)).astype(np.float32)
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    a=1-cv2.GaussianBlur(m,(0,0),1.2)
    # la tierra por debajo de la primera agua continua no cuenta: solo se queda lo que está unido a la tierra de arriba
    return np.dstack([im,a*255]).clip(0,255).astype(np.uint8)
if __name__=='__main__':
    k=sys.argv[1]; src=sys.argv[2]
    rgba=quitar(src, tol=float(sys.argv[3]) if len(sys.argv)>3 else 26); Image.fromarray(rgba,'RGBA').save(f'/root/sd/borde/{k}_rgba.png')
    bg=Image.new('RGBA',(rgba.shape[1],rgba.shape[0]),(255,0,0,255)); bg.alpha_composite(Image.fromarray(rgba,'RGBA')); bg.convert('RGB').save(f'/root/sd/borde/{k}_prev.png')
