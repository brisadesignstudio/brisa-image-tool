import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BUILT_IN_PRESETS, CUSTOM_RECIPE } from '../lib/presets';
import { describeSize } from '../lib/geometry';
import { FORMAT_LABEL, formatBytes } from '../lib/format';
import type { Preset, RecipeSettings } from '../lib/types';
import { useStore } from '../state/store';
import { addRecipe, deletePreset, openEditor } from '../state/actions';
import { Icon } from './Icon';

function formatName(settings: RecipeSettings) {
  return settings.format === 'original' ? 'Mismo formato' : FORMAT_LABEL[settings.format];
}

function PresetGroup({
  title,
  presets,
  onPick,
}: {
  title: string;
  presets: readonly Preset[];
  onPick: (preset: RecipeSettings) => void;
}) {
  const inUse = useStore(useShallow((s) => s.recipes.map((r) => r.name)));
  return (
    <section className="picker__group">
      <h3 className="picker__group-title eyebrow">{title}</h3>
      <ul className="presets">
        {presets.map((preset) => (
          <li key={preset.id}>
            <button type="button" className="preset" onClick={() => onPick(preset)}>
              <span className="preset__name">{preset.name}</span>
              <span className="preset__size tabular">
                {describeSize(preset)} · {formatName(preset)}
                {preset.maxBytes !== null && ` · máx. ${formatBytes(preset.maxBytes)}`}
              </span>
              {preset.hint && <span className="preset__hint">{preset.hint}</span>}
              {inUse.includes(preset.name) && (
                <span className="preset__used">
                  <Icon name="check" />
                  Ya está en tus versiones
                </span>
              )}
            </button>
            {!preset.builtIn && (
              <button
                type="button"
                className="icon-btn icon-btn--danger preset__delete"
                onClick={() => deletePreset(preset.id)}
                aria-label={`Borrar el ajuste ${preset.name}`}
                title="Borrar este ajuste guardado"
              >
                <Icon name="trash" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PresetPicker({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const custom = useStore((s) => s.customPresets);

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  const pick = (settings: RecipeSettings) => {
    const recipe = addRecipe(settings);
    dialog.current?.close();
    const selected = useStore.getState().selectedId;
    // Una versión a medida se abre directamente para darle medidas.
    if (settings === CUSTOM_RECIPE && selected) openEditor(selected, recipe.id);
  };

  return (
    <dialog
      ref={dialog}
      className="picker"
      aria-labelledby="picker-title"
      aria-describedby="picker-intro"
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      <div className="picker__head">
        <div>
          <h2 id="picker-title" className="picker__title display">
            Añadir versión
          </h2>
          <p id="picker-intro" className="picker__intro">
            Elige un destino. La versión se crea para todas tus imágenes y después puedes ajustar sus
            medidas, encuadre y formato.
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={() => dialog.current?.close()} aria-label="Cerrar">
          <Icon name="close" />
        </button>
      </div>
      <div className="picker__body">
        <PresetGroup title="Web" presets={BUILT_IN_PRESETS.filter((p) => p.group === 'web')} onPick={pick} />
        <PresetGroup title="Redes" presets={BUILT_IN_PRESETS.filter((p) => p.group === 'redes')} onPick={pick} />
        {custom.length > 0 && <PresetGroup title="Mis ajustes guardados" presets={custom} onPick={pick} />}
        <section className="picker__group">
          <h3 className="picker__group-title eyebrow">A tu medida</h3>
          <button type="button" className="btn btn--secondary" onClick={() => pick(CUSTOM_RECIPE)}>
            <Icon name="plus" />
            Medidas personalizadas
          </button>
        </section>
      </div>
    </dialog>
  );
}
