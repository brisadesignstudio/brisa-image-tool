import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classifyIcc, estimateJpegQuality, inspect, scaledLuminanceTable, sniffFormat } from '../../src/lib/sniff';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../fixtures/static/${name}`, import.meta.url))));

describe('formato real (no por la extensión)', () => {
  it('reconoce JPG, PNG y WebP por su contenido', () => {
    expect(sniffFormat(fixture('q50.jpg'))).toBe('jpeg');
    expect(sniffFormat(fixture('opaca.png'))).toBe('png');
    expect(sniffFormat(fixture('sin-perdida.webp'))).toBe('webp');
  });

  it('rechaza lo que no es imagen', () => {
    expect(sniffFormat(new TextEncoder().encode('Esto es texto, no una imagen.'))).toBeNull();
    expect(inspect(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBeNull();
  });
});

describe('PNG', () => {
  it('lee medidas y si puede tener transparencia', () => {
    const opaque = inspect(fixture('opaca.png'))!;
    expect([opaque.width, opaque.height, opaque.alphaPossible]).toEqual([16, 12, false]);
    expect(inspect(fixture('alfa.png'))!.alphaPossible).toBe(true);
  });

  it('detecta PNG animados', () => {
    expect(inspect(fixture('animada.png'))!.animated).toBe(true);
    expect(inspect(fixture('alfa.png'))!.animated).toBe(false);
  });
});

describe('WebP', () => {
  it('distingue con y sin pérdida', () => {
    expect(inspect(fixture('con-perdida.webp'))!.webpLossless).toBe(false);
    expect(inspect(fixture('sin-perdida.webp'))!.webpLossless).toBe(true);
  });

  it('detecta transparencia y animación', () => {
    const lossyAlpha = inspect(fixture('con-perdida-alfa.webp'))!;
    expect(lossyAlpha.alphaPossible).toBe(true);
    expect(lossyAlpha.webpLossless).toBe(false);
    expect([lossyAlpha.width, lossyAlpha.height]).toEqual([16, 12]);
    expect(inspect(fixture('animada.webp'))!.animated).toBe(true);
  });
});

describe('JPG', () => {
  it('estima la calidad con la que se guardó', () => {
    const q50 = inspect(fixture('q50.jpg'))!;
    const q92 = inspect(fixture('q92.jpg'))!;
    expect(q50.jpegQuality).toBe(50);
    expect(q92.jpegQuality).toBe(92);
    expect(q92.jpegQualityExact).toBe(true);
    expect([q92.width, q92.height]).toEqual([16, 12]);
  });

  it('la estimación es estable para tablas estándar', () => {
    for (const q of [10, 35, 60, 75, 85, 100]) {
      expect(estimateJpegQuality(scaledLuminanceTable(q))).toEqual({ quality: q, exact: true });
    }
  });
});

describe('perfil de color', () => {
  it('reconoce sRGB en ASCII y en UTF-16', () => {
    expect(classifyIcc(new TextEncoder().encode('....desc sRGB IEC61966-2.1'))).toBe('srgb');
    const utf16 = new Uint8Array([0, 0x73, 0, 0x52, 0, 0x47, 0, 0x42]);
    expect(classifyIcc(utf16)).toBe('srgb');
    expect(classifyIcc(new TextEncoder().encode('Display P3'))).toBe('other');
  });
});
