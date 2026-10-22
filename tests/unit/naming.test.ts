import { describe, expect, it } from 'vitest';
import {
  UniquePaths,
  folderFor,
  renderPattern,
  safeFileName,
  slugify,
  stripExtension,
} from '../../src/lib/naming';

const tokens = { nombre: 'Ritual Matcha Ñ', salida: 'ig-4x5', ancho: 1080, alto: 1350, n: 3 };

describe('nombres', () => {
  it('normaliza para web: minúsculas, sin acentos ni espacios', () => {
    expect(slugify('Ritual Matcha Ñ (final)')).toBe('ritual-matcha-n-final');
    expect(slugify('  ---  ')).toBe('');
  });

  it('aplica el patrón con todas las variables', () => {
    expect(renderPattern('{nombre}-{version}', tokens, true)).toBe('ritual-matcha-n-ig-4x5');
    // Patrones guardados con la etiqueta anterior o con tilde siguen funcionando.
    expect(renderPattern('{nombre}-{salida}', tokens, true)).toBe('ritual-matcha-n-ig-4x5');
    expect(renderPattern('{versión}_{n}', tokens, true)).toBe('ig-4x5-03');
    expect(renderPattern('{n}_{nombre}_{ancho}x{alto}', tokens, true)).toBe('03-ritual-matcha-n-1080x1350');
  });

  it('sin normalizar respeta el nombre pero quita caracteres prohibidos', () => {
    expect(renderPattern('{nombre}: {salida}?', tokens, false)).toBe('Ritual Matcha Ñ- ig-4x5-');
    expect(safeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
  });

  it('nunca deja un nombre vacío', () => {
    expect(renderPattern('', { ...tokens, nombre: '' }, true)).toBe('ig-4x5');
    expect(renderPattern('{nombre}', { ...tokens, nombre: '###' }, true)).toBe('imagen');
  });

  it('carpetas por salida, por imagen o ninguna', () => {
    expect(folderFor('salida', 'IG 4x5', 'Foto', true)).toBe('ig-4x5');
    expect(folderFor('imagen', 'IG 4x5', 'Foto Uno', true)).toBe('foto-uno');
    expect(folderFor('ninguna', 'IG 4x5', 'Foto', true)).toBe('');
  });

  it('evita que dos archivos se pisen', () => {
    const unique = new UniquePaths();
    expect(unique.claim('zip/web/foto.jpg')).toBe('zip/web/foto.jpg');
    expect(unique.claim('zip/web/foto.jpg')).toBe('zip/web/foto-2.jpg');
    expect(unique.claim('zip/web/FOTO.jpg')).toBe('zip/web/FOTO-3.jpg');
  });

  it('quita la extensión', () => {
    expect(stripExtension('logo.final.png')).toBe('logo.final');
    expect(stripExtension('.oculto')).toBe('.oculto');
  });
});
