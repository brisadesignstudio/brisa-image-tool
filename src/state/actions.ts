import { CUSTOM_RECIPE, newId, presetFromRecipe, recipeFromPreset } from '../lib/presets';
import { stripExtension } from '../lib/naming';
import { sniffFormat } from '../lib/sniff';
import type { CropRect, NamingSettings, PreviewBackground, Recipe, RecipeSettings, SourceImage } from '../lib/types';
import type { AnalyzeResult } from '../engine/protocol';
import { getPool, syncRenders } from '../engine/renderer';
import { itemKey, showNotice, useStore } from './store';

const set = useStore.setState;
const get = useStore.getState;

function patchImage(id: string, patch: Partial<SourceImage>) {
  set((s) => ({ images: s.images.map((img) => (img.id === id ? { ...img, ...patch } : img)) }));
}

async function isSupported(file: File): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    return sniffFormat(head) !== null;
  } catch {
    return false;
  }
}

export async function addFiles(list: FileList | File[]) {
  const files = Array.from(list);
  if (files.length === 0) return;
  const checks = await Promise.all(files.map(isSupported));
  const accepted = files.filter((_, i) => checks[i]);
  const rejected = files.filter((_, i) => !checks[i]);
  if (rejected.length) {
    const names = rejected.slice(0, 3).map((f) => `«${f.name}»`).join(', ');
    const more = rejected.length > 3 ? ` y ${rejected.length - 3} más` : '';
    showNotice(
      'imagenes',
      'error',
      rejected.length === 1
        ? `${names} no se puede abrir: solo se admiten JPG, PNG y WebP. Expórtala en uno de esos formatos y vuelve a añadirla.`
        : `${names}${more} no se pueden abrir: solo se admiten JPG, PNG y WebP. Expórtalas en uno de esos formatos y vuelve a añadirlas.`,
    );
  }
  if (accepted.length === 0) return;

  const fresh: SourceImage[] = accepted.map((file) => ({
    id: newId('img'),
    file,
    name: file.name,
    baseName: stripExtension(file.name),
    size: file.size,
    status: 'analyzing',
  }));
  set((s) => ({ images: [...s.images, ...fresh], selectedId: s.selectedId ?? fresh[0].id }));

  await Promise.all(
    fresh.map(async (image) => {
      try {
        const result = await getPool().run<AnalyzeResult>(
          { type: 'analyze', imageId: image.id, file: image.file },
          { imageId: image.id, priority: 50 },
        );
        if (!get().images.some((i) => i.id === image.id)) return;
        patchImage(image.id, {
          status: 'ready',
          info: result.info,
          thumbUrl: URL.createObjectURL(result.thumb),
          previewUrl: URL.createObjectURL(result.preview),
          previewWidth: result.previewWidth,
          previewHeight: result.previewHeight,
        });
      } catch (error) {
        patchImage(image.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'No se pudo leer esta imagen.',
        });
      }
    }),
  );
}

function dropKeys<T>(record: Record<string, T>, test: (key: string) => boolean): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) if (!test(key)) next[key] = value;
  return next;
}

export function removeImage(id: string) {
  const s = get();
  const image = s.images.find((i) => i.id === id);
  if (!image) return;
  if (image.thumbUrl) URL.revokeObjectURL(image.thumbUrl);
  if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
  const index = s.images.indexOf(image);
  const images = s.images.filter((i) => i.id !== id);
  const ofImage = (key: string) => key.startsWith(`${id}|`);
  set({
    images,
    selectedId:
      s.selectedId === id ? (images[Math.min(index, images.length - 1)]?.id ?? null) : s.selectedId,
    crops: dropKeys(s.crops, ofImage),
    excluded: dropKeys(s.excluded, ofImage),
    editor: s.editor?.imageId === id ? null : s.editor,
  });
  getPool().broadcast({ type: 'forget', imageId: id });
}

export function removeAllImages() {
  for (const image of [...get().images]) removeImage(image.id);
}

export function selectImage(id: string) {
  set({ selectedId: id });
}

