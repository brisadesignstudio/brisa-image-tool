/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Política de seguridad del contenido: la página solo puede cargar recursos
// propios y no puede enviar datos a ningún otro servidor. Es lo que garantiza
// que las imágenes nunca salen del navegador.
const CSP = [
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

function contentSecurityPolicy(): Plugin {
  return {
    name: 'brisa-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<!-- csp -->',
        `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  // Rutas relativas: el sitio funciona en la raíz de un dominio o en una subcarpeta.
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/webp', '@jsquash/png', '@jsquash/oxipng', '@jsquash/resize'],
  },
  build: {
    target: 'es2022',
    // Nada en línea como data: (la CSP no permite cargar WASM desde data:).
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
