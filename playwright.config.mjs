// Pruebas end to end (pruebas/e2e): la app en Chromium con el tamaño de un teléfono, en modo demo.
import { defineConfig, devices } from '@playwright/test';

const PUERTO = 4173;

export default defineConfig({
  testDir: 'pruebas/e2e',
  testMatch: '*.spec.mjs',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'e2e-resultados.json' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}/`,
    ...devices['Pixel 7'],
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'pixel7' },
    // El teléfono de Ander (CPH2653): 1440 × 3168 a densidad 4. Solo corre las pruebas de cuadros por segundo y de
    // densidad: a densidad 4 la carrera pintaba 2,3 veces más píxeles que en el Pixel 7 y rendía la mitad.
    {
      name: 'cph2653',
      testMatch: 'rendimiento.spec.mjs',
      grep: /cuadros por segundo|densidad/,
      use: { viewport: { width: 360, height: 792 }, screen: { width: 360, height: 792 }, deviceScaleFactor: 4 },
    },
  ],
  webServer: {
    command: `node pruebas/e2e/servidor.mjs`,
    env: { PUERTO: String(PUERTO) },
    url: `http://127.0.0.1:${PUERTO}/`,
    reuseExistingServer: !process.env.CI,
  },
});
