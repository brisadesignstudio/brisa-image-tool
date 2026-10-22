/** Máximo de codificaciones por archivo al buscar la calidad que cabe en el peso. */
export const MAX_ATTEMPTS = 8;

export interface QualityResult<T> {
  value: T;
  quality: number;
  attempts: number;
  /** false si ni con la calidad mínima cabe en el peso máximo. */
  fits: boolean;
}

/**
 * La mayor calidad, entre `floor` y `top`, cuyo archivo no pasa de `maxBytes`.
 * Primero prueba `top` (si cabe, no hay nada que buscar), luego `floor` (si no cabe,
 * se entrega ese, el más ligero permitido) y entre ambas busca por bisección.
 * Siempre devuelve un archivo realmente codificado y medido.
 */
export async function searchQuality<T extends { byteLength: number }>(
  top: number,
  floor: number,
  maxBytes: number,
  encode: (quality: number) => Promise<T>,
): Promise<QualityResult<T>> {
  const first = await encode(top);
  if (first.byteLength <= maxBytes) return { value: first, quality: top, attempts: 1, fits: true };
  const lowest = Math.min(floor, top);
  if (lowest === top) return { value: first, quality: top, attempts: 1, fits: false };
  const low = await encode(lowest);
  if (low.byteLength > maxBytes) return { value: low, quality: lowest, attempts: 2, fits: false };
  // `lo` siempre cabe y `hi` nunca: se acota hasta que son vecinas o se agotan los intentos.
  let lo = lowest;
  let best = low;
  let hi = top;
  let attempts = 2;
  while (hi - lo > 1 && attempts < MAX_ATTEMPTS) {
    const mid = Math.floor((lo + hi) / 2);
    const value = await encode(mid);
    attempts += 1;
    if (value.byteLength <= maxBytes) {
      lo = mid;
      best = value;
    } else {
      hi = mid;
    }
  }
  return { value: best, quality: lo, attempts, fits: true };
}
