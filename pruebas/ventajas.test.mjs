import assert from 'node:assert/strict';
import * as V from '../ventajas.js';

// Remar a ritmo fijo: 4 m/s y w vatios durante n segundos.
const remar = (e, n, w = 150, v = 4, desde = 0) => {
  let m = 0;
  for (let t = desde + 1; t <= desde + n; t++) m = V.avanzarVentaja(e, { t, w, dist: t * v });
  return m;
};

// Sin talentos ni objetos no hay ventaja
assert.equal(remar(V.nuevaVentaja(), 1200), 0);

// Potencia II: 20 s sobre el FTP dan 15 m, una vez cada 2 min
{
  const e = V.nuevaVentaja({ grados: { 'potencia-2': 1 }, ftp: 200, nombres: { 'potencia-2': 'Grito de guerra' } });
  assert.equal(remar(e, 19, 250), 0);
  assert.equal(remar(e, 1, 250, 4, 19), 15);
  assert.equal(remar(e, 60, 250, 4, 20), 15, 'no se repite antes de 2 min');
  assert.equal(e.eventos[0].nombre, 'Grito de guerra');
}
// Fondo II: cada 10 min parejos dan 10 m; el total de talentos no pasa de 30 m
{
  const e = V.nuevaVentaja({ grados: { 'fondo-2': 1 } });
  const m = remar(e, 3600);
  assert.equal(m, 30, 'tope de 30 m por carrera');
}
// Disciplina II: tras 60 s estables, 1 % de tu avance durante 60 s
{
  const e = V.nuevaVentaja({ grados: { 'disciplina-2': 1 } });
  const m = remar(e, 120);
  assert.ok(Math.abs(m - 0.01 * 4 * 60) < 0.01, `disciplina ${m}`);
}
// Objetos
assert.equal(remar(V.nuevaVentaja({ objeto: 'salida' }), 10), 15);
assert.ok(Math.abs(remar(V.nuevaVentaja({ objeto: 'viento' }), 600) - 0.02 * 4 * 120) < 0.01);
assert.equal(remar(V.nuevaVentaja({ objeto: 'ancla' }), 600), 0, 'sin final no hay ancla');
assert.ok(Math.abs(remar(V.nuevaVentaja({ objeto: 'ancla', final: { duracion: 600 } }), 600) - 0.02 * 4 * 181) < 0.01);
assert.ok(Math.abs(remar(V.nuevaVentaja({ objeto: 'ancla', final: { meta: 2000 } }), 500) - 0.02 * 4 * 126) < 0.01);
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
