import { defineConfig, devices } from '@playwright/test';

// Con WEB_URL, las mismas pruebas se pasan contra la web publicada (sin servidor local).
const published = process.env.WEB_URL?.replace(/\/?$/, '/');

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  // El procesado usa varios hilos: mejor una prueba cada vez.
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: published ?? 'http://localhost:4173',
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: published
    ? undefined
    : {
        // Se prueba la versión de producción, con la política de seguridad activa.
        command: 'npm run build && npx vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
