export type SourceFormat = 'jpeg' | 'png' | 'webp';
export type OutputFormat = 'original' | SourceFormat;
export type FitMode = 'fit' | 'crop' | 'pad';
export type PresetGroup = 'web' | 'redes' | 'propio';

/** Todo lo que define una salida, sin identificadores. */
export interface RecipeSettings {
  name: string;
  /** Se usa en los nombres de archivo y carpetas. */
  suffix: string;
  group: PresetGroup;
  mode: FitMode;
  /** Píxeles. null = automático (se deduce de la proporción). */
  width: number | null;
  height: number | null;
  format: OutputFormat;
  /** 1–100. Solo afecta a JPG y WebP con pérdida. */
  quality: number;
  /** WebP sin pérdida. */
  lossless: boolean;
  /** 'transparent' o un color #rrggbb. */
  background: string;
  /** Margen interior en % del lado menor (modo márgenes). */
  margin: number;
}

/** Una salida activa: se aplica a todas las imágenes cargadas. */
export interface Recipe extends RecipeSettings {
  id: string;
}

/** Un ajuste guardado (de fábrica o propio). */
export interface Preset extends RecipeSettings {
  id: string;
  builtIn: boolean;
  hint?: string;
}

/** Recorte normalizado (0–1) respecto a la imagen original. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type IccKind = 'none' | 'srgb' | 'other';

export interface SourceInfo {
  format: SourceFormat;
  width: number;
  height: number;
  hasAlpha: boolean;
  animated: boolean;
  icc: IccKind;
  /** Calidad estimada de un JPG original (escala IJG), o null. */
  jpegQuality: number | null;
  jpegQualityExact: boolean;
  /** Solo WebP: true si el original es sin pérdida. */
  webpLossless: boolean | null;
  /** true si los píxeles se leyeron de forma exacta (sin gestión de color del navegador). */
  exactDecode: boolean;
}

export interface SourceImage {
  id: string;
  file: File;
  /** Nombre del archivo original, intacto. */
  name: string;
  /** Nombre base editable que se usa para las copias. */
  baseName: string;
  size: number;
  status: 'analyzing' | 'ready' | 'error';
  error?: string;
  info?: SourceInfo;
  thumbUrl?: string;
  previewUrl?: string;
  previewWidth?: number;
  previewHeight?: number;
}

export type WarningCode =
  | 'limited'
  | 'smaller-in-pad'
  | 'flattened'
  | 'kept-original'
  | 'heavier'
  | 'animated'
  | 'color';

export interface RenderWarning {
  code: WarningCode;
  message: string;
}

export interface RenderResult {
  key: string;
  status: 'queued' | 'working' | 'done' | 'error';
  blob?: Blob;
  url?: string;
  width?: number;
  height?: number;
  size?: number;
  format?: SourceFormat;
  keptOriginal?: boolean;
  warnings: RenderWarning[];
  error?: string;
}

export type FolderMode = 'salida' | 'imagen' | 'ninguna';

export interface NamingSettings {
  pattern: string;
  normalize: boolean;
  folders: FolderMode;
  includeOriginals: boolean;
  zipName: string;
}

export type PreviewBackground = 'cuadros' | 'claro' | 'oscuro';
