// Resumen de cobertura de las pruebas unitarias en Markdown, a partir de lcov.info (npm run test:cobertura).
// En el CI va al resumen del trabajo (GITHUB_STEP_SUMMARY); en local se imprime.
import { readFileSync, appendFileSync } from 'node:fs';

const lcov = readFileSync(process.argv[2] || 'lcov.info', 'utf8');
const archivos = [];
let a = null;
for (const linea of lcov.split('\n')) {
  const [k, v] = linea.split(':');
  if (k === 'SF') a = { nombre: v.replace(/^.*\/src\//, 'src/'), LF: 0, LH: 0, BRF: 0, BRH: 0, FNF: 0, FNH: 0 };
  else if (a && k in a) a[k] = Number(v);
  else if (linea === 'end_of_record' && a) { archivos.push(a); a = null; }
}
const pct = (h, f) => (f ? `${((100 * h) / f).toFixed(1)} %` : '—');
const suma = (k) => archivos.reduce((s, x) => s + x[k], 0);
const filas = archivos.sort((x, y) => x.LH / (x.LF || 1) - y.LH / (y.LF || 1))
  .map((x) => `| ${x.nombre} | ${pct(x.LH, x.LF)} | ${pct(x.BRH, x.BRF)} | ${pct(x.FNH, x.FNF)} |`);
const md = [
  '## Cobertura de las pruebas unitarias',
  '',
  `**Total: ${pct(suma('LH'), suma('LF'))} de las líneas, ${pct(suma('BRH'), suma('BRF'))} de las ramas y ${pct(suma('FNH'), suma('FNF'))} de las funciones** (solo \`src/\`; las pantallas se prueban en las e2e).`,
  '',
  '<details><summary>Por archivo, de menos a más cubierto</summary>',
  '',
  '| Archivo | Líneas | Ramas | Funciones |',
  '| --- | ---: | ---: | ---: |',
  ...filas,
  '',
  '</details>',
  '',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
else console.log(md);

// Pisos de cobertura de funciones (I-1, ronda 2): la capa de datos no puede volver a quedar sin pruebas.
const PISOS = { 'src/db.js': 80, 'src/historial.js': 80 };
const bajos = Object.entries(PISOS).filter(([n, min]) => {
  const x = archivos.find((f) => f.nombre === n);
  return !x || (100 * x.FNH) / (x.FNF || 1) < min;
});
if (bajos.length) {
  console.error(`Cobertura de funciones bajo el piso: ${bajos.map(([n, min]) => `${n} (< ${min} %)`).join(', ')}`);
  process.exitCode = 1;
}
