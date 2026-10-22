/**
 * Rasteriza el logotipo original de Brisa (brand/brisa-logotipo-vino.svg) a un PNG transparente
 * de 2400 × 400 px para la prueba «los logos no se alteran». Solo se ajusta el área visible del
 * SVG alrededor del dibujo; los trazados no cambian.
 *
 * Uso: node scripts/make-logo-fixture.mjs  (se ejecuta también con `npm run fixtures`)
 * Necesita el Chromium de Playwright: npx playwright install chromium
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'tests/fixtures/generated/brisa-logotipo-2400x400.png');
const [width, height] = [2400, 400];
// Contorno del logotipo (el mismo que usa la interfaz) con aire alrededor, en proporción 6:1.
const viewBox = '34.33 304.28 780 130';

const svg = readFileSync(resolve(root, 'brand/brisa-logotipo-vino.svg'), 'utf8')
  .replace(/<\?xml[^>]*>/, '')
  .replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`)
  .replace('<svg ', `<svg width="${width}" height="${height}" `);

mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: out, omitBackground: true });
  console.log(`brisa-logotipo-2400x400.png generado en ${out}`);
} finally {
  await browser.close();
}
