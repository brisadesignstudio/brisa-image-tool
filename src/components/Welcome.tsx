import { FileButton } from './FileButton';
import { Icon } from './Icon';
import { Notice } from './Notice';

const STEPS = [
  ['Añade tus imágenes', 'JPG, PNG o WebP. Las originales no se tocan.'],
  ['Elige las versiones', 'Web, Instagram, Pinterest… o tus propias medidas.'],
  ['Revisa', 'Encuadre, formato, calidad y peso de cada copia.'],
  ['Descarga', 'Un ZIP con nombres claros y carpetas ordenadas.'],
] as const;

export function Welcome({ dragging }: { dragging: boolean }) {
  return (
    <main className="welcome">
      <section className="hero atmosphere" aria-labelledby="hero-title">
        <div className="hero__copy">
          <p className="hero__eyebrow">Brisa Design Studio · Herramientas</p>
          <h2 id="hero-title" className="hero__title display">
            Tus imágenes, listas para web y redes.
          </h2>
          <p className="hero__lead">
            Medidas exactas, recortes con intención y el peso justo. Todo pasa en tu navegador: tus
            archivos no se suben a ningún sitio.
          </p>
        </div>
        <div className="dropzone" data-over={dragging}>
          <span className="dropzone__icon">
            <Icon name="upload" />
          </span>
          <p className="dropzone__title display">Arrastra aquí tus imágenes</p>
          <p className="dropzone__hint">o, si lo prefieres,</p>
          <FileButton className="btn btn--primary btn--large">Elegir imágenes</FileButton>
          <p className="dropzone__hint">JPG, PNG o WebP · puedes elegir varias a la vez</p>
          <Notice area="imagenes" />
        </div>
      </section>
      <ol className="steps">
        {STEPS.map(([title, text], i) => (
          <li key={title}>
            <span className="steps__num" aria-hidden="true">
              {i + 1}
            </span>
            <strong>{title}</strong>
            <span className="steps__text">{text}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
