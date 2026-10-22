/**
 * Paquetes de ajustes: guardar las versiones actuales (y los nombres de archivo) para
 * reutilizarlas en otro lote. Se apoyan en la misma estructura que los ajustes guardados
 * (RecipeSettings validados con sanitizeSettings) y se guardan en este dispositivo.
 */
import { buildBackup, type BackupParse } from '../lib/backup';
import { todayStamp } from '../lib/naming';
import { packageFrom, recipeFromPreset, sameSettings, settingsOf, uniqueName } from '../lib/presets';
import type { Preset, Recipe, RecipeSettings, SettingsPackage } from '../lib/types';
import { downloadBlob } from './export';
import { showNotice, useStore, type AppState } from './store';

const set = useStore.setState;
const get = useStore.getState;

export type PackageResult = { ok: true; id: string } | { ok: false; error: string };

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function taken(name: string, exceptId?: string): SettingsPackage | undefined {
  return get().packages.find((p) => p.id !== exceptId && sameName(p.name, name));
}

/** Guarda las versiones actuales como paquete nuevo. Nunca sobrescribe otro con el mismo nombre. */
export function savePackage(name: string): PackageResult {
  const clean = name.trim();
  const s = get();
  if (!clean) return { ok: false, error: 'Escribe un nombre para el paquete.' };
  if (s.recipes.length === 0) return { ok: false, error: 'No hay versiones que guardar: añade al menos una.' };
  const existing = taken(clean);
  if (existing) {
    return {
      ok: false,
      error: `Ya hay un paquete llamado «${existing.name}». Elige otro nombre o usa «Actualizar con las versiones actuales» en ese paquete.`,
    };
  }
  const pkg = packageFrom(clean, s.recipes, s.naming);
  set({ packages: [...s.packages, pkg] });
  return { ok: true, id: pkg.id };
}

export function renamePackage(id: string, name: string): PackageResult {
  const clean = name.trim().slice(0, 60);
  if (!clean) return { ok: false, error: 'El nombre no puede quedar vacío.' };
  const existing = taken(clean, id);
  if (existing) return { ok: false, error: `Ya hay otro paquete llamado «${existing.name}».` };
  set((s) => ({ packages: s.packages.map((p) => (p.id === id ? { ...p, name: clean } : p)) }));
  return { ok: true, id };
}

/** Sustituye lo guardado en el paquete por las versiones y nombres actuales. */
export function updatePackage(id: string): PackageResult {
  const s = get();
  const current = s.packages.find((p) => p.id === id);
  if (!current) return { ok: false, error: 'Ese paquete ya no existe.' };
  if (s.recipes.length === 0) return { ok: false, error: 'No hay versiones que guardar: añade al menos una.' };
  const fresh = packageFrom(current.name, s.recipes, s.naming);
  set({ packages: s.packages.map((p) => (p.id === id ? { ...fresh, id } : p)) });
  return { ok: true, id };
}

export function duplicatePackage(id: string): PackageResult {
  const s = get();
  const source = s.packages.find((p) => p.id === id);
  if (!source) return { ok: false, error: 'Ese paquete ya no existe.' };
  const name = uniqueName(`${source.name} (copia)`, s.packages.map((p) => p.name));
  const copy = { ...packageFrom(name, source.versions, source.naming), updatedAt: source.updatedAt };
  const index = s.packages.indexOf(source);
  const packages = [...s.packages];
  packages.splice(index + 1, 0, copy);
  set({ packages });
  return { ok: true, id: copy.id };
}

/** Borra el paquete guardado; las versiones e imágenes de la mesa no cambian. */
export function deletePackage(id: string) {
  set((s) => ({ packages: s.packages.filter((p) => p.id !== id) }));
}

export type ApplyMode = 'add' | 'replace';

export interface ApplyPlan {
  /** Versiones del paquete que se crearán. */
  added: RecipeSettings[];
  /** Versiones del paquete idénticas a una actual (al añadir no se duplican). */
  already: number;
  /** Versiones actuales que se quitan (solo al reemplazar). */
  removed: Recipe[];
  /** Encuadres hechos a mano que se perderían con las versiones quitadas. */
  lostCrops: number;
  /** Versiones quitadas que tenían una selección por imagen distinta de la de por defecto. */
  lostSelections: number;
}

