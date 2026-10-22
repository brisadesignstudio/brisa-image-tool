import { describe, expect, it } from 'vitest';
import { computeLayout, defaultCrop, describeSize, effectiveMode, fitCrop, ratioLabel } from '../../src/lib/geometry';

const fit = (width: number | null, height: number | null) => ({ mode: 'fit' as const, width, height, margin: 0 });
const crop = (width: number, height: number) => ({ mode: 'crop' as const, width, height, margin: 0 });
const pad = (width: number, height: number, margin = 0) => ({ mode: 'pad' as const, width, height, margin });

describe('mantener proporción', () => {
  it('reduce por ancho conservando la proporción', () => {
    const l = computeLayout(6000, 4000, fit(1200, null));
    expect([l.iw, l.ih, l.cw, l.ch]).toEqual([1200, 800, 1200, 800]);
    expect(l.limited).toBe(false);
  });

  it('encaja en una caja sin deformar', () => {
    const l = computeLayout(1000, 3000, fit(1920, 1080));
    expect([l.iw, l.ih]).toEqual([360, 1080]);
  });

  it('nunca amplía: entrega la resolución real y lo avisa', () => {
    const l = computeLayout(640, 480, fit(1200, null));
    expect([l.iw, l.ih]).toEqual([640, 480]);
    expect(l.limited).toBe(true);
    expect(l.identity).toBe(true);
  });

  it('sin medidas: tamaño original', () => {
    const l = computeLayout(1234, 567, fit(null, null));
    expect([l.iw, l.ih]).toEqual([1234, 567]);
    expect(l.identity).toBe(true);
  });
});

describe('recorte', () => {
  it('por defecto recorta centrado con la proporción exacta', () => {
    const c = defaultCrop(6000, 4000, 1080 / 1350);
    expect(c.h).toBe(1);
    expect(c.w * 6000).toBeCloseTo(3200, 5);
    expect(c.x).toBeCloseTo((1 - c.w) / 2, 10);
    const l = computeLayout(6000, 4000, crop(1080, 1350));
    expect([l.cw, l.ch]).toEqual([1080, 1350]);
    expect([l.sw, l.sh]).toEqual([3200, 4000]);
  });

  it('respeta el encuadre manual y lo mantiene dentro de la imagen', () => {
    const c = fitCrop({ x: 0.9, y: 0, w: 0.5, h: 1 }, 6000, 4000, 1);
    expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-9);
    expect((c.w * 6000) / (c.h * 4000)).toBeCloseTo(1, 6);
  });

  it('si el recorte no da para la medida, no amplía', () => {
    const l = computeLayout(800, 400, crop(1080, 1350));
    expect(l.limited).toBe(true);
    expect([l.cw, l.ch]).toEqual([l.sw, l.sh]);
    expect(l.ch).toBe(400);
  });

  it('sin ancho y alto vuelve a mantener la proporción', () => {
    expect(effectiveMode({ mode: 'crop', width: 1080, height: null, margin: 0 })).toBe('fit');
  });
});

describe('márgenes', () => {
  it('centra la imagen completa en el lienzo con margen', () => {
    const l = computeLayout(1600, 800, pad(1080, 1080, 10));
    expect([l.cw, l.ch]).toEqual([1080, 1080]);
    expect(l.iw).toBe(1080 - 2 * 108);
    expect(l.ih).toBe(432);
    expect(l.ox).toBe(108);
    expect(l.oy).toBe(Math.round((1080 - 432) / 2));
  });

  it('una imagen pequeña se queda a su tamaño real', () => {
    const l = computeLayout(64, 64, pad(1080, 1080, 0));
    expect([l.iw, l.ih]).toEqual([64, 64]);
    expect(l.smallerInPad).toBe(true);
  });
});

describe('textos', () => {
  it('describe las medidas', () => {
    expect(describeSize(fit(1200, null))).toBe('1200 px de ancho');
    expect(describeSize(fit(null, null))).toBe('Tamaño original');
    expect(describeSize(crop(1080, 1350))).toBe('1080 × 1350 px');
  });

  it('proporciones legibles', () => {
    expect(ratioLabel(1080, 1350)).toBe('4:5');
    expect(ratioLabel(1080, 1920)).toBe('9:16');
  });
});