export function renameImage(id: string, baseName: string) {
  patchImage(id, { baseName: baseName.slice(0, 120) });
}

export function addRecipe(settings: RecipeSettings): Recipe {
  const recipe = recipeFromPreset(settings);
  set((s) => ({ recipes: [...s.recipes, recipe] }));
  return recipe;
}

export function addCustomRecipe(): Recipe {
  return addRecipe(CUSTOM_RECIPE);
}

export function updateRecipe(id: string, patch: Partial<RecipeSettings>) {
  set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
}

function pickKeys<T>(record: Record<string, T>, test: (key: string) => boolean): Record<string, T> {
  const picked: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) if (test(key)) picked[key] = value;
  return picked;
}

/** Quita una versión de todas las imágenes; se puede deshacer (con sus encuadres) desde el aviso. */
export function removeRecipe(id: string) {
  const s = get();
  const index = s.recipes.findIndex((r) => r.id === id);
  if (index < 0) return;
  const recipe = s.recipes[index];
  const ofRecipe = (key: string) => key.endsWith(`|${id}`);
  const crops = pickKeys(s.crops, ofRecipe);
  const excluded = pickKeys(s.excluded, ofRecipe);
  set({
    recipes: s.recipes.filter((r) => r.id !== id),
    crops: dropKeys(s.crops, ofRecipe),
    excluded: dropKeys(s.excluded, ofRecipe),
    editor: s.editor?.recipeId === id ? null : s.editor,
  });
  showNotice('versiones', 'info', `Versión «${recipe.name}» quitada de todas las imágenes.`, {
    label: 'Deshacer',
    focusAfter: `[data-recipe="${recipe.id}"] .chip__label`,
    run: () => {
      set((now) => {
        const recipes = [...now.recipes];
        recipes.splice(Math.min(index, recipes.length), 0, recipe);
        return {
          recipes,
          crops: { ...now.crops, ...crops },
          excluded: { ...now.excluded, ...excluded },
          notice: null,
        };
      });
    },
  });
}

export function saveRecipeAsPreset(recipeId: string, name: string) {
  const recipe = get().recipes.find((r) => r.id === recipeId);
  if (!recipe) return;
  const preset = presetFromRecipe(recipe, name.trim() || recipe.name);
  set((s) => ({ customPresets: [...s.customPresets, preset] }));
  showNotice('version', 'ok', `Ajuste «${preset.name}» guardado en este equipo. Lo encontrarás en «Añadir versión».`);
}

export function deletePreset(id: string) {
  set((s) => ({ customPresets: s.customPresets.filter((p) => p.id !== id) }));
}

export function setCrop(imageId: string, recipeId: string, crop: CropRect) {
  set((s) => ({ crops: { ...s.crops, [itemKey(imageId, recipeId)]: crop } }));
}

export function resetCrop(imageId: string, recipeId: string) {
  set((s) => ({ crops: dropKeys(s.crops, (key) => key === itemKey(imageId, recipeId)) }));
}

/** Vuelve a intentar una copia que falló. */
export function retryItem(imageId: string, recipeId: string) {
  const key = itemKey(imageId, recipeId);
  set((s) => ({ results: dropKeys(s.results, (k) => k === key) }));
  syncRenders();
}

export function toggleExcluded(imageId: string, recipeId: string) {
  const key = itemKey(imageId, recipeId);
  set((s) =>
    s.excluded[key]
      ? { excluded: dropKeys(s.excluded, (k) => k === key) }
      : { excluded: { ...s.excluded, [key]: true as const } },
  );
}

export function setNaming(patch: Partial<NamingSettings>) {
  set((s) => ({ naming: { ...s.naming, ...patch } }));
}

export function setPreviewBg(previewBg: PreviewBackground) {
  set({ previewBg });
}

export function openEditor(imageId: string, recipeId: string) {
  set({ editor: { imageId, recipeId }, selectedId: imageId });
}

export function closeEditor() {
  set({ editor: null });
}

export function dismissNotice() {
  set({ notice: null });
}
