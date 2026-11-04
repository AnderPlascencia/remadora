// QA de la colección de bote (etapa 15): un respaldo de antes de la colección (0.54) conserva velas, vela elegida y
// monedas al restaurarlo en otro teléfono, y el equipo completo no baja los cuadros por segundo de la carrera.
import { test, expect, completarBienvenida, abrirRespaldo, guardarRespaldo, restaurar, esperarAviso } from './ayuda.mjs';

const conPersonaje = (page, extra) => page.evaluate((x) => {
  const per = JSON.parse(localStorage.getItem('personaje') || '{}');
  localStorage.setItem('personaje', JSON.stringify({ ...per, ...x }));
}, extra);

async function abrirTienda(page) {
  await page.locator('#tab-heroe').click();
  await page.locator('[data-hp="tienda"]').click();
  await expect(page.locator('#tienda-velas')).toBeVisible();
}

test('un respaldo de 0.54 con velas de color pasa a otro teléfono con sus velas, la elegida y sus monedas', async ({ page, otroTelefono }, info) => {
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  // Como lo dejaba la 0.54: velas de color compradas y una elegida, sin piezas ni equipo por clase.
  await conPersonaje(page, { clase: 'romano', nombre: 'Prueba', tiendaVentajas: true, velas: ['oro', 'carmesi'], vela: 'oro', gastado: -3000 });
  const antes = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('personaje')); delete p.piezas; delete p.equipoBote; localStorage.setItem('personaje', JSON.stringify(p)); return p; });
  await page.reload();
  await abrirTienda(page);
  const monedasA = await page.locator('#heroe-monedas').textContent();
  await abrirRespaldo(page);
  const archivo = info.outputPath('respaldo-054.json');
  const datos = await guardarRespaldo(page, archivo);
  // El respaldo lleva el personaje tal cual (velas y vela), sea texto u objeto según el formato.
  const perRespaldo = typeof datos.ajustes.personaje === 'string' ? JSON.parse(datos.ajustes.personaje) : datos.ajustes.personaje;
  expect(perRespaldo).toMatchObject({ velas: antes.velas, vela: 'oro', clase: 'romano' });

  const b = await otroTelefono();
  await b.goto('./');
  await b.locator('#inicio-saltar').click();
  await abrirRespaldo(b);
  await restaurar(b, archivo);
  await esperarAviso(b, /^Restaurado/, { reloj: false });
  await b.waitForTimeout(2_000);
  await b.waitForLoadState();
  const perB = await b.evaluate(() => JSON.parse(localStorage.getItem('personaje')));
  expect(perB.velas).toEqual(['oro', 'carmesi']);
  expect(perB.gastado).toBe(-3000);
  await abrirTienda(b);
  await expect(b.locator('#tienda-velas .objeto.activo')).toContainText('Velas de oro');
  await expect(b.locator('#heroe-monedas')).toHaveText(monedasA);
  // Elegir la vela de la colección y volver a la de oro no pierde ninguna de las dos.
  await b.locator('#tienda-velas .objeto').filter({ hasText: 'Púrpura imperial' }).locator('button').click();
  await expect(b.locator('#tienda-velas .objeto.activo')).toContainText('Púrpura imperial');
  await b.locator('#tienda-velas .objeto').filter({ hasText: 'Velas de oro' }).locator('button').click();
  await expect(b.locator('#tienda-velas .objeto.activo')).toContainText('Velas de oro');
  expect((await b.evaluate(() => JSON.parse(localStorage.getItem('personaje')))).velas).toEqual(['oro', 'carmesi']);
});

test('con el equipo legendario completo la carrera da sus cuadros por segundo en 2D y 3D con la CPU ×4', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    window.__pintadas = 0;
    const borrar = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...a) { if (this.canvas.id === 'carrera') window.__pintadas++; return borrar.apply(this, a); };
  });
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await page.locator('#btn-grabar').click();
  const carrera = page.locator('#carrera');
  await expect(carrera).toBeVisible();
  await carrera.scrollIntoViewIfNeeded();
  // La pieza más cara de dibujar de cada tipo (la vela legendaria es animada) en el bote propio.
  const clase = await page.evaluate(async () => {
    const per = JSON.parse(localStorage.getItem('personaje') || '{}');
    const m = await import('./src/carrera.js');
    m.usarEquipo({ vela: `${per.clase}-legendaria`, proa: `${per.clase}-proa-oro`, palas: `${per.clase}-palas` });
    return per.clase;
  });
  expect(clase).toBeTruthy();
  await page.waitForTimeout(1_500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const medido = {};
  for (const vista of ['2d', '3d']) {
    expect(await page.evaluate(() => localStorage.getItem('vistaCarrera') || '2d')).toBe(vista);
    await page.evaluate(() => { window.__pintadas = 0; });
    await page.waitForTimeout(4_000);
    medido[vista] = (await page.evaluate(() => window.__pintadas)) / 4;
    await carrera.click();
    await page.waitForTimeout(2_000);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`equipo legendario ${clase}, cuadros por segundo con CPU ×4:`, JSON.stringify(medido));
  // Los mismos mínimos y topes que rendimiento.spec.mjs.
  expect(medido['2d']).toBeGreaterThanOrEqual(6);
  expect(medido['3d']).toBeGreaterThanOrEqual(4);
  expect(medido['2d']).toBeLessThanOrEqual(67);
  expect(medido['3d']).toBeLessThanOrEqual(34);
});
