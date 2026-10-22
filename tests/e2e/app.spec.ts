import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { inspect } from '../../src/lib/sniff';
import { addImages, decodePng, decodeWebp, downloadZip, entry, fixture, samePixels, settle } from './helpers';

test.describe('Preparador de imágenes', () => {
  test('privacidad: nada sale del navegador y la política de seguridad está activa', async ({ page }) => {
    const outside: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://localhost:4173') && !url.startsWith('blob:') && !url.startsWith('data:')) {
        outside.push(url);
      }
    });
    await page.goto('/');
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
      'content',
      /connect-src 'self'/,
    );
    await expect(page.getByText('Tus imágenes no salen de tu equipo')).toBeVisible();
    await addImages(page, ['foto-grande-6000x4000.jpg', 'logo-transparente-1600x800.png']);
    await settle(page);
    await downloadZip(page);
    expect(outside).toEqual([]);
  });

  test('lee formatos reales, transparencias y orientación, y rechaza lo que no es imagen', async ({ page }) => {
    await page.goto('/');
    await addImages(page, [
      'retrato-exif-rotado.jpg',
      'logo-transparente-1600x800.png',
      'ilustracion-sin-perdida.webp',
      'foto-web-2400x1600.webp',
      'icono-64x64.png',
      'no-soy-una-imagen.jpg',
    ]);
    await expect(page.locator('.toast')).toContainText('no-soy-una-imagen.jpg');
    const items = page.locator('.image-item');
    await expect(items).toHaveCount(5);
    // Guardada tumbada con orientación EXIF: se lee de pie.
    await expect(items.nth(0)).toContainText('1512 × 2016');
    await expect(items.nth(1)).toContainText('Transparencia');
    await expect(items.nth(2)).toContainText('Transparencia');
    await expect(items.nth(3)).not.toContainText('Transparencia');
    await expect(items.nth(4)).toContainText('64 × 64');
    await settle(page);
  });

  test('nunca amplía: una imagen pequeña se entrega a su tamaño real', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-pequena-640x480.jpg']);
    await settle(page);
    const web = page.locator('[data-testid=output-card]').filter({ hasText: 'Contenido web' });
    await expect(web).toContainText('640 × 480 px');
    await expect(web).toContainText('No se amplía');
  });

  test('peso antes y después, y el último ajuste de calidad no se pierde al cerrar', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg']);
    await settle(page);
    await page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
    const editor = page.getByTestId('editor');
    const weight = editor.locator('.compare-table tr', { hasText: 'Peso' });
    await expect(weight).toContainText('1,8 MB');
    await expect(weight.locator('strong')).toBeVisible();
    const before = await weight.locator('strong').innerText();
    await editor.locator('#quality').fill('35');
    await expect(weight.locator('strong')).not.toHaveText(before, { timeout: 30_000 });
    await editor.locator('#quality').fill('60');
    await editor.getByRole('button', { name: 'Listo' }).click();
    const card = page.locator('[data-testid=output-card]').filter({ hasText: 'Instagram vertical 4:5' });
    await expect(card).toContainText('calidad 60');
  });

  test('recorte manual: mover el encuadre cambia la copia', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg']);
    await settle(page);
    const card = page.locator('[data-testid=output-card]').filter({ hasText: 'Instagram vertical 4:5' });
    const firstSrc = await card.locator('img').getAttribute('src');
    await card.getByRole('button', { name: 'Ajustar', exact: true }).click();
    const box = page.getByTestId('crop-box');
    await expect(box).toBeVisible();
    const rect = (await box.boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 - 180, rect.y + rect.height / 2, { steps: 6 });
    await page.mouse.up();
    const moved = (await box.boundingBox())!;
    expect(moved.x).toBeLessThan(rect.x - 100);
    // También con teclado.
    await box.focus();
    await page.keyboard.press('ArrowRight');
    await page.getByTestId('editor').getByRole('button', { name: 'Listo' }).click();
    await settle(page);
    await expect(card.locator('img')).not.toHaveAttribute('src', firstSrc!);
  });

  test('márgenes con fondo transparente: el PNG conserva la transparencia', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['logo-transparente-1600x800.png']);
    await page.getByRole('button', { name: 'Añadir salida' }).click();
    await page.getByRole('button', { name: /Logo para perfil/ }).click();
    await settle(page);
    await page.getByRole('button', { name: 'Ajustar Logo para perfil' }).click();
    const editor = page.getByTestId('editor');
    await editor.getByRole('button', { name: 'Transparente', exact: true }).click();
    await editor.getByRole('button', { name: 'Listo' }).click();
    await settle(page);
    const files = await downloadZip(page);
    const png = await decodePng(entry(files, 'perfil/logo-transparente-1600x800-perfil.png'));
    expect([png.width, png.height]).toEqual([1080, 1080]);
    expect(png.data[3]).toBe(0); // esquina transparente
    const center = (540 * 1080 + 540) * 4;
    expect(png.data[center + 3]).toBeGreaterThan(0);
    // El JPG de la misma imagen no puede tener transparencia: se rellena y se avisa.
    expect(inspect(entry(files, 'ig-4x5/logo-transparente-1600x800-ig-4x5.jpg'))!.format).toBe('jpeg');
  });

  test('los logos no se alteran: sin cambios de tamaño salen idénticos píxel a píxel', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['brisa-logotipo-2400x400.png', 'ilustracion-sin-perdida.webp', 'degradado-alfa-1024x512.png']);
    // Solo «Solo optimizar»: mismo tamaño y formato.
    for (const name of ['Quitar la salida Contenido web', 'Quitar la salida Instagram vertical 4:5']) {
      await page.getByRole('button', { name }).click();
    }
    await page.getByRole('button', { name: 'Añadir salida' }).click();
    await page.getByRole('button', { name: /Solo optimizar/ }).click();
    await settle(page);
    const files = await downloadZip(page);
    const pairs: Array<[string, string, typeof decodePng]> = [
      ['brisa-logotipo-2400x400.png', 'brisa-logotipo-2400x400-optimizada.png', decodePng],
      ['degradado-alfa-1024x512.png', 'degradado-alfa-1024x512-optimizada.png', decodePng],
      ['ilustracion-sin-perdida.webp', 'ilustracion-sin-perdida-optimizada.webp', decodeWebp],
    ];
    for (const [original, copy, decode] of pairs) {
      const a = await decode(new Uint8Array(readFileSync(fixture(original))));
      const b = await decode(entry(files, copy));
      expect(samePixels(a, b), `${copy} debe ser idéntica a ${original}`).toBe(true);
    }
  });

  test('ZIP ordenado por salida, con nombres limpios y las originales intactas', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg', 'icono-64x64.png']);
    await page.getByLabel('Incluir las originales').check();
    await settle(page);
    await page.getByRole('button', { name: 'Ver icono-64x64.png' }).click();
    await page.getByLabel('Nombre para las copias').fill('Ícono Brisa');
    const files = await downloadZip(page);
    const paths = Object.keys(files).sort();
    expect(paths.every((p) => /^brisa-imagenes-\d{4}-\d{2}-\d{2}\//.test(p))).toBe(true);
    expect(paths.some((p) => p.endsWith('/web/icono-brisa-web.webp'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/ig-4x5/foto-grande-6000x4000-ig-4x5.jpg'))).toBe(true);
    const original = new Uint8Array(readFileSync(fixture('foto-grande-6000x4000.jpg')));
    expect(Buffer.compare(Buffer.from(entry(files, 'originales/foto-grande-6000x4000.jpg')), Buffer.from(original))).toBe(0);
    const ig = inspect(entry(files, 'ig-4x5/foto-grande-6000x4000-ig-4x5.jpg'))!;
    expect([ig.width, ig.height]).toEqual([1080, 1350]);
    const web = inspect(entry(files, 'web/foto-grande-6000x4000-web.webp'))!;
    expect([web.width, web.height]).toEqual([1200, 800]);
  });

  test('los ajustes se guardan en el dispositivo', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-pequena-640x480.jpg']);
    await settle(page);
    await page.getByRole('button', { name: 'Ajustar Contenido web' }).click();
    const editor = page.getByTestId('editor');
    await editor.getByLabel('Nombre del ajuste').fill('Blog Brisa');
    await editor.getByRole('button', { name: 'Guardar' }).click();
    await editor.getByRole('button', { name: 'Listo' }).click();
    await page.getByLabel('Nombre de los archivos').fill('{n}-{nombre}');
    await page.reload();
    await addImages(page, ['foto-pequena-640x480.jpg']);
    await expect(page.getByLabel('Nombre de los archivos')).toHaveValue('{n}-{nombre}');
    await page.getByRole('button', { name: 'Añadir salida' }).click();
    await expect(page.locator('.preset', { hasText: 'Blog Brisa' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Borrar el ajuste Blog Brisa' })).toBeVisible();
  });

  test('en el móvil no hay desplazamiento lateral', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await addImages(page, ['foto-grande-6000x4000.jpg', 'logo-transparente-1600x800.png']);
    await settle(page);
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});
