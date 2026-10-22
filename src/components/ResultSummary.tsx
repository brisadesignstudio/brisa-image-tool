import { itemKey, useStore } from '../state/store';
import {
  FORMAT_LABEL,
  colorName,
  describeSourceQuality,
  formatBytes,
  formatDelta,
  formatDimensions,
  supportsAlpha,
} from '../lib/format';
import { effectiveMode } from '../lib/geometry';
import { buildSpec } from '../engine/spec';
import type { Recipe, SourceImage } from '../lib/types';
import { Icon } from './Icon';

/**
 * Original frente a resultado para la imagen que se está viendo. Separa lo que pasa
 * con las medidas (recortar, reducir, márgenes) de cómo se comprime el archivo.
 */
export function ResultSummary({ image, recipe }: { image: SourceImage; recipe: Recipe }) {
  const key = itemKey(image.id, recipe.id);
  const result = useStore((s) => s.results[key]);
  const crop = useStore((s) => s.crops[key]);
  const info = image.info;
  const spec = buildSpec(image, recipe, crop);
  if (!info || !spec) return null;

  const { layout, format, lossless } = spec;
  const mode = effectiveMode(recipe);
  const done = result?.status === 'done' && result.key === spec.key;
  const kept = done && Boolean(result.keptOriginal);

  const geometry: string[] = [];
  if (mode === 'crop' && (layout.sw < info.width || layout.sh < info.height)) geometry.push('recortada');
  if (layout.iw < layout.sw || layout.ih < layout.sh) geometry.push('reducida');
  if (mode === 'pad' && (layout.iw < layout.cw || layout.ih < layout.ch)) geometry.push('con márgenes');
  const dimensions = geometry.length ? geometry.join(' y ') : 'mismas medidas';

  const used = done && typeof result.quality === 'number' ? result.quality : recipe.quality;
  const compression = kept
    ? 'original sin recomprimir'
    : lossless
      ? 'compresión sin pérdida'
      : used < recipe.quality
        ? `compresión con pérdida, calidad ${used} (ajustada al peso; máxima ${recipe.quality})`
        : `compresión con pérdida, calidad ${used}`;
  const limit = recipe.maxBytes;
  const over = done && limit !== null && result.size !== undefined && result.size > limit;

  let surface = '';
  if (format === 'jpeg' && (info.hasAlpha || (mode === 'pad' && spec.background === 'transparent'))) {
    surface = `fondo ${colorName(spec.background === 'transparent' ? '#ffffff' : spec.background)}`;
  } else if (mode === 'pad') {
    surface = `fondo ${colorName(spec.background)}`;
  } else if (supportsAlpha(format) && info.hasAlpha) {
    surface = 'con transparencia';
  }

  return (
    <div className="summary" data-testid="resumen">
      <div className="summary__col">
        <p className="summary__label eyebrow">Original</p>
        <p className="summary__main tabular">
          {FORMAT_LABEL[info.format]} · {formatDimensions(info.width, info.height)} px ·{' '}
          {formatBytes(image.size)}
        </p>
        <p className="summary__detail">
          {describeSourceQuality(info)}
          {info.hasAlpha ? ' · con transparencia' : ''}
        </p>
      </div>
      <Icon name="arrow-right" className="icon summary__arrow" />
      <div className="summary__col">
        <p className="summary__label eyebrow">Resultado</p>
        <p className="summary__main tabular">
          {FORMAT_LABEL[format]} · {formatDimensions(layout.cw, layout.ch)} px ·{' '}
          {done && result.size !== undefined ? (
            <>
              <strong data-testid="peso-copia">{formatBytes(result.size)}</strong>{' '}
              <span className={`delta${result.size > image.size ? ' delta--up' : ''}`}>
                {formatDelta(image.size, result.size)}
              </span>
              {limit !== null && (
                <>
                  {' '}
                  <span className={`limit-pill${over ? ' limit-pill--over' : ''}`} data-testid="limite-resumen">
                    {over ? <Icon name="warning" /> : <Icon name="check" />}
                    {over ? 'Supera el peso máximo' : 'Dentro del máximo'} ({formatBytes(limit)})
                  </span>
                </>
              )}
            </>
          ) : result?.status === 'error' ? (
            <span className="muted">no se pudo preparar</span>
          ) : (
            <span className="muted">calculando el peso…</span>
          )}
        </p>
        <p className="summary__detail">
          {dimensions} · {compression}
          {surface && ` · ${surface}`}
        </p>
      </div>
    </div>
  );
}
