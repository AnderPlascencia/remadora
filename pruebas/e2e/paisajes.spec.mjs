// Paisajes de la colección: se compran en Héroe › Tienda, se ven en la carrera 2D y 3D, en vertical y en horizontal.
import { test, expect, completarBienvenida } from './ayuda.mjs';

const COLECCION = { canon: 'Cañón del desierto', otono: 'Lago de otoño', cerezos: 'Lago de los cerezos', glaciar: 'Bahía glaciar', mediterraneo: 'Costa mediterránea' };

// Monedas de sobra: el saldo es lo ganado menos lo gastado.
async function conMonedas(page) {
  await page.evaluate(() => {
    const per = JSON.parse(localStorage.getItem('personaje') || '{}');
    localStorage.setItem('personaje', JSON.stringify({ ...per, tiendaVentajas: true, gastado: -20000 }));
  });
  await page.reload();
}

async function abrirTienda(page) {
  await page.locator('#tab-heroe').click();
  await page.locator('[data-hp="tienda"]').click();
  await expect(page.locator('#tienda-paisajes')).toBeVisible();
}

test('la tienda ofrece los cinco paisajes nuevos, ordenados por precio y con su miniatura', async ({ page }) => {
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await abrirTienda(page);
  const tarjetas = page.locator('#tienda-paisajes .objeto');
  for (const nombre of Object.values(COLECCION)) await expect(tarjetas.filter({ hasText: nombre })).toHaveCount(1);
  // Del gratis al más caro
  const precios = await tarjetas.locator('.monedas').allInnerTexts();
  const numeros = precios.map((t) => (t === 'Gratis' ? 0 : Number(t.replace(/\D/g, ''))));
  expect(numeros).toEqual([...numeros].sort((a, b) => a - b));
  // Sin monedas no se puede comprar
  await expect(page.locator('#tienda-paisajes [data-paisaje="glaciar"]')).toBeDisabled();
  for (const id of Object.keys(COLECCION)) {
    const img = tarjetas.filter({ hasText: COLECCION[id] }).locator('img');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth), { message: `${id}: miniatura` }).toBe(320);
  }
});

test('comprar la bahía glaciar la deja puesta y la carrera la pinta en 2D y 3D, en vertical y en horizontal', async ({ page }) => {
  test.setTimeout(60_000);
  const pedidas = new Map();
  page.on('response', (r) => { const m = r.url().match(/assets\/carrera\/(glaciar\w*)\.webp/); if (m) pedidas.set(m[1], r.status()); });
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await conMonedas(page);
  await abrirTienda(page);
  const comprar = page.locator('#tienda-paisajes [data-paisaje="glaciar"]');
  await expect(comprar).toHaveText('Comprar');
  await comprar.click();
  await expect.poll(() => page.evaluate(() => window.__avisos.at(-1))).toBe('¡Bahía glaciar es tuyo! Ya lo verás en tu próxima carrera.');
  await expect(page.locator('#tienda-paisajes .objeto.activo')).toContainText('Bahía glaciar');
  await expect(page.locator('#tienda-paisajes .objeto.activo .paisaje-uso')).toHaveText('En uso');
  // Se guarda: al volver a abrir la app sigue puesto
  await page.reload();
  await abrirTienda(page);
  await expect(page.locator('#tienda-paisajes .objeto.activo')).toContainText('Bahía glaciar');

  await page.locator('#tab-entrenar').click();
  // Tras recargar, el modo demo se vuelve a encender (como en Ajustes › Modo demo)
  await page.evaluate(() => document.getElementById('btn-demo').click());
  await expect(page.locator('#estado')).toHaveText('Modo demo');
  await page.locator('#btn-grabar').click();
  const carrera = page.locator('#carrera');
  await expect(carrera).toBeVisible();
  await carrera.scrollIntoViewIfNeeded();
  // 2D: la costa vista desde arriba
  await expect.poll(() => pedidas.get('glaciar_costa')).toBe(200);
  await page.waitForTimeout(500);
  const pintada = () => carrera.evaluate((c) => {
    // Hay color (no es un lienzo vacío) en la franja de arriba, donde va la orilla o el cielo
    const d = c.getContext('2d').getImageData(0, 0, c.width, Math.max(1, c.height * 0.2)).data;
    let opacos = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) opacos++;
    return opacos / (d.length / 4);
  });
  expect(await pintada()).toBeGreaterThan(0.9);
  // 3D: el panorama y el atlas de la orilla
  await carrera.click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vistaCarrera'))).toBe('3d');
  await expect.poll(() => pedidas.get('glaciar')).toBe(200);
  await expect.poll(() => pedidas.get('glaciar_orilla')).toBe(200);
  await page.waitForTimeout(500);
  expect(await pintada()).toBeGreaterThan(0.9);
  // Horizontal (teléfono girado) y de vuelta a vertical: el lienzo sigue a la vista y pintado
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(600);
  await carrera.scrollIntoViewIfNeeded();
  expect((await carrera.boundingBox()).width).toBeGreaterThan(300);
  expect(await pintada()).toBeGreaterThan(0.9);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  expect(await pintada()).toBeGreaterThan(0.9);
});
