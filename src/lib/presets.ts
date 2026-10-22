import { sanitizeNaming } from './naming';
import type { NamingSettings, Preset, Recipe, RecipeSettings, SettingsPackage } from './types';

/** Calidad mínima propuesta al activar el peso máximo. */
export const DEFAULT_MIN_QUALITY = 60;
/** Peso máximo propuesto al activarlo: 300 KB. */
export const DEFAULT_MAX_BYTES = 300_000;
/** Límites del peso máximo admitido: de 1 KB a 100 MB. */
export const MIN_MAX_BYTES = 1_000;
export const MAX_MAX_BYTES = 100_000_000;

const base = {
  lossless: false,
  background: '#ffffff',
  margin: 0,
  maxBytes: null,
  minQuality: DEFAULT_MIN_QUALITY,
} satisfies Partial<RecipeSettings>;

/** Ajustes de fábrica. Medidas recomendadas por cada plataforma en 2026. */
export const BUILT_IN_PRESETS: readonly Preset[] = [
  {
    ...base,
    id: 'web-portada',
    builtIn: true,
    group: 'web',
    name: 'Portada web',
    hint: 'Imágenes a todo lo ancho de la pantalla',
    suffix: 'portada',
    mode: 'fit',
    width: 1920,
    height: null,
    format: 'webp',
    quality: 80,
  },
  {
    ...base,
    id: 'web-contenido',
    builtIn: true,
    group: 'web',
    name: 'Contenido web',
    hint: 'Imágenes dentro de una página o un blog',
    suffix: 'web',
    mode: 'fit',
    width: 1200,
    height: null,
    format: 'webp',
    quality: 80,
  },
  {
    ...base,
    id: 'web-miniatura',
    builtIn: true,
    group: 'web',
    name: 'Miniatura web',
    hint: 'Tarjetas, galerías y listados',
    suffix: 'miniatura',
    mode: 'fit',
    width: 600,
    height: null,
    format: 'webp',
    quality: 80,
  },
  {
    ...base,
    id: 'web-enlace',
    builtIn: true,
    group: 'web',
    name: 'Vista previa de enlace',
    hint: 'La imagen que aparece al compartir tu web (Open Graph)',
    suffix: 'enlace',
    mode: 'crop',
    width: 1200,
    height: 630,
    format: 'jpeg',
    quality: 85,
  },
  {
    ...base,
    id: 'web-optimizar',
    builtIn: true,
    group: 'web',
    name: 'Solo optimizar',
    hint: 'Mismo tamaño y formato, menos peso',
    suffix: 'optimizada',
    mode: 'fit',
    width: null,
    height: null,
    format: 'original',
    quality: 82,
  },
  {
    ...base,
    id: 'ig-1x1',
    builtIn: true,
    group: 'redes',
    name: 'Instagram cuadrado',
    hint: 'Publicación 1:1',
    suffix: 'ig-1x1',
    mode: 'crop',
    width: 1080,
    height: 1080,
    format: 'jpeg',
    quality: 90,
  },
  {
    ...base,
    id: 'ig-4x5',
    builtIn: true,
    group: 'redes',
    name: 'Instagram vertical 4:5',
    hint: 'Publicación vertical clásica',
    suffix: 'ig-4x5',
    mode: 'crop',
    width: 1080,
    height: 1350,
    format: 'jpeg',
    quality: 90,
  },
  {
    ...base,
    id: 'ig-3x4',
    builtIn: true,
    group: 'redes',
    name: 'Instagram vertical 3:4',
    hint: 'El formato de la cuadrícula del perfil',
    suffix: 'ig-3x4',
    mode: 'crop',
    width: 1080,
    height: 1440,
    format: 'jpeg',
    quality: 90,
  },
  {
    ...base,
    id: 'historia-9x16',
    builtIn: true,
    group: 'redes',
    name: 'Historias, Reels y TikTok',
    hint: 'Pantalla completa 9:16',
    suffix: 'historia',
    mode: 'crop',
    width: 1080,
    height: 1920,
    format: 'jpeg',
    quality: 90,
  },
  {
    ...base,
    id: 'pinterest-2x3',
    builtIn: true,
    group: 'redes',
    name: 'Pinterest',
    hint: 'Pin vertical 2:3',
    suffix: 'pin',
    mode: 'crop',
    width: 1000,
    height: 1500,
    format: 'jpeg',
    quality: 90,
  },
  {
    ...base,
    id: 'logo-perfil',
    builtIn: true,
    group: 'redes',
    name: 'Logo para perfil',
    hint: 'Tu logo centrado con aire alrededor',
    suffix: 'perfil',
    mode: 'pad',
    width: 1080,
    height: 1080,
    format: 'png',
    quality: 90,
    margin: 14,
  },
];

export const DEFAULT_RECIPE_PRESETS = ['web-contenido', 'ig-4x5'];

export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

