import { useRef, useState, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../state/store';
import { setNaming } from '../state/actions';
import { exportSummary, exportZip } from '../state/export';
import { formatBytes } from '../lib/format';
import { PATTERN_TOKENS } from '../lib/naming';
import type { FolderMode } from '../lib/types';
import { Icon } from './Icon';
import { Notice } from './Notice';

const FOLDERS: Record<FolderMode, string> = {
  salida: 'una carpeta por versión',
  imagen: 'una carpeta por imagen',
  ninguna: 'sin carpetas',
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ExportBar() {
  const naming = useStore((s) => s.naming);
  const exporting = useStore((s) => s.exporting);
  const summary = useStore(useShallow(exportSummary));
  const [open, setOpen] = useState(false);
  const pattern = useRef<HTMLInputElement>(null);

  const insertToken = (token: string) => {
    const input = pattern.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    setNaming({ pattern: input.value.slice(0, start) + token + input.value.slice(end) });
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

  // Qué falta para poder descargar (con el botón desactivado), dicho en claro.
  const nothing =
    summary.reading > 0 || summary.images === 0
      ? null
      : summary.versions === 0
        ? 'Añade al menos una versión (paso 2) para poder descargar.'
        : summary.copies === 0
          ? 'No hay nada seleccionado para descargar: activa al menos una versión en «Versiones de esta imagen» (paso 3).'
          : null;

  const status =
    summary.reading > 0
      ? `Leyendo ${plural(summary.reading, 'imagen', 'imágenes')}…`
      : summary.ready < summary.copies
        ? `Preparando ${summary.copies - summary.ready} de ${summary.copies}…`
        : `${formatBytes(summary.bytes)} en total`;

  return (
    <section className="export" aria-labelledby="export-title">
      <div className="export__inner">
        {open && (
          <div id="export-options" className="export__options">
            <div className="export__pattern">
              <label className="field__label" htmlFor="pattern-input">
                Nombre de los archivos
              </label>
              <input
                id="pattern-input"
                ref={pattern}
                className="input"
                value={naming.pattern}
                onChange={(event) => setNaming({ pattern: event.target.value })}
                spellCheck={false}
                aria-describedby={summary.example ? 'pattern-example' : undefined}
              />
              <span className="tokens" role="group" aria-label="Insertar en el nombre">
                {PATTERN_TOKENS.map(({ token, label: tokenLabel }) => (
                  <button
                    key={token}
                    type="button"
                    className="token"
                    title={`Insertar ${tokenLabel}`}
                    aria-label={`Insertar ${tokenLabel}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertToken(token)}
                  >
                    {token}
                  </button>
                ))}
              </span>
              {summary.example && (
                <span id="pattern-example" className="export__example tabular">
                  Ejemplo: {summary.example}
                </span>
              )}
            </div>
            <div className="export__choices">
              <label className="field">
                <span className="field__label">Carpetas dentro del ZIP</span>
                <select
                  className="select"
                  value={naming.folders}
                  onChange={(event) => setNaming({ folders: event.target.value as FolderMode })}
                >
                  <option value="salida">Una por versión</option>
                  <option value="imagen">Una por imagen</option>
                  <option value="ninguna">Sin carpetas</option>
                </select>
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={naming.normalize}
                  onChange={(event) => setNaming({ normalize: event.target.checked })}
                />
                Nombres aptos para web (sin acentos ni espacios)
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={naming.includeOriginals}
                  onChange={(event) => setNaming({ includeOriginals: event.target.checked })}
                />
                Incluir las originales intactas
              </label>
            </div>
          </div>
        )}
        <div className="export__row">
          <div className="export__summary">
            <h2 id="export-title" className="export__title">
              <span className="step step--light" aria-hidden="true">
                4
              </span>
              <span className="visually-hidden">Paso 4: </span>
              Descarga
            </h2>
            <p className="export__count tabular">
              <strong>{plural(summary.files, 'archivo', 'archivos')}</strong>
              <span>
                {' '}
                · {plural(summary.images, 'imagen', 'imágenes')} ×{' '}
                {plural(summary.versions, 'versión', 'versiones')}
                {summary.excluded > 0 && `, ${summary.excluded} sin incluir`}
                {summary.originals > 0 && ` + ${plural(summary.originals, 'original', 'originales')}`}
              </span>
            </p>
            {(summary.copies > 0 || summary.reading > 0) && (
              <p className="export__detail tabular">
                {status} · {FOLDERS[naming.folders]}
              </p>
            )}
            {nothing && (
              <p className="export__warn" id="sin-seleccion" data-testid="sin-seleccion">
                <Icon name="warning" />
                {nothing}
              </p>
            )}
            {!nothing && summary.withoutVersions > 0 && (
              <p className="export__warn">
                <Icon name="info" />
                {summary.withoutVersions === 1
                  ? `«${summary.firstWithoutVersions}» no tiene ninguna versión seleccionada: no irá en el ZIP.`
                  : `${summary.withoutVersions} imágenes no tienen ninguna versión seleccionada: no irán en el ZIP.`}
              </p>
            )}
            {summary.unreadable > 0 && (
              <p className="export__warn">
                <Icon name="warning" />
                {summary.unreadable === 1
                  ? '1 imagen no se pudo leer y no se incluirá. Revísala en la lista.'
                  : `${summary.unreadable} imágenes no se pudieron leer y no se incluirán. Revísalas en la lista.`}
              </p>
            )}
            {exporting && (
              <div
                className="progress"
                role="progressbar"
                aria-label="Progreso de la descarga"
                aria-valuemin={0}
                aria-valuemax={exporting.total}
                aria-valuenow={exporting.done}
                style={{ '--p': exporting.total ? exporting.done / exporting.total : 0 } as CSSProperties}
              >
                <span />
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn--on-dark"
            aria-expanded={open}
            aria-controls="export-options"
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name="sliders" />
            {open ? 'Menos opciones' : 'Más opciones'}
          </button>
          <button
            type="button"
            className="btn btn--large btn--download"
            onClick={() => void exportZip()}
            disabled={busy || Boolean(nothing) || (summary.copies === 0 && summary.reading === 0)}
            aria-describedby={nothing ? 'sin-seleccion' : undefined}
          >
            {busy ? <span className="spinner" /> : <Icon name="download" />}
            {label}
          </button>
        </div>
        <Notice area="descarga" />
      </div>
    </section>
  );
}
