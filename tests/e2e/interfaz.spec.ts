import { expect, test, type Page } from '@playwright/test';
import { addImages, downloadZip, settle } from './helpers';

/**
 * Controles que no se pueden pulsar porque algo los tapa: para cada botón, campo o
 * selector visible se lleva a la vista y se comprueba qué hay en su centro.
 */
async function coveredControls(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((selector) => {
    const describe = (el: Element | null) =>
      el
        ? `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''} «${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}»`
        : 'nada';
    const root = document.querySelector(selector);
    if (!root) return [`no existe ${selector}`];
    const problems: string[] = [];
    const controls = root.querySelectorAll<HTMLElement>(
      'button, input:not([type=file]), select, summary, [tabindex="0"]',
    );
    for (const el of controls) {
      if (el.closest('[inert]') || (el.closest('dialog') && !el.closest('dialog[open]'))) continue;
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Zonas muy grandes (la zona de revisión) se comprueban por su borde superior.
      const x = r.left + Math.min(r.width / 2, 40);
      const y = r.top + Math.min(r.height / 2, 20);
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) {
        problems.push(`${describe(el)} queda fuera de la pantalla`);
        continue;
      }
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) {
        problems.push(`${describe(el)} tapado por ${describe(hit)}`);
      }
    }
    return problems;
  }, scope);
}

const VIEWS = [
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'ventana pequeña', width: 1024, height: 700 },
  { name: 'móvil', width: 390, height: 844 },
  { name: 'zoom 200 %', width: 720, height: 450 },
];

