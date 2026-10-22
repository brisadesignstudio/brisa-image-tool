import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore, type AppState } from '../state/store';
import { setNaming } from '../state/actions';
import { exportZip, outputFileName, plannedItems } from '../state/export';
import { formatBytes } from '../lib/format';
import { PATTERN_TOKENS } from '../lib/naming';
import type { FolderMode } from '../lib/types';
import { Icon } from './Icon';

function summarize(state: AppState) {
  const items = plannedItems(state);
  let bytes = 0;
  let ready = 0;
  for (const item of items) {
    const result = state.results[item.key];
    if (result?.status === 'done' && result.size !== undefined) {
      bytes += result.size;
      ready += 1;
    }
  }
  const originals = state.naming.includeOriginals
    ? state.images.filter((i) => i.status === 'ready')
    : [];
  for (const image of originals) bytes += image.size;
  const first = items[0];
  const firstResult = first ? state.results[first.key] : undefined;
  const example =
    first && firstResult?.format && firstResult.width
      ? outputFileName(state.naming, first.image, first.recipe, first.index, firstResult)
      : null;
  return {
    files: items.length + originals.length,
    copies: items.length,
    ready,
    reading: state.images.filter((i) => i.status === 'analyzing').length,
    bytes,
    example,
  };
}

export function ExportBar() {
  const naming = useStore((s) => s.naming);
  const exporting = useStore((s) => s.exporting);
  const summary = useStore(useShallow(summarize));
  const pattern = useRef<HTMLInputElement>(null);

  const insertToken = (token: string) => {
    const input = pattern.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + token + input.value.slice(end);
    setNaming({ pattern: next });
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const busy = Boolean(exporting);
  const label = !exporting
    ? 'Descargar ZIP'
    : exporting.phase === 'zipping'
      ? 'Creando el ZIP…'
      : exporting.phase === 'reading'
        ? `Leyendo ${exporting.done} de ${exporting.total}…`
        : `Preparando ${exporting.done} de ${exporting.total}…`;

  return (
    <div className="export" role="region" aria-label="Nombres y descarga">
      <div className="export__inner">
        <div className="export__naming">
          <label className="export__pattern">
            <span className="field__label">Nombre de los archivos</span>
            <input
              ref={pattern}
              className="input"
              value={naming.pattern}
              onChange={(event) => setNaming({ pattern: event.target.value })}
              spellCheck={false}
              aria-describedby="naming-example"
            />
            <span className="tokens" aria-label="Insertar en el nombre">
              {PATTERN_TOKENS.map(({ token, label: tokenLabel }) => (
                <button
                  key={token}
                  type="button"
                  className="token"
                  title={`Insertar ${tokenLabel}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertToken(token)}
                >
                  {token}
                </button>
              ))}
            </span>
            <span id="naming-example" className="export__example">
              {summary.example ? `Ej.: ${summary.example}` : 'Ej.: nombre-salida.jpg'}
            </span>
          </label>
          <label className="field">
            <span className="field__label">Carpetas</span>
            <select
              className="select"
              value={naming.folders}
              onChange={(event) => setNaming({ folders: event.target.value as FolderMode })}
            >
              <option value="salida">Una por salida</option>
              <option value="imagen">Una por imagen</option>
              <option value="ninguna">Sin carpetas</option>
            </select>
          </label>
          <div className="export__switches">
            <label className="switch">
              <input
                type="checkbox"
                checked={naming.normalize}
                onChange={(event) => setNaming({ normalize: event.target.checked })}
              />
              Nombres aptos para web
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={naming.includeOriginals}
                onChange={(event) => setNaming({ includeOriginals: event.target.checked })}
              />
              Incluir las originales
            </label>
          </div>
        </div>
        <div className="export__summary tabular" aria-live="polite">
          <strong>
            {summary.files} {summary.files === 1 ? 'archivo' : 'archivos'}
          </strong>
          <span>
            {summary.reading > 0
              ? `Leyendo ${summary.reading} ${summary.reading === 1 ? 'imagen' : 'imágenes'}…`
              : summary.ready < summary.copies
                ? `Preparando ${summary.copies - summary.ready}…`
                : `${formatBytes(summary.bytes)} en total`}
          </span>
        </div>
        <button
          type="button"
          className="btn btn--large btn--download"
          onClick={() => void exportZip()}
          disabled={busy || (summary.copies === 0 && summary.reading === 0)}
        >
          {busy ? <span className="spinner" /> : <Icon name="download" />}
          {label}
        </button>
      </div>
    </div>
  );
}
