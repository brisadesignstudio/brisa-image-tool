import { Icon } from './Icon';

/**
 * A qué afecta un ajuste: a todas las imágenes de la versión o solo a la que se está viendo.
 * Mismo aspecto en todo el editor para que se reconozca de un vistazo.
 */
export function Scope({ images }: { images?: number }) {
  if (images === undefined) {
    return (
      <span className="scope scope--one">
        <Icon name="image" />
        Solo esta imagen
      </span>
    );
  }
  return (
    <span className="scope scope--all">
      <Icon name="stack" />
      {images === 1 ? 'Para la imagen cargada' : `Para las ${images} imágenes`}
    </span>
  );
}
