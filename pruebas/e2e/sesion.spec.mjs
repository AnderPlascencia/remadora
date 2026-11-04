import { test, expect, abrirApp, completarBienvenida, remar, terminar, listar, enCurso, esperarAviso, avanzar } from './ayuda.mjs';

test.beforeEach(async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo/);
  await avanzar(page, 3_000); // la tarjeta Hoy pasa a la sesión del plan
  await expect(page.locator('#hoy-etq')).toHaveText('Hoy toca');
});

test('una sesión terminada se guarda con sus muestras y abre el resumen', async ({ page }) => {
  const plan = (await page.locator('#hoy-nombre').textContent()).trim();
  await remar(page, 60_000);
  await expect(page.locator('#btn-grabar')).toContainText('Terminar');
  await terminar(page);

  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  const [s, ...otras] = await listar(page, 'sesiones');
  expect(otras).toHaveLength(0);
  expect(s.entrenamiento).toBe(plan);
  expect(s.duracion).toBeGreaterThanOrEqual(55);
  expect(s.duracion).toBeLessThanOrEqual(61);
  expect(s.muestras).toHaveLength(s.duracion);
  expect(s.distancia).toBeGreaterThan(100);
  expect(s.wattsProm).toBeGreaterThan(0);
  // Reglas de XP por carga (v0.46.0): la sesión sabe que era la del plan y el calendario del plan está guardado.
  expect(s.reglasXp).toBe(3);
  expect(s.delDia).toBe('plan');
  const cal = await page.evaluate(() => JSON.parse(localStorage.getItem('calendarioPlan') || 'null'));
  expect(Object.values(cal || {})).toContain(plan);
  await expect(page.locator('#hoja-xp')).toContainText('Carga del entrenamiento');
  // La copia de seguridad de la sesión en curso ya no hace falta.
  expect(await enCurso(page)).toBeNull();

  await page.reload();
  await expect(page.locator('#recuperar-dialogo')).toBeHidden();
  expect(await listar(page, 'sesiones')).toHaveLength(1);
});

test('una sesión de menos de 10 s no se guarda', async ({ page }) => {
  await remar(page, 5_000);
  await terminar(page);
  await esperarAviso(page, /^Sesión muy corta: no se guardó$/);
  expect(await listar(page, 'sesiones')).toHaveLength(0);
});

test('el primer toque de Terminar se cancela solo a los 3 s', async ({ page }) => {
  await remar(page, 20_000);
  const boton = page.locator('#btn-grabar');
  await boton.click();
  await expect(boton).toContainText('¿Terminar?');
  await avanzar(page, 3_500);
  await expect(boton).not.toContainText('¿Terminar?');
  await boton.click();
  await expect(boton).toContainText('¿Terminar?');
  expect(await listar(page, 'sesiones')).toHaveLength(0);
});

test('pausar detiene el reloj de la sesión y seguir lo reanuda', async ({ page }) => {
  await remar(page, 20_000);
  await page.locator('#btn-pausa').click();
  const t = (await enCurso(page))?.t;
  await avanzar(page, 20_000);
  expect((await enCurso(page)).t).toBe(t);
  await page.locator('#btn-pausa').click();
  await avanzar(page, 20_000);
  expect((await enCurso(page)).t).toBeGreaterThan(t + 15);
});
