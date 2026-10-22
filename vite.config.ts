/// <reference types="vitest/config" />
import { existsSync, readFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Política de seguridad del contenido: la página solo puede cargar recursos
// propios y no puede enviar datos a ningún otro servidor. Es lo que garantiza
// que las imágenes nunca salen del navegador.
const CSP_SITE = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "connect-src 'self'",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

// Versión de archivo único: todo va dentro del HTML y la página no puede
// conectarse a ningún sitio (solo lee datos que ya lleva dentro).
const CSP_SINGLE_FILE = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'wasm-unsafe-eval' blob: data:",
  "worker-src blob: data:",
  "connect-src data: blob:",
  "img-src blob: data:",
  "style-src 'unsafe-inline'",
  "font-src data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export const SINGLE_FILE_NAME = 'brisa-preparador-de-imagenes.html';

function contentSecurityPolicy(csp: string): Plugin {
  return {
    name: 'brisa-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<!-- csp -->', `<meta http-equiv="Content-Security-Policy" content="${csp}" />`);
    },
  };
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mete el JS, el CSS y el favicon dentro del HTML para abrirlo con doble clic. */
function singleFile(): Plugin {
  let outDir = '';
  return {
    name: 'brisa-archivo-unico',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    generateBundle(_, bundle) {
      const page = bundle['index.html'];
      if (!page || page.type !== 'asset') return;
      let html = String(page.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'chunk' && file.isEntry) {
          const tag = new RegExp(`<script[^>]*src="\\./${escapeRegExp(name)}"[^>]*></script>`);
          const code = file.code.replace(/<\/script/gi, '<\\/script');
          html = html.replace(tag, () => `<script type="module">${code}</script>`);
          delete bundle[name];
        } else if (file.type === 'asset' && name.endsWith('.css')) {
          const tag = new RegExp(`<link[^>]*href="\\./${escapeRegExp(name)}"[^>]*>`);
          html = html.replace(tag, () => `<style>${String(file.source)}</style>`);
          delete bundle[name];
        }
      }
      const favicon = readFileSync(resolve('public/favicon.svg'), 'utf8');
      html = html.replace('href="./favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(favicon)}"`);
      page.source = html;
    },
    closeBundle() {
      const built = resolve(outDir, 'index.html');
      if (existsSync(built)) renameSync(built, resolve(outDir, SINGLE_FILE_NAME));
    },
  };
}

export default defineConfig(({ mode }) => {
  const singleFileBuild = mode === 'archivo';
  return {
    // Rutas relativas: el sitio funciona en la raíz de un dominio o en una subcarpeta.
    base: './',
    plugins: [
      react(),
      contentSecurityPolicy(singleFileBuild ? CSP_SINGLE_FILE : CSP_SITE),
      ...(singleFileBuild ? [singleFile()] : []),
    ],
    resolve: singleFileBuild
      ? { alias: [{ find: /^\.\/spawn-worker$/, replacement: resolve('src/engine/spawn-worker-inline.ts') }] }
      : undefined,
    // Abierta desde el disco, Chrome solo admite workers clásicos (no de tipo módulo).
    worker: { format: singleFileBuild ? 'iife' : 'es' },
    optimizeDeps: {
      exclude: ['@jsquash/jpeg', '@jsquash/webp', '@jsquash/png', '@jsquash/oxipng', '@jsquash/resize'],
    },
    build: singleFileBuild
      ? {
          target: 'es2022',
          outDir: 'dist-archivo',
          // Todo (códecs, tipografías) en línea dentro del HTML.
          assetsInlineLimit: () => true,
          copyPublicDir: false,
          modulePreload: false,
          cssCodeSplit: false,
        }
      : {
          target: 'es2022',
          // Nada en línea como data: (la CSP del sitio no permite cargar WASM desde data:).
          assetsInlineLimit: 0,
        },
    test: {
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
    },
  };
});
