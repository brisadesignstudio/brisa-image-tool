import type { OutputFormat, SourceFormat, SourceInfo } from './types';

const NUMBER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const INTEGER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

/** 1 234 567 → «1,2 MB». Base 1000, como Finder y la mayoría de webs. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${INTEGER.format(bytes)} B`;
  if (bytes < 1000 * 1000) return `${INTEGER.format(bytes / 1000)} KB`;
  return `${NUMBER.format(bytes / (1000 * 1000))} MB`;
}

/** Variación de peso: −72 % / +5 %. */
export function formatDelta(before: number, after: number): string {
  if (!before) return '';
  const change = Math.round(((after - before) / before) * 100);
  if (change === 0) return '0 %';
  return `${change > 0 ? '+' : '−'}${Math.abs(change)} %`;
}

export function formatDimensions(width: number, height: number): string {
  return `${INTEGER.format(width)} × ${INTEGER.format(height)}`;
}

export const FORMAT_LABEL: Record<SourceFormat, string> = {
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WebP',
};

export const MIME: Record<SourceFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function resolveFormat(format: OutputFormat, source: SourceFormat): SourceFormat {
  return format === 'original' ? source : format;
}

export function supportsAlpha(format: SourceFormat): boolean {
  return format !== 'jpeg';
}

/** Calidad de la original, en palabras. */
export function describeSourceQuality(info: SourceInfo): string {
  if (info.format === 'png') return 'sin pérdida';
  if (info.format === 'webp') {
    if (info.webpLossless === true) return 'sin pérdida';
    return 'con compresión';
  }
  if (info.jpegQuality === null) return 'calidad desconocida';
  return info.jpegQualityExact ? `calidad ${info.jpegQuality}` : `calidad ≈ ${info.jpegQuality}`;
}

/** Calidad de la copia, en palabras. */
export function describeOutputQuality(format: SourceFormat, quality: number, lossless: boolean): string {
  if (format === 'png') return 'sin pérdida';
  if (format === 'webp' && lossless) return 'sin pérdida';
  return `calidad ${quality}`;
}
