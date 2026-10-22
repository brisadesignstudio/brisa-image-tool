import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { itemKey, useStore, type EditorTarget } from '../state/store';
import { closeEditor, openEditor, resetCrop, setPreviewBg } from '../state/actions';
import { computeLayout, effectiveMode } from '../lib/geometry';
import type { PreviewBackground, Recipe, SourceImage } from '../lib/types';
import { CompareView } from './CompareView';
import { CropView } from './CropView';
import { Icon } from './Icon';
import { NoticeAnnouncer } from './Notice';
import { Notes } from './OutputCard';
import { RecipeForm } from './RecipeForm';
import { ResultSummary } from './ResultSummary';
import { Scope } from './Scope';

type Tab = 'encuadre' | 'resultado' | 'comparar';

function ResultView({ image, recipe }: { image: SourceImage; recipe: Recipe }) {
  const result = useStore((s) => s.results[itemKey(image.id, recipe.id)]);
  const pending = !result || result.status === 'queued' || result.status === 'working';
  const img = useRef<HTMLImageElement>(null);
  const [percent, setPercent] = useState<number | null>(null);

  // Cuánto se ha reducido la copia para que quepa en la vista (el archivo no cambia).
  useLayoutEffect(() => {
    const node = img.current;
    if (!node) return;
    const measure = () =>
      setPercent(node.naturalWidth ? Math.round((node.clientWidth / node.naturalWidth) * 100) : null);
    measure();
    node.addEventListener('load', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener('load', measure);
      observer.disconnect();
    };
  }, [result?.url]);

  return (
    <div className="result-view">
      {result?.url && (
        <img
          ref={img}
          src={result.url}
          alt={`Resultado: ${recipe.name}`}
          className={pending ? 'is-stale' : undefined}
          data-testid="result-image"
        />
      )}
      {pending && (
        <span className="status result-view__status">
          <span className="spinner" />
          Preparando…
        </span>
      )}
      {result?.status === 'error' && (
        <span className="status status--error result-view__status">{result.error}</span>
      )}
      {percent !== null && !pending && (
        <span className="view-scale tabular">
          {percent >= 100 ? 'Vista a tamaño real' : `Vista reducida al ${percent} %`}
        </span>
      )}
    </div>
  );
}

const BACKGROUND_OPTIONS: Array<{ value: PreviewBackground; label: string }> = [
  { value: 'cuadros', label: 'Cuadros' },
  { value: 'claro', label: 'Claro' },
  { value: 'oscuro', label: 'Oscuro' },
];

function BackgroundToggle() {
  const previewBg = useStore((s) => s.previewBg);
  return (
    <div className="labelled" role="group" aria-labelledby="view-bg-label">
      <span id="view-bg-label" className="labelled__label">
        Fondo de vista
        <span className="visually-hidden"> (solo para revisar: no se añade a la copia)</span>
      </span>
      <div className="view-bgs">
        {BACKGROUND_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`view-bg bg-${option.value}`}
            aria-pressed={previewBg === option.value}
            aria-label={option.label}
            onClick={() => setPreviewBg(option.value)}
            title={`${option.label}: solo para revisar, no se añade a la copia`}
          />
        ))}
      </div>
    </div>
  );
}

/** El encuadre es lo único individual: se explica y se puede restablecer desde cualquier vista. */
function CropBar({
  image,
  recipe,
  active,
  onEdit,
}: {
  image: SourceImage;
  recipe: Recipe;
  active: boolean;
  onEdit: () => void;
}) {
  const custom = useStore((s) => Boolean(s.crops[itemKey(image.id, recipe.id)]));
  return (
    <div className="cropbar">
      <Scope />
      <p className="cropbar__text">
        {active ? (
          <>
            <strong>Encuadre:</strong> arrastra el marco para moverlo y una esquina para reducirlo. Con
            teclado: flechas, + y −.
          </>
        ) : (
          <>
            <strong>Encuadre {custom ? 'ajustado a mano' : 'centrado'}.</strong>{' '}
            <button type="button" className="link-btn" onClick={onEdit}>
              Cambiar encuadre
            </button>
          </>
        )}
      </p>
      <button
        type="button"
        className="btn btn--secondary btn--small"
        onClick={() => resetCrop(image.id, recipe.id)}
        disabled={!custom}
        title={custom ? 'Vuelve al encuadre centrado' : 'El encuadre ya está centrado'}
      >
        <Icon name="reset" />
        Restablecer encuadre
      </button>
    </div>
  );
}

