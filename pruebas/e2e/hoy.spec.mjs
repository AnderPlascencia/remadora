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

// Etapa 30: si remabas 3 veces por semana y bajaste a 1, Hoy pregunta una sola vez si lo hacemos más fácil.
test('el aviso de riesgo de abandono sale una vez y «Ahora no» lo cierra', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-25T12:00:00') });
  await page.goto('./');
  await completarBienvenida(page);
  await avanzar(page, 4000);
  await page.evaluate(async () => {
    const db = await import('./src/db.js');
    const lunes = new Date('2026-11-23T10:00:00').getTime();
    const dias = [];
    for (let w = 6; w >= 3; w--) dias.push(-7 * w, -7 * w + 2, -7 * w + 4);
    dias.push(-11, -4);
    for (const d of dias) await db.guardar('sesiones', { fecha: lunes + d * 864e5, duracion: 1800, distancia: 6000, rpe: 4 });
  });
  await page.reload();
  await avanzar(page, 4000);
  const caja = page.locator('#hoy-sugerencia');
  await expect(caja).toContainText('Últimamente remas menos: 1 vez por semana, antes 3 veces por semana.');
  await expect(caja).toContainText('tu progreso te espera');
  // Con el plan de 3 días de la bienvenida se ofrece bajar a 2; la prueba sigue por «Ahora no».
  const porSemana = await page.evaluate(() => JSON.parse(localStorage.getItem('programa') || 'null')?.porSemana);
  if (porSemana >= 3) await expect(caja.locator('button').first()).toHaveText(`Bajar a ${porSemana - 1} días`);
  await caja.locator('.sug-no').click();
  await expect(caja).toBeHidden();
  await page.reload();
  await avanzar(page, 4000);
  await expect(page.locator('#hoy-etq')).toBeVisible();
  await expect(caja.filter({ hasText: 'remas menos' })).toBeHidden();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('riesgoAbandono')))).toEqual({ dia: '2026-11-25', respondido: true });
});

test('el aviso de riesgo de abandono baja el plan un día por semana', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-25T12:00:00') });
  await page.goto('./');
  await completarBienvenida(page);
  await avanzar(page, 4000);
  const antes = await page.evaluate(() => JSON.parse(localStorage.getItem('programa') || 'null'));
  test.skip(!antes?.objetivo || antes.porSemana < 3, 'la bienvenida no dejó un plan de 3 días o más');
  await page.evaluate(async () => {
    const db = await import('./src/db.js');
    const lunes = new Date('2026-11-23T10:00:00').getTime();
    for (let w = 6; w >= 3; w--) for (const d of [0, 2, 4]) await db.guardar('sesiones', { fecha: lunes + (d - 7 * w) * 864e5, duracion: 1800, distancia: 6000, rpe: 4 });
    for (const d of [-11, -4]) await db.guardar('sesiones', { fecha: lunes + d * 864e5, duracion: 1800, distancia: 6000, rpe: 4 });
  });
  await page.reload();
  await avanzar(page, 4000);
  await page.locator('#hoy-sugerencia button').first().click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('programa')).porSemana)).toBe(antes.porSemana - 1);
  await expect(page.locator('#hoy-sugerencia').filter({ hasText: 'remas menos' })).toBeHidden();
});
