import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { addImages, settle } from './helpers';

const chipNames = (page: Page) => page.locator('.chip__name');

async function openPackages(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Paquetes' }).click();
  const dialog = page.getByTestId('paquetes');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function savePackage(dialog: Locator, name: string) {
  await dialog.getByLabel('Nombre del paquete').fill(name);
  await dialog.getByRole('button', { name: 'Guardar paquete' }).click();
}

async function removeVersion(page: Page, name: string) {
  await page.getByRole('button', { name: `Quitar la versión ${name}` }).click();
}

async function addVersion(page: Page, preset: RegExp) {
  await page.getByRole('button', { name: 'Añadir versión' }).click();
  await page.getByRole('button', { name: preset }).click();
}

const packageItem = (dialog: Locator, name: string) =>
  dialog.getByTestId('paquete').filter({ has: dialog.page().getByText(name, { exact: true }) });

test.describe('Paquetes de ajustes', () => {
  test('crear y aplicar en otro lote (añadir), con peso máximo, persistencia y deshacer', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg']);
    await settle(page);
    // Configuración «Portafolio Brisa»: web WebP + Instagram JPG con peso máximo + nombres propios.
    await page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
    const editor = page.getByTestId('editor');
    await editor.getByLabel('Peso máximo por archivo', { exact: true }).check();
    await editor.getByRole('button', { name: 'Listo' }).click();
    await page.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByLabel('Nombre de los archivos').fill('{n}-{nombre}-{version}');
    let dialog = await openPackages(page);
    await expect(dialog).toContainText('Se guardan en este navegador y este equipo');
    await savePackage(dialog, 'Portafolio Brisa');
    await expect(dialog.getByTestId('aviso-paquetes')).toContainText('Paquete «Portafolio Brisa» guardado');
    const item = packageItem(dialog, 'Portafolio Brisa');
    await expect(item).toContainText('2 versiones');
    await expect(item).toContainText('1080 × 1350 px · JPG · máx. 300 KB');
    await expect(item).toContainText('«{n}-{nombre}-{version}»');

    // Otro día, otro lote: el paquete sigue ahí (guardado en el navegador).
    await page.reload();
    await addImages(page, ['foto-pequena-640x480.jpg', 'icono-64x64.png']);
    await settle(page);
    await removeVersion(page, 'Instagram vertical 4:5');
    await page.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByLabel('Nombre de los archivos').fill('{nombre}');
    await expect(chipNames(page)).toHaveText(['Contenido web']);
    dialog = await openPackages(page);
    await dialog.getByRole('button', { name: 'Aplicar el paquete Portafolio Brisa' }).click();
    await expect(dialog.getByRole('heading', { name: 'Aplicar «Portafolio Brisa»' })).toBeFocused();
    await expect(dialog.getByLabel(/Añadir a las actuales/)).toBeChecked();
    await expect(dialog).toContainText('Se añade 1 versión (1 ya estaba)');
    await expect(dialog).toContainText('se exportarán para las 2 imágenes cargadas');
    await dialog.getByRole('button', { name: 'Aplicar paquete' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(chipNames(page)).toHaveText(['Contenido web', 'Instagram vertical 4:5']);
    await expect(page.getByRole('button', { name: 'Editar la versión Instagram vertical 4:5' })).toContainText(
      'máx. 300 KB',
    );
    const notice = page.getByTestId('aviso-versiones');
    await expect(notice).toContainText('Paquete «Portafolio Brisa» aplicado: 1 versión añadida (1 ya estaba)');
    await expect(notice).toContainText('las 2 imágenes cargadas');
    await expect(notice).toContainText('También se usan sus nombres de archivo y carpetas');
    await expect(page.getByLabel('Nombre de los archivos')).toHaveValue('{n}-{nombre}-{version}');
    await expect(page.locator('.export__count')).toContainText('4 archivos');
    // Deshacer devuelve versiones y nombres a lo de antes.
    await notice.getByRole('button', { name: 'Deshacer' }).click();
    await expect(chipNames(page)).toHaveText(['Contenido web']);
    await expect(page.getByLabel('Nombre de los archivos')).toHaveValue('{nombre}');
  });

  test('reemplazar avisa de lo que se pierde; cancelar no toca nada; deshacer lo recupera', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg']);
    await settle(page);
    // Paquete con solo «Logo para perfil».
    await addVersion(page, /Logo para perfil/);
    await removeVersion(page, 'Contenido web');
    await removeVersion(page, 'Instagram vertical 4:5');
    let dialog = await openPackages(page);
    await savePackage(dialog, 'Solo perfil');
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    // Trabajo actual: Instagram con encuadre propio y web excluida en esta imagen.
    await addVersion(page, /^Contenido web/);
    await addVersion(page, /^Instagram vertical 4:5/);
    await settle(page);
    await page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
    const editor = page.getByTestId('editor');
    await editor.getByTestId('crop-box').focus();
    await page.keyboard.press('ArrowLeft');
    await editor.getByRole('button', { name: 'Listo' }).click();
    await page.getByTestId('seleccion').getByRole('checkbox', { name: /^Contenido web/ }).uncheck();
    const before = ['Logo para perfil', 'Contenido web', 'Instagram vertical 4:5'];
    await expect(chipNames(page)).toHaveText(before);

    dialog = await openPackages(page);
    await dialog.getByRole('button', { name: 'Aplicar el paquete Solo perfil' }).click();
    await dialog.getByText('Reemplazar las actuales').click();
    await expect(dialog).toContainText('Se quitan «Contenido web» y «Instagram vertical 4:5»');
    await expect(dialog.getByTestId('aviso-reemplazo')).toContainText(
      'se perderán 1 encuadre ajustado a mano y la selección por imagen de 1 versión',
    );
    // Cancelar: todo sigue igual.
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(chipNames(page)).toHaveText(before);
    await expect(page.getByTestId('seleccion').getByRole('checkbox', { name: /^Contenido web/ })).not.toBeChecked();
    await page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
    await expect(editor.getByRole('button', { name: 'Restablecer encuadre' })).toBeEnabled();
    await editor.getByRole('button', { name: 'Listo' }).click();

    // Reemplazar de verdad y deshacer.
    dialog = await openPackages(page);
    await dialog.getByRole('button', { name: 'Aplicar el paquete Solo perfil' }).click();
    await dialog.getByText('Reemplazar las actuales').click();
    await dialog.getByRole('button', { name: 'Reemplazar versiones' }).click();
    await expect(chipNames(page)).toHaveText(['Logo para perfil']);
    await page.getByTestId('aviso-versiones').getByRole('button', { name: 'Deshacer' }).click();
    await expect(chipNames(page)).toHaveText(before);
    await expect(page.getByTestId('seleccion').getByRole('checkbox', { name: /^Contenido web/ })).not.toBeChecked();
    await page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
    await expect(editor.getByRole('button', { name: 'Restablecer encuadre' })).toBeEnabled();
  });

  test('renombrar, actualizar, duplicar y eliminar, sin sobrescribir nombres repetidos', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-pequena-640x480.jpg']);
    await settle(page);
    const dialog = await openPackages(page);
    await savePackage(dialog, 'Portafolio');
    // Mismo nombre: no se sobrescribe.
    await savePackage(dialog, 'portafolio');
    await expect(dialog.getByTestId('error-paquete')).toContainText('Ya hay un paquete llamado «Portafolio»');
    await expect(dialog.getByTestId('paquete')).toHaveCount(1);
    // Duplicar.
    const original = packageItem(dialog, 'Portafolio');
    await original.getByText('Gestionar').click();
    await original.getByRole('button', { name: 'Duplicar' }).click();
    const copy = packageItem(dialog, 'Portafolio (copia)');
    await expect(copy).toHaveCount(1);
    // Renombrar la copia: con un nombre ocupado, no; con uno libre, sí.
    await copy.getByText('Gestionar').click();
    await copy.getByLabel('Nuevo nombre para Portafolio (copia)').fill('Portafolio');
    await copy.getByRole('button', { name: 'Renombrar' }).click();
    await expect(copy.getByRole('alert')).toContainText('Ya hay otro paquete llamado «Portafolio»');
    await copy.getByLabel('Nuevo nombre para Portafolio (copia)').fill('Redes');
    await copy.getByRole('button', { name: 'Renombrar' }).click();
    const redes = packageItem(dialog, 'Redes');
    await expect(redes).toContainText('2 versiones');
    // Actualizar con las versiones actuales (tras añadir una), con confirmación.
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await addVersion(page, /^Pinterest/);
    await openPackages(page);
    await redes.getByText('Gestionar').click();
    await redes.getByRole('button', { name: 'Actualizar con las versiones actuales' }).click();
    await expect(redes).toContainText('Se sustituirán sus 2 versiones guardadas por las 3 actuales');
    await redes.getByRole('button', { name: 'Confirmar: actualizar' }).click();
    await expect(redes).toContainText('3 versiones');
    await expect(packageItem(dialog, 'Portafolio')).toContainText('2 versiones');
    // Eliminar, con confirmación: la mesa no cambia.
    await redes.getByRole('button', { name: 'Eliminar' }).click();
    await expect(redes).toContainText('Las versiones e imágenes de la mesa no cambian');
    await redes.getByRole('button', { name: 'Confirmar: eliminar' }).click();
    await expect(dialog.getByTestId('paquete')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(chipNames(page)).toHaveText(['Contenido web', 'Instagram vertical 4:5', 'Pinterest']);
    await expect(page.locator('.image-item')).toHaveCount(1);
  });

  test('exportar y volver a importar; archivos inválidos con mensajes claros y nada ejecutado', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await page.goto('/');
    await addImages(page, ['foto-pequena-640x480.jpg']);
    await settle(page);
    // Un ajuste suelto y un paquete.
    await page.getByRole('button', { name: 'Ajustar Contenido web' }).click();
    const editor = page.getByTestId('editor');
    await editor.getByText('Más opciones', { exact: true }).click();
    await editor.getByLabel('Nombre del ajuste').fill('Blog Brisa');
    await editor.getByRole('button', { name: 'Guardar' }).click();
    await editor.getByRole('button', { name: 'Listo' }).click();
    const dialog = await openPackages(page);
    await savePackage(dialog, 'Portafolio Brisa');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Exportar (.json)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^brisa-paquetes-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    const backup = JSON.parse(readFileSync(path, 'utf8'));
    expect(backup).toMatchObject({ formato: 'brisa-preparador-de-imagenes/paquetes', version: 1 });
    expect(backup.paquetes.map((p: { name: string }) => p.name)).toEqual(['Portafolio Brisa']);
    expect(backup.ajustes.map((p: { name: string }) => p.name)).toEqual(['Blog Brisa']);
    await expect(dialog.getByTestId('aviso-paquetes')).toContainText('Descarga iniciada');

    // Eliminarlo y volver a importarlo: vista previa antes de importar.
    const item = packageItem(dialog, 'Portafolio Brisa');
    await item.getByText('Gestionar').click();
    await item.getByRole('button', { name: 'Eliminar' }).click();
    await item.getByRole('button', { name: 'Confirmar: eliminar' }).click();
    const input = dialog.getByTestId('importar-paquetes');
    await input.setInputFiles(path);
    const preview = dialog.getByTestId('vista-importar');
    await expect(preview).toContainText('Portafolio Brisa — paquete, 2 versiones');
    await expect(preview).toContainText('Blog Brisa — ajuste de una versión · ya está en este equipo: no se duplica');
    await dialog.getByRole('button', { name: 'Importar 1 elemento' }).click();
    await expect(dialog.getByTestId('aviso-paquetes')).toContainText('Importado: 1 paquete');
    await expect(packageItem(dialog, 'Portafolio Brisa')).toHaveCount(1);

    // Mismo nombre con otro contenido: se importa con otro nombre, sin sobrescribir.
    const changed = { ...backup, ajustes: [], paquetes: [{ ...backup.paquetes[0], versions: backup.paquetes[0].versions.slice(0, 1) }] };
    const changedPath = join(tmpdir(), `paquete-cambiado-${Date.now()}.json`);
    writeFileSync(changedPath, JSON.stringify(changed));
    await input.setInputFiles(changedPath);
    await expect(preview).toContainText('Portafolio Brisa (2) — paquete, 1 versión · ya hay otro «Portafolio Brisa»');
    await dialog.getByRole('button', { name: 'Importar 1 elemento' }).click();
    await expect(packageItem(dialog, 'Portafolio Brisa (2)')).toHaveCount(1);
    await expect(packageItem(dialog, 'Portafolio Brisa')).toContainText('2 versiones');

    // Archivos inválidos o incompatibles.
    const notice = dialog.getByTestId('aviso-paquetes');
    const tryFile = async (name: string, content: string) => {
      await input.setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) });
    };
    await tryFile('roto.json', '{ esto no es json');
    await expect(notice).toContainText('no es un archivo JSON válido');
    await tryFile('otro.json', JSON.stringify({ nombre: 'otra cosa' }));
    await expect(notice).toContainText('No es una copia de paquetes del preparador');
    await tryFile('futuro.json', JSON.stringify({ ...backup, version: 7 }));
    await expect(notice).toContainText('versión más nueva del preparador (v7)');
    // Contenido con apariencia de código: se trata como texto, nunca se ejecuta.
    const hostile = {
      ...backup,
      ajustes: [],
      paquetes: [{ ...backup.paquetes[0], name: '<img src=x onerror=alert("x")>' }],
    };
    await tryFile('raro.json', JSON.stringify(hostile));
    await expect(preview).toContainText('<img src=x onerror=alert("x")>');
    await dialog.getByRole('button', { name: 'Importar 1 elemento' }).click();
    await expect(packageItem(dialog, '<img src=x onerror=alert("x")>')).toHaveCount(1);
    expect(dialogs).toEqual([]);
    expect(await page.locator('[data-testid=paquetes] img').count()).toBe(0);
  });

  test('si el navegador no deja guardar, se avisa y la sesión sigue funcionando', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Sin espacio', 'QuotaExceededError');
      };
    });
    await page.goto('/');
    await addImages(page, ['foto-pequena-640x480.jpg']);
    await settle(page);
    const dialog = await openPackages(page);
    await expect(dialog.getByTestId('sin-almacenamiento')).toContainText('no permite guardar datos');
    await savePackage(dialog, 'Temporal');
    await expect(packageItem(dialog, 'Temporal')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.locator('.export__count')).toContainText('2 archivos');
  });
});
