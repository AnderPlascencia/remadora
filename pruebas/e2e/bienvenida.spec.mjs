import { test, expect, abrirApp, completarBienvenida, esperarAviso } from './ayuda.mjs';

test('la bienvenida arma el plan, deja la app en modo demo y no vuelve a salir', async ({ page }) => {
  await abrirApp(page);
  await expect(page.locator('#inicio-titulo')).toHaveText('Hola, soy Rower');
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo: \d+ sesiones en 6 semanas$/);
  await expect(page.locator('#hoy-nombre')).not.toBeEmpty();
  await expect(page.locator('#btn-grabar')).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('inicioHecho'))).toBe('1');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('programa')))).toBeTruthy();

  await page.reload();
  await expect(page.locator('#tab-entrenar')).toBeVisible();
  await expect(page.locator('#inicio')).toBeHidden();
});

test('«Saltar» cierra la bienvenida sin plan', async ({ page }) => {
  await abrirApp(page);
  await page.locator('#inicio-saltar').click();
  await expect(page.locator('#inicio')).toBeHidden();
  await page.reload();
  await expect(page.locator('#inicio')).toBeHidden();
});
