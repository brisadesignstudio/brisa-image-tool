import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { openEditor, removeRecipe } from '../state/actions';
import { describeSize } from '../lib/geometry';
import { FORMAT_LABEL } from '../lib/format';
import { Icon } from './Icon';
import { Notice } from './Notice';
import { PresetPicker } from './PresetPicker';
import { SectionTitle } from './SectionTitle';

export function VersionsBar() {
  const recipes = useStore((s) => s.recipes);
  const selectedId = useStore((s) => s.selectedId);
  const imageCount = useStore((s) => s.images.filter((i) => i.status !== 'error').length);
  const [picking, setPicking] = useState(false);
  const section = useRef<HTMLElement>(null);

  // Al quitar una versión, el foco pasa a la vecina (o a «Añadir versión») y no se pierde.
  const remove = (index: number) => {
    const neighbour = recipes[index + 1] ?? recipes[index - 1];
    removeRecipe(recipes[index].id);
    requestAnimationFrame(() => {
      const target = neighbour
        ? section.current?.querySelector<HTMLElement>(`[data-recipe="${neighbour.id}"] .chip__label`)
        : section.current?.querySelector<HTMLElement>('.versions__add');
      target?.focus();
    });
  };

  return (
    <section className="panel versions" aria-labelledby="versions-title" ref={section}>
      <div className="versions__head">
        <div className="versions__titles">
          <SectionTitle id="versions-title" step={2} count={recipes.length}>
            Versiones para exportar
          </SectionTitle>
          <p className="versions__scope">
            Por defecto, cada versión se aplica a {imageCount === 1 ? 'la imagen' : `las ${imageCount} imágenes`}{' '}
            y se guarda en este equipo.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--small versions__add"
          onClick={() => setPicking(true)}
        >
          <Icon name="plus" />
          Añadir versión
        </button>
      </div>
      <ul className="chips" aria-label="Versiones">
        {recipes.map((recipe, index) => (
          <li className="chip" key={recipe.id} data-recipe={recipe.id}>
            <button
              type="button"
              className="chip__label"
              onClick={() => selectedId && openEditor(selectedId, recipe.id)}
              disabled={!selectedId}
              aria-label={`Editar la versión ${recipe.name}`}
            >
              <span className="chip__name">{recipe.name}</span>
              <span className="chip__size tabular">
                {describeSize(recipe)} ·{' '}
                {recipe.format === 'original' ? 'mismo formato' : FORMAT_LABEL[recipe.format]}
              </span>
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              onClick={() => remove(index)}
              aria-label={`Quitar la versión ${recipe.name}`}
              title="Quitar esta versión de todas las imágenes"
            >
              <Icon name="close" />
            </button>
          </li>
        ))}
      </ul>
      <Notice area="versiones" />
      {picking && <PresetPicker onClose={() => setPicking(false)} />}
    </section>
  );
}
