import assert from 'node:assert/strict';
import * as H from '../src/habilidades.js';
import * as V from '../src/ventajas.js';

// Etapa 5 del rediseño del héroe: habilidad de clase en carrera, con los límites del entrenador.
const permiso = { activa: true, maxActivaciones: null, calentado: true };
// Rema `seg` segundos con lo que devuelve `f(t)` = { w, spm, mps, brecha }.
function remar(e, seg, f, desde = 0) {
  let dist = e._dist || 0, pal = e._pal || 0;
  for (let t = desde + 1; t <= desde + seg; t++) {
    const x = { w: 200, spm: 24, mps: 4, brecha: null, ...f(t) };
    dist += x.mps;
    pal += x.spm / 60;
    V.avanzarVentaja(e, { t, dist, paladas: pal, spm: x.spm, w: x.w, brecha: x.brecha, detras: x.brecha != null });
  }
  e._dist = dist;
  e._pal = pal;
  return e;
}
const de = (e, nombre) => e.eventos.filter((x) => x.nombre === nombre);

// ---------- Qué habilidad tiene cada clase ----------
assert.equal(H.habilidadDe('vikingo', 'a'), 'timonel');
assert.equal(H.habilidadDe('vikingo', 'b'), 'furia', 'la Furia es del Berserker');
assert.deepEqual(['pirata', 'samurai', 'polinesio', 'romano'].map((c) => H.habilidadDe(c)), ['abordaje', 'zanshin', 'estrella', 'pausarius']);
for (const h of Object.values(H.HABILIDADES)) assert.ok(h.m <= 6 && h.texto && h.nombre);
// Ninguna de intensidad paga más que una de constancia.
const maxInt = Math.max(...Object.values(H.HABILIDADES).filter((h) => h.intensidad).map((h) => h.m));
assert.ok(maxInt <= Math.max(...Object.values(H.HABILIDADES).filter((h) => !h.intensidad).map((h) => h.m)));
// Sin habilidad (pruebas): null.
assert.equal(V.nuevaVentaja({ clase: 'vikingo' }).habilidad, null);

// ---------- Furia del berserker ----------
{
  const nueva = (x = {}) => V.nuevaVentaja({ clase: 'vikingo', senda: 'b', intensidad: permiso, final: { meta: 2000 }, habilidad: { ftp: 200, ftpFiable: true }, ...x });
  // 20 s a 230 W con cadencia 28: cobra; luego no antes de 3 min; como mucho 2 en 2000 m.
  const e = remar(nueva(), 900, (t) => ({ w: t % 100 < 30 ? 230 : 180, spm: 28 }));
  const f = de(e, 'Furia del berserker');
  assert.equal(f.length, 2, '3.ª activación en 2000 m no cobra');
  assert.ok(f[1].t - f[0].t >= 180);
  // Con cadencia 33 no cuenta: la fuerza va en la palada, no en ir más rápido.
  assert.equal(de(remar(nueva(), 300, () => ({ w: 230, spm: 33 })), 'Furia del berserker').length, 0);
  // Sin calentar, nada en los primeros 5 min.
  const fria = remar(nueva({ intensidad: { ...permiso, calentado: false } }), 299, () => ({ w: 230, spm: 28 }));
  assert.equal(de(fria, 'Furia del berserker').length, 0);
  // Con el cuerpo cargado, la de reserva (Timonel) en vez de la Furia.
  const cargado = nueva({ intensidad: { activa: false, motivo: 'cuerpo', calentado: true } });
  assert.equal(cargado.habilidad.id, 'timonel');
  assert.equal(de(remar(cargado, 300, () => ({ w: 230, spm: 28 })), 'Furia del berserker').length, 0);
  // FTP sin prueba reciente: el umbral es la media de 2 min + 15 %.
  const sinPrueba = remar(nueva({ habilidad: { ftp: 400, ftpFiable: false } }), 400, (t) => ({ w: t > 300 ? 240 : 200, spm: 28 }));
  assert.equal(de(sinPrueba, 'Furia del berserker').length, 1);
  // Paga plano: igual a 230 W que a 400 W.
  assert.equal(de(remar(nueva(), 30, () => ({ w: 400, spm: 28 })), 'Furia del berserker')[0].m, H.HABILIDADES.furia.m);
  // Las primeras 4 semanas, 1 sola activación (contando la Furia de salida de los talentos).
  const novato = remar(nueva({ intensidad: { ...permiso, maxActivaciones: 1 } }), 900, (t) => ({ w: t % 200 < 30 ? 230 : 180, spm: 28 }));
  assert.equal(de(novato, 'Furia del berserker').length, 1);
  assert.ok(V.usoIntensidad(novato), 'cuenta para el límite semanal');
}

// ---------- Timonel ----------
{
  const e = V.nuevaVentaja({ clase: 'vikingo', intensidad: permiso, habilidad: { ftp: 200, mppMedia: 10 } });
  // 22 paladas/min a 4 m/s = 10,9 m por palada (+9 %): cada 2 min, 3 m.
  remar(e, 250, () => ({ spm: 22, mps: 4 }));
  assert.equal(de(e, 'Timonel').length, 2);
  assert.ok(!V.usoIntensidad(e), 'el Timonel es de constancia');
  // Con cadencia 26 no cuenta (no se trata de estirar de más).
  assert.equal(de(remar(V.nuevaVentaja({ clase: 'vikingo', intensidad: permiso, habilidad: { mppMedia: 10 } }), 250, () => ({ spm: 26, mps: 5 })), 'Timonel').length, 0);
}

