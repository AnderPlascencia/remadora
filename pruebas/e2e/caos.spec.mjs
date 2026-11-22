import { test, expect, abrirApp, completarBienvenida, remar, terminar, listar, enCurso, avanzar } from './ayuda.mjs';

// Etapa 22 (QA-5): pruebas de caos para la promesa central de la app: ninguna sesión se pierde ni se duplica.
// (Disco lleno, transacción abortada y temporizador frenado ya están en no-perder.spec.mjs.)
test.beforeEach(async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await remar(page, 30_000);
  await expect.poll(async () => (await enCurso(page))?.t).toBeGreaterThanOrEqual(30);
});

const ahora = (page) => page.evaluate(() => Date.now());

test('el reloj salta 10 min hacia adelante (teléfono suspendido): no se inventan tiempo ni metros', async ({ page }) => {
  const antes = await enCurso(page);
  await page.clock.setSystemTime((await ahora(page)) + 10 * 60_000);
  // Al despertar, el primer dato de la remadora llega antes del tic que pone al día los 10 minutos.
  await page.evaluate(async () => {
    const { remadora } = await import('./src/pantallas/sesion.js');
    remadora.dispatchEvent(new CustomEvent('datos', { detail: { tipo: 'metricas', watts: 150, distancia: null, resistencia: 8 } }));
  });
  await avanzar(page, 20_000);
  await expect.poll(async () => (await enCurso(page))?.t).toBeGreaterThan(antes.t);
  const despues = await enCurso(page);
  // Los 10 minutos sin datos cuentan como pausa: la sesión solo suma lo remado después.
  expect(despues.t - antes.t).toBeLessThanOrEqual(25);
  expect(despues.dist - antes.dist).toBeLessThan(150);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  const sesiones = await listar(page, 'sesiones');
  expect(sesiones).toHaveLength(1);
  expect(sesiones[0].duracion).toBeLessThan(120);
});

test('el reloj salta 1 h hacia atrás (cambio de horario): la sesión sigue contando y se guarda', async ({ page }) => {
  const antes = await enCurso(page);
  await page.clock.setSystemTime((await ahora(page)) - 3600_000);
  await avanzar(page, 30_000);
  const despues = await enCurso(page);
  expect(despues.t).toBeGreaterThanOrEqual(antes.t + 15);
  expect(despues.muestras.map((m) => m.t)).toEqual(despues.muestras.map((_, i) => i + 1));
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  const sesiones = await listar(page, 'sesiones');
  expect(sesiones).toHaveLength(1);
  expect(sesiones[0].duracion).toBeGreaterThanOrEqual(45);
});

test('dos pestañas: la otra no ofrece guardar la sesión que se rema aquí, y sí cuando esta se cierra', async ({ page }) => {
  const otra = await page.context().newPage();
  await otra.clock.install({ time: await ahora(page) });
  await otra.goto('./');
  await otra.clock.runFor(2_000);
  await expect(otra.locator('#tab-entrenar')).toBeVisible();
  await expect(otra.locator('#recuperar-dialogo')).toBeHidden();
  // Android cierra la pestaña donde se remaba: la otra ya puede ofrecer guardar lo remado, una sola vez.
  await page.close();
  await otra.reload();
  await otra.clock.runFor(2_000);
  await expect(otra.locator('#recuperar-dialogo')).toBeVisible();
  await otra.locator('#recuperar-guardar').click();
  await expect(otra.locator('#hoja-titulo')).toBeVisible();
  expect(await listar(otra, 'sesiones')).toHaveLength(1);
});

test('pestaña congelada por Chrome: al volver, la sesión sigue y se guarda entera', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
  await page.clock.fastForward(60_000);
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await avanzar(page, 10_000);
  const copia = await enCurso(page);
  expect(copia.t).toBeGreaterThanOrEqual(38);
  expect(copia.muestras.map((m) => m.t)).toEqual(copia.muestras.map((_, i) => i + 1));
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  expect(await listar(page, 'sesiones')).toHaveLength(1);
});
