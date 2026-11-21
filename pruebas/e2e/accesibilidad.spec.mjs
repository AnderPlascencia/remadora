// Accesibilidad con axe-core (WCAG 2.1 A y AA) en las pantallas principales y con los tres temas, más la letra
// mínima de 14 px en el modo remo, que se lee de lejos mientras remas.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, abrirApp, completarBienvenida, avanzar, remar, terminar } from './ayuda.mjs';

async function revisar(page, pantalla) {
  // Sin animaciones: el split se desvanece 0,16 s al cambiar y axe no debe medir el contraste a medio camino.
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const resumen = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} ${n.any[0]?.message || ''}`).join(' | ')}`);
  expect(resumen, `axe en ${pantalla}`).toEqual([]);
}

// Botones y controles visibles de menos de 44 × 44 px. Excepciones: el «?» de ayuda (24 px a la vista, con 44 px
// de zona táctil por su ::before) y el «Afinar de 1 a 10» del esfuerzo (plegado), que en una fila no cabe a 44 px
// de ancho (mide 44 de alto y cumple los 24 px del nivel AA de WCAG 2.2). Los 5 botones grandes sí miden 44.
const tactilesChicos = (page) => page.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, summary, [role=button], [role=radio], [role=tab]')]
  .filter((e) => e.checkVisibility({ visibilityProperty: true }) && !e.closest('[aria-hidden="true"], [inert]') && !e.matches('.ayuda-q, #rpe-fino button'))
  .map((e) => { const r = e.getBoundingClientRect(); return { el: `${e.id ? `#${e.id}` : e.className} ${e.textContent.trim().slice(0, 24)}`, w: Math.round(r.width), h: Math.round(r.height) }; })
  .filter((x) => x.w > 0 && x.h > 0 && (x.w < 44 || x.h < 44))
  .filter((x) => !/^(checkbox|radio)$/.test(x.el)) // las casillas van dentro de su etiqueta, que es la zona táctil
  .map((x) => `${x.el} ${x.w}×${x.h}`));

async function revisarTodo(page, pantalla) {
  await revisar(page, pantalla);
  expect(await tactilesChicos(page), `objetivos táctiles de menos de 44 px en ${pantalla}`).toEqual([]);
}

// La letra más chica del texto que se ve dentro de `raiz` (lo decorativo con aria-hidden, como los puntos de vista, no cuenta).
const letraMinima = (page, raiz) => page.evaluate((sel) => {
  let min = { px: Infinity, texto: '' };
  const w = document.createTreeWalker(document.querySelector(sel), NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const el = w.currentNode.parentElement;
    if (!w.currentNode.textContent.trim() || !el.checkVisibility({ visibilityProperty: true }) || el.closest('[aria-hidden="true"]')) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < min.px) min = { px, texto: `${el.id || el.className}: ${w.currentNode.textContent.trim().slice(0, 40)}` };
  }
  return min;
}, raiz);

for (const tema of ['oscuro', 'claro', 'contraste']) {
  test(`tema ${tema}: Entrenar, modo remo, Héroe y Ajustes pasan axe, y el modo remo no baja de 14 px`, async ({ page }) => {
    await abrirApp(page);
    await page.evaluate((t) => localStorage.setItem('tema', t), tema);
    await page.reload();
    await completarBienvenida(page);
    expect(await page.evaluate(() => document.documentElement.dataset.tema || 'oscuro')).toBe(tema);

    await revisar(page, 'Entrenar');
    await page.locator('#btn-grabar').click();
    await avanzar(page, 3_000);
    await revisar(page, 'Entrenar remando');

    for (const vista of ['numeros', 'grafica', 'carrera']) {
      await page.evaluate((v) => localStorage.setItem('vistaRemo', v), vista);
      await page.locator('#btn-modo-remo').click();
      await expect(page.locator('#modo-remo')).toBeVisible();
      await avanzar(page, 2_000);
      await revisar(page, `modo remo (${vista})`);
      const min = await letraMinima(page, '#modo-remo');
      expect(min.px, `letra más chica del modo remo (${vista}): ${min.texto}`).toBeGreaterThanOrEqual(14);
      await page.locator('#mr-salir').click();
      await expect(page.locator('#modo-remo')).toBeHidden();
    }

    await page.locator('#tab-heroe').click();
    await avanzar(page, 500);
    await revisar(page, 'Héroe');
    await page.locator('#tab-ajustes').click();
    await avanzar(page, 500);
    await revisar(page, 'Ajustes');
  });
}

for (const tema of ['oscuro', 'claro', 'contraste']) {
  test(`tema ${tema}: la bienvenida, el resumen, Progreso y Planes pasan axe y sus objetivos táctiles miden 44 px`, async ({ page }) => {
    test.setTimeout(120_000);
    await abrirApp(page);
    await page.evaluate((t) => localStorage.setItem('tema', t), tema);
    await page.reload();
    const inicio = page.locator('#inicio');
    await expect(inicio).toBeVisible();
    for (let paso = 1; paso <= 6; paso++) {
      await revisarTodo(page, `bienvenida, paso ${paso}`);
      for (const grupo of await page.locator('#inicio [role=radiogroup]:visible').all()) {
        const opcion = grupo.locator('button, [role=radio]').first();
        if (await opcion.count()) await opcion.click();
      }
      if (await page.locator('#inicio-demo').isVisible()) break;
      await page.locator('#inicio-siguiente').click();
      await avanzar(page, 500);
    }
    await page.locator('#inicio-demo').click();
    await expect(inicio).toBeHidden();

    await remar(page, 30_000);
    await terminar(page);
    await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
    await avanzar(page, 1_000);
    await revisarTodo(page, 'resumen de la sesión');
    await page.keyboard.press('Escape');

    // Con Datos avanzados se ven todas las secciones de Progreso; se abren todas.
    await page.evaluate(() => localStorage.setItem('avanzado', '1'));
    await page.reload();
    await page.locator('#tab-historial').click();
    for (const d of await page.locator('#vista-historial details.seccion:not([open])').all()) if (await d.isVisible()) await d.locator('summary').first().click();
    await avanzar(page, 500);
    await revisarTodo(page, 'Progreso');

    await page.locator('#tab-entrenamientos').click();
    for (const pt of ['entrenamientos', 'programa']) {
      await page.locator(`.planes-pestanas [data-pt="${pt}"]`).click();
      await avanzar(page, 500);
      await revisarTodo(page, `Planes (${pt})`);
    }
  });
}

test('una hoja abierta deja lo de detrás inerte, se lleva el foco y lo devuelve al cerrarse', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await expect(page.locator('main')).not.toHaveAttribute('inert', '');
  await remar(page, 30_000);
  await terminar(page);
  await expect(page.locator('#hoja')).toBeVisible();
  for (const sel of ['main', 'header.barra', 'nav.nav-inferior']) await expect(page.locator(sel)).toHaveAttribute('inert', '');
  expect(await page.evaluate(() => !!document.activeElement?.closest('#hoja'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#hoja')).toBeHidden();
  for (const sel of ['main', 'header.barra', 'nav.nav-inferior']) await expect(page.locator(sel)).not.toHaveAttribute('inert', '');
  // En Progreso, la sesión se abre desde su fila: al cerrar la hoja, el foco vuelve a esa fila.
  await page.locator('#tab-historial').click();
  const historial = page.locator('details[data-seccion="historial"]');
  if (!(await historial.getAttribute('open'))) await historial.locator('summary').click();
  const fila = page.locator('#lista-sesiones .fila-boton').first();
  await fila.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#hoja')).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement?.closest('#hoja'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#hoja')).toBeHidden();
  await expect(fila).toBeFocused();
});
