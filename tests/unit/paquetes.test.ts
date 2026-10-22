import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, buildBackup, parseBackup } from '../../src/lib/backup';
import { BUILT_IN_PRESETS, packageFrom, recipeFromPreset, settingsOf, uniqueName } from '../../src/lib/presets';
import { defaultNaming } from '../../src/lib/naming';
import { planApply } from '../../src/state/packages';
import { itemKey, type AppState } from '../../src/state/store';
import type { Preset, Recipe } from '../../src/lib/types';

const preset = (id: string) => BUILT_IN_PRESETS.find((p) => p.id === id)!;
const recipe = (id: string, over: Partial<Recipe> = {}): Recipe => ({ ...recipeFromPreset(preset(id)), ...over });

describe('copia de seguridad de paquetes', () => {
  const pkg = packageFrom(
    'Portafolio Brisa',
    [settingsOf(preset('web-contenido')), { ...settingsOf(preset('ig-4x5')), maxBytes: 300_000, minQuality: 55 }],
    { ...defaultNaming(), pattern: '{n}-{nombre}', folders: 'imagen' },
  );
  const custom: Preset = { ...settingsOf(preset('web-miniatura')), name: 'Blog Brisa', id: 'ajuste-1', builtIn: false, group: 'propio' };

  it('exporta e importa lo mismo, con identificadores nuevos', () => {
    const text = JSON.stringify(buildBackup([pkg], [custom], new Date(2026, 9, 22)));
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.paquetes).toHaveLength(1);
    const back = parsed.paquetes[0];
    expect(back.name).toBe('Portafolio Brisa');
    expect(back.id).not.toBe(pkg.id);
    expect(back.versions.map(settingsOf)).toEqual(pkg.versions.map(settingsOf));
    expect(back.versions[1]).toMatchObject({ maxBytes: 300_000, minQuality: 55 });
    expect(back.naming).toEqual(pkg.naming);
    expect(parsed.ajustes.map((a) => a.name)).toEqual(['Blog Brisa']);
    expect(parsed.descartados).toBe(0);
    // Nunca guarda imágenes, encuadres ni selecciones.
    expect(text).not.toMatch(/crops|excluded|images|blob|data:image/);
  });

  it('rechaza con un mensaje claro lo que no es una copia válida', () => {
    const errorOf = (text: string) => {
      const parsed = parseBackup(text);
      return parsed.ok ? 'válido' : parsed.error;
    };
    expect(errorOf('esto no es json')).toContain('no es un archivo JSON válido');
    expect(errorOf('{"hola": 1}')).toContain('No es una copia de paquetes');
    expect(errorOf('[]')).toContain('No es una copia de paquetes');
    expect(errorOf(JSON.stringify({ formato: BACKUP_FORMAT, version: 99, paquetes: [] }))).toContain(
      'versión más nueva',
    );
    expect(errorOf(JSON.stringify({ formato: BACKUP_FORMAT, version: 'uno', paquetes: [] }))).toContain(
      'versión válida',
    );
    expect(errorOf(JSON.stringify({ formato: BACKUP_FORMAT, version: 1, paquetes: [] }))).toContain(
      'ningún paquete ni ajuste válido',
    );
    expect(errorOf('x'.repeat(2_000_001))).toContain('demasiado grande');
  });

  it('valida campo a campo: descarta lo dañado y no ejecuta nada', () => {
    const text = JSON.stringify({
      formato: BACKUP_FORMAT,
      version: 1,
      paquetes: [
        {
          name: '<img src=x onerror=alert(1)>',
          versions: [settingsOf(preset('ig-4x5')), { name: '', format: 'bmp' }, 42],
          naming: { pattern: '{nombre}', folders: 'raro', extra: 'ignorado' },
          __proto__: { malicioso: true },
          codigo: 'function () { alert(1) }',
        },
        { name: 'Sin versiones', versions: [] },
        'texto suelto',
      ],
    });
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.paquetes).toHaveLength(1);
    const [pkg] = parsed.paquetes;
    // El nombre se guarda como texto tal cual (la interfaz nunca lo interpreta como HTML).
    expect(pkg.name).toBe('<img src=x onerror=alert(1)>');
    expect(pkg.versions).toHaveLength(1);
    expect(pkg.naming).toEqual({ ...defaultNaming(), pattern: '{nombre}' });
    expect(Object.keys(pkg).sort()).toEqual(['id', 'name', 'naming', 'updatedAt', 'versions']);
    expect(parsed.descartados).toBe(2);
  });

  it('los nombres repetidos se numeran en lugar de sobrescribir', () => {
    expect(uniqueName('Portafolio', ['Redes'])).toBe('Portafolio');
    expect(uniqueName('Portafolio', ['portafolio'])).toBe('Portafolio (2)');
    expect(uniqueName('Portafolio', ['Portafolio', 'Portafolio (2)'])).toBe('Portafolio (3)');
  });
});

describe('aplicar un paquete', () => {
  const web = recipe('web-contenido', { id: 'r-web' });
  const ig = recipe('ig-4x5', { id: 'r-ig' });
  const pin = recipe('pinterest-2x3', { id: 'r-pin' });
  const state = {
    images: [{ id: 'a', status: 'ready' }],
    recipes: [web, ig, pin],
    crops: { [itemKey('a', 'r-pin')]: { x: 0, y: 0, w: 0.5, h: 0.5 }, [itemKey('a', 'r-ig')]: { x: 0, y: 0, w: 0.5, h: 0.5 } },
    excluded: { [itemKey('a', 'r-pin')]: true, [itemKey('a', 'r-web')]: true },
    naming: defaultNaming(),
  } as unknown as AppState;
  const pkg = packageFrom('Portafolio', [web, settingsOf(preset('logo-perfil'))], null);

  it('añadir no duplica versiones idénticas ni toca las actuales', () => {
    const plan = planApply(pkg, 'add', state);
    expect(plan.added.map((v) => v.name)).toEqual(['Logo para perfil']);
    expect(plan.already).toBe(1);
    expect(plan.removed).toEqual([]);
    expect([plan.lostCrops, plan.lostSelections]).toEqual([0, 0]);
  });

  it('reemplazar avisa de los encuadres y selecciones que se perderían, y conserva las iguales', () => {
    const plan = planApply(pkg, 'replace', state);
    expect(plan.added.map((v) => v.name)).toEqual(['Logo para perfil']);
    expect(plan.removed.map((r) => r.id)).toEqual(['r-ig', 'r-pin']);
    expect(plan.lostCrops).toBe(2); // Instagram y Pinterest
    expect(plan.lostSelections).toBe(1); // Pinterest (la selección de web se conserva)
  });
});
