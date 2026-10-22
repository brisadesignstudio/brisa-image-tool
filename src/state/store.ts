import { create } from 'zustand';
import {
  BUILT_IN_PRESETS,
  DEFAULT_RECIPE_PRESETS,
  recipeFromPreset,
  sanitizePackage,
  sanitizeSettings,
} from '../lib/presets';
import { defaultNaming, sanitizeNaming } from '../lib/naming';
import { loadSetting, saveSetting, storageAvailable } from '../lib/storage';
import type {
  CropRect,
  NamingSettings,
  Preset,
  PreviewBackground,
  Recipe,
  RenderResult,
  SettingsPackage,
  SourceImage,
} from '../lib/types';

export const itemKey = (imageId: string, recipeId: string) => `${imageId}|${recipeId}`;

export interface EditorTarget {
  imageId: string;
  recipeId: string;
}

/** Zona de la interfaz donde se muestra el aviso (junto a lo que se refiere). */
export type NoticeArea = 'imagenes' | 'versiones' | 'revision' | 'descarga' | 'version' | 'paquetes';

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
  /** Paquetes de ajustes guardados (varias versiones y sus nombres de archivo). */
  packages: SettingsPackage[];
  /** false si el navegador no permite guardar: lo de esta sesión no se conservará al cerrar. */
  storageReady: boolean;
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

function loadPackages(): SettingsPackage[] {
  return loadSetting<SettingsPackage[]>('paquetes', [], (raw) => {
    if (!Array.isArray(raw)) return null;
    return raw.flatMap((item) => {
      const valid = sanitizePackage(item);
      const id = (item as { id?: unknown })?.id;
      return valid ? [{ ...valid.pkg, id: typeof id === 'string' ? id : valid.pkg.id }] : [];
    });
  });
}

function loadNaming(): NamingSettings {
  return loadSetting<NamingSettings>('nombres', defaultNaming(), sanitizeNaming);
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
  packages: loadPackages(),
  storageReady: storageAvailable(),
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
  if (state.packages !== prev.packages && !saveSetting('paquetes', state.packages) && state.storageReady) {
    // Falló al guardar (p. ej., cuota llena): se avisa y la sesión sigue igual.
    useStore.setState({ storageReady: false });
  }
  if (state.naming !== prev.naming) saveSetting('nombres', state.naming);
  if (state.previewBg !== prev.previewBg) saveSetting('fondo-vista', state.previewBg);
});

let noticeId = 0;
export function showNotice(area: NoticeArea, kind: Notice['kind'], text: string, action?: Notice['action']) {
  useStore.setState({ notice: { id: ++noticeId, area, kind, text, action } });
}