test.describe('Interfaz', () => {
  test('ningún control queda tapado en la mesa ni en el editor', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg', 'logo-transparente-1600x800.png', 'foto-pequena-640x480.jpg']);
    await settle(page);
    // El detector funciona: una barra fija sobre la descarga se detecta.
    await page.evaluate(() => {
      const bar = document.createElement('div');
      bar.id = 'barra-de-prueba';
      bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:160px;z-index:99;background:#000';
      document.body.append(bar);
    });
    expect((await coveredControls(page, 'body')).join('\n')).toContain('Descargar ZIP');
    await page.evaluate(() => document.getElementById('barra-de-prueba')?.remove());
    for (const view of VIEWS) {
      await page.setViewportSize({ width: view.width, height: view.height });
      expect(await coveredControls(page, 'body'), `mesa · ${view.name}`).toEqual([]);
      // Con las opciones de descarga abiertas.
      await page.getByRole('button', { name: 'Más opciones' }).click();
      expect(await coveredControls(page, 'body'), `mesa con opciones · ${view.name}`).toEqual([]);
      await page.getByRole('button', { name: 'Menos opciones' }).click();
      // Editor, con «Más opciones» de la versión abierto.
      await page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
      const editor = page.getByTestId('editor');
      await editor.getByText('Más opciones', { exact: true }).click();
      expect(await coveredControls(page, '[data-testid=editor]'), `editor · ${view.name}`).toEqual([]);
      await editor.getByRole('button', { name: 'Listo' }).click();
      await expect(editor).toHaveCount(0);
    }
  });

  test('versiones para exportar: se entiende cuántas, de qué tipo y a cuántas imágenes afectan', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg', 'icono-64x64.png']);
    await settle(page);
    const versions = page.getByRole('region', { name: /Versiones para exportar/ });
    await expect(versions).toContainText('Por defecto, cada versión se aplica a las 2 imágenes');
    await expect(versions.getByRole('button', { name: 'Editar la versión Contenido web' })).toContainText(
      '1200 px de ancho · WebP',
    );
    await expect(versions.getByRole('button', { name: 'Editar la versión Instagram vertical 4:5' })).toContainText(
      '1080 × 1350 px · JPG',
    );
    // El selector deja claro qué destinos ya están en uso.
    await page.getByRole('button', { name: 'Añadir versión' }).click();
    await expect(page.getByRole('dialog', { name: 'Añadir versión' })).toBeVisible();
    await expect(page.locator('.preset', { hasText: 'Instagram vertical 4:5' })).toContainText('Ya está en tus versiones');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  });

  test('quitar una versión se puede deshacer, con sus encuadres, y el foco no se pierde', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg']);
    await settle(page);
    // Un encuadre propio en Instagram.
    await page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
    const editor = page.getByTestId('editor');
    await editor.getByTestId('crop-box').focus();
    await page.keyboard.press('ArrowLeft');
    await editor.getByRole('button', { name: 'Listo' }).click();
    await page.getByRole('button', { name: 'Quitar la versión Instagram vertical 4:5' }).click();
    await expect(page.getByRole('button', { name: 'Editar la versión Instagram vertical 4:5' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar la versión Contenido web' })).toBeFocused();
    const notice = page.getByTestId('aviso-versiones');
    await expect(notice).toContainText('Versión «Instagram vertical 4:5» quitada de todas las imágenes');
    await notice.getByRole('button', { name: 'Deshacer' }).click();
    const restored = page.getByRole('button', { name: 'Editar la versión Instagram vertical 4:5' });
    await expect(restored).toBeFocused();
    await expect(notice).toHaveCount(0);
    // Vuelve en su sitio y con su encuadre.
    await expect(page.locator('.chip__name')).toHaveText(['Contenido web', 'Instagram vertical 4:5']);
    await restored.click();
    await expect(editor.getByRole('button', { name: 'Restablecer encuadre' })).toBeEnabled();
  });

  test('alcance: lo de la versión vale para todas las imágenes; el encuadre, solo para una', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg', 'foto-web-2400x1600.webp']);
    await settle(page);
    await page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
    const editor = page.getByTestId('editor');
    await expect(editor.locator('.side__head')).toContainText('Para las 2 imágenes');
    await expect(editor.locator('.cropbar')).toContainText('Solo esta imagen');
    await expect(editor.locator('.cropbar')).toContainText('arrastra el marco');
    const reset = editor.getByRole('button', { name: 'Restablecer encuadre' });
    await expect(reset).toBeDisabled();
    await editor.getByTestId('crop-box').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(reset).toBeEnabled();
    await editor.locator('#quality').fill('55');
    // En la otra imagen: la calidad compartida ya está y el encuadre sigue centrado.
    await editor.getByRole('button', { name: 'Imagen siguiente' }).click();
    await expect(editor).toContainText('foto-web-2400x1600.webp');
    await expect(editor.locator('#quality')).toHaveValue('55');
    await expect(reset).toBeDisabled();
    // De vuelta en la primera, el encuadre propio sigue ahí y se puede restablecer.
    await editor.getByRole('button', { name: 'Imagen anterior' }).click();
    await expect(reset).toBeEnabled();
    await reset.click();
    await expect(reset).toBeDisabled();
    // También desde «Resultado»: el encuadre se ve como individual y se puede cambiar.
    await editor.getByRole('button', { name: 'Resultado' }).click();
    await expect(editor.locator('.cropbar')).toContainText('Encuadre centrado');
    await editor.getByRole('button', { name: 'Cambiar encuadre' }).click();
    await expect(editor.getByTestId('crop-box')).toBeVisible();
    await editor.getByRole('button', { name: 'Listo' }).click();
    await settle(page);
    const card = page.locator('[data-testid=output-card]').filter({ hasText: 'Instagram vertical 4:5' });
    await expect(card).toContainText('calidad 55');
  });

  test('vista previa: fondo de vista frente a fondo exportado, zoom frente a medida real', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['logo-transparente-1600x800.png']);
    await settle(page);
    await page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
    const editor = page.getByTestId('editor');
    const viewBg = editor.getByRole('group', { name: /Fondo de vista/ });
    await expect(viewBg).toContainText('Fondo de vista');
    await viewBg.getByRole('button', { name: 'Oscuro' }).click();
    await expect(viewBg.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');
    // JPG no admite transparencia: el fondo que se exporta se elige aparte y se nombra.
    await expect(editor.getByText('Fondo exportado')).toBeVisible();
    await expect(editor.getByTestId('resumen')).toContainText('fondo blanco');
    await editor.getByRole('button', { name: 'Resultado' }).click();
    await expect(editor.locator('.view-scale')).toContainText(/Vista (reducida al \d+ %|a tamaño real)/);
    await editor.getByRole('button', { name: 'Antes y después' }).click();
    await expect(editor.getByRole('group', { name: 'Zoom de inspección' })).toBeVisible();
    await expect(editor.locator('.compare-toolbar__scale')).toContainText('el archivo mide 640 × 800 px');
    await expect(editor.locator('.compare__labels')).toContainText('Antes de comprimir');
    await expect(editor.locator('.compare__labels')).toContainText('Después · archivo final');
  });

  test('descarga: recuento claro, «Más opciones» y aviso que no da el archivo por guardado', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg', 'icono-64x64.png']);
    await settle(page);
    const count = page.locator('.export__count');
    await expect(count).toContainText('4 archivos');
    await expect(count).toContainText('2 imágenes × 2 versiones');
    // Una copia fuera: se ve en su tarjeta y en el recuento.
    const card = page.locator('[data-testid=output-card]').filter({ hasText: 'Contenido web' });
    await card.getByLabel('Incluir en la descarga').uncheck();
    await expect(card).toContainText('No se descargará');
    await expect(count).toContainText('3 archivos');
    await expect(count).toContainText('1 sin incluir');
    // Lo menos frecuente está en «Más opciones», con su estado anunciado.
    await expect(page.getByLabel('Nombre de los archivos')).toHaveCount(0);
    const more = page.getByRole('button', { name: 'Más opciones' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(page.getByRole('button', { name: 'Menos opciones' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Nombre de los archivos')).toHaveValue('{nombre}-{version}');
    await expect(page.locator('.export__example')).toContainText('foto-grande-6000x4000-ig-4x5.jpg');
    await page.getByLabel('Incluir las originales intactas').check();
    await expect(count).toContainText('5 archivos');
    await expect(count).toContainText('+ 2 originales');
    const files = await downloadZip(page);
    expect(Object.keys(files)).toHaveLength(5);
    const notice = page.getByTestId('aviso-descarga');
    await expect(notice).toContainText('Descarga iniciada');
    await expect(notice).toContainText('5 archivos');
    await expect(notice).toContainText('descargas de tu navegador');
    await expect(notice).not.toContainText('guardad');
  });

  test('una imagen dañada se explica y no se cuela en silencio en la descarga', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-pequena-640x480.jpg']);
    // Se espera a la mesa de trabajo: el selector de la portada desaparece al cargar.
    await expect(page.locator('.image-item')).toHaveCount(1);
    await page.locator('[data-testid=file-input]').first().setInputFiles({
      name: 'dañada.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(200).fill(7)]),
    });
    const broken = page.locator('.image-item', { hasText: 'dañada.jpg' });
    await expect(broken).toContainText(/Vuelve a exportarl[ao]/);
    await settle(page);
    await expect(page.locator('.export__warn')).toContainText('1 imagen no se pudo leer y no se incluirá');
    await expect(page.locator('.export__count')).toContainText('2 archivos');
    const files = await downloadZip(page);
    expect(Object.keys(files)).toHaveLength(2);
    await expect(page.getByTestId('aviso-descarga')).toContainText('No incluye «dañada.jpg», que no se pudo leer');
  });

  test('teclado: el editor se abre, se recorre y se cierra sin perder el foco', async ({ page }) => {
    await page.goto('/');
    await addImages(page, ['foto-grande-6000x4000.jpg', 'retrato-exif-rotado.jpg']);
    await settle(page);
    const adjust = page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' });
    await adjust.focus();
    await page.keyboard.press('Enter');
    const editor = page.getByTestId('editor');
    await expect(editor).toBeVisible();
    // Mientras está abierto, el foco no se escapa a la página de detrás.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid=editor]')));
      expect(inside).toBe(true);
    }
    await editor.getByRole('button', { name: 'Imagen siguiente' }).focus();
    await page.keyboard.press('Enter');
    await expect(editor).toContainText('retrato-exif-rotado.jpg');
    // Escape cierra igual que «Listo»: los cambios ya están guardados y el foco vuelve.
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    await expect(adjust).toBeFocused();
    // La zona de revisión se puede desplazar con el teclado.
    const main = page.locator('main.main');
    await main.focus();
    await expect(main).toBeFocused();
  });

  test('zoom 200 % y móvil: una sola columna, sin desplazamiento lateral ni zonas anidadas', async ({ page }) => {
    for (const view of VIEWS.slice(2)) {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.goto('/');
      await addImages(page, ['foto-grande-6000x4000.jpg', 'retrato-exif-rotado.jpg']);
      await settle(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, view.name).toBeLessThanOrEqual(0);
      // La revisión no tiene desplazamiento propio: se mueve con la página.
      const nested = await page.locator('main.main').evaluate((n) => n.scrollHeight > n.clientHeight + 1);
      expect(nested, view.name).toBe(false);
      await page.getByRole('button', { name: 'Ajustar Instagram vertical 4:5' }).click();
      const editor = page.getByTestId('editor');
      // El editor se desplaza entero; los ajustes no llevan otra barra de desplazamiento.
      const side = await editor.locator('.editor__side').evaluate((n) => n.scrollHeight > n.clientHeight + 1);
      expect(side, view.name).toBe(false);
      await editor.evaluate((n) => n.scrollTo(0, n.scrollHeight));
      await expect(editor.getByRole('button', { name: 'Listo' })).toBeInViewport();
      await editor.getByRole('button', { name: 'Listo' }).click();
    }
  });
});
