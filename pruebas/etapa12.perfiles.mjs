// Perfiles típicos de cada clase (etapa 12): lo usan pruebas/etapa12.test.mjs para igualar los talentos.
const base = { paladas: 0, metros: 0, min: 0, ganados: 0, rivales: 0, sinPausas: false, delPrograma: false, racha: 1, sesSemana: 1, kmSemana: 0, metaSemanaKm: 40 };
const s = (x) => ({ ...base, ...x });
export const PERFILES = {
  // 3 o 4 sesiones de 30 min a 24 golpes/min y una larga de 45 a la semana.
  vikingo: [720, 720, 720, 1080].map((paladas) => s({ paladas, min: paladas / 24, metros: paladas * 10 })),
  // Siempre con 3 fantasmas; gana de 0 a 3 (la media, 1,5).
  pirata: [0, 0, 1, 1, 1, 2, 2, 2, 3, 3].map((ganados) => s({ rivales: 3, ganados, min: 30, metros: 7000 })),
  // Sin pausas 7 de cada 10, sesión del plan 6 de cada 10 (las dos juntas, 4).
  samurai: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 0], [1, 0], [1, 0], [0, 1], [0, 1], [0, 0]].map(([p, d]) => s({ sinPausas: !!p, delPrograma: !!d, min: 30, metros: 7000 })),
  // 35 min y 8 km; una de cada 4, 60 min y 13 km.
  polinesio: [[35, 8000], [35, 8000], [35, 8000], [60, 13000]].map(([min, metros]) => s({ min, metros })),
  // 4 sesiones por semana de 6 km, racha de 1 o 2 días.
  romano: [1, 2, 3, 4].map((n) => s({ sesSemana: n, racha: n % 2 ? 1 : 2, metros: 6000, kmSemana: 6 * n, min: 30 })),
};
