// Sendas del héroe (etapa 4): en Héroe › Talentos se ven las dos sendas de tu clase; antes del nivel 20 se ven
// pero no se eligen, y con la senda B guardada sus talentos ocupan las mejoras 3, 4 y la maestría.
import { test, expect, completarBienvenida } from './ayuda.mjs';

async function abrirTalentos(page, x) {
  await page.evaluate((extra) => {
    const per = JSON.parse(localStorage.getItem('personaje') || '{}');
    localStorage.setItem('personaje', JSON.stringify({ ...per, clase: 'vikingo', nombre: 'Prueba', ...extra }));
  }, x);
  await page.reload();
  await page.locator('#tab-heroe').click();
  await page.locator('[data-hp="talentos"]').click();
  await expect(page.locator('#arbol .sendas')).toBeVisible();
}

test('las dos sendas del vikingo: se ven antes del nivel 20 y la B cambia los talentos', async ({ page }) => {
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await abrirTalentos(page, {});
  const sendas = page.locator('#arbol .senda');
  await expect(sendas).toHaveCount(2);
  await expect(sendas.nth(0)).toContainText('Timonel del drakkar');
  await expect(sendas.nth(0)).toContainText('Tu senda');
  await expect(sendas.nth(1)).toContainText('Berserker');
  await expect(sendas.nth(1)).toContainText('Se elige en el nivel 20');
  await expect(page.locator('#arbol [data-senda]')).toHaveCount(0);
  await expect(page.locator('#arbol .talento').filter({ hasText: 'Salida del drakkar' })).toHaveCount(1);
  // Habilidad de clase (etapa 5): el Timonel en la senda A, la Furia del berserker en la B.
  await expect(page.locator('#arbol .habilidad-clase')).toContainText('Timonel');

  await abrirTalentos(page, { senda: { vikingo: [[Date.now() - 1000, 'b']] } });
  await expect(page.locator('#arbol .senda.activa')).toContainText('Berserker');
  await expect(page.locator('#arbol .habilidad-clase')).toContainText('Furia del berserker');
  await expect(page.locator('#arbol .habilidad-clase')).toContainText('«Timonel»');
  for (const n of ['Furia de salida', 'Grito de guerra', 'Hambre de batalla', 'Golpe de hacha', 'Brazos de hacha']) {
    await expect(page.locator('#arbol .talento').filter({ hasText: n })).toHaveCount(1);
  }
  await expect(page.locator('#arbol .talento').filter({ hasText: 'Salida del drakkar' })).toHaveCount(0);
  await expect(page.locator('#arbol .talento').filter({ hasText: 'Furia de salida' }).locator('.etq-tal.intensidad')).toHaveText('Intensidad');
  await page.locator('#arbol').screenshot({ path: test.info().outputPath('sendas.png') });
});

test('la saga del vikingo: el primer capítulo tiene su propio jefe', async ({ page }) => {
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await abrirTalentos(page, {});
  await page.locator('[data-hp="misiones"]').click();
  await expect(page.locator('#mis-capitulo')).toContainText('El despertar');
  await expect(page.locator('#mis-capitulo')).toContainText('draugr');
});

test('la maestría de tu clase se ve en la ficha y cada clase guarda la suya', async ({ page }) => {
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await abrirTalentos(page, {});
  await page.locator('[data-hp="ficha"]').click();
  await expect(page.locator('#heroe-maestria')).toContainText('Maestría de Vikingo');
  await expect(page.locator('#heroe-maestria [role="progressbar"]')).toBeVisible();
  // Cambiar de clase apunta la de antes en el historial.
  await page.locator('#btn-cambiar-clase').click();
  const per = await page.evaluate(() => JSON.parse(localStorage.getItem('personaje')));
  expect(per.claseHist).toEqual([[0, 'vikingo']]);
  await page.locator('#clases [data-clase="romano"]').click();
  await page.locator('#btn-crear-heroe').click();
  const despues = await page.evaluate(() => JSON.parse(localStorage.getItem('personaje')));
  expect(despues.claseHist.map(([, c]) => c)).toEqual(['vikingo', 'romano']);
});
