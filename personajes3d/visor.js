// Visor 3D de personajes (Three.js, vendor/three r169). Carga el GLB de la clase, aplica la variante del nivel
// y reproduce sus animaciones. Pensado para ser barato: una escena pequeña por visor, sin sombras dinámicas,
// solo dibuja mientras se ve en pantalla y se libera entero con destruir().
//
//   const v = new VisorPersonaje(caja, { clase: 'vikingo', nivel: 12, animacion: 'idle', camara: 'cuerpo',
//     fondo: null, calidad: 'auto', interactivo: true, alCargar, alFallar });
//   v.animacion('rowing'); v.velocidad(1.2); v.nivel(20); v.destruir();
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PERSONAJES_3D, piezasOcultas, materialesDe, modeloDe } from './config.js';

export function webglDisponible() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

const RAIZ = new URL('../', import.meta.url); // las rutas de config.js son relativas a la raíz de la app
const movimientoReducido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const limpio = (n) => THREE.PropertyBinding.sanitizeNodeName(n);

// Encuadres: qué altura del cuerpo se mira, cuánto alto entra y desde dónde (dirección de la cámara).
const CAMARAS = {
  cuerpo: { mira: 0.5, alto: 1.1, dir: [0.18, 0.06, 1] },
  victoria: { mira: 0.64, alto: 1.5, dir: [0.18, 0.06, 1] }, // con el hacha en alto
  retrato: { mira: 0.86, alto: 0.42, dir: [0.12, 0.04, 1], ancho: 0.4 },
  remo: { mira: 0.38, alto: 0.9, dir: [-1, 0.28, 0.75], ancho: 1.55 },
};

export class VisorPersonaje {
  constructor(contenedor, o = {}) {
    this.o = { nivel: 1, animacion: 'idle', camara: 'cuerpo', fondo: null, calidad: 'auto', interactivo: false, tiempoMax: 20000, ...o };
    this.def = PERSONAJES_3D[this.o.clase];
    this.caja = contenedor;
    this.estado = 'cargando';
    this.ritmo = 1;
    this.visible = true;
    this.reducido = movimientoReducido();
    this.lienzo = document.createElement('canvas');
    this.lienzo.className = 'visor3d-lienzo';
    this.lienzo.setAttribute('role', 'img');
    this.lienzo.setAttribute('aria-label', `${this.def?.nombre || 'Personaje'} en 3D`);
  }

  // Carga el modelo. Devuelve una promesa que se resuelve al primer dibujo o se rechaza (sin WebGL, red, GLB roto).
  async cargar() {
    try {
      if (!this.def) throw new Error(`La clase «${this.o.clase}» no tiene modelo 3D`);
      if (!webglDisponible()) throw new Error('WebGL no está disponible');
      this.montar(this.caja);
      const r = this.caja.getBoundingClientRect();
      const url = modeloDe(this.o.clase, this.o.calidad, { ancho: r.width || 300, ratio: window.devicePixelRatio || 1, memoria: navigator.deviceMemory });
      this.movil = url === this.def.modelos.movil;
      this.crearEscena();
      const cargador = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const gltf = await Promise.race([
        cargador.loadAsync(new URL(url, RAIZ).href),
        new Promise((_, no) => { setTimeout(() => no(new Error('El modelo tardó demasiado en cargar')), this.o.tiempoMax); }),
      ]);
      if (this.destruido) { liberar(gltf.scene); return this; }
      this.prepararModelo(gltf);
      this.nivel(this.o.nivel);
      this.animacion(this.o.animacion, { mezcla: 0 });
      this.encuadrar();
      this.observar();
      this.estado = 'listo';
      this.caja.dataset.visor3d = 'listo';
      this.dibujar();
      this.o.alCargar?.(this);
      return this;
    } catch (e) {
      this.estado = 'error';
      this.caja.dataset.visor3d = 'error';
      this.destruir();
      this.o.alFallar?.(e);
      throw e;
    }
  }

  // Mueve el lienzo a otro contenedor (cuando la vista se vuelve a pintar) sin recargar nada.
  montar(contenedor) {
    this.caja = contenedor;
    contenedor.dataset.visor3d = this.estado;
    contenedor.append(this.lienzo);
    this.redimensionar?.();
    if (this.ro) { this.ro.disconnect(); this.ro.observe(contenedor); this.io.disconnect(); this.io.observe(contenedor); }
  }

