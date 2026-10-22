import { itemKey, useStore } from '../state/store';
import type { RenderResult } from '../lib/types';
import { CancelledError, WorkerPool, defaultPoolSize } from './pool';
import type { RenderOutput } from './protocol';
import { buildSpec, warningsFor, type RenderSpec } from './spec';

let poolInstance: WorkerPool | null = null;

export function getPool(): WorkerPool {
  return (poolInstance ??= new WorkerPool(defaultPoolSize()));
}

const PRIORITY = { editor: 30, selected: 20, rest: 0 } as const;

function priorityFor(imageId: string, recipeId: string): number {
  const s = useStore.getState();
  if (s.editor?.imageId === imageId && s.editor.recipeId === recipeId) return PRIORITY.editor;
  if (s.selectedId === imageId) return PRIORITY.selected;
  return PRIORITY.rest;
}

function patchResult(key: string, result: RenderResult) {
  useStore.setState((s) => ({ results: { ...s.results, [key]: result } }));
}

async function launch(key: string, imageId: string, recipeId: string, spec: RenderSpec) {
  try {
    const output = await getPool().run<RenderOutput>(
      { type: 'render', job: { ...spec.job, includeRaw: false } },
      { imageId, priority: priorityFor(imageId, recipeId), tag: key },
    );
    const s = useStore.getState();
    const current = s.results[key];
    const image = s.images.find((i) => i.id === imageId);
    const recipe = s.recipes.find((r) => r.id === recipeId);
    // Si mientras tanto cambió algo, este resultado ya no vale.
    if (!current || current.key !== spec.key || !image || !recipe) return;
    if (current.url) URL.revokeObjectURL(current.url);
    patchResult(key, {
      key: spec.key,
      status: 'done',
      blob: output.blob,
      url: URL.createObjectURL(output.blob),
      width: output.width,
      height: output.height,
      size: output.size,
      format: spec.format,
      keptOriginal: output.keptOriginal,
      warnings: warningsFor(image, recipe, spec, output),
    });
  } catch (error) {
    if (error instanceof CancelledError) return;
    const current = useStore.getState().results[key];
    if (!current || current.key !== spec.key) return;
    patchResult(key, {
      ...current,
      status: 'error',
      error: error instanceof Error ? error.message : 'No se pudo preparar esta copia.',
    });
  }
}

/** Compara lo pedido con lo que hay y lanza solo los renderizados que faltan. */
export function syncRenders() {
  const s = useStore.getState();
  const pool = getPool();
  const live = new Set<string>();
  const updates: Record<string, RenderResult> = {};

  for (const image of s.images) {
    if (image.status !== 'ready') continue;
    for (const recipe of s.recipes) {
      const key = itemKey(image.id, recipe.id);
      live.add(key);
      const spec = buildSpec(image, recipe, s.crops[key]);
      if (!spec) continue;
      const current = s.results[key];
      if (current && current.key === spec.key) {
        if (current.status === 'queued') pool.reprioritize(key, priorityFor(image.id, recipe.id));
        continue;
      }
      pool.cancel((tag) => tag === key);
      // Se mantiene la vista anterior mientras se prepara la nueva.
      updates[key] = {
        key: spec.key,
        status: 'queued',
        warnings: current?.warnings ?? warningsFor(image, recipe, spec),
        blob: current?.blob,
        url: current?.url,
        width: current?.width,
        height: current?.height,
        size: current?.size,
        format: current?.format,
        keptOriginal: current?.keptOriginal,
      };
      void launch(key, image.id, recipe.id, spec);
    }
  }

  const stale = Object.keys(s.results).filter((key) => !live.has(key));
  if (stale.length === 0 && Object.keys(updates).length === 0) return;
  for (const key of stale) {
    pool.cancel((tag) => tag === key);
    const url = s.results[key].url;
    if (url) URL.revokeObjectURL(url);
  }
  useStore.setState((state) => {
    const results = { ...state.results, ...updates };
    for (const key of stale) delete results[key];
    return { results };
  });
}

let timer: ReturnType<typeof setTimeout> | undefined;

export function startRenderer() {
  useStore.subscribe((state, prev) => {
    if (
      state.images !== prev.images ||
      state.recipes !== prev.recipes ||
      state.crops !== prev.crops ||
      state.selectedId !== prev.selectedId ||
      state.editor !== prev.editor
    ) {
      clearTimeout(timer);
      timer = setTimeout(syncRenders, 80);
    }
  });
}

/** Para la comparación antes/después: la copia y sus píxeles sin comprimir. */
export async function renderForCompare(imageId: string, recipeId: string) {
  const s = useStore.getState();
  const image = s.images.find((i) => i.id === imageId);
  const recipe = s.recipes.find((r) => r.id === recipeId);
  if (!image || !recipe) return null;
  const spec = buildSpec(image, recipe, s.crops[itemKey(imageId, recipeId)]);
  if (!spec) return null;
  const tag = `compare|${itemKey(imageId, recipeId)}`;
  getPool().cancel((t) => t === tag);
  const output = await getPool().run<RenderOutput>(
    { type: 'render', job: { ...spec.job, includeRaw: true } },
    { imageId, priority: PRIORITY.editor + 1, tag },
  );
  return { key: spec.key, output };
}
