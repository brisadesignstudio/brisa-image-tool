/// <reference lib="webworker" />
import { inspect, type Inspection } from '../lib/sniff';
import type { Layout } from '../lib/geometry';
import type { SourceFormat, SourceInfo } from '../lib/types';
import { MIME } from '../lib/format';
import { decodePng, decodeWebp, encodeJpeg, encodePng, encodeWebp, resizePixels } from './codecs';
import { FriendlyError, type AnalyzeResult, type RenderJob, type RenderOutput } from './protocol';

/**
 * Una imagen decodificada. Los PNG y WebP sin perfil de color especial se leen
 * con un decodificador exacto (píxeles idénticos al archivo); el resto lo lee
 * el navegador, que aplica la orientación EXIF y convierte el color a sRGB.
 */
type Decoded =
  | { kind: 'pixels'; width: number; height: number; pixels: ImageData }
  | { kind: 'bitmap'; width: number; height: number; bitmap: ImageBitmap };

function canDecodeExactly(insp: Inspection): boolean {
  return (
    (insp.format === 'png' || insp.format === 'webp') && !insp.animated && !insp.exif && insp.icc !== 'other'
  );
}

async function decodeWithBrowser(file: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
      colorSpaceConversion: 'default',
    });
    return { kind: 'bitmap', width: bitmap.width, height: bitmap.height, bitmap };
  } catch {
    throw new FriendlyError(
      'No se pudo leer esta imagen. Puede que esté dañada o que sea demasiado grande para el navegador.',
    );
  }
}

export async function decode(file: Blob, insp: Inspection, bytes?: Uint8Array<ArrayBuffer>): Promise<Decoded> {
  if (canDecodeExactly(insp)) {
    try {
      const data = bytes ?? new Uint8Array(await file.arrayBuffer());
      const pixels = insp.format === 'png' ? await decodePng(data) : await decodeWebp(data);
      return { kind: 'pixels', width: pixels.width, height: pixels.height, pixels };
    } catch {
      // Si el decodificador exacto no puede, lo intenta el navegador.
    }
  }
  return decodeWithBrowser(file);
}

function context2d(width: number, height: number) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new FriendlyError('El navegador no permite procesar imágenes en segundo plano.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

/** Copia una región de píxeles exactos (siempre en un búfer nuevo). */
function copyRegion(src: ImageData, sx: number, sy: number, sw: number, sh: number): ImageData {
  const out = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 0; y < sh; y++) {
    const start = ((sy + y) * src.width + sx) * 4;
    out.set(src.data.subarray(start, start + sw * 4), y * sw * 4);
  }
  return new ImageData(out, sw, sh);
}

type Drawable = ImageBitmap | OffscreenCanvas;

/**
 * Reduce a la mitad repetidamente (filtro de caja, sin aliasing) mientras la
 * imagen siga siendo más del doble de grande que el destino. Acelera mucho las
 * reducciones grandes; el ajuste final lo hace siempre Lanczos3.
 */
