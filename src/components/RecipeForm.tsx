import { useEffect, useRef, useState } from 'react';
import { saveRecipeAsPreset, updateRecipe } from '../state/actions';
import { FORMAT_LABEL, colorName, resolveFormat, supportsAlpha } from '../lib/format';
import { MAX_SIDE } from '../lib/presets';
import { effectiveMode } from '../lib/geometry';
import { isLossless } from '../engine/spec';
import type { FitMode, OutputFormat, Recipe, RecipeSettings, SourceFormat, SourceImage } from '../lib/types';
import { Icon } from './Icon';
import { Notice } from './Notice';

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

const MODE_HINT: Record<FitMode, string> = {
  fit: 'La imagen completa, sin recortes ni bordes. Las medidas son el máximo.',
  crop: 'Rellena la medida exacta recortando. Eliges el encuadre de cada imagen en la vista.',
  pad: 'La imagen completa sobre un lienzo de la medida exacta, con aire alrededor.',
};

const FORMAT_HINT: Record<SourceFormat, string> = {
  jpeg: 'JPG: para fotos. Compresión con pérdida; no admite transparencia.',
  png: 'PNG: compresión sin pérdida y transparencia. Ideal para logos; con fotos pesa más.',
  webp: 'WebP: el más ligero para web. Admite transparencia.',
};

/** Ajustes compartidos de la versión: se aplican a todas las imágenes. */
export function RecipeForm({ recipe, image }: { recipe: Recipe; image: SourceImage }) {
  const info = image.info!;
  const [presetName, setPresetName] = useState(recipe.name);
  useEffect(() => setPresetName(recipe.name), [recipe.id, recipe.name]);

  const update = (patch: Partial<RecipeSettings>) => updateRecipe(recipe.id, patch);
  const format = resolveFormat(recipe.format, info.format);
  const lossless = isLossless(recipe, info, format);
  const mode = effectiveMode(recipe);
  const showBackground = mode === 'pad' || (format === 'jpeg' && info.hasAlpha);
  const background = format === 'jpeg' && recipe.background === 'transparent' ? '#ffffff' : recipe.background;

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
    <div className="side-stack">
      <section className="group" aria-labelledby="group-size">
        <h4 id="group-size" className="group__title">
          Medidas y encaje
        </h4>
        <div className="field">
          <span className="field__label" id="dims-label">
            {recipe.mode === 'fit' ? 'Medida máxima' : 'Medida exacta'}
          </span>
          <div className="dims" role="group" aria-labelledby="dims-label">
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
              ? 'Deja una vacía y se calcula sola. Nunca se amplía la original.'
              : 'Ancho y alto del archivo. Nunca se amplía la original.'}
          </span>
        </div>
        <div className="field">
          <span className="field__label" id="mode-label">
            Encaje
          </span>
          <div className="seg seg--block" role="group" aria-labelledby="mode-label">
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
          <span className="field__hint">{MODE_HINT[recipe.mode]}</span>
        </div>
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
        {showBackground && (
          <div className="field">
            <span className="field__label" id="bg-label">
              Fondo exportado
            </span>
            <div className="swatch-row" role="group" aria-labelledby="bg-label">
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
            <span className="field__hint">
              {mode === 'pad'
                ? `Lienzo alrededor de la imagen: ${colorName(background)}. Se guarda en el archivo.`
                : `JPG no admite transparencia: las zonas transparentes se rellenan de ${colorName(background)}.`}
            </span>
          </div>
        )}
      </section>

      <section className="group" aria-labelledby="group-format">
        <h4 id="group-format" className="group__title">
          Formato y compresión
        </h4>
        <div className="field">
          <span className="field__label" id="format-label">
            Formato
          </span>
          <div className="seg seg--block" role="group" aria-labelledby="format-label">
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
          <span className="field__hint">{FORMAT_HINT[format]}</span>
        </div>
        {format === 'webp' && (
          <label className="switch">
            <input
              type="checkbox"
              checked={lossless}
              disabled={recipe.format === 'original' && info.webpLossless === true}
              onChange={(event) => update({ lossless: event.target.checked })}
            />
            Compresión sin pérdida (logos e ilustraciones)
          </label>
        )}
        {lossless ? (
          <p className="note note--info">
            <Icon name="info" />
            <span>
              Compresión sin pérdida: el archivo no pierde detalle al guardarse. Si la medida es menor que
              la original, la imagen se reduce igualmente.
            </span>
          </p>
        ) : (
          <QualitySlider value={recipe.quality} onCommit={(quality) => update({ quality })} />
        )}
      </section>

      <details className="more">
        <summary>
          <span className="more__title">Más opciones</span>
          <span className="more__hint">Nombre de la versión y guardar como ajuste</span>
        </summary>
        <div className="more__body side-stack">
          <label className="field">
            <span className="field__label">Nombre de la versión</span>
            <input
              className="input"
              value={recipe.name}
              onChange={(event) => update({ name: event.target.value })}
              onBlur={(event) => !event.target.value.trim() && update({ name: 'Versión' })}
            />
          </label>
          <label className="field">
            <span className="field__label">Nombre corto para archivos y carpetas</span>
            <input
              className="input"
              value={recipe.suffix}
              onChange={(event) => update({ suffix: event.target.value })}
              onBlur={(event) => !event.target.value.trim() && update({ suffix: 'version' })}
              spellCheck={false}
            />
          </label>
          <form
            className="field"
            onSubmit={(event) => {
              event.preventDefault();
              saveRecipeAsPreset(recipe.id, presetName);
            }}
          >
            <label className="field__label" htmlFor="preset-name">
              Guardar como ajuste en este equipo
            </label>
            <div className="save-preset">
              <input
                id="preset-name"
                className="input"
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                aria-label="Nombre del ajuste"
              />
              <button type="submit" className="btn btn--secondary">
                <Icon name="save" />
                Guardar
              </button>
            </div>
            <span className="field__hint">Aparecerá en «Añadir versión», también otro día.</span>
          </form>
          <Notice area="version" />
        </div>
      </details>
    </div>
  );
}
