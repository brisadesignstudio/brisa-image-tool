import { FileButton } from './FileButton';
import { Icon } from './Icon';

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
        </div>
      </section>
      <ol className="steps">
        <li>
          <span className="steps__num">1</span>
          <strong>Carga tus imágenes</strong>
          <span className="steps__text">Las originales no se tocan: se trabaja siempre sobre copias.</span>
        </li>
        <li>
          <span className="steps__num">2</span>
          <strong>Elige las salidas</strong>
          <span className="steps__text">Web, Instagram, Pinterest… o tus propias medidas, guardadas para la próxima.</span>
        </li>
        <li>
          <span className="steps__num">3</span>
          <strong>Descarga tu ZIP</strong>
          <span className="steps__text">Con nombres claros y todo ordenado en carpetas.</span>
        </li>
      </ol>
    </main>
  );
}
