import { useEffect, useRef, useState, type FormEvent } from 'react';
import { showNotice, useStore } from '../state/store';
import { dismissNotice } from '../state/actions';
import {
  applyPackage,
  deletePackage,
  duplicatePackage,
  exportPackages,
  importBackup,
  planApply,
  previewImport,
  renamePackage,
  savePackage,
  updatePackage,
  type ApplyMode,
} from '../state/packages';
import { MAX_BACKUP_BYTES, parseBackup, type BackupParse } from '../lib/backup';
import { describeSize } from '../lib/geometry';
import { FORMAT_LABEL, formatBytes } from '../lib/format';
import { FOLDER_LABEL } from '../lib/naming';
import type { NamingSettings, RecipeSettings, SettingsPackage } from '../lib/types';
import { Icon } from './Icon';
import { Notice, NoticeAnnouncer } from './Notice';

type View =
  | { kind: 'lista' }
  | { kind: 'aplicar'; id: string }
  | { kind: 'importar'; parsed: Extract<BackupParse, { ok: true }>; fileName: string };

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

function describeVersion(v: RecipeSettings): string {
  const format = v.format === 'original' ? 'mismo formato' : FORMAT_LABEL[v.format];
  return `${describeSize(v)} · ${format}${v.maxBytes !== null ? ` · máx. ${formatBytes(v.maxBytes)}` : ''}`;
}

const describeNaming = (n: NamingSettings) => `«${n.pattern}», ${FOLDER_LABEL[n.folders]}`;

function listNames(names: string[]): string {
  const quoted = names.map((n) => `«${n}»`);
  return quoted.length <= 1 ? (quoted[0] ?? '') : `${quoted.slice(0, -1).join(', ')} y ${quoted[quoted.length - 1]}`;
}

function SaveForm() {
  const recipes = useStore((s) => s.recipes);
  const naming = useStore((s) => s.naming);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = savePackage(name);
    if (!result.ok) return setError(result.error);
    setError(null);
    showNotice('paquetes', 'ok', `Paquete «${name.trim()}» guardado en este navegador.`);
    setName('');
  };

  return (
    <section className="packs__section" aria-labelledby="packs-save">
      <h3 id="packs-save" className="picker__group-title eyebrow">
        Guardar las versiones actuales
      </h3>
      <form className="packs__save" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Nombre del paquete</span>
          <span className="packs__row">
            <input
              className="input"
              value={name}
              maxLength={60}
              placeholder="Por ejemplo, Portafolio Brisa"
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby="packs-save-hint"
            />
            <button type="submit" className="btn btn--primary" disabled={recipes.length === 0}>
              <Icon name="save" />
              Guardar paquete
            </button>
          </span>
        </label>
        <p id="packs-save-hint" className="field__hint">
          {recipes.length === 0
            ? 'Añade al menos una versión para poder guardarla.'
            : `Guarda ${recipes.length === 1 ? 'la versión' : `las ${recipes.length} versiones`} (${listNames(recipes.map((r) => r.name))}) con sus medidas, encaje, fondo, formato, calidad y peso máximo, y los nombres de archivo: ${describeNaming(naming)}. No guarda imágenes, encuadres ni selecciones por imagen.`}
        </p>
        {error && (
          <p className="note" role="alert" data-testid="error-paquete">
            <Icon name="warning" />
            <span>{error}</span>
          </p>
        )}
      </form>
    </section>
  );
}

