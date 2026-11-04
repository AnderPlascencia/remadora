import { test, expect, abrirApp, completarBienvenida, remar, terminar } from './ayuda.mjs';

test('crear el héroe usa la misma tarjeta de clase que la bienvenida', async ({ page }) => {
  await abrirApp(page);
  await page.locator('#inicio-saltar').click();
  await page.locator('#tab-heroe').click();
  const clases = page.locator('#clases .clase-mini');
  await expect(clases).toHaveCount(5);
  await expect(page.locator('#btn-crear-heroe')).toBeDisabled();
  await clases.nth(1).click();
  await expect(clases.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#btn-crear-heroe')).toBeEnabled();
});

test('desde Ajustes, el enlace a Planes › Programa abre esa subpestaña', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await page.locator('#tab-ajustes').click();
  const enlace = page.locator('#vista-ajustes .enlace-chevron[data-pt="programa"]');
  // Perfil abre desplegado; por si quedó cerrado de antes, se abre sin tocar el resumen.
  await page.evaluate(() => { document.querySelector('#vista-ajustes details:has(.enlace-chevron[data-pt="programa"])').open = true; });
  await enlace.click();
  await expect(page.locator('#vista-entrenamientos')).toHaveClass(/activa/);
  await expect(page.locator('#pt-programa')).toBeVisible();
  await expect(page.locator('.planes-pestanas [data-pt="programa"]')).toHaveAttribute('aria-pressed', 'true');
});

test('el historial de Progreso va plegado y dice cuántas sesiones hay', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await remar(page, 30_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await page.reload();
  await page.locator('#tab-historial').click();
  await expect(page.locator('#historial-resumen')).toHaveText('1 sesión');
  const historial = page.locator('details[data-seccion="historial"]');
  await expect(historial).not.toHaveAttribute('open', '');
  await expect(page.locator('#lista-sesiones')).toBeHidden();
  await historial.locator('summary').click();
  await expect(page.locator('#lista-sesiones')).toBeVisible();
});