// ---------- ¡Al abordaje! ----------
{
  const nueva = (x = {}) => V.nuevaVentaja({ clase: 'pirata', intensidad: permiso, habilidad: { ftp: 200 }, ...x });
  // A 10 m del fantasma, 15 s a 240 W tras ir a 200: cobra. Hasta 3, con 90 s entre una y otra.
  const e = remar(nueva(), 600, (t) => ({ w: t % 100 >= 60 && t % 100 < 80 ? 240 : 200, brecha: 10 }));
  const a = de(e, '¡Al abordaje!');
  assert.equal(a.length, 3);
  assert.ok(a.every((x, i) => !i || x.t - a[i - 1].t >= 90));
  // Lejos del fantasma, nada.
  assert.equal(de(remar(nueva(), 300, (t) => ({ w: t % 100 >= 60 && t % 100 < 80 ? 240 : 200, brecha: 40 })), '¡Al abordaje!').length, 0);
  // Dejarse caer detrás a propósito y acelerar no cobra: hace un minuto ibas 2 m detrás y ahora 12.
  const caido = remar(nueva(), 120, (t) => ({ w: t > 100 ? 240 : 190, brecha: t < 40 ? 2 : Math.min(12, 2 + (t - 40) / 5) }));
  assert.equal(de(caido, '¡Al abordaje!').length, 0);
  // Comparte el contador de 3 con Mano rápida.
  const mano = nueva({ grados: { m3: 3 } });
  for (const t of [10, 110, 210]) V.alAdelantar(mano, t);
  assert.equal(de(mano, 'Mano rápida').length, 3);
  V.alAdelantar(mano, 400);
  assert.equal(de(mano, 'Mano rápida').length, 3, 'la cuarta no');
  remar(mano, 600, (t) => ({ w: t % 100 >= 60 && t % 100 < 80 ? 240 : 200, brecha: 10 }), 400);
  assert.equal(de(mano, '¡Al abordaje!').length, 0, 'el contador ya está lleno');
  // Con la intensidad apagada: Estrella guía de reserva.
  assert.equal(nueva({ intensidad: { activa: false, motivo: 'semana' } }).habilidad.id, 'estrella');
}

// ---------- Zanshin ----------
{
  const nueva = () => V.nuevaVentaja({ clase: 'samurai', intensidad: permiso, final: { meta: 2000 }, habilidad: { ftp: 200 } });
  // Ruido de ±2 en el dato bruto con la media estable: cobra al cruzar la meta.
  const e = remar(nueva(), 500, (t) => ({ spm: 24 + (t % 2 ? 2 : -2) }));
  assert.equal(de(e, 'Zanshin').length, 1);
  // Subir la cadencia al final (el «sprint de cadencia») no cobra.
  assert.equal(de(remar(nueva(), 500, (t) => ({ spm: t > 440 ? 30 : 24 })), 'Zanshin').length, 0);
  // Aflojar más de un 10 % tampoco.
  assert.equal(de(remar(nueva(), 500, (t) => ({ w: t > 440 ? 160 : 200 })), 'Zanshin').length, 0);
}

// ---------- Estrella guía y Ritmo del pausarius ----------
{
  const e = remar(V.nuevaVentaja({ clase: 'polinesio', intensidad: permiso, habilidad: { ftp: 200 } }), 500, () => ({}));
  assert.equal(de(e, 'Estrella guía').length, 2, 'una cada 4 min con el ritmo parejo');
  const irregular = remar(V.nuevaVentaja({ clase: 'polinesio', intensidad: permiso, habilidad: { ftp: 200 } }), 500, (t) => ({ mps: t % 60 < 30 ? 4 : 4.4 }));
  assert.equal(de(irregular, 'Estrella guía').length, 0);
  const r = remar(V.nuevaVentaja({ clase: 'romano', intensidad: permiso, habilidad: { ftp: 200 } }), 600, () => ({ spm: 24 }));
  assert.equal(de(r, 'Ritmo del pausarius').length, 2, '2 min para fijar el ritmo y luego una cada 3 min');
  // Paleando (menos del 60 % del FTP) no cuenta.
  assert.equal(de(remar(V.nuevaVentaja({ clase: 'romano', intensidad: permiso, habilidad: { ftp: 200 } }), 600, () => ({ spm: 24, w: 100 })), 'Ritmo del pausarius').length, 0);
}

// ---------- Topes ----------
{
  // La habilidad nunca da más de 15 m, y talentos + habilidad nunca pasan de 40.
  const e = remar(V.nuevaVentaja({ clase: 'polinesio', intensidad: permiso, habilidad: { ftp: 200 } }), 3600, () => ({}));
  assert.equal(e.habilidad.m, H.SUBTOPE_HABILIDAD_M);
  const lleno = { m1: 3, m2: 3, m3: 3, m4: 3, maestria: 3 };
  const t = remar(V.nuevaVentaja({ clase: 'polinesio', grados: lleno, intensidad: permiso, habilidad: { ftp: 200 } }), 3600, () => ({}));
  assert.ok(t.talentos <= 40);
  // En una sesión del plan, ni habilidad ni talentos de intensidad.
  const p = V.nuevaVentaja({ clase: 'polinesio', intensidad: permiso, habilidad: { ftp: 200 } });
  V.apagarIntensidad(p, 'plan');
  assert.equal(de(remar(p, 500, () => ({})), 'Estrella guía').length, 0);
}
