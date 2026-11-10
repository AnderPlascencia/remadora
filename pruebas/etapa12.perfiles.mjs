// Perfiles típicos de cada clase (etapa 12): lo usan pruebas/etapa12.test.mjs para igualar los talentos.
const base = { paladas: 0, metros: 0, min: 0, ganados: 0, rivales: 0, sinPausas: false, delPrograma: false, racha: 1, sesSemana: 1, kmSemana: 0, metaSemanaKm: 40 };
const s = (x) => ({ ...base, ...x });
export const PERFILES = {
  // 3 o 4 sesiones de 30 min a 24 golpes/min y una larga de 45 a la semana.
  vikingo: [720, 720, 720, 1080].map((paladas) => s({ paladas, min: paladas / 24, metros: paladas * 10 })),
  // Desde la etapa 3 del rediseño, el vikingo de palada larga: 3 o 4 sesiones de 7,2 km y una de 10,8; la palada
  // igual que la habitual, un 4 % más larga, un 3 % más corta y un 1 % más larga.
  vikingoPalada: [[7200, 1], [7200, 1.04], [7200, 0.97], [10800, 1.01]].map(([metros, rel]) => s({ palada: true, mppMedia: 10, metros, paladas: Math.round(metros / (10 * rel)), min: metros / 240 })),
  // Siempre con 3 fantasmas; gana de 0 a 3 (la media, 1,5).
  pirata: [0, 0, 1, 1, 1, 2, 2, 2, 3, 3].map((ganados) => s({ rivales: 3, ganados, min: 30, metros: 7000 })),
  // Sin pausas 7 de cada 10, sesión del plan 6 de cada 10 (las dos juntas, 4).
  samurai: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 0], [1, 0], [1, 0], [0, 1], [0, 1], [0, 0]].map(([p, d]) => s({ sinPausas: !!p, delPrograma: !!d, min: 30, metros: 7000 })),
  // 35 min y 8 km; una de cada 4, 60 min y 13 km.
  polinesio: [[35, 8000], [35, 8000], [35, 8000], [60, 13000]].map(([min, metros]) => s({ min, metros })),
  // 4 sesiones por semana de 6 km, racha de 1 o 2 días.
  romano: [1, 2, 3, 4].map((n) => s({ sesSemana: n, racha: n % 2 ? 1 : 2, metros: 6000, kmSemana: 6 * n, min: 30 })),
};

// Senda B (etapa 4 del rediseño): un perfil típico de cada una, con el árbol lleno.
const b = (x) => s({ senda: 'b', palada: true, mppMedia: 10, ...x });
export const PERFILES_SENDA_B = {
  // Berserker: 2 sesiones clave del plan de 6 km, 2 carreras de 2000 m contra 3 fantasmas y 4 de 7,2 km (una de palada corta).
  vikingo: [b({ clave: true, metros: 6000, paladas: 600, min: 30 }), b({ metros: 2000, paladas: 200, min: 8, rivales: 3, ganados: 1 }), b({ metros: 2000, paladas: 200, min: 8, rivales: 3, ganados: 2 }), b({ metros: 7200, paladas: 720, min: 30 }), b({ metros: 7200, paladas: 750, min: 30 }), b({ clave: true, metros: 6000, paladas: 620, min: 30 }), b({ metros: 7200, paladas: 700, min: 30 }), b({ metros: 7200, paladas: 720, min: 30 })],
  // Intendente: 3 fantasmas, gana de 0 a 3, alguna reñida y alguna en Alta mar.
  pirata: [0, 0, 1, 1, 1, 2, 2, 2, 3, 3].map((ganados, i) => b({ rivales: 3, ganados, renidas: Math.min(ganados, i % 2), altamar: ganados >= 2 && i % 3 === 0 ? 1 : 0, min: 30, metros: 7000 })),
  // Senda de la espada: % en rango de 40 a 95 y de 0 a 25 min de remo parejo.
  samurai: [[95, 1, 1, 20], [85, 1, 0, 15], [70, 0, 1, 10], [90, 1, 1, 25], [60, 0, 0, 5], [82, 1, 1, 20], [50, 0, 0, 0], [92, 1, 1, 25], [75, 1, 0, 15], [40, 0, 1, 5]].map(([pctEnRango, p, d, tecMin]) => b({ pctEnRango, sinPausas: !!p, delPrograma: !!d, tecMin, min: 30, metros: 7000 })),
  // Remero de carrera: carreras de 8 y 13 km contra 3 fantasmas; una sin fantasmas.
  polinesio: [[35, 8000, 3, 1], [35, 8000, 3, 2], [35, 8000, 0, 0], [60, 13000, 3, 3], [35, 8000, 3, 1], [60, 13000, 3, 2]].map(([min, metros, rivales, ganados]) => b({ min, metros, rivales, ganados })),
  // Harpax: 4 sesiones por semana de 6 km contra 3 fantasmas, una en Alta mar.
  romano: [1, 2, 3, 4].map((n) => b({ sesSemana: n, metros: 6000, min: 30, rivales: 3, ganados: [1, 2, 1, 3][n - 1], altamar: n === 4 ? 1 : 0 })),
};
