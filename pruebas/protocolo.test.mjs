import { parsePaquete, paqueteRemada, paqueteMetricas, nivelDesdeByte, hexABytes, formatoSplit } from '../protocolo.js';
import assert from 'node:assert/strict';
// Tabla de niveles conocida (byte 11 -> nivel)
const tabla = {1:1,3:2,4:3,6:4,7:5,8:5,9:6,0x0b:7,0x0c:8,0x0d:8,0x0e:9,0x10:10,0x11:11,0x13:12,0x14:13,0x15:13,0x16:14,0x18:15,0x19:16,0x1a:16,0x1b:17,0x1d:18,0x1e:19,0x20:20,0x22:21,0x23:22,0x25:23,0x26:24,0x27:24};
for (const [r, n] of Object.entries(tabla)) assert.equal(nivelDesdeByte(+r), n, `byte ${r}`);
for (let n = 1; n <= 24; n++) assert.equal(parsePaquete(paqueteMetricas(150, 1234, n)).resistencia, n);
assert.deepEqual(parsePaquete(paqueteMetricas(213, 4567, 10)), { tipo: 'metricas', watts: 213, distancia: 4567, resistencia: 10 });
assert.deepEqual(parsePaquete(paqueteRemada(26, 125)), { tipo: 'remada', spm: 26, split: 125 });
assert.equal(parsePaquete(paqueteRemada(0, 125)), null);
assert.equal(parsePaquete(hexABytes('fe 02 19 03')), null);
const todoFF = paqueteMetricas(0,0,1); todoFF.fill(0xff, 12); assert.equal(parsePaquete(todoFF), null);
assert.equal(formatoSplit(125), '2:05');
console.log('protocolo OK');
