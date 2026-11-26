// Ronda 2, etapa 12 (R2-18, UX2-30): una sola vitrina de insignias en Héroe › Ficha; Progreso solo enlaza.
import { test, expect, abrirApp, completarBienvenida, remar, terminar } from './ayuda.mjs';

test('Progreso enlaza a la vitrina de Héroe › Ficha, con las insignias de la historia y las de entrenamiento', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  // Con una sesión, Progreso enseña su contenido.
  await remar(page, 30_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await page.keyboard.press('Escape');
  await page.locator('#tab-historial').click();
  // En Progreso ya no hay una segunda colección: solo el enlace.
  await expect(page.locator('#vista-historial .insignias')).toHaveCount(0);
  await page.locator('#ir-insignias').click();
  await expect(page.locator('#vista-heroe')).toBeVisible();
  await expect(page.locator('#hp-ficha')).toBeVisible();
  await expect(page.locator('#vitrina-insignias')).toHaveJSProperty('open', true);
  await expect(page.locator('#ficha-insignias .insignia, #ficha-insignias > *').first()).toBeVisible();
  await expect(page.locator('#ficha-insignias-ent > *').first()).toBeVisible();
  await expect(page.locator('#ins-ent-n')).toHaveText(/^\d+ de \d+$/);
  await expect(page.locator('#insignias-historia-resumen')).toHaveText(/^\d+ de \d+$/);
});

test('la tienda tiene una sola sección de velas, y las de color dicen que son solo aspecto', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await page.locator('#tab-heroe').click();
  await page.locator('#tab-hp-tienda').click();
  await expect(page.locator('.tienda-sub', { hasText: /^Velas$/ })).toHaveCount(1);
  await expect(page.locator('.tienda-sub', { hasText: 'Velas de color' })).toHaveCount(0);
  await expect(page.locator('.ventaja-pieza', { hasText: 'Solo aspecto' })).toHaveCount(5);
});
