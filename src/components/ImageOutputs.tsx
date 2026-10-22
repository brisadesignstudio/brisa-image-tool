import { useStore } from '../state/store';
import { renameImage } from '../state/actions';
import { FORMAT_LABEL, describeSourceQuality, formatBytes, formatDimensions } from '../lib/format';
import { OutputCard } from './OutputCard';

export function ImageOutputs() {
  const image = useStore((s) => s.images.find((i) => i.id === s.selectedId));
  const recipes = useStore((s) => s.recipes);
  const readyCount = useStore((s) => s.images.filter((i) => i.status === 'ready').length);
  const index = useStore((s) =>
    s.images.filter((i) => i.status === 'ready').findIndex((i) => i.id === s.selectedId),
  );

  if (!image) return null;

  if (image.status !== 'ready' || !image.info) {
    return (
      <section className="image-head">
        <div>
          <h2 className="image-head__title display">{image.name}</h2>
          <p className="image-head__meta">
            {image.status === 'error' ? image.error : 'Leyendo la imagen…'}
          </p>
        </div>
      </section>
    );
  }

  const info = image.info;
  return (
    <section aria-labelledby="image-title">
      <div className="image-head">
        <div>
          <p className="eyebrow image-head__eyebrow">
            Imagen {index + 1} de {readyCount}
          </p>
          <h2 id="image-title" className="image-head__title display">
            {image.name}
          </h2>
          <p className="image-head__meta tabular">
            Original: {FORMAT_LABEL[info.format]} · {formatDimensions(info.width, info.height)} px ·{' '}
            {formatBytes(image.size)} · {describeSourceQuality(info)}
            {info.hasAlpha ? ' · con transparencia' : ''}
          </p>
        </div>
        <label className="rename field">
          <span className="field__label">Nombre para las copias</span>
          <input
            className="input"
            value={image.baseName}
            onChange={(event) => renameImage(image.id, event.target.value)}
            spellCheck={false}
          />
        </label>
      </div>
      {recipes.length === 0 ? (
        <div className="empty-outputs">
          <p>Añade al menos una salida para crear copias de tus imágenes.</p>
        </div>
      ) : (
        <div className="cards">
          {recipes.map((recipe) => (
            <OutputCard key={recipe.id} image={image} recipe={recipe} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}
