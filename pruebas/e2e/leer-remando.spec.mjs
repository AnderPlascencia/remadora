// Leer los números remando (0.79): watts de 64 px o más en todas sus vistas y avisos en cola.
import { test, expect, abrirApp, completarBienvenida, avanzar, avisos } from './ayuda.mjs';

const tamWatts = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#mr-watts')).fontSize));

for (const [nombre, vp] of [['vertical', { width: 412, height: 839 }], ['horizontal', { width: 839, height: 412 }]]) {
  test(`${nombre}: el modo remo empieza apagado y sus watts nunca bajan de 64 px`, async ({ page }) => {
    await page.setViewportSize(vp);
    await abrirApp(page);
    await completarBienvenida(page);
    await page.locator('#btn-grabar').click();
    // Decisión de Ander: el modo remo no se abre solo; se abre con su botón.
    await expect(page.locator('#modo-remo')).toBeHidden();
    await page.locator('#btn-modo-remo').click();
    await expect(page.locator('#modo-remo')).toBeVisible();
    await avanzar(page, 3_000);
    for (const vista of ['numeros', 'uno', 'grafica', 'carrera']) {
      await page.evaluate((v) => localStorage.setItem('vistaRemo', v), vista);
      await page.locator('#mr-salir').click();
      await page.locator('#btn-modo-remo').click();
      await expect(page.locator('#modo-remo')).toBeVisible();
      await avanzar(page, 1_000);
      expect(await tamWatts(page), `watts en la vista ${vista}`).toBeGreaterThanOrEqual(64);
    }
    // En el modo remo el aviso sale arriba: no tapa los watts.
    await page.evaluate(() => import('./src/ui.js').then((m) => m.toast('Aviso de prueba', 5000)));
    const aviso = await page.locator('#toast').boundingBox();
    const watts = await page.locator('#mr-watts').boundingBox();
    expect(aviso.y + aviso.height <= watts.y || aviso.y >= watts.y + watts.height, 'el aviso no se monta sobre los watts').toBe(true);
  });
}

test('los avisos van en cola: el segundo espera al primero y no se repiten', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await avanzar(page, 6_000);
  await page.evaluate(() => { window.__avisos = []; });
  await page.evaluate(() => import('./src/ui.js').then((m) => { m.toast('Uno'); m.toast('Dos'); m.toast('Dos'); m.toast('Juego', 3000, 'juego'); m.toast('Tres'); }));
  await expect(page.locator('#toast')).toHaveText('Uno');
  await avanzar(page, 1_600);
  await expect(page.locator('#toast')).toHaveText('Dos');
  await avanzar(page, 1_600);
  await expect(page.locator('#toast')).toHaveText('Tres');
  await avanzar(page, 1_600);
  await expect(page.locator('#toast')).toHaveText('Juego');
  // Uno de seguridad no espera.
  await page.evaluate(() => import('./src/ui.js').then((m) => m.toast('Sin conexión', 3000, 'seguridad')));
  await expect(page.locator('#toast')).toHaveText('Sin conexión');
  expect((await avisos(page)).filter((a) => a === 'Dos')).toHaveLength(1);
});
