import { useStore } from '../state/store';
import { removeAllImages, removeImage, selectImage } from '../state/actions';
import { FORMAT_LABEL, formatBytes, formatDimensions } from '../lib/format';
import type { SourceImage } from '../lib/types';
import { FileButton } from './FileButton';
import { Icon } from './Icon';

function ImageItem({ image, selected }: { image: SourceImage; selected: boolean }) {
  const info = image.info;
  return (
    <li className="image-item" aria-current={selected}>
      <button
        type="button"
        className="image-item__select"
        onClick={() => selectImage(image.id)}
        aria-label={`Ver ${image.name}`}
      />
      <div className="image-item__thumb bg-cuadros">
        {image.thumbUrl ? (
          <img src={image.thumbUrl} alt="" />
        ) : (
          <div className="image-item__loading">
            <span className="spinner" />
          </div>
        )}
      </div>
      <div className="image-item__body">
        <p className="image-item__name" title={image.name}>
          {image.name}
        </p>
        {image.status === 'error' && <p className="image-item__error">{image.error}</p>}
        {image.status === 'analyzing' && <p className="image-item__meta">Leyendo…</p>}
        {info && (
          <>
            <p className="image-item__meta tabular">
              {formatDimensions(info.width, info.height)} · {formatBytes(image.size)}
            </p>
            <div className="tags">
              <span className="tag">{FORMAT_LABEL[info.format]}</span>
              {info.hasAlpha && <span className="tag tag--alpha">Transparencia</span>}
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        className="icon-btn icon-btn--danger"
        onClick={() => removeImage(image.id)}
        aria-label={`Quitar ${image.name}`}
        title="Quitar de la lista (el archivo original no se toca)"
      >
        <Icon name="close" />
      </button>
    </li>
  );
}

export function ImageList() {
  const images = useStore((s) => s.images);
  const selectedId = useStore((s) => s.selectedId);
  return (
    <aside className="sidebar" aria-labelledby="images-title">
      <div className="sidebar__head">
        <h2 id="images-title" className="sidebar__title display">
          Imágenes <span className="sidebar__count tabular">{images.length}</span>
        </h2>
        <FileButton className="btn btn--secondary btn--small">
          <Icon name="plus" />
          Añadir
        </FileButton>
      </div>
      <ul className="image-list">
        {images.map((image) => (
          <ImageItem key={image.id} image={image} selected={image.id === selectedId} />
        ))}
      </ul>
      <div className="sidebar__foot">
        <p className="field__hint">Las originales nunca se modifican: se trabaja sobre copias.</p>
        <button type="button" className="btn btn--ghost btn--small" onClick={removeAllImages}>
          <Icon name="trash" />
          Quitar todas
        </button>
      </div>
    </aside>
  );
}
