import assert from 'node:assert/strict';
import * as V from '../ventajas.js';

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
assert.equal(remar(V.nuevaVentaja({ objeto: 'salida' }), 10), 15);
cerca(remar(V.nuevaVentaja({ objeto: 'viento' }), 600), 0.02 * 4 * 120, 'viento');
assert.equal(remar(V.nuevaVentaja({ objeto: 'ancla' }), 600), 0, 'sin final no hay ancla');
cerca(remar(V.nuevaVentaja({ objeto: 'ancla', final: { duracion: 600 } }), 600), 0.02 * 4 * 181, 'ancla por tiempo');
cerca(remar(V.nuevaVentaja({ objeto: 'ancla', final: { meta: 2000 } }), 500), 0.02 * 4 * 126, 'ancla por distancia');
// Segunda oportunidad: perder por menos de 10 m es empate
assert.equal(V.diferenciaFinal(-8, V.nuevaVentaja({ objeto: 'segunda' })), 0);
assert.equal(V.diferenciaFinal(-12, V.nuevaVentaja({ objeto: 'segunda' })), -12);
assert.equal(V.diferenciaFinal(-8, V.nuevaVentaja({ objeto: 'salida' })), 7);
// Pruebas sin objetos
assert.ok(V.esPrueba({ nombre: 'Prueba 500 m' }));
assert.ok(!V.esPrueba({ nombre: 'Pirámide' }));
// Mapa: detecta el acelerón
const rival = { muestras: Array.from({ length: 200 }, (_, i) => ({ t: i + 1, dist: i < 100 ? (i + 1) * 4 : 400 + (i - 99) * 4.5 })) };
assert.equal(V.proximoAceleron(rival, 60), 45);
console.log('ventajas OK');
