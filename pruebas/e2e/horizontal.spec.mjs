// Ronda 2, etapa 11: el teléfono en el soporte (792 × 360, el horizontal de Ander).
// Mientras remas, la cabecera se quita y la barra de acción pasa a una columna a la derecha: el área útil pasa
// del 58 % al 75 %, Entrenar mide 2,1 pantallas (antes 4) y la página de debajo del modo remo no se desplaza.
import { test, expect, abrirApp, completarBienvenida, avanzar } from './ayuda.mjs';

test.use({ viewport: { width: 792, height: 360 }, screen: { width: 792, height: 360 } });

const medir = (page) => page.evaluate(() => {
  const caja = (s) => { const e = document.querySelector(s); if (!e || getComputedStyle(e).display === 'none') return null; return e.getBoundingClientRect(); };
  const nav = caja('nav.nav-inferior');
  const barra = caja('#vista-entrenar .barra-accion');
  const cab = caja('header.barra');
  // Área útil: lo que queda de la pantalla sin la navegación, la barra de acción y la cabecera (si se ve).
  const ancho = innerWidth - nav.width - barra.width;
  const alto = innerHeight - (cab && cab.bottom > 0 ? cab.bottom : 0);
  return { util: (ancho * alto) / (innerWidth * innerHeight), pantallas: document.scrollingElement.scrollHeight / innerHeight, barra, cab: !!cab };
});

test('remando en horizontal: área útil > 60 %, Entrenar ≤ 2,5 pantallas y la barra a un lado', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await page.locator('#btn-grabar').click();
  await avanzar(page, 5_000);
  const m = await medir(page);
  expect(m.cab, 'sin cabecera mientras remas').toBe(false);
  expect(m.util).toBeGreaterThan(0.6);
  expect(m.pantallas).toBeLessThanOrEqual(2.5);
  // La barra va de arriba abajo a la derecha: no tapa nada del contenido.
  expect(m.barra.right).toBeCloseTo(792, 0);
  expect(m.barra.height).toBeCloseTo(360, 0);
  const contenido = await page.locator('#en-vivo .metricas').boundingBox();
  expect(contenido.x + contenido.width).toBeLessThanOrEqual(m.barra.left);
  for (const id of ['#btn-grabar', '#btn-pausa', '#btn-modo-remo']) {
    const b = await page.locator(id).boundingBox();
    expect(b.height, `${id} de 44 px o más`).toBeGreaterThanOrEqual(44);
    expect(b.x).toBeGreaterThanOrEqual(m.barra.left);
  }
  // Watts y la carrera a la vista sin desplazar.
  const watts = await page.locator('#m-watts').boundingBox();
  expect(watts.y + watts.height).toBeLessThanOrEqual(360);
});

test('modo remo: la página de debajo no se desplaza y «Vista» abre las vistas al mantenerlo pulsado', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await page.locator('#btn-grabar').click();
  await page.locator('#btn-modo-remo').click();
  await avanzar(page, 2_000);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
  const antes = await page.evaluate(() => document.scrollingElement.scrollTop);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.scrollingElement.scrollTop)).toBe(antes);
  // El botón dice la vista que ves.
  await expect(page.locator('#mr-vista .num')).toHaveText('Números');
  await page.locator('#mr-vista').click();
  await expect(page.locator('#mr-vista .num')).toHaveText('Uno');
  // Mantener pulsado: las vistas, y un toque lleva directo a la gráfica.
  const b = await page.locator('#mr-vista').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.clock.runFor(700);
  await page.mouse.up();
  await expect(page.locator('#mr-vistas')).toBeVisible();
  await expect(page.locator('#mr-vista .num'), 'soltar no pasa a la siguiente').toHaveText('Uno');
  await page.locator('#mr-vistas [data-vista="grafica"]').click();
  await expect(page.locator('#mr-vistas')).toBeHidden();
  await expect(page.locator('#mr-vista .num')).toHaveText('Gráfica');
  await expect(page.locator('#modo-remo')).toHaveClass(/vista-grafica/);
  // Al salir del modo remo, la página vuelve a desplazarse.
  await page.locator('#mr-salir').click();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');
});

test('Héroe en horizontal: la tarjeta a la izquierda y las pestañas a la derecha', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await page.locator('#tab-heroe').click();
  await expect(page.locator('.heroe-tarjeta')).toBeVisible();
  const tarjeta = await page.locator('.heroe-tarjeta').boundingBox();
  const tabs = await page.locator('.heroe-tabs').boundingBox();
  expect(tarjeta.x + tarjeta.width).toBeLessThanOrEqual(tabs.x);
  // La vista de Entrenar no se cuela en otras pestañas.
  await expect(page.locator('#vista-entrenar')).toBeHidden();
});
