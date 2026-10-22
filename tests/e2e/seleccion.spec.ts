import { expect, test, type Page } from '@playwright/test';
import { inspect } from '../../src/lib/sniff';
import { formatBytes } from '../../src/lib/format';
import { addImages, decodePng, downloadZip, settle } from './helpers';

/** Casilla de una versión en «Versiones de esta imagen» (la imagen en revisión). */
const pick = (page: Page, version: string) =>
  page.getByTestId('seleccion').getByRole('checkbox', { name: new RegExp(`^${version}`) });

const show = (page: Page, name: string) => page.getByRole('button', { name: `Ver ${name}` }).click();

const tag = (page: Page, name: string) =>
  page.locator('.image-item', { hasText: name }).getByTestId('versiones-imagen');

const FOTO = 'foto-grande-6000x4000.jpg';
const LOGO = 'logo-transparente-1600x800.png';
const OTRA = 'foto-pequena-640x480.jpg';

test.describe('Versiones por imagen', () => {
  test('selección mixta: recuento, peso y ZIP con exactamente esas combinaciones', async ({ page }) => {
    await page.goto('/');
    await addImages(page, [FOTO, LOGO, OTRA]);
    await page.getByRole('button', { name: 'Añadir versión' }).click();
    await page.getByRole('button', { name: /Logo para perfil/ }).click();
    await settle(page);
    // Por defecto, todas las imágenes exportan todas las versiones.
    const count = page.locator('.export__count');
    await expect(count).toContainText('9 archivos');
    await expect(page.locator('[data-testid=versiones-imagen]')).toHaveCount(0);
    // El PNG del logo, transparente (ajuste de la versión, igual que antes).
    await show(page, LOGO);
    await page.getByRole('button', { name: 'Ajustar Logo para perfil' }).click();
    const editor = page.getByTestId('editor');
    await editor.getByRole('button', { name: 'Transparente', exact: true }).click();
    await editor.getByRole('button', { name: 'Listo' }).click();
    // Logo: solo el PNG transparente.
    await pick(page, 'Contenido web').uncheck();
    await pick(page, 'Instagram vertical 4:5').uncheck();
    await expect(page.getByTestId('seleccion')).toContainText('1 de 3');
    // Foto: web e Instagram.
    await show(page, FOTO);
    await pick(page, 'Logo para perfil').uncheck();
    // Otra imagen: solo web.
    await show(page, OTRA);
    await pick(page, 'Instagram vertical 4:5').uncheck();
    await pick(page, 'Logo para perfil').uncheck();
    // Cada imagen dice cuántas versiones exporta; la tarjeta excluida, que no se descargará.
    await expect(tag(page, FOTO)).toHaveText('2 de 3 versiones');
    await expect(tag(page, LOGO)).toHaveText('1 de 3 versiones');
    await expect(tag(page, OTRA)).toHaveText('1 de 3 versiones');
    const igCard = page.locator('[data-testid=output-card]').filter({ hasText: 'Instagram vertical 4:5' });
    await expect(igCard).toContainText('No se descargará');
    await expect(igCard.getByLabel('Incluir en la descarga')).not.toBeChecked();
    await settle(page);
    await expect(count).toContainText('4 archivos');
    await expect(count).toContainText('3 imágenes × 3 versiones, 5 sin incluir');

    const files = await downloadZip(page);
    const paths = Object.keys(files)
      .map((p) => p.replace(/^brisa-imagenes-\d{4}-\d{2}-\d{2}\//, ''))
      .sort();
    expect(paths).toEqual([
      'ig-4x5/foto-grande-6000x4000-ig-4x5.jpg',
      'perfil/logo-transparente-1600x800-perfil.png',
      'web/foto-grande-6000x4000-web.webp',
      'web/foto-pequena-640x480-web.webp',
    ]);
    // Formatos reales y transparencia del logo.
    const entry = (suffix: string) => files[Object.keys(files).find((k) => k.endsWith(suffix))!];
    expect(inspect(entry('foto-grande-6000x4000-ig-4x5.jpg'))!.format).toBe('jpeg');
    expect(inspect(entry('foto-grande-6000x4000-web.webp'))!.format).toBe('webp');
    expect(inspect(entry('foto-pequena-640x480-web.webp'))!.format).toBe('webp');
    const logo = await decodePng(entry('logo-transparente-1600x800-perfil.png'));
    expect([logo.width, logo.height]).toEqual([1080, 1080]);
    expect(logo.data[3]).toBe(0);
    // El peso total anunciado es el de lo que de verdad va en el ZIP.
    const total = Object.values(files).reduce((sum, bytes) => sum + bytes.length, 0);
    await expect(page.locator('.export__detail')).toContainText(`${formatBytes(total)} en total`);
    await expect(page.getByTestId('aviso-descarga')).toContainText('4 archivos');
  });

  test('excluir y volver a incluir conserva los ajustes de la versión y el encuadre', async ({ page }) => {
    await page.goto('/');
    await addImages(page, [FOTO]);
    await settle(page);
    await page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
    const editor = page.getByTestId('editor');
    await editor.getByTestId('crop-box').focus();
    await page.keyboard.press('ArrowLeft');
    await editor.locator('#quality').fill('55');
    await editor.getByRole('button', { name: 'Listo' }).click();
    await settle(page);
    const count = page.locator('.export__count');
    await expect(count).toContainText('2 archivos');

    await pick(page, 'Instagram vertical 4:5').uncheck();
    await expect(count).toContainText('1 archivo');
    await expect(count).toContainText('1 sin incluir');
    const card = page.locator('[data-testid=output-card]').filter({ hasText: 'Instagram vertical 4:5' });
    await expect(card).toContainText('No se descargará');

    // Se vuelve a incluir desde la propia tarjeta: los dos controles van a la par.
    await card.getByLabel('Incluir en la descarga').check();
    await expect(pick(page, 'Instagram vertical 4:5')).toBeChecked();
    await expect(count).toContainText('2 archivos');
    await expect(card).not.toContainText('No se descargará');
    await expect(card).toContainText('calidad 55');
    await card.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
    await expect(editor.getByRole('button', { name: 'Restablecer encuadre' })).toBeEnabled();
    await expect(editor.locator('#quality')).toHaveValue('55');
  });

  test('«Aplicar a todas» copia la selección a todas las imágenes y se puede deshacer', async ({ page }) => {
    await page.goto('/');
    await addImages(page, [FOTO, LOGO, OTRA]);
    await settle(page);
    const count = page.locator('.export__count');
    const apply = page.getByRole('button', { name: 'Aplicar esta selección a todas las imágenes' });
    // Con la misma selección en todas, no hay nada que aplicar.
    await expect(apply).toHaveAttribute('aria-disabled', 'true');
    await show(page, LOGO);
    await pick(page, 'Contenido web').uncheck();
    await expect(count).toContainText('5 archivos');
    await expect(apply).toHaveAttribute('aria-disabled', 'false');
    await apply.click();
    await expect(count).toContainText('3 archivos');
    for (const name of [FOTO, LOGO, OTRA]) await expect(tag(page, name)).toHaveText('1 de 2 versiones');
    const notice = page.getByTestId('aviso-revision');
    await expect(notice).toContainText('Selección aplicada a las 3 imágenes: «Instagram vertical 4:5»');
    await expect(apply).toHaveAttribute('aria-disabled', 'true');
    await expect(apply).toBeFocused();
    // Deshacer devuelve cada imagen a lo que tenía.
    await notice.getByRole('button', { name: 'Deshacer' }).click();
    await expect(count).toContainText('5 archivos');
    await expect(tag(page, LOGO)).toHaveText('1 de 2 versiones');
    await expect(tag(page, FOTO)).toHaveCount(0);
    await expect(tag(page, OTRA)).toHaveCount(0);
    await expect(apply).toBeFocused();
  });

  test('sin nada seleccionado se explica qué falta y la descarga se desactiva', async ({ page }) => {
    await page.goto('/');
    await addImages(page, [FOTO, OTRA]);
    await settle(page);
    const download = page.getByRole('button', { name: /Descargar ZIP/ });
    for (const name of [FOTO, OTRA]) {
      await show(page, name);
      await pick(page, 'Contenido web').uncheck();
      await pick(page, 'Instagram vertical 4:5').uncheck();
    }
    await expect(download).toBeDisabled();
    const missing = page.getByTestId('sin-seleccion');
    await expect(missing).toContainText('No hay nada seleccionado para descargar');
    await expect(missing).toContainText('Versiones de esta imagen');
    await expect(page.locator('.export__count')).toContainText('0 archivos');
    await expect(tag(page, FOTO)).toHaveText('Ninguna versión');
    // Con una sola combinación vuelve a poder descargarse, y se avisa de la imagen vacía.
    await pick(page, 'Contenido web').check();
    await expect(download).toBeEnabled();
    await expect(missing).toHaveCount(0);
    await expect(page.locator('.export__warn')).toContainText(
      `«${FOTO}» no tiene ninguna versión seleccionada: no irá en el ZIP`,
    );
    const files = await downloadZip(page);
    expect(Object.keys(files).map((p) => p.split('/').slice(1).join('/'))).toEqual([
      'web/foto-pequena-640x480-web.webp',
    ]);
  });
});
