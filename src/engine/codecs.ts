/**
 * Códecs WebAssembly (Squoosh / jSquash). Cada uno se inicia la primera vez que
 * hace falta y carga su .wasm desde el propio sitio (o desde el mismo HTML en la
 * versión de archivo único): no hay ninguna petición a servidores externos.
 */
import initPng, { decode as wasmPngDecode } from '@jsquash/png/codec/pkg/squoosh_png.js';
import initOxipng, { optimise_raw } from '@jsquash/oxipng/codec/pkg/squoosh_oxipng.js';
import initResize, { resize as wasmResize } from '@jsquash/resize/lib/resize/pkg/squoosh_resize.js';
import mozjpegEncFactory from '@jsquash/jpeg/codec/enc/mozjpeg_enc.js';
import webpEncFactory from '@jsquash/webp/codec/enc/webp_enc.js';
import webpEncSimdFactory from '@jsquash/webp/codec/enc/webp_enc_simd.js';
import webpDecFactory from '@jsquash/webp/codec/dec/webp_dec.js';
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

const pngReady = once(() => initPng());
const oxipngReady = once(() => initOxipng());
const resizeReady = once(() => initResize());
const jpegEncoder = once((): Promise<MozJPEGModule> => mozjpegEncFactory({ noInitialRun: true }));
const webpEncoder = once(
  async (): Promise<WebPEncModule> => ((await simd()) ? webpEncSimdFactory : webpEncFactory)({ noInitialRun: true }),
);
const webpDecoder = once((): Promise<WebPDecModule> => webpDecFactory({ noInitialRun: true }));

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
