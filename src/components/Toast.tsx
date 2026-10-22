import { useEffect } from 'react';
import { useStore } from '../state/store';
import { dismissToast } from '../state/actions';
import { Icon } from './Icon';

export function Toast() {
  const toast = useStore((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, toast.kind === 'error' ? 9000 : 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className={`toast${toast.kind === 'error' ? ' toast--error' : ''}`} role="status" aria-live="polite">
      <Icon name={toast.kind === 'error' ? 'warning' : toast.kind === 'ok' ? 'check' : 'info'} />
      <span>{toast.text}</span>
      <button type="button" className="icon-btn" onClick={dismissToast} aria-label="Cerrar aviso">
        <Icon name="close" />
      </button>
    </div>
  );
}
