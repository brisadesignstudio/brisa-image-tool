import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS, searchQuality } from '../../src/engine/quality-search';
import { ByteCache } from '../../src/engine/memo';
import { buildSpec, warningsFor } from '../../src/engine/spec';
import { BUILT_IN_PRESETS, recipeFromPreset, sanitizeSettings } from '../../src/lib/presets';
import { exportSummary } from '../../src/state/export';
import { defaultNaming } from '../../src/lib/naming';
import { itemKey, type AppState } from '../../src/state/store';
import type { Recipe, SourceImage, SourceInfo } from '../../src/lib/types';

/** Codificador de prueba: el peso crece con la calidad (como en JPG y WebP). */
function fakeEncoder(sizeAt: (quality: number) => number) {
  const tried: number[] = [];
  const encode = async (quality: number) => {
    tried.push(quality);
    return { byteLength: sizeAt(quality), quality };
  };
  return { encode, tried };
}

describe('búsqueda de calidad dentro del peso', () => {
  it('si ya cabe con la calidad elegida, no busca más', async () => {
    const { encode, tried } = fakeEncoder((q) => q * 1000);
    const r = await searchQuality(90, 60, 300_000, encode);
    expect([r.quality, r.fits, r.attempts]).toEqual([90, true, 1]);
    expect(tried).toEqual([90]);
  });

  it('encuentra la mayor calidad que cabe, con pocos intentos', async () => {
    const { encode, tried } = fakeEncoder((q) => q * 1000);
    const r = await searchQuality(90, 60, 75_500, encode);
    expect(r.fits).toBe(true);
    expect(r.quality).toBe(75);
    expect(r.value.byteLength).toBeLessThanOrEqual(75_500);
    expect(r.attempts).toBeLessThanOrEqual(MAX_ATTEMPTS);
    expect(tried.length).toBe(r.attempts);
  });

  it('si ni con la calidad mínima cabe, entrega esa (la más ligera permitida) y lo dice', async () => {
    const { encode } = fakeEncoder((q) => q * 1000);
    const r = await searchQuality(90, 60, 50_000, encode);
    expect([r.quality, r.fits, r.attempts]).toEqual([60, false, 2]);
    expect(r.value.byteLength).toBe(60_000);
  });

  it('nunca baja de la calidad mínima ni sube de la elegida', async () => {
    const { encode, tried } = fakeEncoder((q) => q * q * 10);
    await searchQuality(80, 40, 20_000, encode);
    expect(Math.min(...tried)).toBeGreaterThanOrEqual(40);
    expect(Math.max(...tried)).toBeLessThanOrEqual(80);
  });

  it('con la calidad mínima igual o mayor que la elegida, no busca', async () => {
    const { encode, tried } = fakeEncoder((q) => q * 1000);
    const r = await searchQuality(50, 60, 10_000, encode);
    expect([r.quality, r.fits]).toEqual([50, false]);
    expect(tried).toEqual([50]);
  });

  it('limita los intentos en el rango más amplio y devuelve siempre algo que cabe', async () => {
    const { encode } = fakeEncoder((q) => 1000 + q * 997);
    const r = await searchQuality(100, 1, 37_900, encode);
    expect(r.attempts).toBeLessThanOrEqual(MAX_ATTEMPTS);
    expect(r.fits).toBe(true);
    expect(r.value.byteLength).toBeLessThanOrEqual(37_900);
    expect(r.quality).toBeGreaterThanOrEqual(30); // cerca de la mejor (37) pese al tope de intentos
  });
});

describe('caché de resultados', () => {
  it('saca lo usado hace más tiempo al pasar del límite y olvida por imagen', () => {
    const cache = new ByteCache<Uint8Array>(100, (b) => b.byteLength);
    cache.set('a|1', new Uint8Array(40));
    cache.set('a|2', new Uint8Array(40));
    cache.get('a|1'); // se usa: pasa a ser lo más reciente
    cache.set('b|1', new Uint8Array(40));
    expect(cache.get('a|2')).toBeUndefined();
    expect(cache.get('a|1')).toBeDefined();
    cache.set('enorme', new Uint8Array(80)); // más de la mitad: no se guarda
    expect(cache.get('enorme')).toBeUndefined();
    cache.forget('a|');
    expect(cache.get('a|1')).toBeUndefined();
    expect(cache.get('b|1')).toBeDefined();
  });
});

const info = (over: Partial<SourceInfo> = {}): SourceInfo => ({
  format: 'jpeg',
  width: 3000,
  height: 2000,
  hasAlpha: false,
  animated: false,
  icc: 'none',
  jpegQuality: 92,
  jpegQualityExact: false,
  webpLossless: null,
  exactDecode: false,
  ...over,
});

