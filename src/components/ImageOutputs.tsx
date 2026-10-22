import type { CSSProperties } from 'react';
import { useStore } from '../state/store';
import { renameImage } from '../state/actions';
import { FORMAT_LABEL, describeSourceQuality, formatBytes, formatDimensions } from '../lib/format';
import { OutputCard } from './OutputCard';
import { SectionTitle } from './SectionTitle';

export function ImageOutputs() {
  const image = useStore((s) => s.images.find((i) => i.id === s.selectedId));
  const recipes = useStore((s) => s.recipes);
  const readyCount = useStore((s) => s.images.filter((i) => i.status === 'ready').length);
  const index = useStore((s) =>
    s.images.filter((i) => i.status === 'ready').findIndex((i) => i.id === s.selectedId),
  );

  if (!image) return null;

  const info = image.info;
  return (
    <section className="review" aria-labelledby="review-title">
      <div className="review__head">
        <div className="review__titles">
          <SectionTitle
            id="review-title"
            step={3}
            count={info ? `imagen ${index + 1} de ${readyCount}` : undefined}
          >
            Revisión
          </SectionTitle>
          <p className="review__name display">{image.name}</p>
          <p className="review__meta tabular">
            {info ? (
              <>
                Original: {FORMAT_LABEL[info.format]} · {formatDimensions(info.width, info.height)} px ·{' '}
                {formatBytes(image.size)} · {describeSourceQuality(info)}
                {info.hasAlpha ? ' · con transparencia' : ''}
              </>
            ) : image.status === 'error' ? (
              image.error
            ) : (
              'Leyendo la imagen…'
            )}
          </p>
        </div>
        {info && (
          <label className="rename field">
            <span className="field__label">Nombre base de sus archivos</span>
            <input
              className="input"
              value={image.baseName}
              onChange={(event) => renameImage(image.id, event.target.value)}
              spellCheck={false}
            />
          </label>
        )}
      </div>
      {info &&
        (recipes.length === 0 ? (
          <div className="empty-outputs">
            <p>Añade al menos una versión para crear copias de tus imágenes.</p>
          </div>
        ) : (
          <div className="cards" style={{ '--count': recipes.length } as CSSProperties}>
            {recipes.map((recipe) => (
              <OutputCard key={recipe.id} image={image} recipe={recipe} index={index} />
            ))}
          </div>
        ))}
    </section>
  );
}
