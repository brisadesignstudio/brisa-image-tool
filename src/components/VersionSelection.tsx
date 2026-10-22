import { useShallow } from 'zustand/react/shallow';
import { itemKey, useStore } from '../state/store';
import { applySelectionToAll, setIncluded } from '../state/actions';
import { FORMAT_LABEL, resolveFormat } from '../lib/format';
import type { SourceImage } from '../lib/types';
import { Icon } from './Icon';

/**
 * Qué versiones exporta esta imagen. Por defecto, todas. Desactivar una no borra sus
 * ajustes ni el encuadre: solo deja esa combinación fuera del ZIP.
 */
export function VersionSelection({ image }: { image: SourceImage }) {
  const recipes = useStore((s) => s.recipes);
  const included = useStore(
    useShallow((s) => s.recipes.map((r) => !s.excluded[itemKey(image.id, r.id)])),
  );
  // «Aplicar a todas» solo tiene efecto si alguna imagen tiene otra selección.
  const others = useStore((s) => {
    const valid = s.images.filter((i) => i.status !== 'error');
    return (
      valid.length > 1 &&
      valid.some((other) =>
        s.recipes.some(
          (r) => Boolean(s.excluded[itemKey(other.id, r.id)]) !== Boolean(s.excluded[itemKey(image.id, r.id)]),
        ),
      )
    );
  });
  const info = image.info;
  if (!info || recipes.length === 0) return null;
  const count = included.filter(Boolean).length;

  return (
    <div className="selection" role="group" aria-labelledby="selection-label" data-testid="seleccion">
      <p id="selection-label" className="selection__label">
        Versiones de esta imagen{' '}
        <span className="count tabular">
          {count} de {recipes.length}
        </span>
      </p>
      <ul className="selection__list">
        {recipes.map((recipe, index) => (
          <li key={recipe.id}>
            <label className="pick" data-on={included[index]}>
              <input
                type="checkbox"
                checked={included[index]}
                onChange={(event) => setIncluded(image.id, recipe.id, event.target.checked)}
              />
              <span className="pick__name">{recipe.name}</span>
              <span className="pick__format">{FORMAT_LABEL[resolveFormat(recipe.format, info.format)]}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn--secondary btn--small selection__apply"
        aria-disabled={!others}
        aria-label="Aplicar esta selección a todas las imágenes"
        title={others ? 'Todas las imágenes exportarán estas versiones' : 'Todas las imágenes tienen ya esta selección'}
        onClick={() => others && applySelectionToAll(image.id)}
      >
        <Icon name="stack" />
        Aplicar a todas
      </button>
    </div>
  );
}
