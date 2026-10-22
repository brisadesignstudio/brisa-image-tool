import type { Layout } from '../lib/geometry';
import type { SourceFormat, SourceInfo } from '../lib/types';

export interface AnalyzeResult {
  info: SourceInfo;
  thumb: Blob;
  preview: Blob;
  previewWidth: number;
  previewHeight: number;
}

export interface RenderJob {
  imageId: string;
  file: Blob;
  info: SourceInfo;
  layout: Layout;
  format: SourceFormat;
  quality: number;
  lossless: boolean;
  /** 'transparent' o #rrggbb */
  background: string;
  /** Misma geometría y formato: si la copia no pesa menos, se entrega el archivo original. */
  keepOriginalIfNotSmaller: boolean;
  /** Devuelve también los píxeles sin comprimir (para comparar antes/después). */
  includeRaw: boolean;
}

export interface RenderOutput {
  blob: Blob;
  width: number;
  height: number;
  size: number;
  keptOriginal: boolean;
  flattened: boolean;
  raw?: { width: number; height: number; data: ArrayBuffer };
}

export interface ZipEntry {
  path: string;
  blob: Blob;
}

export type WorkerRequest =
  | { id: number; type: 'analyze'; imageId: string; file: Blob }
  | { id: number; type: 'render'; job: RenderJob }
  | { id: number; type: 'zip'; entries: ZipEntry[] }
  | { id: number; type: 'forget'; imageId: string };

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

/** Errores con un mensaje pensado para mostrarse tal cual. */
export class FriendlyError extends Error {
  readonly friendly = true;
}
