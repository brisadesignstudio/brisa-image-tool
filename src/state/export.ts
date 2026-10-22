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
import { formatBytes } from '../lib/format';
import type { NamingSettings, Recipe, RenderResult, SourceImage } from '../lib/types';
import type { ZipEntry } from '../engine/protocol';
import { buildSpec } from '../engine/spec';
import { getPool, syncRenders } from '../engine/renderer';
import { itemKey, showNotice, useStore, type AppState } from './store';

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

/** Copias que irán al ZIP: imágenes listas × versiones que cada imagen tiene seleccionadas. */
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

export interface ExportSummary {
  /** Archivos del ZIP: copias seleccionadas y, si se piden, originales (0 si no hay copias). */
  files: number;
  copies: number;
  images: number;
  versions: number;
  /** Combinaciones imagen × versión que no se descargarán. */
  excluded: number;
  originals: number;
  /** Copias seleccionadas que ya están listas. */
  ready: number;
  /** Copias listas que superan el peso máximo de su versión (se descargan igualmente). */
  overLimit: number;
  reading: number;
  unreadable: number;
  /** Imágenes listas sin ninguna versión seleccionada (no irán en el ZIP) y el nombre de la primera. */
  withoutVersions: number;
  firstWithoutVersions: string | null;
  /** Peso de lo que se descargará (copias listas y originales). */
  bytes: number;
  example: string | null;
}

/** Recuento y peso de la descarga con la selección actual. */
export function exportSummary(state: AppState): ExportSummary {
  const items = plannedItems(state);
  const images = state.images.filter((i) => i.status === 'ready');
  let bytes = 0;
  let ready = 0;
  let overLimit = 0;
  for (const item of items) {
    const result = state.results[item.key];
    if (result?.status === 'done' && result.size !== undefined) {
      bytes += result.size;
      ready += 1;
      if (item.recipe.maxBytes !== null && result.size > item.recipe.maxBytes) overLimit += 1;
    }
  }
  const originals = state.naming.includeOriginals && items.length > 0 ? images : [];
  for (const image of originals) bytes += image.size;
  const first = items[0];
  const firstResult = first ? state.results[first.key] : undefined;
  const selected = new Set(items.map((item) => item.image.id));
  const empty = state.recipes.length > 0 ? images.filter((image) => !selected.has(image.id)) : [];
  return {
    files: items.length > 0 ? items.length + originals.length : 0,
    copies: items.length,
    images: images.length,
    versions: state.recipes.length,
    excluded: images.length * state.recipes.length - items.length,
    originals: originals.length,
    ready,
    overLimit,
    reading: state.images.filter((i) => i.status === 'analyzing').length,
    unreadable: state.images.filter((i) => i.status === 'error').length,
    withoutVersions: empty.length,
    firstWithoutVersions: empty[0]?.name ?? null,
    bytes,
    example:
      first && firstResult?.format && firstResult.width
        ? outputFileName(state.naming, first.image, first.recipe, first.index, firstResult)
        : null,
  };
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

/**
 * Espera a que estén listas las copias seleccionadas. La selección se vuelve a leer en
 * cada paso: si cambia mientras tanto, el ZIP refleja la selección del momento final.
 */
function waitForRenders(): Promise<PlannedItem[]> {
  return new Promise((resolve) => {
    const check = () => {
      const state = useStore.getState();
      const items = plannedItems(state);
      const finished = items.filter((item) => {
        const result = state.results[item.key];
        return isCurrent(state, item) && (result.status === 'done' || result.status === 'error');
      }).length;
      useStore.setState({ exporting: { phase: 'waiting', done: finished, total: items.length } });
      if (finished === items.length) {
        unsubscribe();
        resolve(items);
      }
    };
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (
        state.results !== prev.results ||
        state.excluded !== prev.excluded ||
        state.recipes !== prev.recipes ||
        state.images !== prev.images ||
        state.crops !== prev.crops
      ) {
        check();
      }
    });
    check();
  });
}

/** Inicia la descarga de un archivo generado en el navegador. */
export function downloadBlob(blob: Blob, fileName: string) {
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
    const items = await waitForRenders();
    const state = useStore.getState();
    if (items.length === 0) {
      showNotice(
        'descarga',
        'info',
        state.recipes.length === 0
          ? 'Aún no hay nada que descargar: añade al menos una versión (paso 2).'
          : 'No hay nada seleccionado para descargar: activa al menos una versión en «Versiones de esta imagen» (paso 3).',
      );
      return;
    }
    const failed = items.filter((item) => state.results[item.key]?.status === 'error');
    if (failed.length) {
      const names = failed
        .slice(0, 3)
        .map((item) => `${item.image.name} (${item.recipe.name})`)
        .join(', ');
      const more = failed.length > 3 ? ` y ${failed.length - 3} más` : '';
      showNotice(
        'descarga',
        'error',
        failed.length === 1
          ? `No se pudo preparar una copia: ${names}. Pulsa «Reintentar» en su tarjeta o desactiva «Incluir en la descarga» y vuelve a descargar.`
          : `No se pudieron preparar ${failed.length} copias: ${names}${more}. Pulsa «Reintentar» en sus tarjetas o desactiva «Incluir en la descarga» y vuelve a descargar.`,
      );
      return;
    }
    const date = new Date();
    const entries = planZip(state, date);
    useStore.setState({ exporting: { phase: 'zipping', done: 0, total: entries.length } });
    const zip = await getPool().run<Blob>({ type: 'zip', entries }, { priority: 100 });
    const fileName = `${zipBaseName(state.naming, date)}.zip`;
    downloadBlob(zip, fileName);
    const heavy = items.filter((item) => {
      const size = state.results[item.key]?.size;
      return item.recipe.maxBytes !== null && size !== undefined && size > item.recipe.maxBytes;
    }).length;
    const overNote = heavy
      ? ` Incluye ${heavy === 1 ? '1 archivo que supera' : `${heavy} archivos que superan`} el peso máximo de su versión.`
      : '';
    const unreadable = state.images.filter((i) => i.status === 'error');
    const skipped = unreadable.length
      ? ` No incluye ${unreadable.length === 1 ? `«${unreadable[0].name}», que no se pudo leer` : `${unreadable.length} imágenes que no se pudieron leer`}.`
      : '';
    showNotice(
      'descarga',
      'ok',
      `Descarga iniciada: ${fileName} (${entries.length} ${entries.length === 1 ? 'archivo' : 'archivos'}; el ZIP pesa ${formatBytes(zip.size)}). Búscalo en las descargas de tu navegador.${overNote}${skipped}`,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'error desconocido';
    showNotice('descarga', 'error', `No se pudo crear el ZIP (${reason}). Vuelve a intentarlo; si se repite, descarga menos imágenes a la vez.`);
  } finally {
    useStore.setState({ exporting: null });
  }
}
