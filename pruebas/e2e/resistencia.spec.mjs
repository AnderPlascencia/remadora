// Probar resistencia (Ajustes > Diagnóstico) en modo demo: el nivel enviado llega a los paquetes de la consola
// y la app avisa cuando la consola lo confirma.
import { test, expect, abrirApp, completarBienvenida, esperarAviso, avanzar } from './ayuda.mjs';

test('Enviar resistencia la aplica y la consola la confirma', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await page.locator('#tab-ajustes').click();
  await page.evaluate(() => { document.querySelector('#vista-ajustes details[data-seccion="conexion"]').open = true; });
  const selector = page.locator('#sel-nivel-prueba');
  await expect(selector.locator('option')).toHaveCount(24);
  await selector.selectOption('17');
  await page.locator('#btn-nivel-prueba').click();
  await esperarAviso(page, /^La consola está en resistencia 17$/);
  await selector.selectOption('3');
  await page.locator('#btn-nivel-prueba').click();
  await esperarAviso(page, /^La consola está en resistencia 3$/);
  await avanzar(page, 1000);
  expect(await page.evaluate(() => window.__avisos.some((a) => /no confirmó/.test(a)))).toBe(false);
});
