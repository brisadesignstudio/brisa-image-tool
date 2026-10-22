import type { FolderMode, NamingSettings, SourceFormat } from './types';

export const DEFAULT_PATTERN = '{nombre}-{salida}';

export const PATTERN_TOKENS = [
  { token: '{nombre}', label: 'nombre de la imagen' },
  { token: '{salida}', label: 'nombre corto de la salida' },
  { token: '{ancho}', label: 'ancho en px' },
  { token: '{alto}', label: 'alto en px' },
  { token: '{n}', label: 'número de imagen' },
] as const;

export function todayStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function defaultNaming(): NamingSettings {
  return {
    pattern: DEFAULT_PATTERN,
    normalize: true,
    folders: 'salida',
    includeOriginals: false,
    zipName: 'brisa-imagenes',
  };
}

/** Quita la extensión de un nombre de archivo. */
export function stripExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

/** minúsculas, sin acentos ni espacios: «Ritual Matcha Ñ» → «ritual-matcha-n». */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/** Elimina lo que ningún sistema admite en un nombre de archivo. */
export function safeFileName(value: string): string {
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');
  return cleaned.slice(0, 120);
}

export function extensionFor(format: SourceFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

export interface NameTokens {
  nombre: string;
  salida: string;
  ancho: number;
  alto: number;
  n: number;
}

/** Nombre de archivo sin extensión a partir del patrón. */
export function renderPattern(pattern: string, tokens: NameTokens, normalize: boolean): string {
  const source = pattern.trim() || DEFAULT_PATTERN;
  const raw = source.replace(/\{(nombre|salida|ancho|alto|n)\}/g, (_, key: keyof NameTokens) =>
    key === 'n' ? String(tokens.n).padStart(2, '0') : String(tokens[key]),
  );
  const name = normalize ? slugify(raw) : safeFileName(raw);
  return name || 'imagen';
}

export function folderFor(mode: FolderMode, outputSuffix: string, imageBase: string, normalize: boolean) {
  const clean = (v: string) => (normalize ? slugify(v) : safeFileName(v)) || 'imagenes';
  if (mode === 'salida') return clean(outputSuffix);
  if (mode === 'imagen') return clean(imageBase);
  return '';
}

/** Evita que dos archivos se pisen dentro del ZIP: añade -2, -3… */
export class UniquePaths {
  private taken = new Set<string>();

  claim(path: string): string {
    if (!this.taken.has(path.toLowerCase())) {
      this.taken.add(path.toLowerCase());
      return path;
    }
    const dot = path.lastIndexOf('.');
    const stem = dot > path.lastIndexOf('/') ? path.slice(0, dot) : path;
    const ext = dot > path.lastIndexOf('/') ? path.slice(dot) : '';
    for (let i = 2; ; i++) {
      const candidate = `${stem}-${i}${ext}`;
      if (!this.taken.has(candidate.toLowerCase())) {
        this.taken.add(candidate.toLowerCase());
        return candidate;
      }
    }
  }
}

export function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/');
}
