import { test, expect, abrirApp, completarBienvenida, esperarAviso, avanzar, terminar } from './ayuda.mjs';

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
  // Con la bienvenida hecha, su módulo ya no se baja al abrir (ronda 2, QA-F4), pero se puede repetir desde Ayuda.
  await page.locator('#tab-ajustes').click();
  await page.locator('[data-seccion="ayuda"] summary').click();
  await page.locator('#btn-repetir-inicio').click();
  await expect(page.locator('#inicio')).toBeVisible();
});

test('«Saltar» cierra la bienvenida sin plan', async ({ page }) => {
  await abrirApp(page);
  await page.locator('#inicio-saltar').click();
  await expect(page.locator('#inicio')).toBeHidden();
  await page.reload();
  await expect(page.locator('#inicio')).toBeHidden();
});

test('3 toques hasta la primera palada; el héroe se elige en el resumen y la primera semana se cuenta', async ({ page }) => {
  await abrirApp(page);
  // Toque 1: el objetivo. Los días y la hora ya vienen puestos y se dicen en el paso de conectar.
  await page.locator('#inicio-objetivos [data-obj]').first().click();
  await expect(page.locator('#inicio-plan-resumen')).toContainText('3 días por semana (lunes, miércoles y sábado), a las 19:00');
  await expect(page.locator('#inicio-dias-campo')).toBeHidden();
  // Toque 2: conectar (aquí, el modo demo). Toque 3: Empezar.
  await page.locator('#inicio-demo').click();
  await expect(page.locator('#inicio')).toBeHidden();
  await expect(page.locator('#hoy-semana1')).toHaveText(/Tu primera semana · 1 de \d/);
  await page.locator('#btn-grabar').click();
  await avanzar(page, 70_000);
  await terminar(page);
  // El resumen pide primero el héroe, que se queda con la XP de esta sesión, y luego edad y peso.
  const eleccion = page.locator('#hoja-xp .xp-heroe');
  await expect(eleccion).toBeVisible();
  await expect(page.locator('#hoja-tu-perfil')).toBeVisible();
  await eleccion.locator('[data-clase-rapida]').first().click();
  await expect(page.locator('#hoja-xp')).toContainText('ya tiene esta experiencia');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('personaje')).clase)).toBeTruthy();
  await page.locator('#hp-edad').fill('41');
  await page.locator('#hp-peso').fill('82');
  await page.locator('#hp-guardar').click();
  await expect(page.locator('#hoja-tu-perfil')).toBeHidden();
  expect(await page.evaluate(() => [localStorage.getItem('edad'), localStorage.getItem('peso')])).toEqual(['41', '82']);
});

test('«Cambiar» en conectar deja elegir los días antes de remar', async ({ page }) => {
  await abrirApp(page);
  await page.locator('#inicio-objetivos [data-obj]').first().click();
  await page.locator('#inicio-cambiar').click();
  await expect(page.locator('#inicio-dias-campo')).toBeVisible();
  await page.locator('#inicio-dias [data-dias="2"]').click();
  await page.locator('#inicio-siguiente').click();
  await expect(page.locator('#inicio-plan-resumen')).toContainText('2 días por semana (martes y viernes)');
  await page.locator('#inicio-demo').click();
  await esperarAviso(page, /^Tu plan está listo/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('programa')).porSemana)).toBe(2);
});
