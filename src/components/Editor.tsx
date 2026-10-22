import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { itemKey, useStore, type EditorTarget } from '../state/store';
import { closeEditor, openEditor, setPreviewBg } from '../state/actions';
import { effectiveMode } from '../lib/geometry';
import type { PreviewBackground, Recipe, SourceImage } from '../lib/types';
import { CompareView } from './CompareView';
import { CropView } from './CropView';
import { Icon } from './Icon';
import { RecipeForm } from './RecipeForm';

type Tab = 'encuadre' | 'resultado' | 'comparar';

function ResultView({ image, recipe }: { image: SourceImage; recipe: Recipe }) {
  const result = useStore((s) => s.results[itemKey(image.id, recipe.id)]);
  const pending = !result || result.status === 'queued' || result.status === 'working';
  return (
    <div className="result-view">
      {result?.url && (
        <img
          src={result.url}
          alt={`Resultado: ${recipe.name}`}
          className={pending ? 'is-stale' : undefined}
          data-testid="result-image"
        />
      )}
      {pending && (
        <span className="status">
          <span className="spinner" />
          Preparando…
        </span>
      )}
      {result?.status === 'error' && <span className="status status--error">{result.error}</span>}
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
    <div className="seg" role="group" aria-label="Fondo de la vista previa">
      {BACKGROUND_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={previewBg === option.value}
          onClick={() => setPreviewBg(option.value)}
          title="Fondo solo para revisar: no se añade a la copia"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function EditorDialog({ target }: { target: EditorTarget }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useStore((s) => s.images.find((i) => i.id === target.imageId));
  const recipe = useStore((s) => s.recipes.find((r) => r.id === target.recipeId));
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

  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby="editor-title"
      onClose={() => {
        // El evento llega después; si el diálogo vuelve a estar abierto, no era un cierre real.
        if (!dialog.current?.open) closeEditor();
      }}
      data-testid="editor"
    >
      <div className="editor__grid">
        <header className="editor__head">
          <div className="editor__heading">
            <h2 id="editor-title" className="editor__title display">
              {recipe.name}
            </h2>
            <p className="editor__subtitle">{image.name}</p>
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
              {position + 1} de {readyIds.length}
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
          <button type="button" className="btn btn--primary" onClick={() => dialog.current?.close()}>
            <Icon name="check" />
            Listo
          </button>
        </header>
        <section className="editor__stage" aria-label="Vista previa">
          <div className="stage__toolbar">
            <div className="seg" role="group" aria-label="Qué ver">
              {mode === 'crop' && (
                <button type="button" aria-pressed={active === 'encuadre'} onClick={() => setTab('encuadre')}>
                  Encuadre
                </button>
              )}
              <button type="button" aria-pressed={active === 'resultado'} onClick={() => setTab('resultado')}>
                Resultado
              </button>
              <button type="button" aria-pressed={active === 'comparar'} onClick={() => setTab('comparar')}>
                Antes / después
              </button>
            </div>
            <BackgroundToggle />
          </div>
          <div className={`stage__view bg-${previewBg}`}>
            {active === 'encuadre' && <CropView image={image} recipe={recipe} />}
            {active === 'resultado' && <ResultView image={image} recipe={recipe} />}
            {active === 'comparar' && <CompareView image={image} recipe={recipe} />}
          </div>
        </section>
        <aside className="editor__side" aria-label="Ajustes">
          <RecipeForm recipe={recipe} image={image} />
        </aside>
      </div>
    </dialog>
  );
}

export function Editor() {
  const target = useStore((s) => s.editor);
  return target ? <EditorDialog target={target} /> : null;
}
