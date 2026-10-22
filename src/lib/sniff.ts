import { unzlibSync } from 'fflate';
import type { IccKind, SourceFormat } from './types';

/**
 * Lectura de cabeceras: qué formato es de verdad (no se fía de la extensión),
 * si tiene transparencia o animación, qué perfil de color trae y, en JPG,
 * la calidad aproximada con la que se guardó.
 */
export interface Inspection {
  format: SourceFormat;
  width: number | null;
  height: number | null;
  /** Puede tener transparencia según la cabecera (se confirma al leer los píxeles). */
  alphaPossible: boolean;
  animated: boolean;
  icc: IccKind;
  /** PNG/WebP con metadatos EXIF (pueden traer orientación). */
  exif: boolean;
  webpLossless: boolean | null;
  jpegQuality: number | null;
  jpegQualityExact: boolean;
}

export function sniffFormat(b: Uint8Array): SourceFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return 'png';
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  return null;
}

export function inspect(bytes: Uint8Array): Inspection | null {
  const format = sniffFormat(bytes);
  if (format === 'png') return inspectPng(bytes);
  if (format === 'webp') return inspectWebp(bytes);
  if (format === 'jpeg') return inspectJpeg(bytes);
  return null;
}

function ascii(b: Uint8Array, offset: number, length: number): string {
  let s = '';
  for (let i = 0; i < length && offset + i < b.length; i++) s += String.fromCharCode(b[offset + i]);
  return s;
}

const u32be = (b: Uint8Array, o: number) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u32le = (b: Uint8Array, o: number) =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);

/** ¿El perfil ICC es sRGB? Busca «sRGB» en la descripción (ASCII o UTF-16). */
export function classifyIcc(profile: Uint8Array): IccKind {
  const needle = [0x73, 0x52, 0x47, 0x42]; // sRGB
  outer: for (let i = 0; i + 4 <= profile.length; i++) {
    for (let j = 0; j < 4; j++) if (profile[i + j] !== needle[j]) continue outer;
    return 'srgb';
  }
  outer16: for (let i = 0; i + 8 <= profile.length; i++) {
    for (let j = 0; j < 4; j++) {
      if (profile[i + j * 2] !== 0 || profile[i + j * 2 + 1] !== needle[j]) continue outer16;
    }
    return 'srgb';
  }
  return 'other';
}

function inspectPng(b: Uint8Array): Inspection {
  const info: Inspection = {
    format: 'png',
    width: null,
    height: null,
    alphaPossible: false,
    animated: false,
    icc: 'none',
    exif: false,
    webpLossless: null,
    jpegQuality: null,
    jpegQualityExact: false,
  };
  let o = 8;
  while (o + 8 <= b.length) {
    const length = u32be(b, o);
    const type = ascii(b, o + 4, 4);
    const data = o + 8;
    if (data + length > b.length) break;
    if (type === 'IHDR') {
      info.width = u32be(b, data);
      info.height = u32be(b, data + 4);
      const colorType = b[data + 9];
      info.alphaPossible = colorType === 4 || colorType === 6;
    } else if (type === 'tRNS') {
      info.alphaPossible = true;
    } else if (type === 'acTL') {
      info.animated = true;
    } else if (type === 'eXIf') {
      info.exif = true;
    } else if (type === 'sRGB') {
      info.icc = 'srgb';
    } else if (type === 'iCCP') {
      let p = data;
      while (p < data + length && b[p] !== 0) p++;
      try {
        const profile = unzlibSync(b.subarray(p + 2, data + length));
        info.icc = classifyIcc(profile);
      } catch {
        info.icc = 'other';
      }
    } else if (type === 'IDAT' || type === 'IEND') {
      break;
    }
    o = data + length + 4;
  }
  return info;
}

