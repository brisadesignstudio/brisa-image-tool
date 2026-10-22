/**
 * Copia de seguridad de los paquetes y ajustes guardados: un JSON con formato y versión.
 * Al importar solo se leen datos (JSON.parse) y se validan campo a campo; nunca se
 * ejecuta nada del archivo, y todo lo que se muestra se trata como texto.
 */
import { newId, sanitizePackage, sanitizeSettings, settingsOf } from './presets';
import type { Preset, SettingsPackage } from './types';

export const BACKUP_FORMAT = 'brisa-preparador-de-imagenes/paquetes';
export const BACKUP_VERSION = 1;
/** Una copia real ocupa unos pocos KB: más de 2 MB no es una copia de ajustes. */
export const MAX_BACKUP_BYTES = 2_000_000;
const MAX_ITEMS = 200;

export interface BackupFile {
  formato: string;
  version: number;
  exportado: string;
  paquetes: SettingsPackage[];
  ajustes: Preset[];
}

export function buildBackup(packages: SettingsPackage[], presets: Preset[], date = new Date()): BackupFile {
  return {
    formato: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportado: date.toISOString(),
    paquetes: packages.map((pkg) => ({ ...pkg, versions: pkg.versions.map(settingsOf) })),
    ajustes: presets.map((preset) => ({ ...settingsOf(preset), id: preset.id, builtIn: false, group: 'propio' })),
  };
}

export type BackupParse =
  | {
      ok: true;
      exportado: string | null;
      paquetes: SettingsPackage[];
      ajustes: Preset[];
      /** Paquetes o ajustes descartados por no ser válidos. */
      descartados: number;
    }
  | { ok: false; error: string };

export function parseBackup(text: string): BackupParse {
  if (text.length > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'El archivo es demasiado grande para ser una copia de paquetes (más de 2 MB).' };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'No se puede leer: no es un archivo JSON válido. Elige el .json que exportaste desde el preparador.' };
  }
  if (!raw || typeof raw !== 'object' || (raw as { formato?: unknown }).formato !== BACKUP_FORMAT) {
    return { ok: false, error: 'No es una copia de paquetes del preparador de imágenes de Brisa.' };
  }
  const r = raw as Record<string, unknown>;
  const version = r.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'La copia no indica una versión válida: puede estar dañada.' };
  }
  if (version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `Esta copia es de una versión más nueva del preparador (v${version}) y no se puede importar en esta (v${BACKUP_VERSION}).`,
    };
  }
  const rawPackages = Array.isArray(r.paquetes) ? r.paquetes.slice(0, MAX_ITEMS) : [];
  const rawPresets = Array.isArray(r.ajustes) ? r.ajustes.slice(0, MAX_ITEMS) : [];
  let descartados = 0;
  const paquetes = rawPackages.flatMap((item) => {
    const valid = sanitizePackage(item);
    if (!valid) descartados += 1;
    return valid ? [valid.pkg] : [];
  });
  const ajustes = rawPresets.flatMap((item): Preset[] => {
    const settings = sanitizeSettings(item);
    if (!settings) descartados += 1;
    return settings ? [{ ...settings, group: 'propio', id: newId('ajuste'), builtIn: false }] : [];
  });
  if (paquetes.length === 0 && ajustes.length === 0) {
    return { ok: false, error: 'La copia no contiene ningún paquete ni ajuste válido.' };
  }
  const exportado = typeof r.exportado === 'string' && !Number.isNaN(Date.parse(r.exportado)) ? r.exportado : null;
  return { ok: true, exportado, paquetes, ajustes, descartados };
}
