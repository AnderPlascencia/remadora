// Ronda 2, etapa 5 (UX2-4, UX2-15, UX2-16, UX2-17, UX2-24): en el teléfono de Ander (360 × 792), «Hoy toca» y
// Empezar caben en una pantalla, y el resumen de la primera sesión deja elegir el héroe sin desplazarse.
import { test, expect, abrirApp, completarBienvenida, remar, terminar, avanzar } from './ayuda.mjs';

test('primer día a 360 px: Hoy toca cabe con Empezar, y el héroe se elige en la primera pantalla del resumen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 792 });
  await abrirApp(page);
  await completarBienvenida(page, { heroe: false });
  await avanzar(page, 3000);
  // Título, por qué y un solo «Más» (de 44 px), todo por encima de Empezar.
  const hoy = await page.locator('#hoy').boundingBox();
  const empezar = await page.locator('#btn-grabar').boundingBox();
  expect(hoy.y + hoy.height).toBeLessThanOrEqual(empezar.y);
  expect(empezar.y + empezar.height).toBeLessThanOrEqual(792);
  expect((await page.locator('#hoy-mas > summary').boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('#xp-estimada')).toBeHidden();
  await expect(page.locator('#hoy-mas-resumen')).toContainText('antes de remar');

  await remar(page, 60_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  // Cortada al minuto: no dice «Entrenaste Fondo», sino cuánto de la sesión hiciste.
  await expect(page.locator('#hoja-capacidad .hc-cabecera')).toContainText(/Empezaste.* · 1 de \d+ min/);
  // Esfuerzo en 3 + 2 con la misma altura y la palabra en una línea.
  const rpe = await Promise.all((await page.locator('#rpe button').all()).map((b) => b.boundingBox()));
  expect(new Set(rpe.map((b) => Math.round(b.y))).size).toBe(2);
  expect(new Set(rpe.map((b) => Math.round(b.height))).size).toBe(1);
  for (const b of rpe) expect(b.height).toBeGreaterThanOrEqual(44);
  // El héroe, en la primera pantalla y antes que lo próximo; edad y peso no se piden en el primer resumen.
  const heroes = page.locator('#hoja-xp .clases-mini button');
  await expect(heroes).toHaveCount(5);
  for (const b of await heroes.all()) expect((await b.boundingBox()).y + (await b.boundingBox()).height).toBeLessThanOrEqual(792);
  await expect(page.locator('#hoja-tu-perfil')).toBeHidden();
  expect(await page.evaluate(() => !!(document.querySelector('#hoja-xp').compareDocumentPosition(document.querySelector('#hoja-proxima')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await heroes.first().click();
  await page.locator('#hoja-cerrar').click();

  // Héroe › Camino: el hito destacado es el próximo que se alcanza (el primer punto de talento), no el nivel 10.
  await page.locator('#tab-heroe').click();
  await expect(page.locator('#camino-siguiente h3')).toHaveText('Tu primer punto de talento');
  await expect(page.locator('#camino-siguiente .eti')).toContainText('nivel 3');
  await expect(page.locator('#camino-siguiente p')).toContainText('Después: nivel 10');
});
