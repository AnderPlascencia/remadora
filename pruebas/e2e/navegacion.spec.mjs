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

test('el asistente de metas parte de tu predicción y la mejora cambia con las semanas', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await remar(page, 150_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await page.reload();
  await page.locator('#tab-entrenamientos').click();
  await page.locator('.planes-pestanas [data-pt="programa"]').click();
  // La bienvenida ya creó un plan: se quita para volver al asistente (el diálogo se acepta solo).
  await page.locator('#btn-quitar-programa').click();
  await page.locator('#as-objetivo [data-v="meta"]').click();
  const info = page.locator('#pm-info');
  await expect(info).toContainText(/Tu predicción \(desde tus [\d,]+ m\) para 2,000 m: \d+:\d\d\. Una meta realista en 8 semanas: \d+:\d\d \(un 6 % mejor, al empezar se mejora rápido\)/);
  await expect(page.locator('#pm-tiempo')).toHaveAttribute('placeholder', /^\d+:\d\d$/);
  await page.locator('#pm-semanas').fill('4');
  await page.locator('#pm-semanas').dispatchEvent('change');
  await expect(info).toContainText('en 4 semanas');
  await expect(info).toContainText('un 4,2 % mejor');
});

test('una sola racha y un solo «qué toca»: el resumen dice la próxima del plan y Progreso, la racha del plan', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await remar(page, 60_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await expect(page.locator('#hoja-proxima .proxima')).toContainText(/Próxima de tu plan: .+, (mañana|el \w+)/);
  await page.reload();
  await page.locator('#tab-historial').click();
  await expect(page.locator('#racha-etq')).toHaveText(/cumpliendo tu plan/);
  await expect(page.locator('#vista-historial')).not.toContainText('días seguidos remando');
});
