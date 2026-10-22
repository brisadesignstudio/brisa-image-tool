import { itemKey, useStore } from '../state/store';
import { openEditor, retryItem, setIncluded } from '../state/actions';
import { outputFileName } from '../state/export';
import {
  FORMAT_LABEL,
  describeOutputQuality,
  formatBytes,
  formatDelta,
  formatDimensions,
  resolveFormat,
} from '../lib/format';
import { describeSize } from '../lib/geometry';
import { buildSpec, isLossless } from '../engine/spec';
import type { Recipe, RenderWarning, SourceImage } from '../lib/types';
import { Icon } from './Icon';

const INFO_CODES = new Set(['kept-original', 'smaller-in-pad', 'color']);

export function Notes({ warnings, limit }: { warnings: RenderWarning[]; limit?: number }) {
  if (warnings.length === 0) return null;
  const shown = limit ? warnings.slice(0, limit) : warnings;
  return (
    <ul className="notes">
      {shown.map((w) => {
        const info = INFO_CODES.has(w.code);
        return (
          <li key={w.code} className={`note${info ? ' note--info' : ''}`}>
            <Icon name={info ? 'info' : 'warning'} />
            <span>{w.message}</span>
          </li>
        );
      })}
      {limit && warnings.length > limit && (
        <li className="note note--info">
          <Icon name="info" />
          <span>
            {warnings.length - limit} {warnings.length - limit === 1 ? 'aviso más' : 'avisos más'} en
            «Ajustar».
          </span>
        </li>
      )}
    </ul>
  );
}

export function OutputCard({ image, recipe, index }: { image: SourceImage; recipe: Recipe; index: number }) {
  const key = itemKey(image.id, recipe.id);
  const result = useStore((s) => s.results[key]);
  const crop = useStore((s) => s.crops[key]);
  const excluded = useStore((s) => Boolean(s.excluded[key]));
  const previewBg = useStore((s) => s.previewBg);
  const naming = useStore((s) => s.naming);
  const info = image.info;
  if (!info) return null;

  const format = resolveFormat(recipe.format, info.format);
  const lossless = isLossless(recipe, info, format);
  // Solo vale el resultado de los ajustes actuales: mientras se prepara otro, no se da por bueno.
  const current = Boolean(result && result.key === buildSpec(image, recipe, crop)?.key);
  const pending = !result || !current || result.status === 'queued' || result.status === 'working';
  const size = pending ? undefined : result?.size;
  const over = recipe.maxBytes !== null && size !== undefined && size > recipe.maxBytes;
  const adjusted =
    !pending && typeof result?.quality === 'number' && result.quality < recipe.quality ? result.quality : null;
  const fileName =
    result?.format && result.width ? outputFileName(naming, image, recipe, index, result) : null;
  const edit = () => openEditor(image.id, recipe.id);

  return (
    <article className="card" data-excluded={excluded} data-testid="output-card" aria-label={recipe.name}>
      {/* La vista previa abre el editor con el ratón; con teclado se usa «Ajustar». */}
      <div className={`card__view bg-${previewBg}`} data-stale={pending && Boolean(result?.url)} onClick={edit}>
        {result?.url && <img src={result.url} alt={`Vista previa de ${recipe.name}`} />}
        {pending && (
          <span className="status card__badge">
            <span className="spinner" />
            Preparando…
          </span>
        )}
        {result?.status === 'error' && (
          <span className="status status--error card__badge">
            <Icon name="warning" />
            No se pudo preparar
          </span>
        )}
        {excluded && (
          <span className="card__flag">
            <Icon name="close" />
            No se descargará
          </span>
        )}
      </div>
      <div className="card__body">
        <div>
          <h3 className="card__title display">{recipe.name}</h3>
          <p className="card__meta tabular">
            {result?.width && result.height
              ? `${formatDimensions(result.width, result.height)} px`
              : describeSize(recipe)}{' '}
            · {FORMAT_LABEL[format]} ·{' '}
            {!pending && result?.keptOriginal
              ? 'original sin recomprimir'
              : adjusted !== null
                ? `calidad ${adjusted}, ajustada al peso`
                : describeOutputQuality(format, recipe.quality, lossless)}
          </p>
        </div>
        <p className="weight tabular">
          <span className="visually-hidden">Peso de la original: </span>
          <span className="weight__before" title="Peso de la original">
            {formatBytes(image.size)}
          </span>
          <Icon name="arrow-right" />
          <span className="visually-hidden">; de la copia: </span>
          <span className="weight__after" title="Peso de la copia">
            {size !== undefined ? formatBytes(size) : 'calculando…'}
          </span>
          {size !== undefined && (
            <span className={`delta${size > image.size ? ' delta--up' : ''}`}>
              {formatDelta(image.size, size)}
            </span>
          )}
          {recipe.maxBytes !== null && size !== undefined && (
            <span className={`limit-pill${over ? ' limit-pill--over' : ''}`} data-testid="limite">
              {over ? <Icon name="warning" /> : <Icon name="check" />}
              {over ? 'Supera el peso máximo' : 'Dentro del máximo'} ({formatBytes(recipe.maxBytes)})
            </span>
          )}
        </p>
        {result?.status === 'error' && (
          <ul className="notes">
            <li className="note">
              <Icon name="warning" />
              <span>
                {result.error}{' '}
                <button type="button" className="link-btn" onClick={() => retryItem(image.id, recipe.id)}>
                  Reintentar
                </button>
              </span>
            </li>
          </ul>
        )}
        {result && <Notes warnings={pending ? result.warnings.filter((w) => w.code !== 'over-limit') : result.warnings} limit={2} />}
        {fileName && (
          <p className="filename" title="Nombre del archivo dentro del ZIP">
            {fileName}
          </p>
        )}
        <div className="card__foot">
          <button
            type="button"
            className="btn btn--secondary btn--small"
            onClick={edit}
            aria-label={`Ajustar ${recipe.name}`}
          >
            <Icon name="sliders" />
            Ajustar
          </button>
          <label className="switch">
            <input
              type="checkbox"
              checked={!excluded}
              onChange={(event) => setIncluded(image.id, recipe.id, event.target.checked)}
            />
            Incluir en la descarga
          </label>
        </div>
      </div>
    </article>
  );
}
