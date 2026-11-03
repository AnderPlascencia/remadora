import assert from 'node:assert/strict';
import * as E from '../src/estadisticas.js';
import { parseMedidaPulso } from '../src/protocolo.js';

// ---------- Potencia ----------
const pareja = Array.from({ length: 600 }, (_, t) => ({ t, w: 150 }));
assert.equal(E.variabilidadPotencia(pareja), 1);
assert.equal(E.factorIntensidad(pareja, 200), 0.75);
assert.equal(E.factorIntensidad(pareja, 0), null);
assert.equal(E.trabajoKj(pareja), 90);
// Tirones de 2 min a 300 W y 2 min a 50 W: misma media que 175 W parejo, pero más variabilidad.
const tirones = Array.from({ length: 600 }, (_, t) => ({ t, w: Math.floor(t / 120) % 2 ? 50 : 300 }));
assert.ok(E.variabilidadPotencia(tirones) > 1.2);
assert.equal(E.variabilidadPotencia(pareja.slice(0, 10)), null);

const curva = E.curvaPotencia(pareja);
assert.deepEqual(curva.map((p) => p.segs), [5, 10, 30, 60, 120, 180, 300, 600]);
assert.ok(curva.every((p) => p.w === 150));
const hist = E.curvaHistorial([{ fecha: 1, muestras: pareja }, { fecha: 2, muestras: pareja.map((x) => ({ ...x, w: x.t < 60 ? 400 : 100 })) }]);
assert.equal(hist.find((p) => p.segs === 60).w, 400);
assert.equal(hist.find((p) => p.segs === 60).fecha, 2);
assert.equal(hist.find((p) => p.segs === 600).fecha, 1);

// Puntos exactos de CP = 200 W y W′ = 20 000 J: P = CP + W′/t.
const pc = E.potenciaCritica([180, 300, 720, 1200].map((segs) => ({ segs, w: 200 + 20000 / segs })));
assert.deepEqual(pc, { cp: 200, wPrima: 20000 });
assert.equal(E.potenciaCritica([{ segs: 300, w: 250 }]), null);
assert.equal(E.potenciaCritica([{ segs: 60, w: 400 }, { segs: 3600, w: 180 }]), null);

// W′: 60 s a 300 W con CP 200 gasta 6000 J; luego se recarga sin pasar del máximo.
const sprint = [...Array.from({ length: 60 }, () => ({ w: 300 })), ...Array.from({ length: 600 }, () => ({ w: 100 }))];
const saldo = E.saldoWPrima(sprint, 200, 20000);
assert.equal(saldo[59], 14000);
assert.ok(saldo[200] > 14000 && saldo.at(-1) <= 20000);
assert.ok(saldo.at(-1) > saldo[200]);
assert.deepEqual(E.saldoWPrima(sprint, 0, 20000), []);

assert.equal(E.vo2maxEstimado(250, 75), 43);
assert.equal(E.vo2maxEstimado(250, 0), null);

// ---------- Potencia + pulso ----------
// 40 min a 150 W: el pulso sube de 130 a 140 lpm después del calentamiento.
const fondo = Array.from({ length: 2400 }, (_, t) => ({ t, w: 150, fc: t < 300 ? 100 + t / 10 : 130 + (10 * (t - 300)) / 2100 }));
const dec = E.desacople(fondo);
assert.ok(dec > 3 && dec < 5, `desacople ${dec}`);
assert.equal(E.desacople(fondo.slice(0, 900)), null);
const deriva = E.derivaCardiaca(fondo);
assert.ok(Math.abs(deriva - 10 / 35) < 0.01, `deriva ${deriva}`);
const plano = fondo.map((x) => ({ ...x, fc: 135 }));
assert.equal(E.desacople(plano), 0);
assert.equal(E.derivaCardiaca(plano), 0);
assert.equal(E.derivaCardiaca(fondo.map((x) => ({ ...x, fc: 0 }))), null);

assert.equal(E.pulsoAWatts(plano, 150), 135);
assert.equal(E.pulsoAWatts(plano, 250), null);
assert.equal(E.wattsAPulso(plano, 135), 150);
assert.equal(E.indiceEficiencia(plano), 1.11);

