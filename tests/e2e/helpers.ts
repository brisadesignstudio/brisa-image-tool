import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = join(here, '..', 'fixtures', 'generated');

export function fixture(name: string): string {
  const path = join(FIXTURES, name);
  if (!existsSync(path)) {
    throw new Error(`Falta ${name}. Genera las imágenes de prueba con: npm run fixtures`);
  }
  return path;
}

export async function addImages(page: Page, names: string[]) {
  await page.locator('[data-testid=file-input]').first().setInputFiles(names.map(fixture));
}

/** Espera a que todas las copias visibles estén listas. */
export async function settle(page: Page) {
  await expect(page.locator('[data-testid=output-card]').first()).toBeVisible();
  await expect(page.locator('[data-testid=output-card] .status')).toHaveCount(0, { timeout: 90_000 });
}

export async function downloadZip(page: Page): Promise<Record<string, Uint8Array>> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 90_000 }),
    page.getByRole('button', { name: /Descargar ZIP/ }).click(),
  ]);
  const path = await download.path();
  return unzipSync(new Uint8Array(readFileSync(path)));
}

export function entry(files: Record<string, Uint8Array>, suffix: string): Uint8Array {
  const key = Object.keys(files).find((k) => k.endsWith(suffix));
  if (!key) throw new Error(`No está en el ZIP: ${suffix}. Hay: ${Object.keys(files).join(', ')}`);
  return files[key];
}

// Decodificadores exactos (los mismos códecs WASM) para comparar píxeles en Node.
const require = createRequire(import.meta.url);
type Pixels = { width: number; height: number; data: Uint8ClampedArray };

class NodeImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
}

let pngReady: Promise<(bytes: Uint8Array) => Pixels> | null = null;
export function decodePng(bytes: Uint8Array): Promise<Pixels> {
  pngReady ??= (async () => {
    (globalThis as { ImageData?: unknown }).ImageData ??= NodeImageData;
    const glue = await import('@jsquash/png/codec/pkg/squoosh_png.js');
    const wasm = readFileSync(require.resolve('@jsquash/png/codec/pkg/squoosh_png_bg.wasm'));
    await glue.default(wasm);
    return (b: Uint8Array) => glue.decode(b) as unknown as Pixels;
  })();
  return pngReady.then((decode) => decode(bytes));
}

let webpReady: Promise<(bytes: Uint8Array) => Pixels> | null = null;
export function decodeWebp(bytes: Uint8Array): Promise<Pixels> {
  webpReady ??= (async () => {
    (globalThis as { ImageData?: unknown }).ImageData ??= NodeImageData;
    const glue = await import('@jsquash/webp/codec/dec/webp_dec.js');
    const wasmBinary = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
    const module = await glue.default({ noInitialRun: true, wasmBinary } as never);
    return (b: Uint8Array) => module.decode(b) as unknown as Pixels;
  })();
  return webpReady.then((decode) => decode(bytes));
}

export function samePixels(a: Pixels, b: Pixels): boolean {
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) return false;
  for (let i = 0; i < a.data.length; i += 4) {
    // Un píxel totalmente transparente no tiene color visible: solo cuenta su alfa.
    if (a.data[i + 3] === 0 && b.data[i + 3] === 0) continue;
    if (
      a.data[i] !== b.data[i] ||
      a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2] ||
      a.data[i + 3] !== b.data[i + 3]
    )
      return false;
  }
  return true;
}