export function settingsOf(source: RecipeSettings): RecipeSettings {
  return {
    name: source.name,
    suffix: source.suffix,
    group: source.group,
    mode: source.mode,
    width: source.width,
    height: source.height,
    format: source.format,
    quality: source.quality,
    lossless: source.lossless,
    background: source.background,
    margin: source.margin,
    maxBytes: source.maxBytes,
    minQuality: source.minQuality,
  };
}

export function recipeFromPreset(preset: RecipeSettings): Recipe {
  return { id: newId('salida'), ...settingsOf(preset) };
}

export function presetFromRecipe(recipe: RecipeSettings, name: string): Preset {
  return { ...settingsOf(recipe), name, group: 'propio', id: newId('ajuste'), builtIn: false };
}

export const CUSTOM_RECIPE: RecipeSettings = {
  ...base,
  name: 'Salida personalizada',
  suffix: 'personalizada',
  group: 'propio',
  mode: 'fit',
  width: 1600,
  height: null,
  format: 'original',
  quality: 82,
};

/** Lado máximo admitido para una salida, en píxeles. */
export const MAX_SIDE = 12000;

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function dimension(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_SIDE) : null;
}

/** Valida datos guardados en el dispositivo; devuelve null si no sirven. */
export function sanitizeSettings(raw: unknown): RecipeSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const mode = r.mode === 'crop' || r.mode === 'pad' ? r.mode : 'fit';
  const format = ['original', 'jpeg', 'png', 'webp'].includes(String(r.format))
    ? (r.format as RecipeSettings['format'])
    : 'original';
  const group = r.group === 'web' || r.group === 'redes' ? r.group : 'propio';
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 60) : null;
  if (!name) return null;
  const settings: RecipeSettings = {
    name,
    suffix:
      typeof r.suffix === 'string' && r.suffix.trim() ? r.suffix.trim().slice(0, 40) : 'salida',
    group,
    mode,
    width: dimension(r.width),
    height: dimension(r.height),
    format,
    quality: clamp(Math.round(Number(r.quality) || 82), 1, 100),
    lossless: r.lossless === true,
    background:
      r.background === 'transparent' || (typeof r.background === 'string' && HEX.test(r.background))
        ? (r.background as string)
        : '#ffffff',
    margin: clamp(Math.round(Number(r.margin) || 0), 0, 40),
    maxBytes:
      r.maxBytes === null || r.maxBytes === undefined || !Number.isFinite(Number(r.maxBytes))
        ? null
        : clamp(Math.round(Number(r.maxBytes)), MIN_MAX_BYTES, MAX_MAX_BYTES),
    minQuality: clamp(Math.round(Number(r.minQuality) || DEFAULT_MIN_QUALITY), 1, 100),
  };
  if (settings.mode !== 'fit' && (!settings.width || !settings.height)) settings.mode = 'fit';
  return settings;
}

/** ¿Dos versiones guardan exactamente lo mismo? (sin contar su identificador). */
export function sameSettings(a: RecipeSettings, b: RecipeSettings): boolean {
  return JSON.stringify(settingsOf(a)) === JSON.stringify(settingsOf(b));
}

/** Un nombre que no choca con los existentes: «Portafolio» → «Portafolio (2)». */
export function uniqueName(name: string, taken: readonly string[]): string {
  const used = new Set(taken.map((n) => n.trim().toLowerCase()));
  const base = name.trim().slice(0, 60) || 'Paquete';
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, 54)} (${n})`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

/** Límites de un paquete: suficientes para cualquier lote real y a salvo de archivos absurdos. */
export const MAX_PACKAGE_VERSIONS = 30;

export function packageFrom(
  name: string,
  recipes: readonly RecipeSettings[],
  naming: NamingSettings | null,
  date = new Date(),
): SettingsPackage {
  return {
    id: newId('paquete'),
    name: name.trim().slice(0, 60),
    versions: recipes.slice(0, MAX_PACKAGE_VERSIONS).map(settingsOf),
    naming: naming ? { ...naming } : null,
    updatedAt: date.toISOString(),
  };
}

/**
 * Valida un paquete guardado o importado. Solo se quedan los campos conocidos y con
 * valores válidos; las versiones dañadas se descartan. Siempre con identificador nuevo.
 */
export function sanitizePackage(raw: unknown): { pkg: SettingsPackage; dropped: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 60) : '';
  if (!name || !Array.isArray(r.versions)) return null;
  const list = r.versions.slice(0, MAX_PACKAGE_VERSIONS);
  const versions = list.flatMap((item) => {
    const settings = sanitizeSettings(item);
    return settings ? [settings] : [];
  });
  if (versions.length === 0) return null;
  const updated = typeof r.updatedAt === 'string' && !Number.isNaN(Date.parse(r.updatedAt)) ? r.updatedAt : new Date(0).toISOString();
  return {
    pkg: {
      id: newId('paquete'),
      name,
      versions,
      naming: r.naming === null || r.naming === undefined ? null : sanitizeNaming(r.naming),
      updatedAt: updated,
    },
    dropped: r.versions.length - versions.length,
  };
}
