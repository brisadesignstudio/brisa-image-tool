import { expect, test, type Locator, type Page } from '@playwright/test';
import { inspect } from '../../src/lib/sniff';
import { addImages, decodePng, downloadZip, settle } from './helpers';

/** Abre el editor de una versión y activa su peso máximo (en KB). */
async function openWithLimit(page: Page, version: string, kb: string): Promise<Locator> {
  await page.getByRole('button', { name: `Ajustar ${version}` }).click();
  const editor = page.getByTestId('editor');
  await editor.getByLabel('Peso máximo por archivo', { exact: true }).check();
  await setLimit(editor, kb);
  return editor;
}

async function setLimit(editor: Locator, kb: string) {
  const field = editor.getByLabel('Peso máximo por archivo, en KB');
  await field.fill(kb);
  await field.press('Enter');
}

/** Peso que muestra el resumen del editor, en bytes aproximados («39 KB» → 39 000). */
async function shownBytes(editor: Locator): Promise<number> {
  const text = await editor.getByTestId('peso-copia').innerText();
  const [value, unit] = text.replace(',', '.').split(/\s+/);
  return Number(value) * (unit === 'MB' ? 1_000_000 : unit === 'KB' ? 1000 : 1);
}

const strip = (files: Record<string, Uint8Array>) =>
  Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path.split('/').slice(1).join('/'), bytes]));

