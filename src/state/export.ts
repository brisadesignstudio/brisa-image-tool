import {
  UniquePaths,
  extensionFor,
  folderFor,
  joinPath,
  renderPattern,
  safeFileName,
  slugify,
  todayStamp,
} from '../lib/naming';
import type { NamingSettings, Recipe, RenderResult, SourceImage } from '../lib/types';
import type { ZipEntry } from '../engine/protocol';
import { buildSpec } from '../engine/spec';
import { getPool, syncRenders } from '../engine/renderer';
import { itemKey, showToast, useStore, type AppState } from './store';

export function zipBaseName(naming: NamingSettings, date = new Date()): string {
  return `${slugify(naming.zipName) || 'brisa-imagenes'}-${todayStamp(date)}`;
}

/** Nombre de archivo de una copia (sin carpeta). */
export function outputFileName(
  naming: NamingSettings,
  image: SourceImage,
  recipe: Recipe,
  index: number,
  result: Pick<RenderResult, 'width' | 'height' | 'format'>,
): string {
  const base = renderPattern(
    naming.pattern,
    {
      nombre: image.baseName,
      salida: recipe.suffix,
      ancho: result.width ?? 0,
      alto: result.height ?? 0,
      n: index + 1,
    },
    naming.normalize,
  );
  return `${base}.${extensionFor(result.format ?? 'jpeg')}`;
}

export interface PlannedItem {
  key: string;
  image: SourceImage;
  recipe: Recipe;
  index: number;
}

/** Copias que irán al ZIP (imágenes listas, salidas activas, sin excluir). */
export function plannedItems(state: AppState): PlannedItem[] {
  const items: PlannedItem[] = [];
  state.images
    .filter((image) => image.status === 'ready')
    .forEach((image, index) => {
      for (const recipe of state.recipes) {
        const key = itemKey(image.id, recipe.id);
        if (!state.excluded[key]) items.push({ key, image, recipe, index });
      }
    });
  return items;
}

/** Rutas del ZIP: carpeta raíz con fecha, carpetas por salida o por imagen y originales aparte. */
export function planZip(state: AppState, date = new Date()): ZipEntry[] {
  const root = zipBaseName(state.naming, date);
  const unique = new UniquePaths();
  const entries: ZipEntry[] = [];
  for (const item of plannedItems(state)) {
    const result = state.results[item.key];
    if (!result?.blob || result.status !== 'done') continue;
    const folder = folderFor(state.naming.folders, item.recipe.suffix, item.image.baseName, state.naming.normalize);
    const name = outputFileName(state.naming, item.image, item.recipe, item.index, result);
    entries.push({ path: unique.claim(joinPath(root, folder, name)), blob: result.blob });
  }
  if (state.naming.includeOriginals) {
    for (const image of state.images.filter((i) => i.status === 'ready')) {
      const name = safeFileName(image.name) || 'original';
      entries.push({ path: unique.claim(joinPath(root, 'originales', name)), blob: image.file });
    }
  }
  return entries;
}

function isCurrent(state: AppState, item: PlannedItem): boolean {
  const result = state.results[item.key];
  const spec = buildSpec(item.image, item.recipe, state.crops[item.key]);
  return Boolean(result && spec && result.key === spec.key);
}

/** Espera a que terminen de leerse todas las imágenes (si no, se quedarían fuera del ZIP). */
function waitForAnalysis(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const { images } = useStore.getState();
      const reading = images.filter((i) => i.status === 'analyzing').length;
      if (reading === 0) {
        unsubscribe();
        resolve();
        return;
      }
      useStore.setState({
        exporting: { phase: 'reading', done: images.length - reading, total: images.length },
      });
    };
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.images !== prev.images) check();
    });
    check();
  });
}

function waitForRenders(items: PlannedItem[]): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const state = useStore.getState();
      const finished = items.filter((item) => {
        const result = state.results[item.key];
        return isCurrent(state, item) && (result.status === 'done' || result.status === 'error');
      }).length;
      useStore.setState({ exporting: { phase: 'waiting', done: finished, total: items.length } });
      if (finished === items.length) {
        unsubscribe();
        resolve();
      }
    };
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.results !== prev.results) check();
    });
    check();
  });
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function exportZip() {
  if (useStore.getState().exporting) return;
  try {
    await waitForAnalysis();
    syncRenders();
    const items = plannedItems(useStore.getState());
    if (items.length === 0) {
      showToast('info', 'No hay copias para descargar: añade imágenes y al menos una salida.');
      return;
    }
    await waitForRenders(items);
    const state = useStore.getState();
    const failed = items.filter((item) => state.results[item.key]?.status === 'error');
    if (failed.length) {
      showToast(
        'error',
        failed.length === 1
          ? 'Una copia no se pudo preparar. Revísala (está marcada) o exclúyela del ZIP.'
          : `${failed.length} copias no se pudieron preparar. Revísalas (están marcadas) o exclúyelas del ZIP.`,
      );
      return;
    }
    const date = new Date();
    const entries = planZip(state, date);
    useStore.setState({ exporting: { phase: 'zipping', done: 0, total: entries.length } });
    const zip = await getPool().run<Blob>({ type: 'zip', entries }, { priority: 100 });
    download(zip, `${zipBaseName(state.naming, date)}.zip`);
    showToast('ok', `Listo: ${entries.length} ${entries.length === 1 ? 'archivo' : 'archivos'} en tu ZIP.`);
  } catch (error) {
    showToast('error', error instanceof Error ? error.message : 'No se pudo crear el ZIP.');
  } finally {
    useStore.setState({ exporting: null });
  }
}
