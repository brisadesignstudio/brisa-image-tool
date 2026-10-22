import { Wordmark } from '../brand/Wordmark';
import { Icon } from './Icon';

export function Header() {
  return (
    <header className="header">
      <div className="header__brand">
        <Wordmark className="header__wordmark" />
        <span className="header__divider" aria-hidden="true" />
        <h1 className="header__title">Preparador de imágenes</h1>
      </div>
      <div className="header__spacer" />
      <p
        className="privacy"
        title="Todo se procesa en tu navegador. Ninguna imagen se sube a ningún servidor."
      >
        <Icon name="lock" />
        <span>Tus imágenes no salen de tu equipo</span>
      </p>
    </header>
  );
}