function PackageItem({ pkg, onApply }: { pkg: SettingsPackage; onApply: () => void }) {
  const [name, setName] = useState(pkg.name);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'actualizar' | 'eliminar' | null>(null);
  const current = useStore((s) => s.recipes.length);
  useEffect(() => setName(pkg.name), [pkg.name]);

  const rename = (event: FormEvent) => {
    event.preventDefault();
    const result = renamePackage(pkg.id, name);
    setError(result.ok ? null : result.error);
    if (result.ok) showNotice('paquetes', 'ok', `Paquete renombrado: «${name.trim()}».`);
  };

  return (
    <li className="pack" data-testid="paquete">
      <div className="pack__head">
        <div className="pack__titles">
          <p className="pack__name">{pkg.name}</p>
          <p className="pack__meta">
            {pkg.versions.length === 1 ? '1 versión' : `${pkg.versions.length} versiones`}
            {Date.parse(pkg.updatedAt) > 0 && ` · guardado el ${DATE.format(new Date(pkg.updatedAt))}`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--small"
          onClick={onApply}
          aria-label={`Aplicar el paquete ${pkg.name}`}
        >
          Aplicar…
        </button>
      </div>
      <ul className="pack__versions">
        {pkg.versions.map((v, i) => (
          <li key={i}>
            <strong>{v.name}</strong> — {describeVersion(v)}
          </li>
        ))}
      </ul>
      {pkg.naming && <p className="pack__meta">Nombres de archivo: {describeNaming(pkg.naming)}</p>}
      <details className="pack__manage">
        <summary>Gestionar</summary>
        <div className="pack__tools">
          <form className="packs__row" onSubmit={rename}>
            <label className="visually-hidden" htmlFor={`rename-${pkg.id}`}>
              Nuevo nombre para {pkg.name}
            </label>
            <input
              id={`rename-${pkg.id}`}
              className="input"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(error)}
            />
            <button type="submit" className="btn btn--secondary btn--small">
              Renombrar
            </button>
          </form>
          {error && (
            <p className="note" role="alert">
              <Icon name="warning" />
              <span>{error}</span>
            </p>
          )}
          {confirm === null && (
            <div className="pack__actions">
              <button
                type="button"
                className="btn btn--secondary btn--small"
                onClick={() => setConfirm('actualizar')}
                disabled={current === 0}
              >
                Actualizar con las versiones actuales
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--small"
                onClick={() => {
                  const result = duplicatePackage(pkg.id);
                  if (result.ok) showNotice('paquetes', 'ok', `Paquete «${pkg.name}» duplicado.`);
                }}
              >
                Duplicar
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirm('eliminar')}>
                <Icon name="trash" />
                Eliminar
              </button>
            </div>
          )}
          {confirm && (
            <div className="pack__confirm" role="group" aria-label="Confirmar">
              <p>
                {confirm === 'actualizar'
                  ? `Se sustituirán ${pkg.versions.length === 1 ? 'su versión guardada' : `sus ${pkg.versions.length} versiones guardadas`} por ${current === 1 ? 'la versión actual' : `las ${current} actuales`} y sus nombres de archivo.`
                  : 'Se eliminará el paquete guardado. Las versiones e imágenes de la mesa no cambian.'}
              </p>
              <div className="pack__actions">
                <button
                  type="button"
                  className={`btn btn--small ${confirm === 'eliminar' ? 'btn--danger' : 'btn--primary'}`}
                  onClick={() => {
                    if (confirm === 'actualizar') {
                      const result = updatePackage(pkg.id);
                      if (result.ok) showNotice('paquetes', 'ok', `Paquete «${pkg.name}» actualizado con las versiones actuales.`);
                    } else {
                      deletePackage(pkg.id);
                      showNotice('paquetes', 'info', `Paquete «${pkg.name}» eliminado.`);
                    }
                    setConfirm(null);
                  }}
                >
                  {confirm === 'actualizar' ? 'Confirmar: actualizar' : 'Confirmar: eliminar'}
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirm(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

function ApplyView({ pkg, onCancel, onDone }: { pkg: SettingsPackage; onCancel: () => void; onDone: () => void }) {
  const state = useStore();
  const [mode, setMode] = useState<ApplyMode>('add');
  const [withNaming, setWithNaming] = useState(true);
  const current = state.recipes;
  const plan = planApply(pkg, mode, state);
  const addPlan = planApply(pkg, 'add', state);
  const replacePlan = planApply(pkg, 'replace', state);
  const images = state.images.filter((i) => i.status !== 'error').length;
  const namingDiffers = Boolean(pkg.naming) && JSON.stringify(pkg.naming) !== JSON.stringify(state.naming);
  const loss = mode === 'replace' && (plan.lostCrops > 0 || plan.lostSelections > 0);

  return (
    <div className="packs__apply">
      <div>
        <p className="field__label">Versiones del paquete</p>
        <ul className="pack__versions">
          {pkg.versions.map((v, i) => (
            <li key={i}>
              <strong>{v.name}</strong> — {describeVersion(v)}
            </li>
          ))}
        </ul>
      </div>
      {current.length > 0 && (
        <fieldset className="packs__modes">
          <legend className="field__label">
            Qué hacer con {current.length === 1 ? 'la versión actual' : `las ${current.length} versiones actuales`}
          </legend>
          <label className="packs__mode">
            <input type="radio" name="modo" checked={mode === 'add'} onChange={() => setMode('add')} />
            <span>
              <strong>Añadir a las actuales</strong>
              <span className="field__hint">
                {addPlan.added.length === 0
                  ? 'Sus versiones ya están: no se añade ninguna.'
                  : `${addPlan.added.length === 1 ? 'Se añade 1 versión' : `Se añaden ${addPlan.added.length} versiones`}${addPlan.already ? ` (${addPlan.already} ya ${addPlan.already === 1 ? 'estaba' : 'estaban'})` : ''}. Las actuales se quedan como están.`}
              </span>
            </span>
          </label>
          <label className="packs__mode">
            <input type="radio" name="modo" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            <span>
              <strong>Reemplazar las actuales</strong>
              <span className="field__hint">
                {replacePlan.removed.length === 0
                  ? 'No se quita ninguna versión actual.'
                  : `${replacePlan.removed.length === 1 ? 'Se quita' : 'Se quitan'} ${listNames(replacePlan.removed.map((r) => r.name))}.`}{' '}
                Las versiones iguales a las del paquete se conservan con sus encuadres.
              </span>
            </span>
          </label>
        </fieldset>
      )}
      {loss && (
        <p className="note" role="alert" data-testid="aviso-reemplazo">
          <Icon name="warning" />
          <span>
            Al reemplazar se perderán{' '}
            {[
              plan.lostCrops > 0 && `${plan.lostCrops === 1 ? '1 encuadre ajustado' : `${plan.lostCrops} encuadres ajustados`} a mano`,
              plan.lostSelections > 0 &&
                `la selección por imagen de ${plan.lostSelections === 1 ? '1 versión' : `${plan.lostSelections} versiones`}`,
            ]
              .filter(Boolean)
              .join(' y ')}
            . Podrás deshacerlo justo después con «Deshacer».
          </span>
        </p>
      )}
      {namingDiffers && pkg.naming && (
        <label className="switch packs__naming">
          <input type="checkbox" checked={withNaming} onChange={(event) => setWithNaming(event.target.checked)} />
          <span>
            Usar también sus nombres de archivo y carpetas: {describeNaming(pkg.naming)}.{' '}
            <span className="field__hint">Ahora: {describeNaming(state.naming)}.</span>
          </span>
        </label>
      )}
      <p className="field__hint">
        {images === 0
          ? 'Las versiones se aplicarán a las imágenes que añadas.'
          : `Las versiones que se añadan se exportarán para ${images === 1 ? 'la imagen cargada' : `las ${images} imágenes cargadas`}; podrás quitarlas por imagen en la revisión.`}
      </p>
      <div className="packs__buttons">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            applyPackage(pkg.id, current.length > 0 ? mode : 'add', namingDiffers && withNaming);
            onDone();
          }}
        >
          {current.length > 0 && mode === 'replace' ? 'Reemplazar versiones' : 'Aplicar paquete'}
        </button>
      </div>
    </div>
  );
}

function ImportView({
  parsed,
  fileName,
  onCancel,
  onDone,
}: {
  parsed: Extract<BackupParse, { ok: true }>;
  fileName: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const items = previewImport(parsed);
  const fresh = items.filter((i) => i.status !== 'ya-existe').length;
  return (
    <div className="packs__apply">
      <p className="field__hint">
        Archivo: {fileName}
        {parsed.exportado && ` · exportado el ${DATE.format(new Date(parsed.exportado))}`}
      </p>
      <ul className="pack__versions" data-testid="vista-importar">
        {items.map((item, i) => (
          <li key={i}>
            <strong>{item.finalName}</strong> — {item.kind === 'paquete' ? `paquete, ${item.detail}` : item.detail}
            {item.status === 'renombrado' && ` · ya hay otro «${item.name}»: se importará con este nombre`}
            {item.status === 'ya-existe' && ' · ya está en este equipo: no se duplica'}
          </li>
        ))}
      </ul>
      {parsed.descartados > 0 && (
        <p className="note">
          <Icon name="warning" />
          <span>
            Se omiten {parsed.descartados === 1 ? '1 elemento dañado o incompatible' : `${parsed.descartados} elementos dañados o incompatibles`}.
          </span>
        </p>
      )}
      <div className="packs__buttons">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={fresh === 0}
          onClick={() => {
            importBackup(parsed);
            onDone();
          }}
        >
          {fresh === 0 ? 'Nada nuevo que importar' : `Importar ${fresh === 1 ? '1 elemento' : `${fresh} elementos`}`}
        </button>
      </div>
    </div>
  );
}

/** Paquetes de ajustes: guardar, aplicar, gestionar y copia de seguridad. */
export function PackagesDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const packages = useStore((s) => s.packages);
  const presets = useStore((s) => s.customPresets.length);
  const storageReady = useStore((s) => s.storageReady);
  const [view, setView] = useState<View>({ kind: 'lista' });
  const first = useRef(true);
  // Cada vista empieza sin los avisos de la anterior (salvo el que acaba de dar su resultado).
  const go = (next: View, keepNotice = false) => {
    if (!keepNotice && useStore.getState().notice?.area === 'paquetes') dismissNotice();
    setView(next);
  };

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => node?.close();
  }, []);

  // Al cambiar de vista, el foco va a su título (y no se pierde en la página de detrás).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [view.kind]);

  const pkg = view.kind === 'aplicar' ? packages.find((p) => p.id === view.id) : undefined;
  const title =
    view.kind === 'aplicar' && pkg
      ? `Aplicar «${pkg.name}»`
      : view.kind === 'importar'
        ? 'Importar copia de seguridad'
        : 'Paquetes de ajustes';

  const readFile = async (file: File) => {
    if (file.size > MAX_BACKUP_BYTES) {
      showNotice('paquetes', 'error', 'El archivo es demasiado grande para ser una copia de paquetes (más de 2 MB).');
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      showNotice('paquetes', 'error', 'No se pudo leer el archivo. Vuelve a intentarlo.');
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) showNotice('paquetes', 'error', parsed.error);
    else go({ kind: 'importar', parsed, fileName: file.name });
  };

  return (
    <dialog
      ref={dialog}
      className="picker packs"
      aria-labelledby="packs-title"
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
      data-testid="paquetes"
    >
      <div className="picker__head">
        <div>
          <h2 id="packs-title" className="picker__title display" ref={heading} tabIndex={-1}>
            {title}
          </h2>
          {view.kind === 'lista' && (
            <p className="picker__intro">
              Guarda varias versiones juntas, con sus nombres de archivo, y reutilízalas en otro lote. Se
              guardan en este navegador y este equipo; para llevarlas a otro, usa la copia de seguridad.
            </p>
          )}
        </div>
        <button type="button" className="icon-btn" onClick={() => dialog.current?.close()} aria-label="Cerrar">
          <Icon name="close" />
        </button>
      </div>
      <div className="picker__body packs__body">
        {!storageReady && (
          <p className="note" role="status" data-testid="sin-almacenamiento">
            <Icon name="warning" />
            <span>
              Este navegador no permite guardar datos ahora (modo privado, almacenamiento bloqueado o lleno).
              Lo que guardes durará hasta que cierres la pestaña: exporta una copia de seguridad para no
              perderlo. Todo lo demás de esta sesión sigue igual.
            </span>
          </p>
        )}
        <Notice area="paquetes" />
        {view.kind === 'aplicar' && pkg && (
          <ApplyView
            pkg={pkg}
            onCancel={() => go({ kind: 'lista' })}
            onDone={() => dialog.current?.close()}
          />
        )}
        {view.kind === 'importar' && (
          <ImportView
            parsed={view.parsed}
            fileName={view.fileName}
            onCancel={() => go({ kind: 'lista' })}
            onDone={() => go({ kind: 'lista' }, true)}
          />
        )}
        {(view.kind === 'lista' || (view.kind === 'aplicar' && !pkg)) && (
          <>
            <SaveForm />
            <section className="packs__section" aria-labelledby="packs-list">
              <h3 id="packs-list" className="picker__group-title eyebrow">
                Tus paquetes{packages.length > 0 && ` (${packages.length})`}
              </h3>
              {packages.length === 0 ? (
                <p className="field__hint">Aún no hay paquetes guardados en este navegador.</p>
              ) : (
                <ul className="packs__list">
                  {packages.map((item) => (
                    <PackageItem key={item.id} pkg={item} onApply={() => go({ kind: 'aplicar', id: item.id })} />
                  ))}
                </ul>
              )}
            </section>
            <section className="packs__section" aria-labelledby="packs-backup">
              <h3 id="packs-backup" className="picker__group-title eyebrow">
                Copia de seguridad
              </h3>
              <div className="pack__actions">
                <button
                  type="button"
                  className="btn btn--secondary btn--small"
                  onClick={exportPackages}
                  disabled={packages.length === 0 && presets === 0}
                >
                  <Icon name="download" />
                  Exportar (.json)
                </button>
                <button type="button" className="btn btn--secondary btn--small" onClick={() => fileInput.current?.click()}>
                  <Icon name="upload" />
                  Importar…
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  data-testid="importar-paquetes"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void readFile(file);
                  }}
                />
              </div>
              <p className="field__hint">
                Un archivo con tus paquetes y tus ajustes guardados de una versión; nunca imágenes. Al importar
                se revisa antes de añadir nada y no se sobrescribe ningún paquete.
              </p>
            </section>
          </>
        )}
      </div>
      <NoticeAnnouncer areas={['paquetes']} />
    </dialog>
  );
}
