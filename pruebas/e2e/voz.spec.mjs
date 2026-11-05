import { test, expect, abrirApp, completarBienvenida, remar, esperarAviso, avanzar } from './ayuda.mjs';

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
