// Registro de los ajustes que la app guarda en localStorage: cada clave con su tipo, su valor por defecto
// y si entra en el respaldo. Una clave que no esté aquí no se puede usar (lo comprueba pruebas/ajustes.test.mjs).
//
// tipo: 'texto', 'numero' (vacío = sin valor), 'si' ('1' o '0') o 'json'. En localStorage todo va como texto;
// en el respaldo (formato 2) cada valor va con su tipo: 75 y no '75', true y no '1', el héroe como objeto.

const A = (tipo, defecto, respaldo = false) => ({ tipo, defecto, respaldo });

export const AJUSTES = {
  // Perfil
  peso: A('numero', 75, true),
  ftp: A('numero', 0, true),
  ftpEstimado: A('si', false, true),
  ftpDePerfil: A('si', false, true),
  perfilPorPartesNo: A('si', false, true),
  ftpRevisado: A('numero', 0, true), // cuándo aceptaste o descartaste la última propuesta de FTP (estadisticas.revisarFtp)
  edad: A('numero', 0, true),
  sexo: A('texto', '', true),
  altura: A('numero', 0, true),
  experiencia: A('texto', '', true),
  diasSemana: A('numero', 3, true),
  minutosSesion: A('numero', null, true),
  fcMax: A('numero', 0, true),
  fcMaxDeEdad: A('si', false, true),
  fcMaxFuente: A('texto', '', true), // 'manual', 'observada' o 'edad' (pulso.js)
  fcReposo: A('numero', 0, true),
  metaSemana: A('numero', 10, true),
  // Tu cita (etapa 13, cita.js): días de remo (0 = lunes) y hora; la próxima cita movida a mano ({ fecha, hora }).
  diasRemo: A('json', null, true),
  horaRemo: A('texto', '19:00', true),
  citaMovida: A('json', null, false),
  // Preferencias
  voz: A('si', true, true),
  cantidadVoz: A('texto', 'completa', true), // 'datos', 'entrenador' o 'completa' (voz.js)
  modoAuto: A('si', false, true),
  empezarPalada: A('si', false, true), // etapa 16: en el modo remo, la sesión empieza con la primera palada
  ahorroBateria: A('si', false, true), // Ajustes › Apariencia: la carrera a 30 fps y densidad 1,5 (carrera.js)
  pausaAuto: A('si', true, true),
  resAuto: A('si', false, true),
  atrVivo: A('si', true, true),
  avanzado: A('si', false, true),
  libreFantasmas: A('si', true, true),
  vistaRemo: A('texto', 'numeros', true),
  vistaCarrera: A('texto', '2d', true),
  variante: A('texto', 'generica', true),
  tema: A('texto', 'oscuro', true),
  guiado: A('texto', '0-0', true),
  ritmoObjetivo: A('texto', '', true),
  inicioHecho: A('si', false, true),
  // Héroe y rivales
  personaje: A('json', null, true),
  referencias: A('json', null, true),
  fantasmaPerso: A('json', {}, true),
  rivales: A('json', [], false),
  dificultad: A('texto', 'costa', false),
  // Plan (el plan va aparte en el respaldo, en «programa»)
  programa: A('json', null, false),
  calendarioPlan: A('json', null, false),
  eleccionDia: A('texto', '', false),
  antesDeRemar: A('json', null, false), // { dia, sueno, dolor, zona }: lo que respondiste hoy antes de remar
  retoActivo: A('texto', '', false), // el reto recibido por enlace (reto.js), codificado como llegó; se borra al rechazarlo
  dolores: A('json', [], true), // [{ dia, dolor, zona }] de las últimas 4 semanas (etapa 27)
  riesgoAbandono: A('json', null, false), // { dia, respondido } del último aviso de riesgo de abandono (etapa 30, habito.js). Fuera del respaldo: lo escribe el teléfono al mostrarlo
  // Dónde te quedaste en la pantalla
  modoEnt: A('texto', 'libre', false),
  ultimoEnt: A('texto', '', false),
  ultimoEntObjetivo: A('texto', '', false),
  pestanaPlanes: A('texto', 'entrenamientos', false),
  seccionEnt: A('texto', 'potencia', false),
  subirAtr: A('texto', '', false),
  hoyDetalle: A('si', false, false),
  hoyMas: A('si', false, false), // ronda 2, UX2-4: el «Más» de la tarjeta Hoy abierto
  clasificacionVista: A('numero', -1, false),
  // Avisos ya vistos y marcas de tiempo
  ultimoRespaldo: A('numero', 0, false),
  ayudaGestos: A('numero', 0, false),
  avisoXpLenta: A('si', false, false),
  avisoTriunfo12: A('si', false, false), // etapa 12: el Triunfo romano cambió (se avisa una vez)
  // La copia de la sesión en curso cuando IndexedDB falla (ver pantallas/sesion.js).
  sesionEnCurso: A('json', null, false),
};

// Claves con un prefijo fijo: consejo-entrenar, consejo-heroe…
export const PREFIJOS = {
  'consejo-': A('si', false, false),
  'consejoVisto-': A('numero', null, false), // ronda 2, UX2-37: veces que salió el consejo de esa pestaña
};

export function definicion(clave) {
  if (Object.hasOwn(AJUSTES, clave)) return AJUSTES[clave];
  const p = Object.keys(PREFIJOS).find((x) => clave.startsWith(x));
  return p ? PREFIJOS[p] : null;
}

export const registrada = (clave) => definicion(clave) != null;

export const CLAVES_RESPALDO = Object.keys(AJUSTES).filter((k) => AJUSTES[k].respaldo);

// El valor por defecto tal como iría en localStorage.
export function defectoTexto(clave) {
  const d = definicion(clave);
  return d ? aTexto(clave, d.defecto) : undefined;
}

// De texto (localStorage) a su tipo. undefined si el texto no vale para ese tipo.
export function aTipo(clave, texto) {
  const d = definicion(clave);
  if (texto == null || !d) return undefined;
  const t = String(texto);
  switch (d.tipo) {
    case 'numero': {
      if (t === '') return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'si': return t === '1' ? true : t === '0' ? false : undefined;
    case 'json': try { return JSON.parse(t); } catch { return undefined; }
    default: return t;
  }
}

// De su tipo a texto (localStorage). undefined si el valor no es de ese tipo.
export function aTexto(clave, valor) {
  const d = definicion(clave);
  if (!d || valor === undefined) return undefined;
  switch (d.tipo) {
    case 'numero': return valor == null || valor === '' ? '' : Number.isFinite(Number(valor)) ? String(Number(valor)) : undefined;
    case 'si': return typeof valor === 'boolean' ? (valor ? '1' : '0') : undefined;
    case 'json': return JSON.stringify(valor);
    default: return typeof valor === 'string' ? valor : undefined;
  }
}
