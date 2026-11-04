// Colección de bote por clase: en Héroe › Tienda se ve la colección de tu clase, lo bloqueado dice qué falta
// y lo comprado queda puesto en tu bote.
import { test, expect, completarBienvenida } from './ayuda.mjs';

async function conClase(page, clase, extra = {}) {
  await page.evaluate(([c, x]) => {
    const per = JSON.parse(localStorage.getItem('personaje') || '{}');
    localStorage.setItem('personaje', JSON.stringify({ ...per, clase: c, nombre: 'Prueba', tiendaVentajas: true, ...x }));
  }, [clase, extra]);
  await page.reload();
}

async function abrirTienda(page) {
  await page.locator('#tab-heroe').click();
  await page.locator('[data-hp="tienda"]').click();
  await expect(page.locator('#tienda-velas')).toBeVisible();
}

test('la colección del vikingo: lo bloqueado dice qué falta y lo comprado queda en uso', async ({ page }) => {
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await conClase(page, 'vikingo', { gastado: -5000 });
  await abrirTienda(page);
  await expect(page.locator('#coleccion-titulo')).toHaveText('Tu bote: colección vikingo');
  const fichas = page.locator('#tienda-velas .objeto');
  await expect(fichas).toHaveCount(13); // 8 de la clase y 5 de color
  await expect(fichas.filter({ hasText: 'Franjas del norte' }).locator('.paisaje-uso')).toHaveText('En uso');
  await expect(fichas.filter({ hasText: 'Cuervos de Odín' }).locator('.bloqueada')).toHaveText('Llega al nivel 20');
  await expect(fichas.filter({ hasText: 'Fuego del Valhalla' }).locator('.bloqueada')).toHaveText('Cumple «Saga de las cien mil»');
  const barra = page.locator('#coleccion-hazana [role="progressbar"]');
  await expect(barra).toHaveAttribute('aria-valuemax', '75000');
  await expect(barra).toHaveAttribute('aria-valuetext', /de 75.000 paladas/);

  await fichas.filter({ hasText: 'Círculo de runas' }).locator('button').click();
  await expect.poll(() => page.evaluate(() => window.__avisos.at(-1))).toContain('Círculo de runas');
  await expect(page.locator('#tienda-velas .objeto.activo').filter({ hasText: 'Círculo de runas' })).toHaveCount(1);
  await page.reload();
  await abrirTienda(page);
  await expect(page.locator('#tienda-velas .objeto.activo').filter({ hasText: 'Círculo de runas' })).toHaveCount(1);
  const per = await page.evaluate(() => JSON.parse(localStorage.getItem('personaje')));
  expect(per.piezas).toEqual(['vikingo-taller']);
  expect(per.equipoBote.vikingo.vela).toBe('vikingo-taller');
  await page.locator('#tienda-velas').screenshot({ path: test.info().outputPath('coleccion.png') });
});

test('una vela de color comprada antes de la colección sigue puesta', async ({ page }) => {
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await conClase(page, 'romano', { velas: ['oro'], vela: 'oro' });
  await abrirTienda(page);
  await expect(page.locator('#tienda-velas .objeto.activo')).toContainText('Velas de oro');
  await expect(page.locator('#tienda-velas .objeto').filter({ hasText: 'Púrpura imperial' }).locator('button')).toHaveText('Usar');
});