  crearEscena() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.lienzo, antialias: !this.movil, alpha: this.o.fondo == null, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.movil ? 1.5 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.15;
    const esc = this.escena = new THREE.Scene();
    if (this.o.fondo != null) esc.background = new THREE.Color(this.o.fondo);
    // Reflejos suaves para metal y cuero sin texturas HDR externas.
    const pmrem = new THREE.PMREMGenerator(r);
    this.entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    esc.environment = this.entorno;
    esc.environmentIntensity = 0.35;
    // Luz de la marca: clave cálida desde delante, contraluz frío nórdico y un relleno muy bajo.
    const clave = new THREE.DirectionalLight(0xffe2c0, 2.4); clave.position.set(1.6, 2.6, 2.4);
    const contra = new THREE.DirectionalLight(0x9cc8ff, 2.2); contra.position.set(-1.8, 2.2, -2.2);
    const calida = new THREE.DirectionalLight(0xffb070, 1.1); calida.position.set(2.2, 1.2, -1.6);
    esc.add(clave, contra, calida, new THREE.HemisphereLight(0x8fb4d0, 0x2a1a10, 0.5));
    // Sombra de contacto falsa (un degradado), en lugar de sombras dinámicas.
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    this.sombra.rotation.x = -Math.PI / 2; this.sombra.position.y = 0.002;
    esc.add(this.sombra);
    this.camara = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
    this.reloj = new THREE.Clock(false);
  }

  prepararModelo(gltf) {
    this.modelo = gltf.scene;
    this.escena.add(this.modelo);
    this.piezas = new Map();
    this.materiales = new Map();
    this.modelo.traverse((n) => {
      if (n.name) this.piezas.set(n.name, n);
      if (n.isMesh) {
        n.frustumCulled = false; // las mallas con piel se mueven fuera de su caja en reposo
        if (n.material?.name) this.materiales.set(n.material.name, n.material);
        n.userData.material = n.material;
      }
    });
    this.mixer = new THREE.AnimationMixer(this.modelo);
    this.acciones = Object.fromEntries(gltf.animations.map((c) => [c.name, this.mixer.clipAction(c)]));
    const v = this.acciones.victory;
    if (v) { v.setLoop(THREE.LoopOnce, 1); v.clampWhenFinished = true; }
    if (this.o.interactivo) this.activarGiro();
  }

  // Equipo y materiales del nivel.
  nivel(n) {
    this.o.nivel = n;
    if (!this.modelo) return this;
    this.aplicarVisibilidad();
    const cambios = materialesDe(this.o.clase, n);
    this.modelo.traverse((m) => {
      if (!m.isMesh) return;
      const pieza = m.name in cambios ? m.name : m.parent?.name in cambios ? m.parent.name : null;
      m.material = (pieza && this.materiales.get(cambios[pieza])) || m.userData.material;
    });
    return this.dibujar();
  }

  aplicarVisibilidad() {
    const ocultas = new Set([...piezasOcultas(this.o.clase, this.o.nivel, this.actual)].map(limpio));
    for (const [nombre, nodo] of this.piezas) if (!nodo.isBone) nodo.visible = !ocultas.has(nombre);
  }

  // Cambia de animación con un fundido corto. 'victory' se queda en su última pose.
  animacion(nombre, { mezcla = 0.35 } = {}) {
    const nueva = this.acciones?.[nombre] || this.acciones?.idle;
    if (!nueva) { this.o.animacion = nombre; return this; }
    const vieja = this.acciones[this.actual];
    this.actual = Object.keys(this.acciones).find((k) => this.acciones[k] === nueva);
    this.o.animacion = this.actual;
    this.aplicarVisibilidad();
    nueva.reset().setEffectiveTimeScale(this.ritmo).setEffectiveWeight(1).play();
    if (vieja && vieja !== nueva && mezcla > 0 && !this.reducido) nueva.crossFadeFrom(vieja, mezcla, false);
    else if (vieja && vieja !== nueva) vieja.stop();
    if (this.reducido) { this.mixer.update(0); this.mixer.setTime(nueva.getClip().duration * 0.3); }
    if (this.o.camara === 'auto') this.encuadrar();
    return this.dibujar();
  }

  // Velocidad de la animación (1 = la grabada). Para remar: golpesPorMinuto / 37.5.
  velocidad(x) {
    this.ritmo = Math.max(0, x);
    if (this.acciones?.[this.actual]) this.acciones[this.actual].setEffectiveTimeScale(this.ritmo);
    this.actualizarBucle();
    return this;
  }

  camaraPreset(nombre) { this.o.camara = nombre; this.encuadrar(); return this.dibujar(); }

  encuadrar() {
    if (!this.camara) return;
    const auto = { rowing: 'remo', victory: 'victoria' }[this.actual] || 'cuerpo';
    const p = CAMARAS[this.o.camara === 'auto' ? auto : this.o.camara] || CAMARAS.cuerpo;
    const h = this.def.altura;
    const { width: w = 1, height: al = 1 } = this.caja.getBoundingClientRect();
    const aspecto = Math.max(0.2, w / Math.max(1, al));
    this.camara.aspect = aspecto;
    const t = Math.tan(THREE.MathUtils.degToRad(this.camara.fov / 2));
    const dist = Math.max((h * p.alto) / 2 / t, ((p.ancho || 0.9) * h) / 2 / (t * aspecto)) * 1.04;
    const d = new THREE.Vector3(...p.dir).normalize();
    const mira = new THREE.Vector3(0, h * p.mira, 0);
    this.camara.position.copy(mira).addScaledVector(d, dist);
    this.camara.lookAt(mira);
    this.camara.updateProjectionMatrix();
  }

  observar() {
    this.redimensionar = () => {
      const { width, height } = this.caja.getBoundingClientRect();
      if (!width || !height) return;
      this.renderer.setSize(width, height, false);
      this.encuadrar();
      this.dibujar();
    };
    this.ro = new ResizeObserver(this.redimensionar);
    this.ro.observe(this.caja);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.actualizarBucle(); });
    this.io.observe(this.caja);
    this.alCambiarPestana = () => this.actualizarBucle();
    document.addEventListener('visibilitychange', this.alCambiarPestana);
    this.mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.alCambiarMovimiento = () => { this.reducido = this.mq.matches; this.animacion(this.actual, { mezcla: 0 }); this.actualizarBucle(); };
    this.mq?.addEventListener?.('change', this.alCambiarMovimiento);
    this.redimensionar();
    this.actualizarBucle();
  }

  // Solo hay bucle de dibujo si se ve, la pestaña está activa, hay movimiento permitido y la animación avanza.
  actualizarBucle() {
    if (!this.renderer) return;
    const animar = this.estado === 'listo' && this.visible && !document.hidden && !this.reducido && (this.ritmo > 0 || this.girando);
    if (animar && !this.enBucle) {
      this.enBucle = true;
      this.reloj.start();
      let acumulado = 0;
      const paso = this.movil ? 1 / 30 : 0;
      this.renderer.setAnimationLoop(() => {
        acumulado += this.reloj.getDelta();
        if (acumulado < paso) return;
        this.mixer.update(Math.min(acumulado, 0.1));
        acumulado = 0;
        this.renderer.render(this.escena, this.camara);
      });
    } else if (!animar && this.enBucle) {
      this.enBucle = false;
      this.reloj.stop();
      this.renderer.setAnimationLoop(null);
      this.dibujar();
    }
  }

  // Un dibujo suelto (cuando no hay bucle).
  dibujar() {
    if (this.renderer && this.modelo && !this.enBucle) {
      this.mixer.update(0);
      this.renderer.render(this.escena, this.camara);
    }
    return this;
  }

  // Arrastrar en horizontal gira el personaje; el desplazamiento vertical de la página sigue funcionando.
  activarGiro() {
    const l = this.lienzo;
    l.style.touchAction = 'pan-y';
    let x0 = null; let giro0 = 0;
    l.addEventListener('pointerdown', (e) => { x0 = e.clientX; giro0 = this.modelo.rotation.y; this.girando = true; l.setPointerCapture(e.pointerId); this.actualizarBucle(); });
    l.addEventListener('pointermove', (e) => {
      if (x0 == null) return;
      this.modelo.rotation.y = giro0 + ((e.clientX - x0) / Math.max(120, l.clientWidth)) * Math.PI * 1.5;
      if (!this.enBucle) { this.renderer.render(this.escena, this.camara); }
    });
    const soltar = () => { x0 = null; this.girando = false; this.actualizarBucle(); };
    l.addEventListener('pointerup', soltar);
    l.addEventListener('pointercancel', soltar);
  }

  destruir() {
    if (this.destruido) return;
    this.destruido = true;
    this.renderer?.setAnimationLoop(null);
    this.ro?.disconnect(); this.io?.disconnect();
    document.removeEventListener('visibilitychange', this.alCambiarPestana);
    this.mq?.removeEventListener?.('change', this.alCambiarMovimiento);
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.modelo); }
    if (this.escena) liberar(this.escena);
    this.entorno?.dispose();
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); }
    this.lienzo.remove();
    this.escena = this.modelo = this.renderer = this.mixer = null;
  }
}

function liberar(raiz) {
  const texturas = new Set();
  raiz.traverse((n) => {
    n.geometry?.dispose();
    for (const m of [n.material, n.userData?.material].flat()) {
      if (!m) continue;
      for (const v of Object.values(m)) if (v?.isTexture) texturas.add(v);
      m.dispose();
    }
  });
  texturas.forEach((t) => t.dispose());
}
