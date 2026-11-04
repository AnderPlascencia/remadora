import assert from 'node:assert/strict';
import * as V from '../src/ventajas.js';

// Remar a ritmo fijo: 4 m/s y 0,5 paladas por segundo (8 m por palada) durante n segundos.
const remar = (e, n, { v = 4, ppS = 0.5, desde = 0, detras = false, spm = 30 } = {}) => {
  let m = 0;
  for (let t = desde + 1; t <= desde + n; t++) m = V.avanzarVentaja(e, { t, dist: t * v, paladas: t * ppS, spm, detras });
  return m;
};
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} ≠ ${b}`);

// Sin talentos ni objetos no hay ventaja
assert.equal(remar(V.nuevaVentaja(), 1200), 0);
// Vikingo, Golpe de hacha grado 1: cada 100 paladas, 1 palada extra (8 m)
{
  const e = V.nuevaVentaja({ clase: 'vikingo', grados: { m1: 1 } });
  cerca(remar(e, 199), 0, 'antes de 100 paladas');
  cerca(remar(e, 1, { desde: 199 }), 8, 'a las 100 paladas');
  assert.equal(e.eventos[0].nombre, 'Golpe de hacha');
  assert.ok(e.eventos[0].discreto);
}
// Vikingo, Salida del drakkar grado 2: 1 m en cada una de las primeras 20 paladas, un solo aviso
{
  const e = V.nuevaVentaja({ clase: 'vikingo', grados: { m3: 2 } });
  cerca(remar(e, 100), 20, 'salida');
  assert.equal(e.eventos.length, 1);
}
// Tope de 40 m por carrera
{
  const e = V.nuevaVentaja({ clase: 'vikingo', grados: { m1: 3 } });
  cerca(remar(e, 3600), 40, 'tope');
}
// Pirata: Robar el viento solo cuenta paladas detrás de un fantasma; Mano rápida roba metros al adelantar
{
  const e = V.nuevaVentaja({ clase: 'pirata', grados: { m2: 1, m3: 2 } });
  cerca(remar(e, 120), 0, 'delante no roba viento');
  cerca(remar(e, 60, { desde: 120, detras: true }), 8, '30 paladas detrás');
  V.alAdelantar(e, 181);
  cerca(V.metrosVentaja(e), 14, 'Mano rápida +6 m');
}
// Samurái: Corte limpio se reinicia al detenerte 3 s; Kiai final en los últimos 200 m de una carrera de 1000 m
{
  const e = V.nuevaVentaja({ clase: 'samurai', grados: { m1: 1 } });
  remar(e, 70);
  remar(e, 3, { desde: 70, spm: 0 });
  cerca(remar(e, 70, { desde: 73 }), 0, 'se reinició al parar');
  cerca(remar(e, 10, { desde: 143 }), 8, '40 paladas seguidas');
  const k = V.nuevaVentaja({ clase: 'samurai', grados: { m3: 3 }, final: { meta: 1000 } });
  cerca(remar(k, 250), 12, 'kiai: 4 tramos de 50 m × 3 m');
}
// Polinesio: cada 250 m y, pasados los 2000 m, cada 500 m
{
  const e = V.nuevaVentaja({ clase: 'polinesio', grados: { m2: 1, m4: 1 } });
  cerca(remar(e, 750), 12 + 4, '3000 m: 12 tramos de 250 m × 1 m y 2 de 500 m × 2 m');
}
// Romano: Hortator cada minuto sin parar; Marcha de la legión con 2 días de racha
{
  const e = V.nuevaVentaja({ clase: 'romano', grados: { m2: 2, m4: 1 }, racha: 2 });
  cerca(V.metrosVentaja(e), 3, 'sale 3 m por delante');
  cerca(remar(e, 180), 3 + 6, '3 min × 2 m');
  cerca(V.metrosVentaja(V.nuevaVentaja({ clase: 'romano', grados: { m4: 1 }, racha: 1 })), 0, 'sin racha no hay salida');
}
// Objetos
assert.equal(remar(V.nuevaVentaja({ objeto: 'salida' }), 10), 20);
cerca(remar(V.nuevaVentaja({ objeto: 'viento' }), 600), 0.03 * 4 * 120, 'viento');
assert.equal(remar(V.nuevaVentaja({ objeto: 'ancla' }), 600), 0, 'sin final no hay ancla');
cerca(remar(V.nuevaVentaja({ objeto: 'ancla', final: { duracion: 600 } }), 600), 0.02 * 4 * 181, 'ancla por tiempo');
cerca(remar(V.nuevaVentaja({ objeto: 'ancla', final: { meta: 2000 } }), 500), 0.02 * 4 * 126, 'ancla por distancia');
// Segunda oportunidad: perder por menos de 15 m es empate
assert.equal(V.diferenciaFinal(-14, V.nuevaVentaja({ objeto: 'segunda' })), 0);
assert.equal(V.diferenciaFinal(-16, V.nuevaVentaja({ objeto: 'segunda' })), -16);
assert.equal(V.diferenciaFinal(-8, V.nuevaVentaja({ objeto: 'salida' })), 12);
// Ventajas nuevas (etapa 15)
assert.equal(V.OBJETOS_VENTAJA.length, 12);
cerca(remar(V.nuevaVentaja({ objeto: 'corriente' }), 300), 0.015 * 4 * 300, 'corriente');
assert.equal(remar(V.nuevaVentaja({ objeto: 'corriente' }), 1200), 30, 'corriente con tope de 30 m');
assert.equal(remar(V.nuevaVentaja({ objeto: 'aire', final: { duracion: 600 } }), 600), 0, 'segundo aire solo si vas detrás');
cerca(remar(V.nuevaVentaja({ objeto: 'aire', final: { duracion: 600 } }), 600, { detras: true }), 0.03 * 4 * 61, 'segundo aire en el último minuto');
{
  const e = V.nuevaVentaja({ objeto: 'cuerno' });
  for (let i = 0; i < 5; i++) V.alAdelantar(e, 10 + i);
  assert.equal(V.metrosVentaja(e), 15, 'cuerno: 3 veces');
}
{
  // Talismán: los talentos rinden un 25 % más y el tope sube a 50 m.
  const con = V.nuevaVentaja({ clase: 'romano', grados: { m2: 2 }, objeto: 'talisman' });
  cerca(remar(con, 180), 6 * 1.25, 'talismán');
  const sin = remar(V.nuevaVentaja({ clase: 'polinesio', grados: { m2: 3 } }), 3600, { v: 5 });
  const tal = remar(V.nuevaVentaja({ clase: 'polinesio', grados: { m2: 3 }, objeto: 'talisman' }), 3600, { v: 5 });
  assert.equal(sin, 40);
  assert.equal(tal, 50);
}
// Equipo del bote: salida de la vela, mascarón en los primeros 2 min, palas cada 100 paladas, tope de 25 m.
{
  const e = V.nuevaVentaja({ equipo: { salida: 8, inicio: 0.01, porPaladas: 1 } });
  cerca(V.metrosVentaja(e), 8, 'vela de taller');
  cerca(remar(e, 600), 8 + 0.01 * 4 * 120 + 3, 'mascarón y palas (300 paladas)');
  assert.equal(e.eventos.filter((x) => x.nombre === 'Mascarón').length, 1, 'un solo aviso del mascarón');
  assert.equal(remar(V.nuevaVentaja({ equipo: { salida: 15, porPaladas: 1, legendaria: 'vikingo' } }), 3600), V.TOPE_EQUIPO_M);
  cerca(V.metrosVentaja(V.nuevaVentaja({ equipo: { salida: 15, legendaria: 'romano' }, racha: 4 })), 23, 'Sol invicto: 2 m por día');
  const k = V.nuevaVentaja({ equipo: { salida: 15, legendaria: 'pirata' } });
  V.alAdelantar(k, 5);
  cerca(V.metrosVentaja(k), 19, 'Kraken');
}
// Pruebas sin objetos
assert.ok(V.esPrueba({ nombre: 'Prueba 500 m' }));
assert.ok(!V.esPrueba({ nombre: 'Pirámide' }));
// Mapa: detecta el acelerón
const rival = { muestras: Array.from({ length: 200 }, (_, i) => ({ t: i + 1, dist: i < 100 ? (i + 1) * 4 : 400 + (i - 99) * 4.5 })) };
assert.equal(V.proximoAceleron(rival, 60), 45);
console.log('ventajas OK');
