import { test, expect, abrirApp, completarBienvenida, remar, esperarAviso, avanzar, terminar } from './ayuda.mjs';

// La voz del navegador se cambia por una que anota lo que diría.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__voz = [];
    const synth = { speaking: false, cancel() {}, speak(u) { window.__voz.push(u.text); }, getVoices: () => [], addEventListener() {} };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  });
  await abrirApp(page);
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo/);
  await avanzar(page, 3_000);
});

test('al empezar la sesión del plan, la voz dice para qué es y cómo sentirla', async ({ page }) => {
  await remar(page, 20_000);
  const dichas = await page.evaluate(() => window.__voz);
  const inicio = dichas.find((t) => t.startsWith('Comienza'));
  expect(inicio).toBeTruthy();
  expect(inicio).toMatch(/^Comienza .+\. (Fondo|Recuperación|Umbral|VO2|Sprints|Técnica|Gasto calórico|Meta|Prueba)\b/);
});

test('la cantidad de voz se elige en Ajustes y se guarda', async ({ page }) => {
  await page.locator('#tab-ajustes').click();
  const seccion = page.locator('details[data-seccion="durante"]');
  if (!(await seccion.getAttribute('open'))) await seccion.locator('summary').click();
  await page.locator('#sel-cantidad-voz').selectOption('datos');
  expect(await page.evaluate(() => localStorage.getItem('cantidadVoz'))).toBe('datos');
  await page.reload();
  await expect(page.locator('#sel-cantidad-voz')).toHaveValue('datos');
});

test('con clase, los ánimos son de tu personaje y al terminar la voz resume el juego', async ({ page }) => {
  await page.evaluate(() => {
    const per = JSON.parse(localStorage.getItem('personaje') || '{}');
    localStorage.setItem('personaje', JSON.stringify({ ...per, clase: 'vikingo', nombre: 'Prueba' }));
  });
  test.setTimeout(150_000);
  await remar(page, 5 * 60_000);
  await terminar(page);
  await avanzar(page, 2_000);
  const dichas = await page.evaluate(() => window.__voz);
  const genericos = ['¡Buen ritmo, sigue así!', 'Vas muy bien, mantén la técnica', '¡Fuerte! Cada palada cuenta'];
  expect(dichas.filter((t) => genericos.includes(t))).toEqual([]);
  const fin = dichas.findIndex((t) => t.startsWith('Sesión terminada'));
  expect(fin).toBeGreaterThan(-1);
  expect(dichas.slice(fin + 1).join(' ')).toMatch(/Ganaste \d+ de experiencia/);
});
