// Tu perfil: datos que pides una vez (en la bienvenida o en Ajustes › Tú) y que la app usa para
// calcular mejor tus métricas y armar planes a tu medida. Todo es opcional: sin un dato, se usa
// una aproximación y la app lo dice.
//
// perfil = { edad, sexo: 'h' | 'm' | '', peso (kg), altura (cm), experiencia: 'inicio' | 'medio' | 'alto' | '',
//            dias (1–5), minutos (20 | 30 | 45 | 60 | 0 = sin límite), objetivo }

export const SEXOS = [
  { clave: 'h', nombre: 'Hombre' },
  { clave: 'm', nombre: 'Mujer' },
  { clave: 'x', nombre: 'Prefiero no decir' },
];
// Las mismas claves que NIVELES_PLAN de programa.js: deciden el volumen del plan mientras no hay historial.
export const EXPERIENCIAS = [
  { clave: 'inicio', nombre: 'Estoy empezando', texto: 'Remo poco o nunca' },
  { clave: 'medio', nombre: 'Remo a veces', texto: '1 o 2 veces por semana' },
  { clave: 'alto', nombre: 'Remo seguido', texto: '3 o más veces por semana' },
];
export const MINUTOS = [30, 45, 60, 0];
export const textoMinutos = (m) => (m ? `${m} min` : 'Sin límite');

// Metabolismo basal (Mifflin-St Jeor) en kcal por hora. Sin edad, altura o sexo: 1 kcal por kg y hora.
export function basalPorHora({ peso = 75, edad = 0, altura = 0, sexo = '' } = {}) {
  const kg = peso > 0 ? peso : 75;
  if (!(edad > 0 && altura > 0 && (sexo === 'h' || sexo === 'm'))) return kg;
  const dia = 10 * kg + 6.25 * altura - 5 * edad + (sexo === 'h' ? 5 : -161);
  return Math.max(30, dia / 24);
}

export const fcMaxDeEdad = (edad) => (edad > 0 ? 220 - edad : 0);

// FTP con el que arranca quien aún no ha remado: W/kg típicos en remo según experiencia y sexo,
// con un 0.5 % menos por año después de los 35. Se reemplaza con la primera sesión de 10 min o más.
const WKG_INICIAL = { inicio: 1.3, medio: 1.8, alto: 2.4 };
export function ftpInicial({ peso = 0, sexo = '', edad = 0, experiencia = '' } = {}) {
  if (!(peso > 0)) return 0;
  const base = WKG_INICIAL[experiencia] || WKG_INICIAL.inicio;
  const porSexo = sexo === 'm' ? 0.82 : sexo === 'h' ? 1 : 0.91;
  const porEdad = edad > 35 ? Math.max(0.6, 1 - 0.005 * (edad - 35)) : 1;
  return Math.round((base * porSexo * porEdad * peso) / 5) * 5;
}

// En los puestos de la tripulación (W/kg), las mujeres comparan contra referencias un 18 % más bajas.
export const factorClasificacion = (sexo) => (sexo === 'm' ? 0.82 : 1);

// Qué falta del perfil y qué mejora cada dato: para la tarjeta de Ajustes y la bienvenida.
export const USOS = [
  { clave: 'edad', falta: (p) => !p.edad, texto: 'Edad: tu pulso máximo, tus zonas de pulso y las calorías' },
  { clave: 'sexo', falta: (p) => !p.sexo, texto: 'Sexo: calorías, FTP inicial y tu puesto en la tripulación' },
  { clave: 'peso', falta: (p) => !p.peso, texto: 'Peso: W/kg, calorías y FTP inicial' },
  { clave: 'altura', falta: (p) => !p.altura, texto: 'Altura: calorías más exactas' },
  { clave: 'experiencia', falta: (p) => !p.experiencia, texto: 'Experiencia: cuánto volumen lleva tu primer plan' },
  { clave: 'minutos', falta: (p) => p.minutos == null, texto: 'Tiempo por sesión: el plan no se pasa de ese tiempo' },
];
export function completitud(p) {
  const faltan = USOS.filter((u) => u.falta(p));
  return { faltan, hechos: USOS.length - faltan.length, total: USOS.length };
}

// Lo que el perfil aporta al armar un plan: el nivel (si aún no hay historial que lo diga) y el tope de minutos.
export function ctxPlanDePerfil(p, { sinHistorial = true } = {}) {
  const ctx = {};
  if (sinHistorial && p.experiencia) ctx.nivel = p.experiencia;
  if (p.minutos > 0) ctx.minutosMax = p.minutos;
  return ctx;
}