const recipeOf = (key: string) => key.slice(key.indexOf('|') + 1);

/**
 * Qué hará aplicar un paquete, antes de hacerlo. Al reemplazar, las versiones actuales
 * idénticas a una del paquete se conservan (con sus encuadres y su selección).
 */
export function planApply(pkg: SettingsPackage, mode: ApplyMode, state: AppState = get()): ApplyPlan {
  if (mode === 'add') {
    const added = pkg.versions.filter((v) => !state.recipes.some((r) => sameSettings(r, v)));
    return { added, already: pkg.versions.length - added.length, removed: [], lostCrops: 0, lostSelections: 0 };
  }
  const pool = [...state.recipes];
  const added: RecipeSettings[] = [];
  for (const version of pkg.versions) {
    const i = pool.findIndex((r) => sameSettings(r, version));
    if (i >= 0) pool.splice(i, 1);
    else added.push(version);
  }
  const removed = pool;
  const gone = new Set(removed.map((r) => r.id));
  return {
    added,
    already: pkg.versions.length - added.length,
    removed,
    lostCrops: Object.keys(state.crops).filter((key) => gone.has(recipeOf(key))).length,
    lostSelections: new Set(Object.keys(state.excluded).map(recipeOf).filter((id) => gone.has(id))).size,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Aplica un paquete añadiendo o reemplazando versiones. Se puede deshacer desde el aviso. */
export function applyPackage(id: string, mode: ApplyMode, withNaming: boolean) {
  const s = get();
  const pkg = s.packages.find((p) => p.id === id);
  if (!pkg) return;
  const before = { recipes: s.recipes, crops: s.crops, excluded: s.excluded, naming: s.naming };
  let recipes: Recipe[];
  let added = 0;
  if (mode === 'add') {
    const fresh = pkg.versions.filter((v) => !s.recipes.some((r) => sameSettings(r, v)));
    added = fresh.length;
    recipes = [...s.recipes, ...fresh.map(recipeFromPreset)];
  } else {
    const pool = [...s.recipes];
    recipes = pkg.versions.map((version) => {
      const i = pool.findIndex((r) => sameSettings(r, version));
      if (i >= 0) return pool.splice(i, 1)[0];
      added += 1;
      return recipeFromPreset(version);
    });
  }
  const live = new Set(recipes.map((r) => r.id));
  const keep = <T,>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([key]) => live.has(recipeOf(key))));
  const naming = withNaming && pkg.naming ? { ...pkg.naming } : s.naming;
  set({
    recipes,
    crops: keep(s.crops),
    excluded: keep(s.excluded) as Record<string, true>,
    naming,
    editor: s.editor && live.has(s.editor.recipeId) ? s.editor : null,
  });

  const images = s.images.filter((i) => i.status !== 'error').length;
  const already = pkg.versions.length - added;
  const what =
    mode === 'add'
      ? added === 0
        ? `sus ${plural(pkg.versions.length, 'versión ya estaba', 'versiones ya estaban')}; no se ha añadido ninguna`
        : `${plural(added, 'versión añadida', 'versiones añadidas')}${already ? ` (${already} ya ${already === 1 ? 'estaba' : 'estaban'})` : ''}`
      : `ahora hay ${plural(recipes.length, 'versión', 'versiones')}${added ? ` (${added} ${added === 1 ? 'nueva' : 'nuevas'})` : ''}`;
  const who =
    added === 0
      ? ''
      : images === 0
        ? ' Se aplicarán a las imágenes que añadas.'
        : ` Las nuevas se exportarán para ${images === 1 ? 'la imagen cargada' : `las ${images} imágenes cargadas`}; puedes quitarlas por imagen en la revisión.`;
  const names = withNaming && pkg.naming ? ' También se usan sus nombres de archivo y carpetas.' : '';
  showNotice('versiones', 'ok', `Paquete «${pkg.name}» aplicado: ${what}.${who}${names}`, {
    label: 'Deshacer',
    focusAfter: '.versions__packages',
    run: () => set({ ...before, notice: null }),
  });
}

