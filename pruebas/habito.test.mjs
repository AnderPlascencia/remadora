import test from 'node:test';
import assert from 'node:assert/strict';
import * as Hab from '../src/habito.js';
import { armarRespaldo } from '../src/respaldo.js';

const ses = (iso) => ({ fecha: Date.parse(iso), duracion: 1200, distancia: 4000 });
const AHORA = Date.parse('2026-11-21T12:00'); // sábado

test('sesiones por semana, de lunes a domingo', () => {
  const s = [ses('2026-11-16T09:00'), ses('2026-11-20T09:00'), ses('2026-11-10T09:00'), ses('2026-10-01T09:00')];
  assert.deepEqual(Hab.sesionesPorSemana(s, 4, AHORA), [0, 0, 1, 2]);
});

test('pausas, huecos largos y tiempo hasta volver', () => {
  // Días: 1, 2, 6 (pausa de 4), 7, 17 (hueco de 10), 18
  const s = ['01', '02', '06', '07', '17', '18'].map((d) => ses(`2026-11-${d}T09:00`));
  const p = Hab.pausas(s, AHORA);
  assert.equal(p.pausas, 2);
  assert.equal(p.huecos, 1);
  assert.equal(p.masLarga, 10);
  assert.equal(p.vuelta, 7);
  assert.equal(p.diasSinRemar, 3);
  assert.deepEqual(Hab.pausas([], AHORA), { pausas: 0, huecos: 0, masLarga: 0, vuelta: null, diasSinRemar: null });
});

test('eventos: aperturas, sesiones dejadas y tasa de compartir', () => {
  const t = (d, h = 9) => Date.parse(`2026-11-${d}T${String(h).padStart(2, '0')}:00`);
  const eventos = [
    { t: t('10'), tipo: 'app' }, { t: t('10', 10), tipo: 'app' }, { t: t('12'), tipo: 'app' },
    { t: t('10'), tipo: 'sesionInicio' }, { t: t('10', 10), tipo: 'sesionFin', completa: true },
    { t: t('12'), tipo: 'sesionInicio' }, { t: t('12', 10), tipo: 'sesionFin', completa: false }, // sin acabar el plan
    { t: t('13'), tipo: 'sesionInicio' }, { t: t('13', 10), tipo: 'sesionCorta' }, // muy corta
    { t: t('14'), tipo: 'sesionInicio' }, // la app se cerró…
    { t: t('15'), tipo: 'sesionInicio', reanudada: true }, { t: t('15', 10), tipo: 'sesionFin', completa: true }, // …y se recuperó
    { t: t('16'), tipo: 'sesionInicio' }, // se cerró y no se recuperó
    { t: t('12', 11), tipo: 'compartir' },
    { t: t('01'), tipo: 'bienvenida', paso: 2 }, { t: t('01'), tipo: 'bienvenida', paso: 3 },
    { t: Date.parse('2026-09-01T09:00'), tipo: 'app' }, // fuera de los 28 días
  ];
  const sesiones = [ses('2026-11-10T09:00'), ses('2026-11-12T09:00'), ses('2026-11-15T09:00'), ses('2026-11-18T09:00')];
  const r = Hab.resumenEventos(eventos, sesiones, 28, AHORA);
  assert.equal(r.aperturas, 3);
  assert.equal(r.diasConApp, 2);
  assert.equal(r.empezadas, 5);
  assert.equal(r.terminadas, 3);
  assert.equal(r.dejadas, 3);
  assert.equal(r.compartidas, 1);
  assert.equal(r.tasaCompartir, 25);
  assert.deepEqual(r.bienvenida, { pasoMax: 3, terminada: false });
});

test('la lista de eventos no crece sin fin y se une sin repetir', () => {
  let l = [];
  for (let i = 0; i < 12; i++) l = Hab.agregarEvento(l, { t: i, tipo: 'app' }, 10);
  assert.equal(l.length, 10);
  assert.equal(l[0].t, 2);
  const u = Hab.unirEventos([{ t: 1, tipo: 'app' }, { t: 3, tipo: 'app' }], [{ t: 1, tipo: 'app' }, { t: 2, tipo: 'compartir' }, { t: 4, tipo: 'raro' }, null]);
  assert.deepEqual(u.map((e) => e.t), [1, 2, 3]);
});

test('resumen con plan: cumplimiento en %, y media solo desde que empezaste', () => {
  const programa = { nombre: 'X', inicio: '2026-11-16', dias: [{ fecha: '2026-11-16', ent: 'A' }, { fecha: '2026-11-18', ent: 'B' }, { fecha: '2026-11-23', ent: 'A' }] };
  const sesiones = [{ ...ses('2026-11-16T09:00'), entrenamiento: 'A' }, { ...ses('2026-11-11T09:00'), entrenamiento: 'Z' }];
  const r = Hab.resumenHabito({ sesiones, eventos: [], programa, ahora: AHORA });
  assert.equal(r.cumplimiento.hechos, 1);
  assert.equal(r.media, 1); // una semana cerrada desde la primera sesión, con una sesión
  assert.equal(Hab.resumenHabito({ sesiones: [], ahora: AHORA }).media, null);
});

test('el respaldo lleva los eventos', () => {
  const r = armarRespaldo({ version: 'x', sesiones: [], entrenamientos: [], programa: null, leer: () => null, eventos: [{ t: 1, tipo: 'app' }] });
  assert.deepEqual(r.eventos, [{ t: 1, tipo: 'app' }]);
});
