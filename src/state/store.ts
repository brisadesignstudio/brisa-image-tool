import { create } from 'zustand';
import {
  BUILT_IN_PRESETS,
  DEFAULT_RECIPE_PRESETS,
  recipeFromPreset,
  sanitizeSettings,
} from '../lib/presets';
import { defaultNaming } from '../lib/naming';
import { loadSetting, saveSetting } from '../lib/storage';
import type {
  CropRect,
  FolderMode,
  NamingSettings,
  Preset,
  PreviewBackground,
  Recipe,
  RenderResult,
  SourceImage,
} from '../lib/types';

export const itemKey = (imageId: string, recipeId: string) => `${imageId}|${recipeId}`;

export interface EditorTarget {
  imageId: string;
  recipeId: string;
}

/** Zona de la interfaz donde se muestra el aviso (junto a lo que se refiere). */
export type NoticeArea = 'imagenes' | 'versiones' | 'revision' | 'descarga' | 'version';

export interface Notice {
  id: number;
  area: NoticeArea;
  kind: 'info' | 'ok' | 'error';
  text: string;
  /** Acción opcional junto al aviso, p. ej. «Deshacer», y dónde dejar el foco después. */
  action?: { label: string; run: () => void; focusAfter?: string };
}

export interface ExportProgress {
  phase: 'reading' | 'waiting' | 'zipping';
  done: number;
  total: number;
}

export interface AppState {
  images: SourceImage[];
  selectedId: string | null;
  /** Versiones para exportar: se aplican a todas las imágenes. */
  recipes: Recipe[];
  /** Ajustes guardados por la usuaria. */
  customPresets: Preset[];
  /** Encuadre manual por imagen y versión. */
  crops: Record<string, CropRect>;
  /**
   * Combinaciones imagen × versión que no se descargan. Por defecto no hay ninguna:
   * cada imagen exporta todas las versiones. No toca ajustes ni encuadres.
   */
  excluded: Record<string, true>;
  results: Record<string, RenderResult>;
  naming: NamingSettings;
  previewBg: PreviewBackground;
  editor: EditorTarget | null;
  exporting: ExportProgress | null;
  notice: Notice | null;
}

function loadRecipes(): Recipe[] {
  const defaults = () =>
    DEFAULT_RECIPE_PRESETS.map((id) => BUILT_IN_PRESETS.find((p) => p.id === id))
      .filter((p): p is Preset => Boolean(p))
      .map(recipeFromPreset);
  return loadSetting<Recipe[]>('salidas', defaults(), (raw) => {
    if (!Array.isArray(raw)) return null;
    return raw.flatMap((item) => {
      const settings = sanitizeSettings(item);
      const id = (item as { id?: unknown })?.id;
      return settings && typeof id === 'string' ? [{ id, ...settings }] : [];
    });
  });
}

function loadPresets(): Preset[] {
  return loadSetting<Preset[]>('ajustes', [], (raw) => {
    if (!Array.isArray(raw)) return null;
    return raw.flatMap((item) => {
      const settings = sanitizeSettings(item);
      const id = (item as { id?: unknown })?.id;
      return settings && typeof id === 'string'
        ? [{ ...settings, id, group: 'propio' as const, builtIn: false }]
        : [];
    });
  });
}

function loadNaming(): NamingSettings {
  const defaults = defaultNaming();
  return loadSetting<NamingSettings>('nombres', defaults, (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Partial<Record<keyof NamingSettings, unknown>>;
    const folders: FolderMode[] = ['salida', 'imagen', 'ninguna'];
    return {
      pattern:
        typeof r.pattern === 'string' ? r.pattern.slice(0, 120).replaceAll('{salida}', '{version}') : defaults.pattern,
      normalize: typeof r.normalize === 'boolean' ? r.normalize : defaults.normalize,
      folders: folders.includes(r.folders as FolderMode) ? (r.folders as FolderMode) : defaults.folders,
      includeOriginals:
        typeof r.includeOriginals === 'boolean' ? r.includeOriginals : defaults.includeOriginals,
      zipName: typeof r.zipName === 'string' && r.zipName.trim() ? r.zipName.slice(0, 60) : defaults.zipName,
    };
  });
}

function loadPreviewBg(): PreviewBackground {
  return loadSetting<PreviewBackground>('fondo-vista', 'cuadros', (raw) =>
    raw === 'cuadros' || raw === 'claro' || raw === 'oscuro' ? raw : null,
  );
}

export const useStore = create<AppState>(() => ({
  images: [],
  selectedId: null,
  recipes: loadRecipes(),
  customPresets: loadPresets(),
  crops: {},
  excluded: {},
  results: {},
  naming: loadNaming(),
  previewBg: loadPreviewBg(),
  editor: null,
  exporting: null,
  notice: null,
}));

// Los ajustes (nunca las imágenes) se guardan en este dispositivo.
useStore.subscribe((state, prev) => {
  if (state.recipes !== prev.recipes) saveSetting('salidas', state.recipes);
  if (state.customPresets !== prev.customPresets) saveSetting('ajustes', state.customPresets);
  if (state.naming !== prev.naming) saveSetting('nombres', state.naming);
  if (state.previewBg !== prev.previewBg) saveSetting('fondo-vista', state.previewBg);
});

let noticeId = 0;
export function showNotice(area: NoticeArea, kind: Notice['kind'], text: string, action?: Notice['action']) {
  useStore.setState({ notice: { id: ++noticeId, area, kind, text, action } });
}
