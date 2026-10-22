import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { removeAllImages, removeImage, selectImage } from '../state/actions';
import { FORMAT_LABEL, formatBytes, formatDimensions } from '../lib/format';
import type { SourceImage } from '../lib/types';
import { FileButton } from './FileButton';
import { Icon } from './Icon';
import { Notice } from './Notice';
import { SectionTitle } from './SectionTitle';

function ImageItem({
  image,
  selected,
  onRemove,
}: {
  image: SourceImage;
  selected: boolean;
  onRemove: () => void;
}) {
  const info = image.info;
  return (
    <li className="image-item" aria-current={selected ? 'true' : undefined} data-image={image.id}>
      <button
        type="button"
        className="image-item__select"
        onClick={() => selectImage(image.id)}
        aria-label={`Ver ${image.name}`}
        aria-pressed={selected}
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
        onClick={onRemove}
        aria-label={`Quitar ${image.name} de la lista`}
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
  const [confirming, setConfirming] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  // Al quitar una imagen, el foco pasa a la vecina y no se pierde.
  const remove = (index: number) => {
    const neighbour = images[index + 1] ?? images[index - 1];
    removeImage(images[index].id);
    if (!neighbour) return;
    requestAnimationFrame(() =>
      list.current?.querySelector<HTMLElement>(`[data-image="${neighbour.id}"] .image-item__select`)?.focus(),
    );
  };

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 6000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <aside className="sidebar" aria-labelledby="images-title">
      <div className="sidebar__head">
        <SectionTitle id="images-title" step={1} count={images.length}>
          Imágenes originales
        </SectionTitle>
        <FileButton className="btn btn--secondary btn--small sidebar__add">
          <Icon name="plus" />
          Añadir imágenes
        </FileButton>
      </div>
      <Notice area="imagenes" />
      <ul className="image-list" aria-label="Imágenes cargadas" ref={list}>
        {images.map((image, index) => (
          <ImageItem
            key={image.id}
            image={image}
            selected={image.id === selectedId}
            onRemove={() => remove(index)}
          />
        ))}
      </ul>
      <div className="sidebar__foot">
        <p className="field__hint sidebar__hint">Las originales no se modifican: se trabaja siempre sobre copias.</p>
        <button
          type="button"
          className={`btn btn--small ${confirming ? 'btn--danger' : 'btn--ghost'}`}
          onClick={() => {
            if (confirming) {
              removeAllImages();
              setConfirming(false);
            } else {
              setConfirming(true);
            }
          }}
        >
          <Icon name="trash" />
          {confirming ? `Confirmar: quitar las ${images.length}` : 'Quitar todas'}
        </button>
      </div>
    </aside>
  );
}
