import { test, expect, completarBienvenida, remar, terminar, listar, enCurso, leerEstado, esperarAviso, avanzar } from './ayuda.mjs';

// Etapa 2: ninguna falla de guardado, de IndexedDB o del temporizador debe perder una sesión.
// window.__frenado detiene el tic de la sesión (como Chrome con la app en segundo plano) mientras el modo demo
// sigue mandando datos, igual que la remadora por Bluetooth.
test.beforeEach(async ({ page }) => {
  // Después del reloj simulado, para envolver su setInterval y no al revés.
  await page.clock.install();
  await page.addInitScript(() => {
    const original = window.setInterval;
    window.setInterval = (fn, ms, ...resto) => original((...a) => { if (!(fn.name === 'tic' && window.__frenado)) fn(...a); }, ms, ...resto);
  });
  await page.goto('./');
  await completarBienvenida(page);
});

test('si guardar la sesión falla, la copia se queda y se puede volver a intentar', async ({ page }) => {
  await remar(page, 30_000);
  // El próximo guardado en «sesiones» falla como con el disco lleno.
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'sesiones' && !window.__yaFallo) {
        window.__yaFallo = true;
        throw new DOMException('sin espacio', 'QuotaExceededError');
      }
      return put.apply(this, args);
    };
  });
  await terminar(page);
  await esperarAviso(page, /No se pudo guardar la sesión/);
  expect(await listar(page, 'sesiones')).toHaveLength(0);
  const copia = await enCurso(page);
  expect(copia.muestras.length).toBeGreaterThanOrEqual(20);
  expect(copia.fin).toBeTruthy();

  // Se ofrece guardarla otra vez, y ahora sí se guarda una sola vez y se borra la copia.
  await expect(page.locator('#recuperar-dialogo')).toBeVisible();
  await page.locator('#recuperar-guardar').click();
  await expect(page.locator('#hoja-titulo')).toBeVisible();
  const sesiones = await listar(page, 'sesiones');
  expect(sesiones).toHaveLength(1);
  expect(sesiones[0].duracion).toBeGreaterThanOrEqual(20);
  expect(await enCurso(page)).toBeNull();
});

test('una copia que ya quedó guardada no se ofrece otra vez', async ({ page }) => {
  await remar(page, 30_000);
  const copia = await enCurso(page);
  // Se guardó la sesión pero la app se cerró antes de borrar la copia.
  await page.evaluate((c) => new Promise((ok) => {
    const req = indexedDB.open('remadora');
    req.onsuccess = () => {
      const t = req.result.transaction('sesiones', 'readwrite');
      t.objectStore('sesiones').put({ fecha: c.inicio, duracion: c.t, distancia: Math.round(c.dist), muestras: c.muestras });
      t.oncomplete = () => { req.result.close(); ok(); };
    };
  }), copia);
  await page.reload();
  await page.clock.runFor(1_000);
  await expect(page.locator('#recuperar-dialogo')).toBeHidden();
  await expect.poll(() => enCurso(page)).toBeNull();
  expect(await listar(page, 'sesiones')).toHaveLength(1);
});

test('una transacción abortada sin error (disco lleno) termina en error en vez de colgarse', async ({ page }) => {
  const resultado = await page.evaluate(async () => {
    const db = await import('./src/db.js');
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const req = put.apply(this, args);
      // Como con QuotaExceededError: la transacción se aborta y la petición no avisa a la transacción.
      req.addEventListener('error', (e) => e.stopPropagation());
      this.transaction.abort();
      return req;
    };
    try {
      await Promise.race([
        db.guardar('entrenamientos', { nombre: 'x' }),
        new Promise((_, mal) => setTimeout(() => mal(new Error('colgada')), 2000)),
      ]);
      return 'guardó';
    } catch (e) {
      return e.name || e.message;
    } finally {
      IDBObjectStore.prototype.put = put;
    }
  });
  expect(resultado).toBe('AbortError');
});

test('con el temporizador frenado en segundo plano, la sesión no pierde tiempo ni metros', async ({ page }) => {
  await remar(page, 20_000);
  const antes = await enCurso(page);
  // Chrome frena el temporizador: pasan 60 s sin ningún tic, pero los datos siguen llegando.
  await page.evaluate(() => { window.__frenado = true; });
  await avanzar(page, 60_000);
  expect((await enCurso(page)).t).toBe(antes.t);
  await page.evaluate(() => { window.__frenado = false; });
  await avanzar(page, 10_000);
  const despues = await enCurso(page);
  // 20 s + 60 s frenados + 10 s: unos 90 s de sesión (antes se contaban unos 30).
  expect(despues.t).toBeGreaterThanOrEqual(antes.t + 60);
  expect(despues.dist).toBeGreaterThan(antes.dist + 100);
  expect(despues.muestras.map((m) => m.t)).toEqual(despues.muestras.map((_, i) => i + 1));
});

test('las reparaciones del historial corren una vez y quedan anotadas', async ({ page }) => {
  await expect.poll(() => leerEstado(page, 'versionDatos')).toBe(1);
});

test('una copia de una versión anterior en localStorage se sigue ofreciendo', async ({ page }) => {
  await remar(page, 30_000);
  await page.reload();
  await page.clock.runFor(1_000);
  await expect(page.locator('#recuperar-dialogo')).toBeVisible();
  // Sin sesión activa, la copia pasa de IndexedDB a localStorage, como la dejaba la versión anterior.
  const copia = await enCurso(page);
  await page.evaluate((c) => new Promise((ok) => {
    localStorage.setItem('sesionEnCurso', JSON.stringify(c));
    const req = indexedDB.open('remadora');
    req.onsuccess = () => {
      const t = req.result.transaction('estado', 'readwrite');
      t.objectStore('estado').delete('enCurso');
      t.oncomplete = () => { req.result.close(); ok(); };
    };
  }), copia);
  await page.reload();
  await page.clock.runFor(1_000);
  await expect(page.locator('#recuperar-dialogo')).toBeVisible();
  await page.locator('#recuperar-guardar').click();
  await expect(page.locator('#hoja-titulo')).toBeVisible();
  expect(await listar(page, 'sesiones')).toHaveLength(1);
  expect(await enCurso(page)).toBeNull();
});
