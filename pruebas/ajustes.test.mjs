import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { AJUSTES, PREFIJOS, registrada, aTexto, aTipo, defectoTexto } from '../src/ajustes-guardados.js';

// Todo el código de la app (src/ y src/pantallas/).
const raiz = new URL('../src/', import.meta.url);
const archivos = [
  ...readdirSync(raiz).filter((f) => f.endsWith('.js')).map((f) => new URL(f, raiz)),
  ...readdirSync(new URL('pantallas/', raiz)).filter((f) => f.endsWith('.js')).map((f) => new URL(`pantallas/${f}`, raiz)),
];
const codigo = archivos.map((u) => [u.pathname.split('/src/')[1], readFileSync(u, 'utf8')]);

// Claves que se leen o escriben: ajustes.leer('x'…), campoNumero('#…', 'x'…), localStorage.getItem('x'),
// constantes CLAVE_… = 'x' y plantillas como `consejo-${vista}` (se mira su prefijo).
function clavesUsadas() {
  const usadas = new Map();
  const anotar = (clave, donde) => usadas.set(clave, [...(usadas.get(clave) || []), donde]);
  for (const [f, t] of codigo) {
    if (f === 'ajustes-guardados.js') continue;
    for (const [, k] of t.matchAll(/ajustes\.(?:leer|escribir|si|num|borrar)\(\s*'([^']+)'/g)) anotar(k, f);
    for (const [, k] of t.matchAll(/ajustes\.(?:leer|escribir|si|num|borrar)\(\s*`([^`$]*)\$\{/g)) anotar(`${k}*`, f);
    for (const [, k] of t.matchAll(/(?:campoNumero|campoSelect|interruptor)\('[^']+',\s*'([^']+)'/g)) anotar(k, f);
    for (const [, k] of t.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*'([^']+)'/g)) anotar(k, f);
    for (const [, k] of t.matchAll(/const CLAVE_\w+ = '([^']+)'/g)) anotar(k, f);
  }
  return usadas;
}

test('toda clave guardada en localStorage está en el registro de ajustes', () => {
  const sin = [...clavesUsadas()].filter(([k]) => (k.endsWith('*') ? !Object.hasOwn(PREFIJOS, k.slice(0, -1)) : !registrada(k)));
  assert.deepEqual(sin.map(([k, f]) => `${k} (${f.join(', ')})`), [], 'claves sin registrar en src/ajustes-guardados.js');
});

test('el registro no guarda claves que ya nadie usa', () => {
  const usadas = clavesUsadas();
  const sobran = Object.keys(AJUSTES).filter((k) => !usadas.has(k));
  assert.deepEqual(sobran, []);
});

test('ninguna clave se lee directo de localStorage fuera de ui.js, salvo la copia de la sesión en curso', () => {
  const directas = codigo.filter(([f, t]) => f !== 'ui.js' && /localStorage\.getItem\((?!CLAVE_EN_CURSO)/.test(t)).map(([f]) => f);
  assert.deepEqual(directas, []);
});

test('cada tipo va y vuelve igual entre localStorage y el respaldo', () => {
  assert.equal(aTipo('peso', '75'), 75);
  assert.equal(aTexto('peso', 75), '75');
  assert.equal(aTipo('edad', ''), null);
  assert.equal(aTexto('edad', null), '');
  assert.equal(aTipo('voz', '1'), true);
  assert.equal(aTexto('voz', false), '0');
  assert.deepEqual(aTipo('personaje', '{"clase":"vikingo"}'), { clase: 'vikingo' });
  assert.equal(aTexto('personaje', { clase: 'vikingo' }), '{"clase":"vikingo"}');
  assert.equal(aTipo('peso', 'mucho'), undefined);
  assert.equal(aTexto('voz', 'sí'), undefined);
  assert.equal(aTipo('noExiste', 'x'), undefined);
  assert.equal(defectoTexto('vistaRemo'), 'numeros');
  assert.equal(defectoTexto('consejo-heroe'), '0');
});
