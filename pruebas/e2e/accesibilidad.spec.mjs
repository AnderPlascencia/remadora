// Accesibilidad con axe-core (WCAG 2.1 A y AA) en las pantallas principales y con los tres temas, más la letra
// mínima de 14 px en el modo remo, que se lee de lejos mientras remas.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, abrirApp, completarBienvenida, avanzar } from './ayuda.mjs';

async function revisar(page, pantalla) {
  // Sin animaciones: el split se desvanece 0,16 s al cambiar y axe no debe medir el contraste a medio camino.
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const resumen = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} ${n.any[0]?.message || ''}`).join(' | ')}`);
  expect(resumen, `axe en ${pantalla}`).toEqual([]);
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
