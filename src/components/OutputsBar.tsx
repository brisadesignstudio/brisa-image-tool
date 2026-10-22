import { useState } from 'react';
import { useStore } from '../state/store';
import { openEditor, removeRecipe } from '../state/actions';
import { describeSize } from '../lib/geometry';
import { FORMAT_LABEL } from '../lib/format';
import { Icon } from './Icon';
import { PresetPicker } from './PresetPicker';

export function OutputsBar() {
  const recipes = useStore((s) => s.recipes);
  const selectedId = useStore((s) => s.selectedId);
  const [picking, setPicking] = useState(false);

  return (
    <section className="panel outputs-bar" aria-labelledby="outputs-title">
      <div className="outputs-bar__head">
        <h2 id="outputs-title" className="outputs-bar__title display">
          Salidas
        </h2>
        <p className="outputs-bar__hint">
          Cada salida crea una copia de todas las imágenes. Tus ajustes se guardan en este equipo.
        </p>
      </div>
      <div className="chips">
        {recipes.map((recipe) => (
          <span className="chip" key={recipe.id}>
            <button
              type="button"
              className="chip__label"
              onClick={() => selectedId && openEditor(selectedId, recipe.id)}
              disabled={!selectedId}
              title="Ajustar esta salida"
            >
              {recipe.name}
              <span className="chip__size tabular">
                {describeSize(recipe)} ·{' '}
                {recipe.format === 'original' ? 'mismo formato' : FORMAT_LABEL[recipe.format]}
              </span>
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              onClick={() => removeRecipe(recipe.id)}
              aria-label={`Quitar la salida ${recipe.name}`}
              title="Quitar esta salida"
            >
              <Icon name="close" />
            </button>
          </span>
        ))}
        <button type="button" className="btn btn--primary btn--small" onClick={() => setPicking(true)}>
          <Icon name="plus" />
          Añadir salida
        </button>
      </div>
      {picking && <PresetPicker onClose={() => setPicking(false)} />}
    </section>
  );
}