const image = (id: string, over: Partial<SourceInfo> = {}): SourceImage => ({
  id,
  file: new Blob(['x']) as File,
  name: `${id}.jpg`,
  baseName: id,
  size: 500_000,
  status: 'ready',
  info: info(over),
});

const preset = (id: string, over: Partial<Recipe> = {}): Recipe => ({
  ...recipeFromPreset(BUILT_IN_PRESETS.find((p) => p.id === id)!),
  id,
  ...over,
});

describe('peso máximo en los ajustes', () => {
  it('está desactivado por defecto y los datos guardados sin él siguen valiendo', () => {
    expect(BUILT_IN_PRESETS.every((p) => p.maxBytes === null)).toBe(true);
    const old = sanitizeSettings({ name: 'Antigua', format: 'jpeg', quality: 80 })!;
    expect(old.maxBytes).toBeNull();
    expect(old.minQuality).toBe(60);
    const fixed = sanitizeSettings({ name: 'X', maxBytes: 5, minQuality: 500 })!;
    expect(fixed.maxBytes).toBe(1000);
    expect(fixed.minQuality).toBe(100);
  });

  it('con pérdida, el peso máximo y la calidad mínima cambian el resultado; sin pérdida, solo el aviso', () => {
    const jpg = preset('ig-4x5');
    const base = buildSpec(image('a'), jpg, undefined)!.key;
    const limited = buildSpec(image('a'), { ...jpg, maxBytes: 300_000 }, undefined)!;
    expect(limited.key).not.toBe(base);
    expect(limited.job.maxBytes).toBe(300_000);
    expect(buildSpec(image('a'), { ...jpg, maxBytes: 300_000, minQuality: 40 }, undefined)!.key).not.toBe(limited.key);
    const png = preset('logo-perfil');
    const logo = image('l', { format: 'png', hasAlpha: true });
    const pngLimited = buildSpec(logo, { ...png, maxBytes: 20_000 }, undefined)!;
    expect(pngLimited.lossless).toBe(true);
    // La calidad mínima no influye en un PNG (nunca pasa a compresión con pérdida).
    expect(buildSpec(logo, { ...png, maxBytes: 20_000, minQuality: 10 }, undefined)!.key).toBe(pngLimited.key);
  });

  it('el aviso da el peso real y alternativas según el formato', () => {
    const jpg = { ...preset('ig-4x5'), maxBytes: 5_000 };
    const spec = buildSpec(image('a'), jpg, undefined)!;
    const over = warningsFor(image('a'), jpg, spec, { keptOriginal: false, flattened: false, size: 17_000 });
    expect(over[0].code).toBe('over-limit');
    expect(over[0].message).toContain('17 KB (máximo 5 KB)');
    expect(over[0].message).toContain('calidad mínima (60)');
    expect(over[0].message).toContain('prueba WebP');
    const within = warningsFor(image('a'), jpg, spec, { keptOriginal: false, flattened: false, size: 4_000 });
    expect(within.some((w) => w.code === 'over-limit')).toBe(false);

    const png = { ...preset('logo-perfil'), maxBytes: 20_000 };
    const logo = image('l', { format: 'png', hasAlpha: true });
    const pngSpec = buildSpec(logo, png, undefined)!;
    const pngOver = warningsFor(logo, png, pngSpec, { keptOriginal: false, flattened: false, size: 75_000 });
    expect(pngOver[0].message).toContain('PNG guarda sin pérdida');
    expect(pngOver[0].message).toContain('WebP con pérdida, que conserva la transparencia');
  });

  it('el resumen de descarga cuenta los archivos que superan su límite, solo entre los seleccionados', () => {
    const recipes = [preset('web-contenido', { maxBytes: 20_000 }), preset('ig-4x5', { maxBytes: 50_000 })];
    const images = [image('a'), image('b')];
    const sizes: Record<string, number> = {
      [itemKey('a', 'web-contenido')]: 25_000, // supera
      [itemKey('a', 'ig-4x5')]: 40_000,
      [itemKey('b', 'web-contenido')]: 18_000,
      [itemKey('b', 'ig-4x5')]: 90_000, // supera, pero no se descarga
    };
    const results: AppState['results'] = {};
    for (const [key, size] of Object.entries(sizes)) {
      results[key] = { key: 'k', status: 'done', blob: new Blob(['x']), width: 10, height: 10, size, format: 'jpeg', warnings: [] };
    }
    const state = {
      images,
      recipes,
      results,
      excluded: { [itemKey('b', 'ig-4x5')]: true },
      crops: {},
      naming: defaultNaming(),
    } as unknown as AppState;
    const summary = exportSummary(state);
    expect(summary.files).toBe(3);
    expect(summary.overLimit).toBe(1);
    expect(summary.bytes).toBe(25_000 + 40_000 + 18_000);
  });
});
