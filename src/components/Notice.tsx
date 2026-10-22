import { useEffect } from 'react';
import { useStore, type NoticeArea } from '../state/store';
import { dismissNotice } from '../state/actions';
import { Icon } from './Icon';

/** Aviso junto a la zona a la que se refiere: no flota sobre el contenido. */
export function Notice({ area }: { area: NoticeArea }) {
  const notice = useStore((s) => (s.notice?.area === area ? s.notice : null));

  useEffect(() => {
    // Los errores se quedan hasta que se cierran; el resto se retira solo.
    if (!notice || notice.kind === 'error') return;
    const timer = setTimeout(() => {
      if (useStore.getState().notice?.id === notice.id) dismissNotice();
    }, 12_000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  return (
    <div className={`notice notice--${notice.kind}`} data-testid={`aviso-${area}`}>
      <Icon name={notice.kind === 'error' ? 'warning' : notice.kind === 'ok' ? 'check' : 'info'} />
      <p>{notice.text}</p>
      {notice.action && (
        <button
          type="button"
          className="btn btn--secondary btn--small notice__action"
          onClick={() => {
            const { run, focusAfter } = notice.action!;
            run();
            // El aviso desaparece: el foco pasa a lo que se ha recuperado.
            if (focusAfter) requestAnimationFrame(() => document.querySelector<HTMLElement>(focusAfter)?.focus());
          }}
        >
          {notice.action.label}
        </button>
      )}
      <button type="button" className="icon-btn" onClick={dismissNotice} aria-label="Cerrar aviso">
        <Icon name="close" />
      </button>
    </div>
  );
}

/**
 * Región que siempre está en la página para que los lectores de pantalla anuncien cada
 * aviso al aparecer. Con el editor abierto, el resto de la página queda inerte: por eso
 * el editor lleva la suya para los avisos que se dan dentro.
 */
export function NoticeAnnouncer({ areas }: { areas: readonly NoticeArea[] }) {
  const notice = useStore((s) => s.notice);
  const text = notice && areas.includes(notice.area) ? notice.text : '';
  return (
    <div className="visually-hidden" aria-live="polite" aria-atomic="true">
      {text}
    </div>
  );
}
