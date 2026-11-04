// Presupuesto de rendimiento: lo que pesa la primera carga, cuántos cuadros por segundo da la carrera en cada vista
// con la CPU 4 veces más lenta (un teléfono de gama media) y que una sesión de 2 h no acumule memoria ni nodos.
// Los límites tienen margen sobre lo medido en local para que CI no falle por ruido; si uno se rompe, algo empeoró.
import { test, expect, completarBienvenida, avanzar, enCurso } from './ayuda.mjs';
import { FPS_MAX } from '../../src/carrera.js';

// Medido el 2026-11-04 (0.52.0): 1,10 MB en 56 archivos.
const BYTES_MAX = 1_250_000;
const ARCHIVOS_MAX = 70;
// Cuadros pintados por segundo, con CPU ×4. En local, solo: 2D 36, 3D 21, realista 13, modo remo 20; con otra prueba
// en paralelo (como en CI) cae a la mitad o menos y salta mucho. El mínimo atrapa lo que se vuelve varias veces más
// lento, no el ruido.
const FPS_MIN = { '2d': 6, '3d': 4, real: 3, remo: 5 };

// Cuenta los cuadros pintados de cada lienzo (cada cuadro de la carrera empieza con clearRect).
function contarPintadas(page) {
  return page.addInitScript(() => {
    window.__pintadas = {};
    const borrar = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      const id = this.canvas.id || '?';
      window.__pintadas[id] = (window.__pintadas[id] || 0) + 1;
      return borrar.apply(this, args);
    };
    // Líneas trazadas por lienzo: la gráfica en vivo no empieza con clearRect, pero cada vez traza sus series.
    window.__trazos = {};
    const trazar = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      const id = this.canvas.id || '?';
      window.__trazos[id] = (window.__trazos[id] || 0) + 1;
      return trazar.apply(this, args);
    };
  });
}

// Cuadros por segundo de un lienzo durante `ms` reales.
async function pintadasPorSegundo(page, id, ms = 4_000) {
  await page.evaluate(() => { window.__pintadas = {}; });
  await page.waitForTimeout(ms);
  return page.evaluate(([i, s]) => (window.__pintadas[i] || 0) / s, [id, ms / 1000]);
}

test('la primera carga pesa menos de 1,25 MB y no baja videos', async ({ page, context }) => {
  const archivos = [];
  context.on('requestfinished', async (r) => archivos.push({ url: r.url(), bytes: (await r.sizes()).responseBodySize }));
  await page.goto('./');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_000);
  const total = archivos.reduce((a, f) => a + f.bytes, 0);
  const grandes = [...archivos].sort((a, b) => b.bytes - a.bytes).slice(0, 5).map((f) => `${new URL(f.url).pathname} ${f.bytes}`);
  expect(total, `primera carga de ${total} bytes; los más grandes: ${grandes.join(', ')}`).toBeLessThanOrEqual(BYTES_MAX);
  expect(archivos.length).toBeLessThanOrEqual(ARCHIVOS_MAX);
  expect(archivos.filter((f) => /\.(mp4|webm)$/.test(f.url)).map((f) => f.url)).toEqual([]);
});

test('la carrera da sus cuadros por segundo en 2D, 3D, realista y modo remo con la CPU ×4, sin pasar su tope', async ({ page }) => {
  test.setTimeout(120_000);
  await contarPintadas(page);
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await page.locator('#btn-grabar').click();
  const carrera = page.locator('#carrera');
  await expect(carrera).toBeVisible();
  await carrera.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const medido = {};
  for (const vista of ['2d', '3d', 'real']) {
    expect(await page.evaluate(() => localStorage.getItem('vistaCarrera') || '2d')).toBe(vista);
    const fps = await pintadasPorSegundo(page, 'carrera');
    medido[vista] = fps;
    // El tope (60 en 2D, 30 en 3D y realista) se respeta aunque el teléfono pueda pintar más.
    expect(fps, `${vista}: ${fps} cuadros/s`).toBeLessThanOrEqual(FPS_MAX[vista] * 1.1 + 1);
    await carrera.click();
    await page.waitForTimeout(2_000);
  }

  // Modo remo en su vista de carrera: pinta la suya y la de Entrenar, que queda detrás, no gasta nada.
  await page.evaluate(() => localStorage.setItem('vistaRemo', 'carrera'));
  await page.locator('#btn-modo-remo').click();
  await expect(page.locator('#modo-remo')).toBeVisible();
  await page.waitForTimeout(2_000);
  await page.evaluate(() => { window.__pintadas = {}; });
  medido.remo = await pintadasPorSegundo(page, 'mr-grafica');
  expect(await page.evaluate(() => window.__pintadas.carrera || 0)).toBe(0);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  console.log('cuadros por segundo con CPU ×4:', JSON.stringify(medido));
  for (const [vista, min] of Object.entries(FPS_MIN)) expect(medido[vista], `${vista}: ${medido[vista]} cuadros/s`).toBeGreaterThanOrEqual(min);
});