assert.equal(E.recuperacionPulso(170, 140), 30);
assert.equal(E.recuperacionPulso(170, 0), null);

// Un pico suelto de 220 no cuenta; 5 s seguidos a 185 sí.
const picos = Array.from({ length: 100 }, (_, t) => ({ t, fc: t === 50 ? 220 : t >= 80 && t < 85 ? 185 : 150 }));
assert.equal(E.fcMaxObservada([{ muestras: picos }]), 185);
assert.equal(E.fcMaxObservada([{ muestras: [] }]), null);

// RR alternando 800 y 820 ms: RMSSD = 20. Un latido perdido (1600 ms) se descarta.
const rr = Array.from({ length: 60 }, (_, i) => (i % 2 ? 820 : 800));
assert.equal(E.rmssd(rr), 20);
assert.equal(E.rmssd([...rr.slice(0, 30), 1600, ...rr.slice(30)]), 20);
assert.equal(E.rmssd(rr.slice(0, 10)), null);

// ---------- Carga ----------
const ahora = Date.parse('2026-10-26T12:00');
const dia = (d, w, segs = 3600) => ({ fecha: ahora - d * 864e5, duracion: segs, muestras: Array.from({ length: segs }, (_, t) => ({ t, w })) });
// 5 meses de una hora a 150 W cada día y una última semana el doble de dura: la fatiga supera a la condición.
const constante = Array.from({ length: 150 }, (_, i) => dia(i + 7, 150));
const r1 = E.ratioCarga(constante, 200, ahora - 7 * 864e5);
assert.ok(r1 > 0.95 && r1 < 1.1, `ratio ${r1}`);
const fuerte = [...constante, ...Array.from({ length: 7 }, (_, i) => dia(i, 200))];
assert.ok(E.ratioCarga(fuerte, 200, ahora) > 1.3);
assert.equal(E.ratioCarga([], 200, ahora), null);
// Las primeras 4 semanas no hay ratio: la condición empieza en 0 y cualquier carga parecería disparada.
const inicio = Array.from({ length: 9 }, (_, i) => dia(i * 2 + 1, 150));
assert.equal(E.diasDeHistorial(inicio, ahora), 17);
assert.equal(E.ratioCarga(inicio, 200, ahora), null);
assert.equal(E.diasDeHistorial([], ahora), 0);

const mono = E.monotonia([dia(0, 150), dia(2, 150), dia(4, 150)], 200, ahora);
assert.ok(mono.monotonia > 0 && mono.monotonia < 2);
assert.ok(mono.tension > 0);
assert.equal(E.monotonia([], 200, ahora), null);

const dist = E.distribucionIntensidad([dia(1, 140, 800), dia(2, 210, 200)], 200, 7, ahora);
assert.deepEqual({ ...dist, segundos: undefined }, { suave: 80, medio: 0, fuerte: 20, segundos: undefined });
assert.equal(E.distribucionIntensidad([dia(10, 140)], 200, 7, ahora), null);

// ---------- Medición de pulso del reloj (0x2A37) ----------
const dv = (bytes) => new DataView(new Uint8Array(bytes).buffer);
assert.deepEqual(parseMedidaPulso(dv([0x00, 72])), { fc: 72, contacto: null, energia: null, rr: [] });
assert.deepEqual(parseMedidaPulso(dv([0x01, 0x2c, 0x01])), { fc: 300, contacto: null, energia: null, rr: [] });
assert.equal(parseMedidaPulso(dv([0x04, 90])).contacto, false);
assert.equal(parseMedidaPulso(dv([0x06, 90])).contacto, true);
// Contacto + energía (500 kJ) + dos RR de 1024/1024 s y 820/1024 s.
assert.deepEqual(parseMedidaPulso(dv([0x1e, 140, 0xf4, 0x01, 0x00, 0x04, 0x34, 0x03])), { fc: 140, contacto: true, energia: 500, rr: [1000, 801] });
assert.equal(parseMedidaPulso(dv([0x00])), null);

console.log('métricas OK');
