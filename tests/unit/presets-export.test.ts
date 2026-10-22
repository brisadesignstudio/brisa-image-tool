import { describe, expect, it } from 'vitest';
import { BUILT_IN_PRESETS, recipeFromPreset, sanitizeSettings, settingsOf } from '../../src/lib/presets';
import { planZip, zipBaseName } from '../../src/state/export';
import { buildSpec, warningsFor } from '../../src/engine/spec';
import { defaultNaming } from '../../src/lib/naming';
import { itemKey, type AppState } from '../../src/state/store';
import type { Recipe, SourceImage, SourceInfo } from '../../src/lib/types';

describe('ajustes guardados', () => {
  it('los ajustes de fábrica son válidos tal cual', () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(sanitizeSettings(preset)).toEqual(settingsOf(preset));
    }
  });

  it('descarta o corrige datos dañados del almacenamiento', () => {
    expect(sanitizeSettings(null)).toBeNull();
    expect(sanitizeSettings({ name: '' })).toBeNull();
    const fixed = sanitizeSettings({ name: 'X', mode: 'crop', width: 1080, quality: 500, background: 'red' })!;
    expect(fixed.mode).toBe('fit'); // recortar sin alto no es posible
    expect(fixed.quality).toBe(100);
    expect(fixed.background).toBe('#ffffff');
  });
});

const info = (over: Partial<SourceInfo> = {}): SourceInfo => ({
  format: 'png',
  width: 1600,
  height: 800,
  hasAlpha: true,
  animated: false,
  icc: 'none',
  jpegQuality: null,
  jpegQualityExact: false,
  webpLossless: null,
  exactDecode: true,
  ...over,
});

const image = (id: string, name: string, over: Partial<SourceInfo> = {}): SourceImage => ({
  id,
  file: new Blob(['x']) as File,
  name,
  baseName: name.replace(/\.[^.]+$/, ''),
  size: 1000,
  status: 'ready',
  info: info(over),
});

const preset = (id: string): Recipe => {
  const p = BUILT_IN_PRESETS.find((x) => x.id === id)!;
  return { ...recipeFromPreset(p), id };
};

describe('copias y avisos', () => {
  it('pasar un logo transparente a JPG avisa de que se rellena el fondo', () => {
    const img = image('a', 'logo.png');
    const recipe = preset('ig-4x5');
    const spec = buildSpec(img, recipe, undefined)!;
    expect(spec.format).toBe('jpeg');
    const codes = warningsFor(img, recipe, spec).map((w) => w.code);
    expect(codes).toContain('flattened');
    expect(codes).toContain('limited'); // 800 px de alto no dan para 1350
  });

  it('«Solo optimizar» conserva formato y medidas, y entrega la original si no gana peso', () => {
    const spec = buildSpec(image('a', 'logo.png'), preset('web-optimizar'), undefined)!;
    expect(spec.format).toBe('png');
    expect(spec.lossless).toBe(true);
    expect(spec.job.keepOriginalIfNotSmaller).toBe(true);
    expect([spec.layout.cw, spec.layout.ch]).toEqual([1600, 800]);
  });

  it('un WebP sin pérdida sigue sin pérdida si se mantiene el formato', () => {
    const spec = buildSpec(image('a', 'ilustracion.webp', { format: 'webp', webpLossless: true }), preset('web-optimizar'), undefined)!;
    expect(spec.lossless).toBe(true);
  });

  it('la clave de render solo cambia si cambia el resultado', () => {
    const img = image('a', 'logo.png');
    const recipe = preset('logo-perfil');
    const a = buildSpec(img, recipe, undefined)!.key;
    expect(buildSpec(img, { ...recipe, name: 'Otro nombre', quality: 10 }, undefined)!.key).toBe(a); // PNG: la calidad no influye
    expect(buildSpec(img, { ...recipe, margin: 20 }, undefined)!.key).not.toBe(a);
  });
});

describe('ZIP', () => {
  it('ordena por carpetas, evita duplicados y añade las originales intactas', () => {
    const images = [image('a', 'Foto Uno.png'), image('b', 'foto-uno.png')];
    const recipes = [preset('web-contenido'), preset('logo-perfil')];
    const results: AppState['results'] = {};
    for (const img of images) {
      for (const r of recipes) {
        results[itemKey(img.id, r.id)] = {
          key: 'k',
          status: 'done',
          blob: new Blob(['copia']),
          width: 100,
          height: 50,
          size: 5,
          format: r.format === 'webp' ? 'webp' : 'png',
          warnings: [],
        };
      }
    }
    const state = {
      images,
      recipes,
      results,
      excluded: { [itemKey('b', 'logo-perfil')]: true },
      crops: {},
      naming: { ...defaultNaming(), includeOriginals: true },
    } as unknown as AppState;
    const date = new Date(2026, 9, 22);
    const paths = planZip(state, date).map((e) => e.path);
    const root = zipBaseName(state.naming, date);
    expect(root).toBe('brisa-imagenes-2026-10-22');
    expect(paths).toEqual([
      `${root}/web/foto-uno-web.webp`,
      `${root}/perfil/foto-uno-perfil.png`,
      `${root}/web/foto-uno-web-2.webp`,
      `${root}/originales/Foto Uno.png`,
      `${root}/originales/foto-uno.png`,
    ]);
  });
});
