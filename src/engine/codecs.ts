/**
 * Códecs WebAssembly (Squoosh / jSquash). Se cargan solo cuando hacen falta y
 * siempre desde el propio sitio: no hay ninguna petición a servidores externos.
 */
import initPng, { decode as wasmPngDecode } from '@jsquash/png/codec/pkg/squoosh_png.js';
import pngWasmUrl from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm?url';
import initOxipng, { optimise_raw } from '@jsquash/oxipng/codec/pkg/squoosh_oxipng.js';
import oxipngWasmUrl from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url';
import initResize, { resize as wasmResize } from '@jsquash/resize/lib/resize/pkg/squoosh_resize.js';
import resizeWasmUrl from '@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm?url';
import mozjpegEncWasmUrl from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';
import webpEncWasmUrl from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import webpEncSimdWasmUrl from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url';
import webpDecWasmUrl from '@jsquash/webp/codec/dec/webp_dec.wasm?url';
import { simd } from 'wasm-feature-detect';
import type { MozJPEGModule } from '@jsquash/jpeg/codec/enc/mozjpeg_enc.js';
import type { WebPModule as WebPEncModule } from '@jsquash/webp/codec/enc/webp_enc.js';
import type { WebPModule as WebPDecModule } from '@jsquash/webp/codec/dec/webp_dec.js';

const once = <T>(factory: () => Promise<T>) => {
  let promise: Promise<T> | null = null;
  return () => (promise ??= factory().catch((error) => {
    promise = null;
    throw error;
  }));
};

const pngReady = once(() => initPng(pngWasmUrl));
const oxipngReady = once(() => initOxipng(oxipngWasmUrl));
const resizeReady = once(() => initResize(resizeWasmUrl));

const jpegEncoder = once(async (): Promise<MozJPEGModule> => {
  const { default: factory } = await import('@jsquash/jpeg/codec/enc/mozjpeg_enc.js');
  return factory({ noInitialRun: true, locateFile: () => mozjpegEncWasmUrl });
});

const webpEncoder = once(async (): Promise<WebPEncModule> => {
  if (await simd()) {
    const { default: factory } = await import('@jsquash/webp/codec/enc/webp_enc_simd.js');
    return factory({ noInitialRun: true, locateFile: () => webpEncSimdWasmUrl });
  }
  const { default: factory } = await import('@jsquash/webp/codec/enc/webp_enc.js');
  return factory({ noInitialRun: true, locateFile: () => webpEncWasmUrl });
});

const webpDecoder = once(async (): Promise<WebPDecModule> => {
  const { default: factory } = await import('@jsquash/webp/codec/dec/webp_dec.js');
  return factory({ noInitialRun: true, locateFile: () => webpDecWasmUrl });
});

/** PNG → píxeles RGBA exactos (sin premultiplicar ni gestión de color). */
export async function decodePng(bytes: Uint8Array<ArrayBuffer>): Promise<ImageData> {
  await pngReady();
  return wasmPngDecode(bytes);
}

/** WebP → píxeles RGBA exactos. */
export async function decodeWebp(bytes: Uint8Array<ArrayBuffer>): Promise<ImageData> {
  const module = await webpDecoder();
  const result = module.decode(bytes);
  if (!result) throw new Error('No se pudo leer el WebP');
  return result;
}

const LANCZOS3 = 3;

/**
 * Redimensionado Lanczos3 con alfa premultiplicado (sin halos en los bordes
 * transparentes) y en el mismo espacio de color que usan las apps de diseño.
 */
export async function resizePixels(src: ImageData, width: number, height: number): Promise<ImageData> {
  await resizeReady();
  const out = wasmResize(
    new Uint8Array(src.data.buffer, src.data.byteOffset, src.data.byteLength),
    src.width,
    src.height,
    width,
    height,
    LANCZOS3,
    true,
    false,
  );
  return new ImageData(
    new Uint8ClampedArray(out.buffer as ArrayBuffer, out.byteOffset, out.byteLength),
    width,
    height,
  );
}

export async function encodeJpeg(img: ImageData, quality: number): Promise<Uint8Array> {
  const module = await jpegEncoder();
  return module.encode(img.data, img.width, img.height, {
    quality,
    baseline: false,
    arithmetic: false,
    progressive: true,
    optimize_coding: true,
    smoothing: 0,
    color_space: 3,
    quant_table: 3,
    trellis_multipass: false,
    trellis_opt_zero: false,
    trellis_opt_table: false,
    trellis_loops: 1,
    auto_subsample: true,
    chroma_subsample: 2,
    separate_chroma_quality: false,
    chroma_quality: 75,
  });
}

export async function encodeWebp(img: ImageData, quality: number, lossless: boolean): Promise<Uint8Array> {
  const module = await webpEncoder();
  const result = module.encode(img.data, img.width, img.height, {
    quality: lossless ? 75 : quality,
    target_size: 0,
    target_PSNR: 0,
    method: 4,
    sns_strength: 50,
    filter_strength: 60,
    filter_sharpness: 0,
    filter_type: 1,
    partitions: 0,
    segments: 4,
    pass: 1,
    show_compressed: 0,
    preprocessing: 0,
    autofilter: 0,
    partition_limit: 0,
    alpha_compression: 1,
    alpha_filtering: 1,
    // La transparencia se guarda siempre sin pérdida.
    alpha_quality: 100,
    lossless: lossless ? 1 : 0,
    exact: 0,
    image_hint: 0,
    emulate_jpeg_size: 0,
    thread_level: 0,
    low_memory: 0,
    near_lossless: 100,
    use_delta_palette: 0,
    // Conversión de color más fiel en bordes de color saturado (logos, texto).
    use_sharp_yuv: lossless ? 0 : 1,
  });
  if (!result) throw new Error('No se pudo crear el WebP');
  return result;
}

/** PNG sin pérdida, optimizado con OxiPNG (mismos píxeles, menos peso). */
export async function encodePng(img: ImageData): Promise<Uint8Array> {
  await oxipngReady();
  return optimise_raw(img.data, img.width, img.height, 2, false, false);
}
