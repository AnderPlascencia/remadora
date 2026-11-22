// Respaldos con el formato de versiones viejas (etapa 22, QA-12), para comprobar que cada versión nueva los sigue
// restaurando con los mismos totales, marcas, XP, nivel y monedas (pruebas/e2e/respaldos-viejos.spec.mjs).
// Son datos inventados y fijos (sin azar): la prueba los arma con este archivo en cada corrida, así no pesan en el
// repositorio. No cambies lo que generan: son una foto de cómo guardaban los datos esas versiones.
//
// - respaldo-v0.44.json, formato 1 (sin «formato»; los ajustes como el texto de localStorage). Sesiones como las
//   guardaba la v0.44: un solo `rival`, sin `version` en algunas, una con saltos falsos de distancia de la consola
//   (la reparación la recorta) y una dañada que no se trae.
// - respaldo-v0.80.json, formato 2 (cada ajuste con su tipo). Sesiones con `rivales`, pausas, plan y pulso.
const DIA = 86_400_000;
const INICIO = Date.UTC(2026, 6, 7, 1, 0); // lunes 6 jul 2026, 19:00 en México

// Una muestra por segundo, con potencia que ondula y el split de esa potencia (fórmula del Concept2).
function muestrasDe(i, duracion, { fc = false, salto = null } = {}) {
  const base = 120 + (i % 6) * 12;
  let dist = 0;
  return Array.from({ length: duracion }, (_, k) => {
    const w = base + Math.round(18 * Math.sin((k + i) / 25));
    const split = Math.round(500 / Math.cbrt(w / 2.8));
    dist += 500 / split;
    // Saltos falsos de la consola: cientos de metros en un segundo (lo que repara repararSaltos).
    const extra = salto && k >= salto ? 400 : 0;
    return { t: k + 1, w, spm: 21 + (k % 4), split, dist: Math.round(dist) + extra, ...(fc ? { fc: 115 + Math.round(k / 40) } : {}) };
  });
}

function resumen(m) {
  const prom = (k) => Math.round(m.reduce((a, x) => a + x[k], 0) / m.length);
  return {
    duracion: m.at(-1).t, distancia: m.at(-1).dist, wattsProm: prom('w'), wattsMax: Math.max(...m.map((x) => x.w)),
    spmProm: prom('spm'), splitProm: prom('split'), kcal: Math.round(m.length * 0.18), paladas: Math.round((prom('spm') * m.length) / 60),
  };
}

export function v044() {
  const sesiones = [];
  for (let i = 0; i < 12; i++) {
    const fecha = INICIO + (Math.floor(i / 3) * 7 + [0, 2, 4][i % 3]) * DIA;
    const m = muestrasDe(i, 300 + ((i * 137) % 500), { salto: i === 5 ? 300 : null });
    const s = { fecha, ...resumen(m), muestras: m, entrenamiento: i % 3 === 2 ? null : 'Fondo 20 min', notas: '' };
    if (i % 2 === 0) s.version = '0.44.1';
    if (i % 4 === 1) s.rival = { nombre: 'Fantasma Haakon', diferencia: (i % 3) * 40 - 30, dificultad: 'costa' };
    if (i === 3) Object.assign(s, { entrenamiento: 'Prueba 2000 m', tiempoMeta: s.duracion });
    sesiones.push(s);
  }
  sesiones.push({ fecha: INICIO + 2 * DIA + 1, duracion: 'diez', distancia: 100 }); // dañada
  return {
    app: 'remadora', version: '0.44.1', fecha: new Date(INICIO + 40 * DIA).toISOString(),
    sesiones, entrenamientos: [{ nombre: 'Fondo 20 min', bloques: [{ duracion: 1200, metrica: 'ftp', min: 55, max: 70 }] }],
    programa: null,
    ajustes: { peso: '78', ftp: '160', edad: '44', personaje: JSON.stringify({ clase: 'vikingo', nombre: 'Erik', inventario: {}, gastado: 0 }), inicioHecho: '1', voz: '1' },
  };
}

export function v080() {
  const sesiones = [];
  for (let i = 0; i < 15; i++) {
    const fecha = INICIO + 60 * DIA + (Math.floor(i / 3) * 7 + [0, 2, 5][i % 3]) * DIA;
    const m = muestrasDe(i + 3, 600 + ((i * 211) % 700), { fc: true });
    const r = resumen(m);
    const s = {
      fecha, ...r, muestras: m, version: '0.80.0', entrenamiento: ['Fondo 30 min', 'Umbral 3×8', 'Fondo 30 min'][i % 3],
      delPrograma: i % 3 !== 2, horaFin: fecha + (r.duracion + 30) * 1000, pausas: [{ t: 300, ini: fecha + 300_000, fin: fecha + 330_000, motivo: 'auto' }],
      fcProm: Math.round(m.reduce((a, x) => a + x.fc, 0) / m.length), fcMax: Math.max(...m.map((x) => x.fc)),
      rivales: [{ nombre: 'Fantasma Kaito', diferencia: ((i * 37) % 120) - 50, dificultad: 'costa' }, { nombre: 'Fantasma Ragnar', diferencia: ((i * 53) % 90) - 60, dificultad: 'bahia' }],
      notas: i === 7 ? 'Me dolió la espalda' : '',
    };
    sesiones.push(s);
  }
  return {
    app: 'remadora', formato: 2, version: '0.80.0', fecha: new Date(INICIO + 100 * DIA).toISOString(),
    sesiones, entrenamientos: [], eventos: [],
    programa: null,
    ajustes: { peso: 70, ftp: 175, edad: 36, sexo: 'm', personaje: { clase: 'samurai', nombre: 'Aiko', inventario: {}, gastado: 0 }, inicioHecho: true, voz: false, vistaCarrera: '3d' },
  };
}

export const RESPALDOS_VIEJOS = { 'v0.44': v044, 'v0.80': v080 };