/** Descarga la copia de seguridad (paquetes y ajustes guardados; nunca imágenes). */
export function exportPackages() {
  const s = get();
  const backup = buildBackup(s.packages, s.customPresets);
  const fileName = `brisa-paquetes-${todayStamp()}.json`;
  downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), fileName);
  showNotice(
    'paquetes',
    'ok',
    `Descarga iniciada: ${fileName} (${plural(s.packages.length, 'paquete', 'paquetes')} y ${plural(s.customPresets.length, 'ajuste', 'ajustes')}). Búscalo en las descargas de tu navegador; con él puedes recuperarlos en otro navegador o equipo.`,
  );
}

export interface ImportItem {
  kind: 'paquete' | 'ajuste';
  name: string;
  /** Nombre con el que se guardará (cambia si ya hay otro distinto con ese nombre). */
  finalName: string;
  detail: string;
  status: 'nuevo' | 'renombrado' | 'ya-existe';
}

const samePackage = (a: SettingsPackage, b: SettingsPackage) =>
  sameName(a.name, b.name) &&
  a.versions.length === b.versions.length &&
  a.versions.every((v, i) => sameSettings(v, b.versions[i])) &&
  JSON.stringify(a.naming) === JSON.stringify(b.naming);

const samePreset = (a: Preset, b: Preset) => sameName(a.name, b.name) && sameSettings(a, b);

/** Qué se importará y con qué nombre, antes de importar. Nada se sobrescribe. */
export function previewImport(parsed: Extract<BackupParse, { ok: true }>): ImportItem[] {
  const s = get();
  const packageNames = s.packages.map((p) => p.name);
  const presetNames = s.customPresets.map((p) => p.name);
  const items: ImportItem[] = [];
  for (const pkg of parsed.paquetes) {
    const detail = plural(pkg.versions.length, 'versión', 'versiones');
    if (s.packages.some((p) => samePackage(p, pkg))) {
      items.push({ kind: 'paquete', name: pkg.name, finalName: pkg.name, detail, status: 'ya-existe' });
      continue;
    }
    const finalName = uniqueName(pkg.name, packageNames);
    packageNames.push(finalName);
    items.push({ kind: 'paquete', name: pkg.name, finalName, detail, status: finalName === pkg.name ? 'nuevo' : 'renombrado' });
  }
  for (const preset of parsed.ajustes) {
    const detail = 'ajuste de una versión';
    if (s.customPresets.some((p) => samePreset(p, preset))) {
      items.push({ kind: 'ajuste', name: preset.name, finalName: preset.name, detail, status: 'ya-existe' });
      continue;
    }
    const finalName = uniqueName(preset.name, presetNames);
    presetNames.push(finalName);
    items.push({ kind: 'ajuste', name: preset.name, finalName, detail, status: finalName === preset.name ? 'nuevo' : 'renombrado' });
  }
  return items;
}

/** Importa lo que no esté ya, con nombres que no chocan. Devuelve cuántos se añadieron. */
export function importBackup(parsed: Extract<BackupParse, { ok: true }>): { packages: number; presets: number } {
  const items = previewImport(parsed);
  const s = get();
  const packages = parsed.paquetes.flatMap((pkg, i) => {
    const item = items[i];
    return item.status === 'ya-existe' ? [] : [{ ...pkg, name: item.finalName }];
  });
  const offset = parsed.paquetes.length;
  const presets = parsed.ajustes.flatMap((preset, i) => {
    const item = items[offset + i];
    return item.status === 'ya-existe' ? [] : [{ ...preset, ...settingsOf(preset), name: item.finalName }];
  });
  set({ packages: [...s.packages, ...packages], customPresets: [...s.customPresets, ...presets] });
  const parts = [
    packages.length ? plural(packages.length, 'paquete', 'paquetes') : '',
    presets.length ? plural(presets.length, 'ajuste', 'ajustes') : '',
  ].filter(Boolean);
  showNotice(
    'paquetes',
    'ok',
    parts.length ? `Importado: ${parts.join(' y ')}.` : 'No había nada nuevo que importar: todo ya estaba en este equipo.',
  );
  return { packages: packages.length, presets: presets.length };
}
