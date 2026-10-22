import type { CropRect, FitMode, RecipeSettings } from './types';

type Geometry = Pick<RecipeSettings, 'mode' | 'width' | 'height' | 'margin'>;

/** Cómo se coloca la original dentro de la salida. Todo en píxeles enteros. */
export interface Layout {
  /** Región de la original que se usa. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Tamaño al que se lleva esa región. Nunca mayor que la región (no se amplía). */
  iw: number;
  ih: number;
  /** Lienzo final. */
  cw: number;
  ch: number;
  /** Posición de la imagen en el lienzo. */
  ox: number;
  oy: number;
  /** La medida pedida necesitaba ampliar la imagen: se entrega a su resolución real. */
  limited: boolean;
  /** Modo márgenes: la imagen queda más pequeña que el hueco porque no se amplía. */
  smallerInPad: boolean;
  /** Ningún cambio geométrico respecto a la original. */
  identity: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Recortar y márgenes necesitan ancho y alto; si falta alguno se mantiene la proporción. */
export function effectiveMode(g: Geometry): FitMode {
  return g.mode !== 'fit' && g.width && g.height ? g.mode : 'fit';
}

/** El recorte más grande posible con esa proporción, centrado. */
export function defaultCrop(srcW: number, srcH: number, aspect: number): CropRect {
  if (srcW / srcH > aspect) {
    const w = (srcH * aspect) / srcW;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = srcW / aspect / srcH;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

/** Corrige un recorte guardado para que tenga la proporción exacta y quepa en la imagen. */
export function fitCrop(
  crop: CropRect | undefined,
  srcW: number,
  srcH: number,
  aspect: number,
): CropRect {
  const full = defaultCrop(srcW, srcH, aspect);
  if (!crop || ![crop.x, crop.y, crop.w, crop.h].every(Number.isFinite) || crop.w <= 0) return full;
  const minW = Math.min(full.w, Math.max(8 / srcW, (8 * aspect) / srcW));
  let w = clamp(crop.w, minW, full.w);
  let h = (w * srcW) / aspect / srcH;
  if (h > full.h) {
    h = full.h;
    w = (h * srcH * aspect) / srcW;
  }
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  return {
    x: clamp(cx - w / 2, 0, 1 - w),
    y: clamp(cy - h / 2, 0, 1 - h),
    w,
    h,
  };
}

export function computeLayout(srcW: number, srcH: number, g: Geometry, crop?: CropRect): Layout {
  const mode = effectiveMode(g);

  if (mode === 'crop') {
    const W = g.width as number;
    const H = g.height as number;
    const c = fitCrop(crop, srcW, srcH, W / H);
    const sx = clamp(Math.round(c.x * srcW), 0, srcW - 1);
    const sy = clamp(Math.round(c.y * srcH), 0, srcH - 1);
    const sw = clamp(Math.round(c.w * srcW), 1, srcW - sx);
    const sh = clamp(Math.round(c.h * srcH), 1, srcH - sy);
    // Se admite medio píxel de redondeo; más allá habría que ampliar y no se hace.
    const reachable = c.w * srcW + 0.5 >= W && c.h * srcH + 0.5 >= H;
    const iw = reachable ? W : sw;
    const ih = reachable ? H : sh;
    return {
      sx,
      sy,
      sw,
      sh,
      iw,
      ih,
      cw: iw,
      ch: ih,
      ox: 0,
      oy: 0,
      limited: !reachable,
      smallerInPad: false,
      identity: sx === 0 && sy === 0 && sw === srcW && sh === srcH && iw === srcW && ih === srcH,
    };
  }

  if (mode === 'pad') {
    const W = g.width as number;
    const H = g.height as number;
    const m = Math.round((Math.min(W, H) * clamp(g.margin, 0, 40)) / 100);
    const innerW = Math.max(1, W - 2 * m);
    const innerH = Math.max(1, H - 2 * m);
    const ratio = Math.min(innerW / srcW, innerH / srcH);
    const scale = Math.min(ratio, 1);
    const iw = Math.max(1, Math.round(srcW * scale));
    const ih = Math.max(1, Math.round(srcH * scale));
    return {
      sx: 0,
      sy: 0,
      sw: srcW,
      sh: srcH,
      iw,
      ih,
      cw: W,
      ch: H,
      ox: Math.round((W - iw) / 2),
      oy: Math.round((H - ih) / 2),
      limited: false,
      smallerInPad: ratio > 1 + 1e-9,
      identity: W === srcW && H === srcH && iw === srcW && ih === srcH,
    };
  }

  let ratio = 1;
  if (g.width && g.height) ratio = Math.min(g.width / srcW, g.height / srcH);
  else if (g.width) ratio = g.width / srcW;
  else if (g.height) ratio = g.height / srcH;
  const scale = Math.min(ratio, 1);
  const iw = Math.max(1, Math.round(srcW * scale));
  const ih = Math.max(1, Math.round(srcH * scale));
  return {
    sx: 0,
    sy: 0,
    sw: srcW,
    sh: srcH,
    iw,
    ih,
    cw: iw,
    ch: ih,
    ox: 0,
    oy: 0,
    limited: ratio > 1 + 1e-9,
    smallerInPad: false,
    identity: iw === srcW && ih === srcH,
  };
}

/** Texto corto para la medida de una salida. */
export function describeSize(g: Geometry): string {
  const mode = effectiveMode(g);
  if (mode !== 'fit') return `${g.width} × ${g.height} px`;
  if (g.width && g.height) return `Hasta ${g.width} × ${g.height} px`;
  if (g.width) return `${g.width} px de ancho`;
  if (g.height) return `${g.height} px de alto`;
  return 'Tamaño original';
}

/** Proporción legible (4:5, 16:9…) o null si no es una proporción sencilla. */
export function ratioLabel(width: number, height: number): string | null {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  const a = width / d;
  const b = height / d;
  if (a <= 32 && b <= 32) return `${a}:${b}`;
  const known: Array<[number, string]> = [
    [1.91, '1,91:1'],
    [16 / 9, '16:9'],
    [9 / 16, '9:16'],
  ];
  const r = width / height;
  const hit = known.find(([value]) => Math.abs(value - r) < 0.01);
  return hit ? hit[1] : null;
}
