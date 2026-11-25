// Ronda 2, etapa 8: Héroe más corto. Cabecera pegajosa al bajar, nombre por clase, consejo que se va solo,
// Misiones y Ficha en dos pantallas o menos del Pixel 7.
import { test, expect, abrirApp, completarBienvenida, avanzar } from './ayuda.mjs';

test('sin nombre, el título es la clase y abajo solo el rango; el ejemplo de nombre es de la clase', async ({ page }) => {
  await abrirApp(page);
  await page.locator('#inicio-saltar').click();
  await page.locator('#tab-heroe').click();
  await expect(page.locator('#heroe-nombre')).toHaveAttribute('placeholder', 'Ej.: un apodo que te guste');
  await page.locator('#clases [data-clase="pirata"]').click();
  await expect(page.locator('#heroe-nombre')).toHaveAttribute('placeholder', 'Ej.: Tess la Bucanera');
  await page.locator('#btn-crear-heroe').click();
  await expect(page.locator('#heroe-titulo')).toHaveText('Pirata');
  await expect(page.locator('#heroe-clase')).not.toContainText('Pirata');
  await expect(page.locator('#heroe-clase')).toContainText('Polizón');
});

test('Misiones y Ficha caben en dos pantallas; al bajar queda la línea del héroe sobre las pestañas', async ({ page }) => {
  // Con las reglas de ahora (el capítulo se abre solo por nivel, desde el 26 de noviembre).
  await page.clock.install({ time: new Date('2026-11-27T12:00:00') });
  await page.goto('./');
  await completarBienvenida(page);
  await page.locator('#tab-heroe').click();
  await avanzar(page, 800);
  const alto = page.viewportSize().height;
  for (const hp of ['misiones', 'ficha']) {
    await page.locator(`#tab-hp-${hp}`).click();
    await avanzar(page, 500);
    // El consejo de la pestaña sale las primeras veces: se quita para medir la pestaña de siempre.
    await page.evaluate(() => document.querySelectorAll('.consejo').forEach((x) => x.remove()));
    const h = await page.evaluate(() => document.scrollingElement.scrollHeight);
    expect(h, hp).toBeLessThanOrEqual(alto * 2);
  }
  await page.locator('#tab-hp-misiones').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('#heroe-mini')).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
  await expect(page.locator('.heroe-pegajosa')).toHaveClass(/compacta/);
  await expect(page.locator('#heroe-mini')).toBeVisible();
  await expect(page.locator('#heroe-mini')).toContainText('Nivel');
  await expect(page.locator('#mis-diarias .enlace-boton, #mis-semanales .enlace-boton')).toHaveCount(1);
});

test('el consejo de una pestaña sale dos veces y después se va solo', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  for (const veces of [1, 1, 0]) {
    await page.locator('#tab-historial').click();
    await expect(page.locator('#vista-historial .consejo')).toHaveCount(veces);
    await page.locator('#tab-heroe').click();
  }
});
