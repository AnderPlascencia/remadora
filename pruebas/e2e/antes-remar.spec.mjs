import { test, expect, abrirApp, completarBienvenida, remar, terminar, esperarAviso, avanzar } from './ayuda.mjs';

test.beforeEach(async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo/);
  await avanzar(page, 3_000);
  await expect(page.locator('#hoy-etq')).toHaveText('Hoy toca');
});

test('antes de remar: responder cambia el estado de hoy, se pliega y desaparece tras la primera sesión', async ({ page }) => {
  const caja = page.locator('#antes-remar');
  await expect(caja).toBeVisible();
  await expect(caja.locator('[data-antes]')).toHaveCount(6);
  // Es opcional: Empezar sigue disponible sin responder.
  await expect(page.locator('#btn-grabar')).toBeVisible();

  await caja.locator('[data-antes="sueno"][data-valor="mal"]').click();
  await expect(caja.locator('[data-antes="sueno"][data-valor="mal"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#hoy-cuerpo')).toHaveAttribute('data-estado', 'cargado');
  await expect(page.locator('#hoy-cuerpo')).toContainText('Dormiste mal');

  await caja.locator('[data-antes="dolor"][data-valor="si"]').click();
  await expect(page.locator('#antes-plegado')).toBeVisible();
  await expect(page.locator('#antes-plegado')).toContainText('Dormiste mal · con dolor o malestar');
  await expect(page.locator('#hoy-cuerpo')).toHaveAttribute('data-estado', 'agotado');
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('antesDeRemar')));
  expect([guardado.sueno, guardado.dolor]).toEqual(['mal', 'si']);

  // «Cambiar ›» vuelve a abrir las preguntas con lo que respondiste marcado.
  await page.locator('#antes-cambiar').click();
  await expect(caja.locator('[data-antes="dolor"][data-valor="si"]')).toHaveAttribute('aria-pressed', 'true');
  await caja.locator('[data-antes="dolor"][data-valor="no"]').click();
  await expect(page.locator('#antes-plegado')).toContainText('sin dolor');
  await expect(page.locator('#hoy-cuerpo')).toHaveAttribute('data-estado', 'cargado');

  // Nunca durante la sesión, y no vuelve a salir después de la primera del día.
  await remar(page, 30_000);
  await expect(caja).toBeHidden();
  await terminar(page);
  await page.reload();
  await expect(page.locator('#hoy-etq')).toBeVisible();
  await expect(caja).toBeHidden();
});