test('la carrera no se pinta cuando queda fuera de la pantalla', async ({ page }) => {
  await contarPintadas(page);
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await page.locator('#btn-grabar').click();
  const carrera = page.locator('#carrera');
  await expect(carrera).toBeVisible();
  await carrera.scrollIntoViewIfNeeded();
  expect(await pintadasPorSegundo(page, 'carrera', 1_500)).toBeGreaterThan(10);
  // Se baja hasta que el lienzo sale por arriba.
  await page.evaluate(() => {
    const c = document.querySelector('#carrera');
    window.scrollBy(0, c.getBoundingClientRect().bottom + 10);
    document.body.style.paddingBottom = `${window.innerHeight * 2}px`;
    window.scrollBy(0, c.getBoundingClientRect().bottom + 10);
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => document.querySelector('#carrera').getBoundingClientRect().bottom)).toBeLessThan(0);
  expect(await pintadasPorSegundo(page, 'carrera', 1_500)).toBe(0);
  // Al volver a verse, sigue sola.
  await carrera.scrollIntoViewIfNeeded();
  await expect.poll(() => pintadasPorSegundo(page, 'carrera', 1_000)).toBeGreaterThan(10);
});

test('2 h simuladas remando: la gráfica en vivo sigue al día y no crecen la memoria, los nodos ni el costo por minuto', async ({ page }) => {
  test.setTimeout(900_000);
  await contarPintadas(page);
  await page.clock.install();
  await page.goto('./');
  await completarBienvenida(page);
  await page.evaluate(() => localStorage.setItem('modoEnt', 'libre'));
  await page.locator('#btn-grabar').click();
  await avanzar(page, 5_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const metricas = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
    return { heap: m.JSHeapUsedSize, nodos: m.Nodes, oyentes: m.JSEventListeners };
  };

  // Se mira la gráfica en vivo, al final de Entrenar: la carrera queda arriba, fuera de la pantalla, como al bajar en
  // el teléfono (si no, el reloj simulado pinta 432 000 cuadros de carrera y la prueba tarda demasiado).
  await page.locator('#grafica-vivo').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await avanzar(page, 1_000);
  await page.evaluate(() => { window.__pintadas = {}; });
  await avanzar(page, 1_000);
  expect(await page.evaluate(() => window.__pintadas.carrera || 0)).toBe(0);

  const marcas = [];
  for (let min = 0; min < 120; min += 10) {
    await page.evaluate(() => { window.__trazos = {}; });
    const t0 = Date.now();
    await avanzar(page, 60_000);
    const msPorMinuto = Date.now() - t0;
    const vivo = await page.evaluate(() => window.__trazos['grafica-vivo'] || 0);
    await avanzar(page, 540_000);
    marcas.push({ min: min + 10, ...(await metricas()), msPorMinuto, vivo, t: (await enCurso(page))?.t });
  }
  console.log(marcas.map((m) => `${m.min} min: ${(m.heap / 1e6).toFixed(1)} MB, ${m.nodos} nodos, ${m.oyentes} oyentes, ${m.msPorMinuto} ms/min`).join('\n'));

  const [primera] = marcas;
  const ultima = marcas.at(-1);
  // La sesión sigue contando y la gráfica en vivo se pintó en cada minuto medido.
  expect(ultima.t).toBeGreaterThanOrEqual(7_200);
  for (const m of marcas) expect(m.vivo, `gráfica en vivo en el minuto ${m.min}`).toBeGreaterThan(0);
  // En local: +0,3 MB y los mismos nodos y oyentes de los 10 a los 120 min.
  expect(ultima.heap - primera.heap).toBeLessThan(3e6);
  expect(Math.abs(ultima.nodos - primera.nodos)).toBeLessThan(200);
  expect(ultima.oyentes - primera.oyentes).toBeLessThanOrEqual(10);
  // Lo que cuesta simular un minuto no se dispara al final (en local, ×1,3).
  const mediana = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];
  const ritmo = mediana(marcas.slice(-3).map((m) => m.msPorMinuto)) / mediana(marcas.slice(0, 3).map((m) => m.msPorMinuto));
  expect(ritmo).toBeLessThan(2);
});