function EditorDialog({ target }: { target: EditorTarget }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useStore((s) => s.images.find((i) => i.id === target.imageId));
  const recipe = useStore((s) => s.recipes.find((r) => r.id === target.recipeId));
  const warnings = useStore((s) => s.results[itemKey(target.imageId, target.recipeId)]?.warnings);
  const readyIds = useStore(
    useShallow((s) => s.images.filter((i) => i.status === 'ready').map((i) => i.id)),
  );
  const previewBg = useStore((s) => s.previewBg);
  const [tab, setTab] = useState<Tab>(recipe && effectiveMode(recipe) === 'crop' ? 'encuadre' : 'resultado');

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => node?.close();
  }, []);

  if (!image?.info || !recipe) return null;

  const mode = effectiveMode(recipe);
  const active: Tab = tab === 'encuadre' && mode !== 'crop' ? 'resultado' : tab;
  const position = readyIds.indexOf(image.id);
  const goTo = (offset: number) => {
    const next = readyIds[position + offset];
    if (next) openEditor(next, recipe.id);
  };
  // Proporción de lo que se ve, para dar a la vista la altura justa en pantallas estrechas.
  const output = computeLayout(image.info.width, image.info.height, recipe);
  const viewAspect =
    active === 'encuadre' ? image.info.width / image.info.height : output.cw / output.ch;
  const viewExtra = active === 'comparar' ? 150 : active === 'resultado' ? 22 : 0;
  const tabs: Array<{ value: Tab; label: string }> = [
    ...(mode === 'crop' ? [{ value: 'encuadre' as const, label: 'Encuadre' }] : []),
    { value: 'resultado', label: 'Resultado' },
    { value: 'comparar', label: 'Antes y después' },
  ];

  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby="editor-title"
      aria-describedby="editor-image"
      onClose={() => {
        // El evento llega después; si el diálogo vuelve a estar abierto, no era un cierre real.
        if (!dialog.current?.open) closeEditor();
      }}
      data-testid="editor"
    >
      <div className="editor__grid">
        <header className="editor__head">
          <div className="editor__heading">
            <p className="editor__eyebrow eyebrow">Versión</p>
            <h2 id="editor-title" className="editor__title display">
              {recipe.name}
            </h2>
            <p id="editor-image" className="editor__subtitle" title={image.name}>
              <Icon name="image" />
              <span>{image.name}</span>
            </p>
          </div>
          <nav className="editor__nav" aria-label="Cambiar de imagen">
            <button
              type="button"
              className="icon-btn"
              onClick={() => goTo(-1)}
              disabled={position <= 0}
              aria-label="Imagen anterior"
            >
              <Icon name="chevron-left" />
            </button>
            <span className="tabular">
              Imagen {position + 1} de {readyIds.length}
            </span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => goTo(1)}
              disabled={position >= readyIds.length - 1}
              aria-label="Imagen siguiente"
            >
              <Icon name="chevron-right" />
            </button>
          </nav>
          <p id="editor-saved" className="editor__saved">
            <Icon name="check" />
            Los cambios se guardan solos
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => dialog.current?.close()}
            aria-describedby="editor-saved"
          >
            <Icon name="check" />
            Listo
          </button>
        </header>

        <section className="editor__stage" aria-label="Vista previa de esta imagen">
          <div className="stage__toolbar">
            <div className="seg" role="group" aria-label="Qué ver">
              {tabs.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active === option.value}
                  onClick={() => setTab(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <BackgroundToggle />
          </div>
          <div
            className={`stage__view bg-${previewBg}`}
            style={{ '--view-ar': viewAspect, '--view-extra': `${viewExtra}px` } as CSSProperties}
          >
            {active === 'encuadre' && <CropView image={image} recipe={recipe} />}
            {active === 'resultado' && <ResultView image={image} recipe={recipe} />}
            {active === 'comparar' && <CompareView image={image} recipe={recipe} />}
          </div>
          <div className="stage__foot">
            {mode === 'crop' && (
              <CropBar
                image={image}
                recipe={recipe}
                active={active === 'encuadre'}
                onEdit={() => setTab('encuadre')}
              />
            )}
            <ResultSummary image={image} recipe={recipe} />
            {warnings && <Notes warnings={warnings} />}
          </div>
        </section>

        <aside className="editor__side" aria-labelledby="side-title">
          <div className="side__head">
            <h3 id="side-title" className="side__title display">
              Ajustes de la versión
            </h3>
            <Scope images={readyIds.length} />
          </div>
          <RecipeForm recipe={recipe} image={image} />
        </aside>
      </div>
      <NoticeAnnouncer areas={['version']} />
    </dialog>
  );
}

export function Editor() {
  const target = useStore((s) => s.editor);
  return target ? <EditorDialog target={target} /> : null;
}
