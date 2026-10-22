import { useEffect, useRef, useState } from 'react';
import { itemKey, useStore } from '../state/store';
import { resetCrop, saveRecipeAsPreset, updateRecipe } from '../state/actions';
import {
  FORMAT_LABEL,
  describeOutputQuality,
  describeSourceQuality,
  formatBytes,
  formatDelta,
  formatDimensions,
  resolveFormat,
  supportsAlpha,
} from '../lib/format';
import { MAX_SIDE } from '../lib/presets';
import { computeLayout, effectiveMode } from '../lib/geometry';
import { buildSpec, isLossless } from '../engine/spec';
import type { FitMode, OutputFormat, Recipe, RecipeSettings, SourceImage } from '../lib/types';
import { Notes } from './OutputCard';
import { Icon } from './Icon';

function NumberField({
  label,
  value,
  allowEmpty,
  onCommit,
}: {
  label: string;
  value: number | null;
  allowEmpty: boolean;
  onCommit: (value: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => setText(value === null ? '' : String(value)), [value]);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (allowEmpty) {
        if (value !== null) onCommit(null);
      } else {
        setText(value === null ? '' : String(value));
      }
      return;
    }
    const n = Math.min(MAX_SIDE, Math.round(Number(trimmed)));
    if (!Number.isFinite(n) || n < 1) {
      setText(value === null ? '' : String(value));
      return;
    }
    if (n !== value) onCommit(n);
  };

  // Se aplica al dejar de escribir, sin esperar a salir del campo.
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    const timer = setTimeout(() => commitRef.current(), 700);
    return () => clearTimeout(timer);
  }, [text]);
  useEffect(() => () => commitRef.current(), []);

  return (
    <span className="input-unit">
      <input
        className="input tabular"
        inputMode="numeric"
        value={text}
        placeholder={allowEmpty ? 'auto' : ''}
        aria-label={label}
        onChange={(event) => setText(event.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
      <span>px</span>
    </span>
  );
}

function QualitySlider({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const pending = useRef<number | null>(null);
  pending.current = local === value ? null : local;
  useEffect(() => {
    if (local === value) return;
    const timer = setTimeout(() => commitRef.current(local), 220);
    return () => clearTimeout(timer);
  }, [local, value]);
  // Si se cierra el editor justo después de mover el control, el cambio no se pierde.
  useEffect(
    () => () => {
      if (pending.current !== null) commitRef.current(pending.current);
    },
    [],
  );

  return (
    <div className="field">
      <div className="quality-row">
        <label className="field__label" htmlFor="quality">
          Calidad
        </label>
        <output htmlFor="quality" className="tabular">
          {local}
        </output>
      </div>
      <input
        id="quality"
        className="range"
        type="range"
        min={1}
        max={100}
        value={local}
        onChange={(event) => setLocal(Number(event.target.value))}
      />
      <div className="quality-scale" aria-hidden="true">
        <span>Más ligera</span>
        <span>Más nítida</span>
      </div>
    </div>
  );
}

const BACKGROUNDS = [
  { value: '#ffffff', label: 'Blanco' },
  { value: '#f6f0e8', label: 'Crema' },
  { value: '#f2cedd', label: 'Rosa' },
  { value: '#631028', label: 'Vino' },
  { value: '#000000', label: 'Negro' },
];

export function RecipeForm({ recipe, image }: { recipe: Recipe; image: SourceImage }) {
  const info = image.info!;
  const key = itemKey(image.id, recipe.id);
  const result = useStore((s) => s.results[key]);
  const crop = useStore((s) => s.crops[key]);
  const [presetName, setPresetName] = useState(recipe.name);
  useEffect(() => setPresetName(recipe.name), [recipe.id, recipe.name]);

  const update = (patch: Partial<RecipeSettings>) => updateRecipe(recipe.id, patch);
  const format = resolveFormat(recipe.format, info.format);
  const lossless = isLossless(recipe, info, format);
  const mode = effectiveMode(recipe);
  const spec = buildSpec(image, recipe, crop);
  const layout = spec?.layout ?? computeLayout(info.width, info.height, recipe);
  const showBackground = mode === 'pad' || (format === 'jpeg' && info.hasAlpha);
  const background = format === 'jpeg' && recipe.background === 'transparent' ? '#ffffff' : recipe.background;
  const done = result?.status === 'done' && result.key === spec?.key;
  const keepsAlpha = supportsAlpha(format) && (info.hasAlpha || (mode === 'pad' && background === 'transparent'));

  const setMode = (next: FitMode) => {
    if (next === 'fit') return update({ mode: 'fit' });
    const ratio = info.width / info.height;
    const width = recipe.width ?? (recipe.height ? Math.round(recipe.height * ratio) : Math.min(info.width, 1080));
    const height = recipe.height ?? Math.round(width / ratio);
    update({ mode: next, width, height });
  };

  const formats: Array<{ value: OutputFormat; label: string }> = [
    { value: 'original', label: `Igual (${FORMAT_LABEL[info.format]})` },
    { value: 'jpeg', label: 'JPG' },
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' },
  ];

  return (
    <>
      <section className="side-section">
        <h3 className="side-section__title display">Esta salida</h3>
        <p className="side-section__hint">
          Lo que cambies aquí se aplica a todas las imágenes. El encuadre es solo para esta.
        </p>
        <div className="side-stack">
          <label className="field">
            <span className="field__label">Nombre</span>
            <input
              className="input"
              value={recipe.name}
              onChange={(event) => update({ name: event.target.value })}
              onBlur={(event) => !event.target.value.trim() && update({ name: 'Salida' })}
            />
          </label>
          <label className="field">
            <span className="field__label">Nombre corto para archivos y carpetas</span>
            <input
              className="input"
              value={recipe.suffix}
              onChange={(event) => update({ suffix: event.target.value })}
              onBlur={(event) => !event.target.value.trim() && update({ suffix: 'salida' })}
              spellCheck={false}
            />
          </label>
          <div className="field">
            <span className="field__label">Medidas</span>
            <div className="dims">
              <NumberField
                label="Ancho"
                value={recipe.width}
                allowEmpty={recipe.mode === 'fit'}
                onCommit={(width) => update({ width })}
              />
              <span className="dims__x" aria-hidden="true">
                ×
              </span>
              <NumberField
                label="Alto"
                value={recipe.height}
                allowEmpty={recipe.mode === 'fit'}
                onCommit={(height) => update({ height })}
              />
            </div>
            <span className="field__hint">
              {recipe.mode === 'fit'
                ? 'Deja una medida vacía y se calcula sola. Nunca se amplía la original.'
                : 'Ancho y alto exactos de la copia.'}
            </span>
          </div>
          <div className="field">
            <span className="field__label">Encaje</span>
            <div className="seg seg--block" role="group" aria-label="Encaje">
              <button type="button" aria-pressed={recipe.mode === 'fit'} onClick={() => setMode('fit')}>
                Mantener proporción
              </button>
              <button type="button" aria-pressed={recipe.mode === 'crop'} onClick={() => setMode('crop')}>
                Recortar
              </button>
              <button type="button" aria-pressed={recipe.mode === 'pad'} onClick={() => setMode('pad')}>
                Márgenes
              </button>
            </div>
            <span className="field__hint">
              {recipe.mode === 'fit' && 'La imagen completa, sin recortes ni bordes.'}
              {recipe.mode === 'crop' && 'Rellena la medida recortando. Mueve el encuadre en la vista.'}
              {recipe.mode === 'pad' && 'La imagen completa sobre un lienzo, con aire alrededor.'}
            </span>
          </div>
          {mode === 'crop' && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => resetCrop(image.id, recipe.id)}>
              <Icon name="reset" />
              Volver a centrar el encuadre
            </button>
          )}
          {mode === 'pad' && (
            <div className="field">
              <div className="quality-row">
                <label className="field__label" htmlFor="margin">
                  Margen
                </label>
                <output htmlFor="margin" className="tabular">
                  {recipe.margin} %
                </output>
              </div>
              <input
                id="margin"
                className="range"
                type="range"
                min={0}
                max={40}
                value={recipe.margin}
                onChange={(event) => update({ margin: Number(event.target.value) })}
              />
            </div>
          )}
          <div className="field">
            <span className="field__label">Formato</span>
            <div className="seg seg--block" role="group" aria-label="Formato">
              {formats.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={recipe.format === option.value}
                  onClick={() => update({ format: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="field__hint">
              {format === 'jpeg' && 'JPG: ideal para fotos. No admite transparencia.'}
              {format === 'png' && 'PNG: sin pérdida, conserva la transparencia. Ideal para logos.'}
              {format === 'webp' && 'WebP: el más ligero para web. Conserva la transparencia.'}
            </span>
          </div>
          {format === 'webp' && (
            <label className="switch">
              <input
                type="checkbox"
                checked={lossless}
                disabled={recipe.format === 'original' && info.webpLossless === true}
                onChange={(event) => update({ lossless: event.target.checked })}
              />
              Sin pérdida (ideal para logos e ilustraciones)
            </label>
          )}
          {lossless ? (
            <p className="note note--info">
              <Icon name="info" />
              <span>Sin pérdida: los píxeles se guardan exactos y solo se optimiza el peso.</span>
            </p>
          ) : (
            <QualitySlider value={recipe.quality} onCommit={(quality) => update({ quality })} />
          )}
          {showBackground && (
            <div className="field">
              <span className="field__label">
                {mode === 'pad' ? 'Fondo del lienzo' : 'Relleno de las zonas transparentes'}
              </span>
              <div className="swatch-row" role="group" aria-label="Color de fondo">
                {supportsAlpha(format) && (
                  <button
                    type="button"
                    className="swatch swatch--transparent"
                    aria-pressed={background === 'transparent'}
                    onClick={() => update({ background: 'transparent' })}
                    aria-label="Transparente"
                    title="Transparente"
                  />
                )}
                {BACKGROUNDS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="swatch"
                    style={{ background: option.value }}
                    aria-pressed={background === option.value}
                    onClick={() => update({ background: option.value })}
                    aria-label={option.label}
                    title={option.label}
                  />
                ))}
                <label
                  className="swatch swatch--custom"
                  data-selected={background !== 'transparent' && !BACKGROUNDS.some((b) => b.value === background)}
                  title="Otro color"
                >
                  <input
                    type="color"
                    value={background === 'transparent' ? '#ffffff' : background}
                    onChange={(event) => update({ background: event.target.value })}
                    aria-label="Otro color"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="side-section">
        <h3 className="side-section__title display">Antes y después</h3>
        <table className="compare-table tabular">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Original</th>
              <th scope="col">Copia</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Formato</th>
              <td>{FORMAT_LABEL[info.format]}</td>
              <td>{FORMAT_LABEL[format]}</td>
            </tr>
            <tr>
              <th scope="row">Medidas</th>
              <td>{formatDimensions(info.width, info.height)}</td>
              <td>{formatDimensions(layout.cw, layout.ch)}</td>
            </tr>
            <tr>
              <th scope="row">Calidad</th>
              <td>{describeSourceQuality(info)}</td>
              <td>{describeOutputQuality(format, recipe.quality, lossless)}</td>
            </tr>
            <tr>
              <th scope="row">Transparencia</th>
              <td>{info.hasAlpha ? 'Sí' : 'No'}</td>
              <td>{keepsAlpha ? 'Sí' : 'No'}</td>
            </tr>
            <tr>
              <th scope="row">Peso</th>
              <td>{formatBytes(image.size)}</td>
              <td>
                {done && result?.size !== undefined ? (
                  <>
                    <strong>{formatBytes(result.size)}</strong>{' '}
                    <span className={`delta${result.size > image.size ? ' delta--up' : ''}`}>
                      {formatDelta(image.size, result.size)}
                    </span>
                  </>
                ) : (
                  <span className="muted">calculando…</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {result && result.warnings.length > 0 && (
        <section className="side-section">
          <h3 className="side-section__title display">A tener en cuenta</h3>
          <Notes warnings={result.warnings} />
        </section>
      )}

      <section className="side-section">
        <h3 className="side-section__title display">Guardar como ajuste</h3>
        <p className="side-section__hint">Para tenerlo a mano la próxima vez, en este equipo.</p>
        <form
          className="save-preset"
          onSubmit={(event) => {
            event.preventDefault();
            saveRecipeAsPreset(recipe.id, presetName);
          }}
        >
          <input
            className="input"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            aria-label="Nombre del ajuste"
          />
          <button type="submit" className="btn btn--secondary">
            <Icon name="save" />
            Guardar
          </button>
        </form>
      </section>
    </>
  );
}
