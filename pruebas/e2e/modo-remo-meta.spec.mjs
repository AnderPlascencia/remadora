// Una meta por bloque en el modo remo (etapa 3 de la ronda 2): el nombre del bloque se lee entero en las tres vistas,
// el reloj del bloque lleva su etiqueta y el reto de atributo solo va en verde cuando estás dentro de la zona que suma.
import { test, expect, abrirApp, completarBienvenida, avanzar } from './ayuda.mjs';

const cortado = (page, sel) => page.locator(sel).evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);

test('de pie a 360 px: nombre entero, «Bloque 1/3» con el reloj y el reto sin verde por encima de su zona', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 792 });
  await abrirApp(page);
  await completarBienvenida(page);
  await page.locator('#btn-grabar').click();
  await avanzar(page, 90_000);
  for (const vista of ['numeros', 'grafica', 'carrera']) {
    await page.evaluate((v) => localStorage.setItem('vistaRemo', v), vista);
    await page.locator('#btn-modo-remo').click();
    await expect(page.locator('#modo-remo')).toBeVisible();
    await avanzar(page, 2_000);
    await expect(page.locator('#mr-nombre')).toHaveText('Calentamiento');
    expect(await cortado(page, '#mr-nombre'), `nombre cortado en ${vista}`).toBe(false);
    await expect(page.locator('#mr-resta-etq')).toHaveText(/^Bloque 1\/3 · luego /);
    if (vista !== 'carrera') {
      // El calentamiento es libre y la demo rema por encima de 135 W: el reto dice hacia dónde ir, sin verde.
      const atr = page.locator('#mr-atr');
      await expect(atr).toHaveClass(/fuera/);
      await expect(atr).toContainText('↓');
      const [b, xp] = await atr.evaluate((el) => [getComputedStyle(el.querySelector('b')).color, getComputedStyle(el).getPropertyValue('--xp')]);
      expect(b).not.toBe(await page.evaluate((c) => { const d = document.createElement('span'); d.style.color = c; document.body.append(d); const r = getComputedStyle(d).color; d.remove(); return r; }, xp.trim()));
    }
    if (vista === 'grafica') {
      // Sin bloques de watts no hay «Rango objetivo» que cumplir.
      await expect(page.locator('#mr-leyenda')).not.toContainText('Rango objetivo');
    }
    await page.locator('#mr-salir').click();
    await expect(page.locator('#modo-remo')).toBeHidden();
  }
});
