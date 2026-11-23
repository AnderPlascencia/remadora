import { test, expect, completarBienvenida, avanzar, remar, terminar } from './ayuda.mjs';

// Etapa 3 del plan de usabilidad: Hoy propone una sola cosa.
test('un plan creado en domingo deja elegida su primera sesión, sin «Tu plan dice» debajo', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-08T12:00:00') });
  await page.goto('./');
  await completarBienvenida(page);
  await avanzar(page, 4000);
  await expect(page.locator('#hoy-etq')).toHaveText('Hoy toca');
  await expect(page.locator('#hoy-sugerencia')).toBeHidden();
  await page.locator('#tab-entrenamientos').click();
  await expect(page.locator('#semana-plan')).toHaveText(/^Tu semana 1 empieza el lun 9 nov\.$/);
});

test('con lo de hoy hecho, la tarjeta dice «Hecho ✓» y la próxima, sin promesa de XP', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-04T12:00:00') });
  await page.goto('./');
  await completarBienvenida(page);
  await avanzar(page, 4000);
  await remar(page, 60_000);
  await terminar(page);
  await page.locator('#hoja-cerrar').click();
  await avanzar(page, 2000);
  await expect(page.locator('#hoy-nombre')).toHaveText('Hecho ✓');
  await expect(page.locator('#hoy-resumen')).toContainText('Próxima: el sábado');
  await expect(page.locator('#xp-estimada')).toBeHidden();
  await expect(page.locator('#hoy-corta')).toBeHidden();
  await expect(page.locator('#sel-entrenamiento')).toHaveValue('');
});
