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
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}/`,
    ...devices['Pixel 7'],
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node pruebas/e2e/servidor.mjs`,
    env: { PUERTO: String(PUERTO) },
    url: `http://127.0.0.1:${PUERTO}/`,
    reuseExistingServer: !process.env.CI,
  },
});