test.describe('Peso máximo por versión', () => {
  test('ya cumple, se alcanza bajando la calidad o es imposible: siempre un archivo válido', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg']);
    await settle(page);
    const editor = await openWithLimit(page, 'Instagram vertical 4:5', '300');
    const summary = editor.getByTestId('resumen');
    // Ya cumple: se mantiene la calidad elegida.
    await expect(editor.getByTestId('limite-resumen')).toHaveText('Dentro del máximo (300 KB)');
    await expect(summary).toContainText('compresión con pérdida, calidad 90');
    await expect(editor.getByText('Calidad (máxima)')).toBeVisible();
    // Se alcanza: la mayor calidad que cabe, sin cambiar medidas ni formato.
    await setLimit(editor, '40');
    await expect(editor.getByTestId('limite-resumen')).toHaveText('Dentro del máximo (40 KB)');
    await expect(summary).toContainText('ajustada al peso; máxima 90');
    await expect(summary).toContainText('JPG · 1080 × 1350 px');
    expect(await shownBytes(editor)).toBeLessThanOrEqual(40_000);
    // Imposible sin bajar de la calidad mínima: se entrega igualmente y se explica.
    await setLimit(editor, '5');
    await expect(editor.getByTestId('limite-resumen')).toHaveText('Supera el peso máximo (5 KB)');
    await expect(summary).toContainText('calidad 60 (ajustada al peso; máxima 90)');
    const notes = editor.locator('.stage__foot .notes');
    await expect(notes).toContainText('incluso con la calidad mínima (60)');
    await expect(notes).toContainText('reduce las medidas, baja la calidad mínima o prueba WebP');
    await editor.getByRole('button', { name: 'Listo' }).click();
    // Tarjeta, ficha de versión y descarga muestran el límite y el aviso.
    const card = page.locator('[data-testid=output-card]').filter({ hasText: 'Instagram vertical 4:5' });
    await expect(card.getByTestId('limite')).toHaveText('Supera el peso máximo (5 KB)');
    await expect(card).toContainText('calidad 60, ajustada al peso');
    await expect(page.getByRole('button', { name: 'Editar la versión Instagram vertical 4:5' })).toContainText(
      'máx. 5 KB',
    );
    await expect(page.getByTestId('sobre-limite')).toContainText('1 archivo supera el peso máximo');
    const files = strip(await downloadZip(page));
    expect(Object.keys(files).sort()).toEqual([
      'ig-4x5/foto-grande-6000x4000-ig-4x5.jpg',
      'web/foto-grande-6000x4000-web.webp',
    ]);
    const ig = inspect(files['ig-4x5/foto-grande-6000x4000-ig-4x5.jpg'])!;
    expect([ig.format, ig.width, ig.height]).toEqual(['jpeg', 1080, 1350]);
    expect(files['ig-4x5/foto-grande-6000x4000-ig-4x5.jpg'].length).toBeGreaterThan(5_000);
    await expect(page.getByTestId('aviso-descarga')).toContainText('Incluye 1 archivo que supera el peso máximo');
  });

  test('PNG y WebP sin pérdida (logo transparente): nunca pasan a compresión con pérdida', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['logo-transparente-1600x800.png']);
    await page.getByRole('button', { name: 'Añadir versión' }).click();
    await page.getByRole('button', { name: /Logo para perfil/ }).click();
    await settle(page);
    const editor = await openWithLimit(page, 'Logo para perfil', '20');
    await editor.getByRole('button', { name: 'Transparente', exact: true }).click();
    // Sin calidad mínima: este formato no baja de calidad.
    await expect(editor.getByLabel('Calidad mínima')).toHaveCount(0);
    await expect(editor.locator('#limit-hint')).toContainText('guarda sin pérdida');
    await expect(editor.getByTestId('limite-resumen')).toHaveText('Supera el peso máximo (20 KB)');
    await expect(editor.getByTestId('resumen')).toContainText('compresión sin pérdida');
    await expect(editor.locator('.stage__foot .notes')).toContainText(
      'reduce las medidas o elige WebP con pérdida, que conserva la transparencia',
    );
    await editor.getByRole('button', { name: 'Listo' }).click();
    await settle(page);
    let files = strip(await downloadZip(page));
    const png = await decodePng(files['perfil/logo-transparente-1600x800-perfil.png']);
    expect([png.width, png.height]).toEqual([1080, 1080]);
    expect(png.data[3]).toBe(0); // la transparencia sigue ahí

    // WebP sin pérdida: tampoco se cambia a con pérdida.
    await page.getByRole('button', { name: 'Ajustar Logo para perfil' }).click();
    await editor.getByRole('button', { name: 'WebP', exact: true }).click();
    await editor.getByLabel('Compresión sin pérdida (logos e ilustraciones)').check();
    await setLimit(editor, '2');
    await expect(editor.getByTestId('limite-resumen')).toHaveText('Supera el peso máximo (2 KB)');
    await expect(editor.locator('.stage__foot .notes')).toContainText('usa WebP con pérdida');
    await editor.getByRole('button', { name: 'Listo' }).click();
    await settle(page);
    files = strip(await downloadZip(page));
    const webp = inspect(files['perfil/logo-transparente-1600x800-perfil.webp'])!;
    expect(webp.format).toBe('webp');
    expect(webp.webpLossless).toBe(true);
    expect(webp.alphaPossible).toBe(true);
  });

  test('cambios rápidos del límite: solo se muestra el resultado de los ajustes actuales', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg']);
    await settle(page);
    const editor = await openWithLimit(page, 'Instagram vertical 4:5', '5');
    await setLimit(editor, '40');
    await setLimit(editor, '7');
    await setLimit(editor, '300');
    await expect(editor.getByTestId('limite-resumen')).toHaveText('Dentro del máximo (300 KB)');
    await expect(editor.getByTestId('resumen')).toContainText('calidad 90');
    await expect(editor.locator('.stage__foot')).not.toContainText('Supera');
    await editor.getByRole('button', { name: 'Listo' }).click();
    await settle(page);
    const card = page.locator('[data-testid=output-card]').filter({ hasText: 'Instagram vertical 4:5' });
    await expect(card.getByTestId('limite')).toHaveText('Dentro del máximo (300 KB)');
    await expect(card).toContainText('calidad 90');
    await expect(page.getByTestId('sobre-limite')).toHaveCount(0);
  });

  test('lote mixto con versiones excluidas: ZIP con formatos, medidas, límites y selección correctos', async ({ page }) => {
    await page.goto('/');
    const names = ['foto-grande-6000x4000.jpg', 'retrato-exif-rotado.jpg', 'logo-transparente-1600x800.png', 'foto-pequena-640x480.jpg'];
    await addImages(page, names);
    await settle(page);
    let editor = await openWithLimit(page, 'Contenido web', '20');
    await editor.getByRole('button', { name: 'Listo' }).click();
    editor = await openWithLimit(page, 'Instagram vertical 4:5', '50');
    await editor.getByRole('button', { name: 'Listo' }).click();
    // Logo: sin Instagram. Retrato: sin web.
    const pick = (version: string) =>
      page.getByTestId('seleccion').getByRole('checkbox', { name: new RegExp(`^${version}`) });
    await page.getByRole('button', { name: 'Ver logo-transparente-1600x800.png' }).click();
    await pick('Instagram vertical 4:5').uncheck();
    await page.getByRole('button', { name: 'Ver retrato-exif-rotado.jpg' }).click();
    await pick('Contenido web').uncheck();
    await settle(page);
    await expect(page.locator('.export__count')).toContainText('6 archivos');

    const files = strip(await downloadZip(page));
    expect(Object.keys(files).sort()).toEqual([
      'ig-4x5/foto-grande-6000x4000-ig-4x5.jpg',
      'ig-4x5/foto-pequena-640x480-ig-4x5.jpg',
      'ig-4x5/retrato-exif-rotado-ig-4x5.jpg',
      'web/foto-grande-6000x4000-web.webp',
      'web/foto-pequena-640x480-web.webp',
      'web/logo-transparente-1600x800-web.webp',
    ]);
    let over = 0;
    for (const [path, bytes] of Object.entries(files)) {
      const meta = inspect(bytes)!;
      if (path.startsWith('web/')) {
        expect(meta.format, path).toBe('webp');
        expect(meta.width!, path).toBeLessThanOrEqual(1200);
        if (bytes.length > 20_000) over += 1;
      } else {
        expect(meta.format, path).toBe('jpeg');
        expect(meta.height! / meta.width!, path).toBeCloseTo(1350 / 1080, 2);
        if (bytes.length > 50_000) over += 1;
      }
    }
    // Lo que supera su límite va en el ZIP y está avisado; lo demás cabe.
    if (over === 0) await expect(page.getByTestId('sobre-limite')).toHaveCount(0);
    else await expect(page.getByTestId('sobre-limite')).toContainText(`${over} archivo`);
    expect(inspect(files['web/logo-transparente-1600x800-web.webp'])!.alphaPossible).toBe(true);
  });
});
