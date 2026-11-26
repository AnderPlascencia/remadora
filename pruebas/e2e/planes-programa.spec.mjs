// Ronda 2, etapa 10: Planes y Programa. Un solo filtro, Programa en dos pantallas con el calendario a 44 px, los días
// una sola vez en Ajustes, y Programa, el editor y compartir cargados al abrirlos.
import { test, expect, abrirApp, completarBienvenida, avanzar } from './ayuda.mjs';

test('Planes: un solo filtro, por tipo o por atributo; el editor se carga al abrirlo', async ({ page }) => {
  const pedidos = [];
  page.on('request', (r) => pedidos.push(new URL(r.url()).pathname));
  await abrirApp(page);
  await completarBienvenida(page);
  for (const m of ['programa-vista.js', 'planes-editor.js', 'compartir.js']) expect(pedidos.some((p) => p.endsWith(m)), m).toBe(false);
  await page.locator('#tab-entrenamientos').click();
  await page.locator('.planes-pestanas [data-pt="entrenamientos"]').click();
  await expect(page.locator('#filtro-modo [data-modo="tipo"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#secciones-ent [data-sec="potencia"]')).toHaveText('Fuerza y potencia');
  await expect(page.locator('#subir-atr')).toBeHidden();
  await page.locator('#filtro-modo [data-modo="atributo"]').click();
  await expect(page.locator('#subir-atr')).toBeVisible();
  await expect(page.locator('#secciones-ent')).toBeHidden();
  await expect(page.locator('#subir-atr [aria-pressed="true"]')).toHaveCount(1);
  await page.locator('#filtro-modo [data-modo="tipo"]').click();
  await expect(page.locator('#secciones-ent')).toBeVisible();
  await page.locator('#btn-nuevo-ent').click();
  await expect(page.locator('#editor-ent')).toBeVisible();
  expect(pedidos.some((p) => p.endsWith('planes-editor.js'))).toBe(true);
});

test('Programa: hoy y esta semana arriba, lo demás plegado, en dos pantallas; el calendario a 44 px', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await page.locator('#tab-entrenamientos').click();
  await page.locator('.planes-pestanas [data-pt="programa"]').click();
  await expect(page.locator('#plan-hoy')).toBeVisible();
  await expect(page.locator('#prog-curva')).not.toHaveAttribute('open', '');
  await page.evaluate(() => document.querySelectorAll('.consejo').forEach((x) => x.remove()));
  const alto = await page.evaluate(() => document.scrollingElement.scrollHeight);
  expect(alto).toBeLessThanOrEqual(page.viewportSize().height * 2);
  await page.locator('#prog-calendario > summary').click();
  const dias = await Promise.all((await page.locator('#calendario button:not(.vacio)').all()).slice(0, 7).map((b) => b.boundingBox()));
  for (const b of dias) expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
});

test('Ajustes: los días se eligen una vez y el número sale de ellos', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await page.locator('#tab-ajustes').click();
  await expect(page.locator('#sel-dias-perfil')).toBeHidden();
  const n = await page.locator('#cita-dias [aria-pressed="true"]').count();
  await expect(page.locator('#cita-n')).toHaveText(String(n));
  const libre = page.locator('#cita-dias [aria-pressed="false"]').first();
  await libre.click();
  await avanzar(page, 300);
  await expect(page.locator('#cita-n')).toHaveText(String(n + 1));
});
