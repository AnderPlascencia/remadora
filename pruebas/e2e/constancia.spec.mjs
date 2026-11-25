import { test, expect, abrirApp, completarBienvenida, remar, terminar, listar } from './ayuda.mjs';

// La constancia se mide en el teléfono: abrir la app, la bienvenida y la sesión quedan como eventos, y la tarjeta
// «Tu constancia» de Progreso (con Datos avanzados) los resume.
test('los eventos del hábito se guardan y la tarjeta «Tu constancia» los muestra', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  // La sesión del plan se elige sola al cerrar la bienvenida: sin esperarla, con la máquina cargada se podía empezar
  // un remo libre (que no cuenta como dejado ni como plan).
  await expect(page.locator('#sel-entrenamiento')).not.toHaveValue('');
  await remar(page, 30_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await page.keyboard.press('Escape');
  await expect.poll(async () => {
    const estado = await listar(page, 'estado');
    const ev = estado.find((x) => Array.isArray(x) && x.some?.((e) => e?.tipo === 'app')) || [];
    return ['app', 'bienvenida', 'bienvenidaFin', 'sesionInicio', 'sesionFin'].filter((t) => ev.some((e) => e.tipo === t));
  }).toEqual(['app', 'bienvenida', 'bienvenidaFin', 'sesionInicio', 'sesionFin']);
  await page.evaluate(() => document.documentElement.setAttribute('data-avanzado', ''));
  await page.locator('#tab-historial').click();
  await page.locator('details[data-seccion="constancia"] summary').click();
  const tabla = page.locator('#tabla-constancia');
  await expect(tabla).toContainText('Sesiones empezadas · dejadas (28 días)');
  // 30 s de la sesión del plan: se guardó, pero sin acabarla, así que cuenta como dejada.
  await expect(tabla).toContainText('1 · 1');
  await expect(tabla).toContainText('Plan cumplido100 % (1 de 1)');
  await expect(page.locator('#constancia-texto')).toHaveText('Remaste hoy.');
});