function inspectWebp(b: Uint8Array): Inspection {
  const info: Inspection = {
    format: 'webp',
    width: null,
    height: null,
    alphaPossible: false,
    animated: false,
    icc: 'none',
    exif: false,
    webpLossless: null,
    jpegQuality: null,
    jpegQualityExact: false,
  };
  const end = Math.min(b.length, 8 + u32le(b, 4));
  const walk = (start: number, stop: number) => {
    let o = start;
    while (o + 8 <= stop) {
      const type = ascii(b, o, 4);
      const size = u32le(b, o + 4);
      const data = o + 8;
      if (type === 'VP8X' && size >= 10) {
        const flags = b[data];
        info.alphaPossible = info.alphaPossible || (flags & 0x10) !== 0;
        info.animated = (flags & 0x02) !== 0;
        info.exif = (flags & 0x08) !== 0;
        if (flags & 0x20 && info.icc === 'none') info.icc = 'other';
        info.width = u24le(b, data + 4) + 1;
        info.height = u24le(b, data + 7) + 1;
      } else if (type === 'ICCP') {
        info.icc = classifyIcc(b.subarray(data, Math.min(stop, data + size)));
      } else if (type === 'ALPH') {
        info.alphaPossible = true;
      } else if (type === 'VP8L' && info.webpLossless === null) {
        info.webpLossless = true;
        if (b[data] === 0x2f) {
          const bits = u32le(b, data + 1);
          info.width ??= (bits & 0x3fff) + 1;
          info.height ??= ((bits >>> 14) & 0x3fff) + 1;
          if ((bits >>> 28) & 1) info.alphaPossible = true;
        }
      } else if (type === 'VP8 ' && info.webpLossless === null) {
        info.webpLossless = false;
        info.width ??= u16le(b, data + 6) & 0x3fff;
        info.height ??= u16le(b, data + 8) & 0x3fff;
      } else if (type === 'ANMF') {
        // Primer fotograma: cabecera de 16 bytes y después sus propios bloques.
        walk(data + 16, Math.min(stop, data + size));
      }
      o = data + size + (size & 1);
    }
  };
  walk(12, end);
  return info;
}


/** Orden zigzag → orden natural (tabla de libjpeg). */
const NATURAL_ORDER = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20,
  13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52,
  45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
];

/** Tabla de luminancia estándar (anexo K de JPEG), orden natural. */
const STD_LUMINANCE = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113,
  92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];

/** Tabla estándar escalada a una calidad (como hace libjpeg). */
export function scaledLuminanceTable(quality: number): number[] {
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  const scale = q < 50 ? Math.floor(5000 / q) : 200 - q * 2;
  return STD_LUMINANCE.map((v) => Math.min(255, Math.max(1, Math.floor((v * scale + 50) / 100))));
}

/**
 * Calidad aproximada en la escala de libjpeg (1–100) a partir de la tabla de
 * luminancia en orden natural. exact = coincide con una tabla estándar.
 */
export function estimateJpegQuality(table: number[]): { quality: number; exact: boolean } {
  let best = 1;
  let bestError = Infinity;
  for (let q = 1; q <= 100; q++) {
    const ref = scaledLuminanceTable(q);
    let error = 0;
    for (let i = 0; i < 64; i++) error += Math.abs(ref[i] - table[i]);
    if (error < bestError) {
      bestError = error;
      best = q;
    }
  }
  return { quality: best, exact: bestError === 0 };
}

function inspectJpeg(b: Uint8Array): Inspection {
  const info: Inspection = {
    format: 'jpeg',
    width: null,
    height: null,
    alphaPossible: false,
    animated: false,
    icc: 'none',
    exif: false,
    webpLossless: null,
    jpegQuality: null,
    jpegQualityExact: false,
  };
  const iccChunks: Uint8Array[] = [];
  let luminance: number[] | null = null;
  let o = 2;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) {
      o++;
      continue;
    }
    const marker = b[o + 1];
    if (marker === 0xff) {
      o++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      o += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = u16be(b, o + 2);
    const data = o + 4;
    const end = o + 2 + length;
    if (length < 2 || end > b.length) break;
    if (marker === 0xe1 && ascii(b, data, 4) === 'Exif') {
      info.exif = true;
    } else if (marker === 0xe2 && ascii(b, data, 12) === 'ICC_PROFILE\0') {
      iccChunks.push(b.subarray(data + 14, end));
    } else if (marker === 0xdb) {
      let p = data;
      while (p < end) {
        const precision = b[p] >> 4;
        const id = b[p] & 0x0f;
        p++;
        const values: number[] = new Array(64);
        for (let i = 0; i < 64; i++) {
          values[NATURAL_ORDER[i]] = precision ? u16be(b, p + i * 2) : b[p + i];
        }
        p += precision ? 128 : 64;
        if (id === 0 && !luminance) luminance = values;
      }
    } else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      info.height = u16be(b, data + 1);
      info.width = u16be(b, data + 3);
    }
    o = end;
  }
  if (iccChunks.length) {
    const total = iccChunks.reduce((n, c) => n + c.length, 0);
    const profile = new Uint8Array(total);
    let p = 0;
    for (const c of iccChunks) {
      profile.set(c, p);
      p += c.length;
    }
    info.icc = classifyIcc(profile);
  }
  if (luminance) {
    const { quality, exact } = estimateJpegQuality(luminance);
    info.jpegQuality = quality;
    info.jpegQualityExact = exact;
  }
  return info;
}
