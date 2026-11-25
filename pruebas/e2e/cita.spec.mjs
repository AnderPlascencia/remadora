import { test, expect, abrirApp, completarBienvenida, remar, terminar, leerAjustes } from './ayuda.mjs';

// Etapa 13: eliges tus días y tu hora, la app te dice tu próxima cita y la puedes llevar a tu calendario (.ics).
test('tus días y tu hora: la próxima cita en Hoy, el calendario y el cierre con cita en el resumen', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  // Hoy ya tiene una cita sin tocar nada (los días de serie y las 19:00), dentro del «Más» (UX2-4).
  await page.locator('#hoy-mas > summary').click();
  await expect(page.locator('#hoy-cita')).toBeVisible();
  await expect(page.locator('#hoy-cita')).toContainText('Tu próxima cita:');
  await expect(page.locator('#hoy-cita')).toContainText('19:00');

  // Ajustes: marcar el jueves suma un día; la hora se guarda.
  await page.locator('#tab-ajustes').click();
  const chips = page.locator('#cita-dias [data-dia]');
  await expect(chips).toHaveCount(7);
  const antes = await page.locator('#cita-dias [aria-pressed="true"]').count();
  const jueves = page.locator('#cita-dias [data-dia="3"]');
  const marcadoAntes = (await jueves.getAttribute('aria-pressed')) === 'true';
  await jueves.click();
  await expect(jueves).toHaveAttribute('aria-pressed', String(!marcadoAntes));
  const despues = antes + (marcadoAntes ? -1 : 1);
  await expect(page.locator('#cita-dias [aria-pressed="true"]')).toHaveCount(despues);
  await expect(page.locator('#sel-dias-perfil')).toHaveValue(String(despues));
  await page.locator('#in-hora-remo').fill('07:30');
  await page.locator('#in-hora-remo').dispatchEvent('change');
  const a = await leerAjustes(page, ['diasRemo', 'horaRemo', 'diasSemana']);
  expect(JSON.parse(a.diasRemo)).toHaveLength(despues);
  expect(a.horaRemo).toBe('07:30');
  expect(a.diasSemana).toBe(String(despues));

  // El calendario: un .ics con aviso 30 min antes a tu hora.
  const descarga = page.waitForEvent('download');
  await page.locator('#btn-cita-ics').click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toBe('rower-citas.ics');
  const texto = await (await archivo.createReadStream()).toArray().then((b) => Buffer.concat(b).toString('utf8'));
  expect(texto).toContain('BEGIN:VCALENDAR');
  expect(texto).toContain('TRIGGER:-PT30M');
  expect(texto).toMatch(/DTSTART:\d{8}T073000/);

  // El resumen de la sesión cierra con «¿Cuándo remas la próxima?», y la cita se puede mover.
  await page.locator('#tab-entrenar').click();
  await remar(page, 30_000);
  await terminar(page);
  const cita = page.locator('#cita-resumen');
  await expect(cita).toContainText('¿Cuándo remas la próxima?');
  await expect(cita).toContainText('07:30');
  await cita.locator('[data-cita="mover"]').click();
  await page.locator('#cita-dia').selectOption({ index: 2 });
  await page.locator('#cita-hora').fill('18:15');
  await cita.locator('[data-cita="guardar"]').click();
  await expect(page.locator('#cita-texto')).toContainText('18:15');
  const movida = JSON.parse((await leerAjustes(page, ['citaMovida'])).citaMovida);
  expect(movida.hora).toBe('18:15');
  const una = page.waitForEvent('download');
  await cita.locator('[data-cita="ics"]').click();
  expect((await una).suggestedFilename()).toBe(`rower-cita-${movida.fecha}.ics`);
});
