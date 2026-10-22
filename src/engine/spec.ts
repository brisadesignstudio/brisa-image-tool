import { computeLayout, effectiveMode, type Layout } from '../lib/geometry';
import { colorName, formatBytes, formatDimensions, resolveFormat } from '../lib/format';
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
  const lossy = !lossless;
  // El peso máximo cambia la calidad de los formatos con pérdida; en los sin pérdida solo
  // decide el aviso (el worker reutiliza el archivo ya codificado).
  const limit = recipe.maxBytes === null ? 'sin-limite' : [recipe.maxBytes, lossy ? recipe.minQuality : null];
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
    limit,
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
      maxBytes: recipe.maxBytes,
      minQuality: recipe.minQuality,
    },
  };
}

/**
 * Avisos en lenguaje claro para una copia, con lo que se puede hacer.
 * Primero lo que cambia el resultado; después la información.
 */
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
  if (output && recipe.maxBytes !== null && output.size > recipe.maxBytes) {
    const over = `Supera el peso máximo: ${formatBytes(output.size)} (máximo ${formatBytes(recipe.maxBytes)})`;
    let advice: string;
    if (!spec.lossless) {
      const floor = Math.min(recipe.minQuality, recipe.quality);
      advice = `, incluso con la calidad mínima (${floor}). Para cumplirlo, ${spec.format === 'jpeg' ? 'reduce las medidas, baja la calidad mínima o prueba WebP' : 'reduce las medidas o baja la calidad mínima'}.`;
    } else if (spec.format === 'png') {
      advice = `. PNG guarda sin pérdida y su peso no baja con la calidad: para cumplirlo, reduce las medidas o elige ${info.hasAlpha ? 'WebP con pérdida, que conserva la transparencia' : 'JPG o WebP con pérdida'}.`;
    } else {
      advice = '. Con compresión sin pérdida el peso no baja con la calidad: para cumplirlo, reduce las medidas o usa WebP con pérdida.';
    }
    warnings.push({ code: 'over-limit', message: over + advice });
  }
  if (layout.limited) {
    const asked = formatDimensions(recipe.width as number, recipe.height as number);
    if (mode === 'crop') {
      // ¿Se puede agrandar el encuadre? Solo si aún no ocupa todo lo que permite la proporción.
      const aspect = (recipe.width as number) / (recipe.height as number);
      const roomy = layout.sw < Math.min(info.width, info.height * aspect) - 1;
      warnings.push({
        code: 'limited',
        message: `El encuadre mide ${formatDimensions(layout.iw, layout.ih)} px en la original, menos que ${asked}: se entrega a ese tamaño, sin ampliar. Para la medida exacta, ${roomy ? 'agranda el encuadre o ' : ''}usa una original más grande.`,
      });
    } else {
      warnings.push({
        code: 'limited',
        message: `La original (${formatDimensions(info.width, info.height)} px) es menor que la medida pedida: se entrega a su tamaño real, sin ampliar, para no perder nitidez.`,
      });
    }
  }
  if (spec.format === 'jpeg' && info.hasAlpha) {
    const background = spec.background === 'transparent' ? '#ffffff' : spec.background;
    warnings.push({
      code: 'flattened',
      message: `JPG no admite transparencia: las zonas transparentes se rellenan de ${colorName(background)}. Elige PNG o WebP para conservarla.`,
    });
  }
  if (output && !output.keptOriginal && output.size > image.size) {
    warnings.push({
      code: 'heavier',
      message: spec.lossless
        ? 'Esta copia pesa más que la original: la compresión sin pérdida ocupa más con fotografías. Para aligerarla, elige JPG o WebP con pérdida.'
        : 'Esta copia pesa más que la original. Para aligerarla, baja la calidad.',
    });
  }
  if (info.animated) {
    warnings.push({ code: 'animated', message: 'Es una imagen animada: solo se usa el primer fotograma.' });
  }
  if (layout.smallerInPad) {
    warnings.push({
      code: 'smaller-in-pad',
      message: `La original es menor que el hueco: se coloca a su tamaño real (${formatDimensions(layout.iw, layout.ih)} px), sin ampliar, y el lienzo mantiene ${formatDimensions(layout.cw, layout.ch)} px.`,
    });
  }
  if (output?.keptOriginal) {
    warnings.push({
      code: 'kept-original',
      message: spec.lossless
        ? 'Se entrega la original intacta: recomprimirla no la hacía más ligera.'
        : 'Se entrega la original intacta: recomprimirla con esta calidad no la hacía más ligera. Si necesitas que pese menos, baja la calidad.',
    });
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