function halveTowards(
  source: Drawable,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  targetW: number,
  targetH: number,
): ImageData {
  let current: Drawable = source;
  let rect = { x: sx, y: sy, w: sw, h: sh };
  while (rect.w / 2 >= targetW * 2 && rect.h / 2 >= targetH * 2) {
    const w = Math.max(1, Math.round(rect.w / 2));
    const h = Math.max(1, Math.round(rect.h / 2));
    const { canvas, ctx } = context2d(w, h);
    ctx.drawImage(current, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
    current = canvas;
    rect = { x: 0, y: 0, w, h };
  }
  const { ctx } = context2d(rect.w, rect.h);
  ctx.drawImage(current, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  return ctx.getImageData(0, 0, rect.w, rect.h);
}

const HUGE = 40_000_000;

/** Región de la original llevada al tamaño final. Nunca amplía. */
export async function sampleRegion(decoded: Decoded, layout: Layout): Promise<ImageData> {
  const { sx, sy, sw, sh, iw, ih } = layout;
  const same = iw === sw && ih === sh;
  if (decoded.kind === 'pixels') {
    if (same) return copyRegion(decoded.pixels, sx, sy, sw, sh);
    if (sw * sh > HUGE && sw / iw > 2) {
      // Imagen enorme: pasa primero por reducciones a la mitad para no agotar la memoria.
      const bitmap = await createImageBitmap(decoded.pixels);
      try {
        const reduced = halveTowards(bitmap, sx, sy, sw, sh, iw, ih);
        return resizePixels(reduced, iw, ih);
      } finally {
        bitmap.close();
      }
    }
    return resizePixels(copyRegion(decoded.pixels, sx, sy, sw, sh), iw, ih);
  }
  const reduced = halveTowards(decoded.bitmap, sx, sy, sw, sh, iw, ih);
  if (reduced.width === iw && reduced.height === ih) return reduced;
  return resizePixels(reduced, iw, ih);
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hasTransparency(img: ImageData): boolean {
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) return true;
  return false;
}

/**
 * Coloca la imagen en el lienzo final. Con fondo de color (o en JPG, que no
 * admite transparencia) mezcla sobre ese color; si no, conserva el alfa tal cual.
 */
export function compose(
  img: ImageData,
  layout: Layout,
  background: string,
  flatten: boolean,
): { image: ImageData; flattened: boolean } {
  const { cw, ch, ox, oy } = layout;
  const opaqueBackground = background !== 'transparent' || flatten;
  const imageHasAlpha = hasTransparency(img);
  const sameCanvas = cw === img.width && ch === img.height;
  if (sameCanvas && (!opaqueBackground || !imageHasAlpha)) {
    return { image: img, flattened: false };
  }
  const out = new Uint8ClampedArray(cw * ch * 4);
  const [br, bg, bb] = opaqueBackground ? parseHex(background === 'transparent' ? '#ffffff' : background) : [0, 0, 0];
  if (opaqueBackground) {
    for (let i = 0; i < out.length; i += 4) {
      out[i] = br;
      out[i + 1] = bg;
      out[i + 2] = bb;
      out[i + 3] = 255;
    }
  }
  const s = img.data;
  for (let y = 0; y < img.height; y++) {
    const ty = y + oy;
    if (ty < 0 || ty >= ch) continue;
    for (let x = 0; x < img.width; x++) {
      const tx = x + ox;
      if (tx < 0 || tx >= cw) continue;
      const si = (y * img.width + x) * 4;
      const ti = (ty * cw + tx) * 4;
      const a = s[si + 3];
      if (!opaqueBackground || a === 255) {
        out[ti] = s[si];
        out[ti + 1] = s[si + 1];
        out[ti + 2] = s[si + 2];
        out[ti + 3] = opaqueBackground ? 255 : a;
      } else if (a > 0) {
        // Uint8ClampedArray redondea al entero más cercano.
        const ia = 255 - a;
        out[ti] = (s[si] * a + out[ti] * ia) / 255;
        out[ti + 1] = (s[si + 1] * a + out[ti + 1] * ia) / 255;
        out[ti + 2] = (s[si + 2] * a + out[ti + 2] * ia) / 255;
      }
    }
  }
  return { image: new ImageData(out, cw, ch), flattened: flatten && imageHasAlpha };
}

async function encode(img: ImageData, format: SourceFormat, quality: number, lossless: boolean) {
  if (format === 'jpeg') return encodeJpeg(img, quality);
  if (format === 'webp') return encodeWebp(img, quality, lossless);
  return encodePng(img);
}

export async function render(job: RenderJob, decoded: Decoded): Promise<{ output: RenderOutput; transfer: Transferable[] }> {
  const sampled = await sampleRegion(decoded, job.layout);
  const { image, flattened } = compose(sampled, job.layout, job.background, job.format === 'jpeg');
  const bytes = await encode(image, job.format, job.quality, job.lossless);

  const keptOriginal = job.keepOriginalIfNotSmaller && bytes.byteLength >= job.file.size;
  const blob = keptOriginal
    ? job.file.slice(0, job.file.size, MIME[job.format])
    : new Blob([bytes as Uint8Array<ArrayBuffer>], { type: MIME[job.format] });

  const output: RenderOutput = {
    blob,
    width: image.width,
    height: image.height,
    size: blob.size,
    keptOriginal,
    flattened,
  };
  const transfer: Transferable[] = [];
  if (job.includeRaw) {
    const data = image.data.buffer as ArrayBuffer;
    output.raw = { width: image.width, height: image.height, data };
    transfer.push(data);
  }
  return { output, transfer };
}

/** Lee la cabecera, comprueba que es JPG/PNG/WebP y decodifica. */
export async function open(file: Blob): Promise<{ insp: Inspection; decoded: Decoded }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const insp = inspect(bytes);
  if (!insp) throw new FriendlyError('Este archivo no es una imagen JPG, PNG ni WebP.');
  const decoded = await decode(file, insp, bytes);
  return { insp, decoded };
}

/** ¿Tiene algún píxel transparente? Se lee por franjas para no gastar memoria. */
function scanAlpha(decoded: Decoded): boolean {
  if (decoded.kind === 'pixels') return hasTransparency(decoded.pixels);
  const band = Math.max(1, Math.floor(4_000_000 / decoded.width));
  const { ctx } = context2d(decoded.width, band);
  for (let y = 0; y < decoded.height; y += band) {
    const h = Math.min(band, decoded.height - y);
    ctx.clearRect(0, 0, decoded.width, band);
    ctx.drawImage(decoded.bitmap, 0, y, decoded.width, h, 0, 0, decoded.width, h);
    const data = ctx.getImageData(0, 0, decoded.width, h).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return true;
  }
  return false;
}

async function snapshot(decoded: Decoded, maxSide: number, alpha: boolean) {
  const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const owned = decoded.kind === 'pixels';
  const source = decoded.kind === 'bitmap' ? decoded.bitmap : await createImageBitmap(decoded.pixels);
  try {
    const reduced = halveTowards(source, 0, 0, decoded.width, decoded.height, width, height);
    const { canvas, ctx } = context2d(width, height);
    const step = await createImageBitmap(reduced);
    ctx.drawImage(step, 0, 0, width, height);
    step.close();
    const blob = await canvas.convertToBlob(
      alpha ? { type: 'image/webp', quality: 0.92 } : { type: 'image/jpeg', quality: 0.88 },
    );
    return { blob, width, height };
  } finally {
    if (owned) source.close();
  }
}

export async function analyze(file: Blob): Promise<{ result: AnalyzeResult; decoded: Decoded }> {
  const { insp, decoded } = await open(file);
  const hasAlpha = insp.alphaPossible ? scanAlpha(decoded) : false;
  const info: SourceInfo = {
    format: insp.format,
    width: decoded.width,
    height: decoded.height,
    hasAlpha,
    animated: insp.animated,
    icc: insp.icc,
    jpegQuality: insp.jpegQuality,
    jpegQualityExact: insp.jpegQualityExact,
    webpLossless: insp.webpLossless,
    exactDecode: decoded.kind === 'pixels',
  };
  const thumb = await snapshot(decoded, 320, hasAlpha);
  const preview = await snapshot(decoded, 1600, hasAlpha);
  return {
    result: {
      info,
      thumb: thumb.blob,
      preview: preview.blob,
      previewWidth: preview.width,
      previewHeight: preview.height,
    },
    decoded,
  };
}

export function release(decoded: Decoded) {
  if (decoded.kind === 'bitmap') decoded.bitmap.close();
}

export type { Decoded };
