import { computeLayout, effectiveMode, type Layout } from '../lib/geometry';
import { formatDimensions, resolveFormat } from '../lib/format';
import type { CropRect, Recipe, RenderWarning, SourceFormat, SourceImage, SourceInfo } from '../lib/types';
import type { RenderJob, RenderOutput } from './protocol';

export interface RenderSpec {
  /** Cambia solo si cambia algo que afecta a los píxeles o al archivo. */
  key: string;
  layout: Layout;
  format: SourceFormat;
  lossless: boolean;
  background: string;
  job: Omit<RenderJob, 'includeRaw'>;
}

/** WebP sin pérdida si se pide, o si se mantiene el formato de un WebP que ya lo era. */
export function isLossless(recipe: Recipe, info: SourceInfo, format: SourceFormat): boolean {
  if (format === 'png') return true;
  if (format !== 'webp') return false;
  return recipe.lossless || (recipe.format === 'original' && info.webpLossless === true);
}

export function buildSpec(image: SourceImage, recipe: Recipe, crop: CropRect | undefined): RenderSpec | null {
  const info = image.info;
  if (!info) return null;
  const mode = effectiveMode(recipe);
  const layout = computeLayout(info.width, info.height, recipe, mode === 'crop' ? crop : undefined);
  const format = resolveFormat(recipe.format, info.format);
  const lossless = isLossless(recipe, info, format);
  // El fondo solo importa con márgenes o al pasar a JPG (que no admite transparencia).
  const background = mode === 'pad' || format === 'jpeg' ? recipe.background : 'transparent';
  const keepOriginalIfNotSmaller = layout.identity && format === info.format;
  const key = JSON.stringify([
    image.id,
    layout.sx,
    layout.sy,
    layout.sw,
    layout.sh,
    layout.iw,
    layout.ih,
    layout.cw,
    layout.ch,
    layout.ox,
    layout.oy,
    format,
    lossless ? 'sin-perdida' : recipe.quality,
    background,
    keepOriginalIfNotSmaller,
  ]);
  return {
    key,
    layout,
    format,
    lossless,
    background,
    job: {
      imageId: image.id,
      file: image.file,
      info,
      layout,
      format,
      quality: recipe.quality,
      lossless,
      background,
      keepOriginalIfNotSmaller,
    },
  };
}

function colorName(hex: string): string {
  const names: Record<string, string> = {
    '#ffffff': 'blanco',
    '#000000': 'negro',
    '#f6f0e8': 'crema',
    '#631028': 'vino',
  };
  return names[hex.toLowerCase()] ?? hex.toUpperCase();
}

/** Avisos en lenguaje claro para una copia. */
export function warningsFor(
  image: SourceImage,
  recipe: Recipe,
  spec: RenderSpec,
  output?: Pick<RenderOutput, 'keptOriginal' | 'flattened' | 'size'>,
): RenderWarning[] {
  const info = image.info as SourceInfo;
  const { layout } = spec;
  const warnings: RenderWarning[] = [];
  const mode = effectiveMode(recipe);
  if (layout.limited) {
    warnings.push({
      code: 'limited',
      message:
        mode === 'crop'
          ? `Para ${formatDimensions(recipe.width as number, recipe.height as number)} px habría que ampliar el recorte. Se entrega a ${formatDimensions(layout.iw, layout.ih)} px, su resolución real.`
          : `La original mide ${formatDimensions(info.width, info.height)} px. No se amplía para no perder nitidez.`,
    });
  }
  if (layout.smallerInPad) {
    warnings.push({
      code: 'smaller-in-pad',
      message: `La imagen se coloca a su tamaño real (${formatDimensions(layout.iw, layout.ih)} px): no se amplía para no perder nitidez.`,
    });
  }
  if (spec.format === 'jpeg' && info.hasAlpha) {
    const background = spec.background === 'transparent' ? '#ffffff' : spec.background;
    warnings.push({
      code: 'flattened',
      message: `JPG no admite transparencia: las zonas transparentes se rellenan de ${colorName(background)}. Elige PNG o WebP para conservarla.`,
    });
  }
  if (output?.keptOriginal) {
    warnings.push({
      code: 'kept-original',
      message: 'Se entrega el archivo original intacto: comprimirlo de nuevo no lo hacía más ligero.',
    });
  } else if (output && output.size > image.size) {
    warnings.push({ code: 'heavier', message: 'Esta copia pesa más que la original.' });
  }
  if (info.animated) {
    warnings.push({ code: 'animated', message: 'Es una imagen animada: solo se usa el primer fotograma.' });
  }
  if (info.icc === 'other') {
    warnings.push({
      code: 'color',
      message:
        'Tenía un perfil de color amplio (como Display P3 o Adobe RGB). La copia se guarda en sRGB, el estándar de web y redes; los colores muy saturados pueden suavizarse un poco.',
    });
  }
  return warnings;
}
