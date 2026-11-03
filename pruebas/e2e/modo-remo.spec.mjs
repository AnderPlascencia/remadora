import { test, expect, abrirApp, completarBienvenida, remar, avanzar, listar } from './ayuda.mjs';

// Lo que no puede faltar ni salirse de la pantalla en el modo remo.
const IMPRESCINDIBLE = ['#mr-watts', '#mr-split', '#mr-resta', '#mr-terminar', '#mr-pausa', '#mr-vista', '#mr-salir'];

async function fueraDePantalla(page) {
  return page.evaluate((sel) => {
    const w = innerWidth;
    const h = innerHeight;
    return sel.filter((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return !r.width || !r.height || r.left < -1 || r.top < -1 || r.right > w + 1 || r.bottom > h + 1;
    });
  }, IMPRESCINDIBLE);
}

// Textos visibles que no caben en su caja (se cortan con «…» o se salen): botones, etiquetas y el indicador.
async function textosCortados(page) {
  return page.evaluate(() => [...document.querySelectorAll('#modo-remo .mr-botones .boton span, #modo-remo .mr-grid .mr-etq, #modo-remo .mr-indicador')]
    .filter((el) => el.offsetParent && el.getClientRects().length)
    .filter((el) => {
      const caja = el.closest('.boton, .mr-grid > div, .mr-principal').getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return el.scrollWidth > el.clientWidth + 1 || r.right > caja.right + 1 || r.left < caja.left - 1;
    })
    .map((el) => `${el.id || el.className}: ${el.textContent}`));
}

for (const [nombre, viewport] of [['vertical', { width: 412, height: 915 }], ['horizontal', { width: 915, height: 412 }], ['horizontal-bajo', { width: 780, height: 340 }]]) {
  test.describe(nombre, () => {
    test.use({ viewport });

    test(`modo remo en ${nombre}: datos en vivo, todo dentro de la pantalla y Terminar guarda`, async ({ page }) => {
      await abrirApp(page);
      await completarBienvenida(page);
      await remar(page, 20_000);
      await page.locator('#btn-modo-remo').click();
      const mr = page.locator('#modo-remo');
      await expect(mr).toBeVisible();
      await avanzar(page, 5_000);
      expect(Number(await page.locator('#mr-watts').textContent())).toBeGreaterThan(0);
      await expect(page.locator('#mr-split')).not.toHaveText('--:--');
      expect(await fueraDePantalla(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

      // Ningún texto se corta y Salir no está junto a Terminar.
      expect(await textosCortados(page)).toEqual([]);
      await expect(page.locator('.mr-botones #mr-salir')).toHaveCount(0);

      // Cambiar de vista no rompe nada (tampoco en la vista de carrera).
      for (let i = 0; i < 3; i++) {
        await page.locator('#mr-vista').click(); await avanzar(page, 1_000);
        expect(await fueraDePantalla(page)).toEqual([]);
        expect(await textosCortados(page)).toEqual([]);
      }

      const terminar = page.locator('#mr-terminar');
      await terminar.click();
      await expect(terminar).toContainText('¿Terminar?');
      expect(await textosCortados(page)).toEqual([]);
      await terminar.click();
      await expect(mr).toBeHidden();
      await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
      expect(await listar(page, 'sesiones')).toHaveLength(1);
    });
  });
}

test('salir del modo remo vuelve a Entrenar con la sesión en marcha', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await remar(page, 15_000);
  await page.locator('#btn-modo-remo').click();
  await page.locator('#mr-salir').click();
  await expect(page.locator('#modo-remo')).toBeHidden();
  await expect(page.locator('#btn-grabar')).toContainText('Terminar');
});
