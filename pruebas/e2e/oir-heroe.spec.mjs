// Tocar a tu héroe en Héroe reproduce una de sus frases con su voz grabada.
import { test, expect, completarBienvenida } from './ayuda.mjs';

test('tocar al héroe dice una frase de su clase con su voz grabada', async ({ page }) => {
  await page.addInitScript(() => {
    window.__audios = [];
    HTMLMediaElement.prototype.play = function () { window.__audios.push(this.src); return Promise.resolve(); };
  });
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await page.evaluate(() => {
    const per = JSON.parse(localStorage.getItem('personaje') || '{}');
    localStorage.setItem('personaje', JSON.stringify({ ...per, clase: 'samurai', nombre: 'Prueba' }));
  });
  await page.reload();
  await page.locator('#tab-heroe').click();
  await page.locator('#heroe-avatar').click();
  await page.locator('#heroe-avatar').press('Enter');
  const audios = await page.evaluate(() => window.__audios);
  expect(audios).toHaveLength(2);
  for (const a of audios) expect(a).toMatch(/assets\/voces\/samurai\/frase-\d\.mp3$/);
  expect(audios[0]).not.toBe(audios[1]);
  // El audio existe de verdad.
  const r = await page.request.get(audios[0]);
  expect(r.ok()).toBe(true);
});
