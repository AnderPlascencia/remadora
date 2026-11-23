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
  // Talentos y Rangos viven ahora en Camino: el árbol está en «Talentos y senda», que se despliega.
  await page.locator('[data-hp="camino"]').click();
  // Se espera a que el Camino esté pintado: la tarjeta del siguiente hito mueve «Talentos y senda» hacia abajo.
  await expect(page.locator('#camino-siguiente h3')).toBeVisible();
  // Al recargar, Chromium puede devolver la sección abierta como estaba: solo se toca si está cerrada.
  if (!(await page.locator('#camino-talentos').evaluate((d) => d.open))) await page.locator('#camino-talentos > summary').click();
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

// Camino de la clase (rediseño de la UI): la línea del 1 al 90 con los títulos de la clase, las mejoras que se abren,
// las piezas del bote por nivel y los jefes; arriba, el siguiente hito. Desde el nivel 20, si no has elegido senda,
// la tarjeta te pide elegirla y la elección queda guardada.
test('el camino del vikingo: siguiente hito, rangos, piezas y jefes, y la senda en el nivel 20', async ({ page }) => {
  await page.goto('./');
  await completarBienvenida(page, { reloj: false });
  await page.evaluate(() => {
    const per = JSON.parse(localStorage.getItem('personaje') || '{}');
    localStorage.setItem('personaje', JSON.stringify({ ...per, clase: 'vikingo', nombre: 'Prueba' }));
  });
  await page.reload();
  await page.locator('#tab-heroe').click();
  // Camino es la primera subpestaña y se abre por defecto.
  await expect(page.locator('#hp-camino')).toBeVisible();
  await expect(page.locator('#camino-siguiente')).toContainText('Siguiente hito · nivel 10');
  await expect(page.locator('#camino-siguiente h3')).toHaveText('Remero de banco');
  const linea = page.locator('#camino-linea');
  await expect(linea.locator('.hito')).toHaveCount(10);
  await expect(linea.locator('.hito').filter({ hasText: 'Karl · eliges senda' })).toContainText('Vela Cuervos de Odín');
  await expect(linea.locator('.hito').filter({ hasText: 'Huscarl' })).toContainText('Maestría: Botín de la saga');
  await expect(linea.locator('.hito').filter({ hasText: 'Huscarl' })).toContainText('Mascarón Cabeza de dragón');
  await expect(linea.locator('.hito').filter({ hasText: 'Remero de banco' })).toContainText('🔒 Jefe: El draugr del muelle');
  await expect(linea.locator('.hito').last()).toContainText('Jefe final: Naglfar');
  await expect(linea.locator('[aria-current="step"]')).toContainText('1');
  // Las mejoras 1 y 2 se ven desde el nivel 1, pero el primer punto de talento llega en el nivel 3.
  await page.locator('#camino-talentos > summary').click();
  await expect(page.locator('#arbol .talento').filter({ hasText: 'Golpe de hacha' })).toContainText('Desde el nivel 3');
  await page.locator('#hp-camino').screenshot({ path: test.info().outputPath('camino-nivel-1.png') });

  // Nivel 20 sin senda elegida: la tarjeta pide elegirla y guarda la elección.
  await page.evaluate(async () => {
    const db = await import('./src/db.js');
    const muestras = Array.from({ length: 361 }, (_, k) => ({ t: k * 10, dist: k * 28, watts: 180, spm: 24 }));
    for (let i = 0; i < 18; i++) await db.guardar('sesiones', { fecha: Date.now() - (18 - i) * 1.1e8, duracion: 3600, distancia: 10000, distFuente: 'watts', muestras });
  });
  await page.reload();
  await page.locator('#tab-heroe').click();
  // El héroe se pinta cuando llega su código y se resumen las sesiones nuevas: se espera a que suba el nivel.
  await expect.poll(async () => Number(await page.locator('#heroe-nivel').textContent())).toBeGreaterThanOrEqual(20);
  await expect(page.locator('#camino-siguiente h3')).toHaveText('Elige tu senda');
  await expect(page.locator('#camino-siguiente')).toContainText('Puedes cambiar gratis');
  await expect(linea.locator('.hito').filter({ hasText: 'Remero de banco' })).toContainText('⚔ Jefe: El draugr del muelle · por vencer');
  await page.locator('#camino-siguiente [data-senda="b"]').click();
  await expect(page.locator('#camino-siguiente h3')).not.toHaveText('Elige tu senda');
  const per = await page.evaluate(() => JSON.parse(localStorage.getItem('personaje')));
  expect(per.senda.vikingo.at(-1)[1]).toBe('b');
  await page.locator('#camino-talentos > summary').click();
  await expect(page.locator('#arbol .senda.activa')).toContainText('Berserker');
});
