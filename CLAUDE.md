# Preparador de imágenes · Brisa Design Studio

Herramienta web para preparar imágenes terminadas (web, redes, entregas): varias versiones por
imagen, encuadre por imagen, compresión con control, peso máximo opcional, paquetes de ajustes y
un ZIP ordenado. Interfaz en español. Todo el procesado ocurre en el navegador.

Estado, historial y pendientes: `ESTADO.md`. Documentación de uso y desarrollo: `README.md`.

## Reglas que no se rompen

- **Todo local**: sin servidores, cuentas, base de datos, APIs ni servicios de pago; ninguna
  conexión externa durante el uso (la CSP lo impide y las pruebas lo comprueban).
- **Originales intactos**; nunca se generan ni reinterpretan imágenes (sin IA, filtros ni
  retoques); nunca se amplía; los logos sin cambios salen idénticos píxel a píxel.
- **Nunca se sustituye en silencio** una conversión pedida; las excepciones se explican con qué
  hacer. «Sin pérdida» describe solo la compresión.
- **Identidad**: fondos de interfaz blancos puros `#FFFFFF`; paleta y logotipos originales de
  Brisa (`brand/`, `src/brand/paths.ts`); tipografías libres incluidas (Fraunces, Archivo) y las de
  marca solo si están instaladas en el equipo. No añadir tipografías de pago al repositorio.
- **El HTML autónomo** (`npm run build:archivo`) debe seguir funcionando con doble clic, desde
  disco y sin internet.
- **Repositorio público**: nunca subir imágenes de clientes, documentos privados ni claves. Las
  imágenes de prueba son sintéticas (`scripts/make-*.py`).
- **No tocar Brisa Platform.** No publicar, desplegar ni cambiar DNS sin una petición explícita.
- **Publicada** en https://tools.brisadesignstudio.com (GitHub Pages, rama `gh-pages`, solo el
  sitio compilado). Detalles, actualizar y volver atrás: «Publicación» del README.
- Accesibilidad: todo usable con teclado, foco visible y nunca tapado, estados que no dependen
  solo del color, nada que dependa de pasar el cursor; probar ventana pequeña, móvil y zoom 200 %.

## Comandos

```bash
npm ci                 # instalar dependencias exactas (package-lock.json)
npm run dev            # desarrollo en http://localhost:5173 (sin CSP, workers de módulo)
npm run typecheck      # TypeScript
npm test               # pruebas unitarias (Vitest)
npm run build          # sitio estático en dist/ (con CSP)
npm run preview        # sirve dist/ en http://localhost:4173
npm run build:archivo  # HTML autónomo en dist-archivo/brisa-preparador-de-imagenes.html
npm run publicar       # publica el commit actual (ya subido) en tools.brisadesignstudio.com;
                       # `npm run publicar -- <commit>` vuelve a una versión anterior. Solo si se pide.
npm run fixtures       # imágenes de prueba (Python 3 + Pillow, y el Chromium de Playwright para
                       # rasterizar el logotipo) → tests/fixtures/generated/
npm run test:e2e       # Playwright (Chromium) contra la versión de producción en :4173
```

- Node 22 (`.nvmrc`). Playwright está fijado a 1.56.1; en un equipo nuevo:
  `npx playwright install chromium`. Pillow, en un entorno de Python fuera del proyecto
  (ver «Desarrollo en tu Mac» en el README).
- Las pruebas e2e reutilizan un `vite preview` que ya esté en el puerto 4173
  (`reuseExistingServer`): si hay uno abierto de antes, sirve una compilación vieja. Ciérralo o
  reinícialo después de cada `npm run build`.
- Las e2e necesitan `npm run fixtures` (las imágenes generadas no se guardan en git).

## Antes de dar algo por terminado

1. `npm run typecheck && npm test`
2. `npm run fixtures` (si faltan) y `npm run test:e2e` completo.
3. `npm run build:archivo` y abrirlo desde disco (`file://`) en Chrome: cargar imágenes,
   descargar el ZIP, sin errores en consola ni peticiones de red.
4. Si cambia la interfaz: revisar escritorio (1440×900), ventana pequeña (1024×700), móvil
   (390×844) y zoom 200 % (720×450 a 2×). La prueba «ningún control queda tapado» lo cubre en
   parte.
5. Cambiar textos de la interfaz suele exigir actualizar las pruebas e2e (buscan por texto y
   etiqueta accesible).

## Mapa del código

```
src/lib/          lógica pura y probada: tipos, geometría (encaje, recorte, nunca ampliar),
                  ajustes de fábrica y validación (presets.ts), nombres y carpetas (naming.ts),
                  lectura de formatos (sniff.ts), copia de seguridad de paquetes (backup.ts),
                  almacenamiento local (storage.ts)
src/engine/       procesado: códecs WASM (codecs.ts), pipeline de decodificar → recortar →
                  redimensionar (Lanczos3) → componer → codificar (pipeline.ts), búsqueda de
                  calidad para el peso máximo (quality-search.ts), cachés del worker (memo.ts),
                  cola de workers con prioridades (pool.ts), qué se pide a cada copia y sus avisos
                  (spec.ts), sincronización con el estado (renderer.ts), worker (processor.worker.ts)
src/state/        estado Zustand (store.ts), acciones (actions.ts), descarga y ZIP (export.ts),
                  paquetes de ajustes (packages.ts)
src/components/   interfaz React: mesa (ImageList, VersionsBar, ImageOutputs, VersionSelection,
                  OutputCard, ExportBar), editor (Editor, CropView, CompareView, RecipeForm,
                  ResultSummary), diálogos (PresetPicker, PackagesDialog), avisos (Notice)
src/styles/app.css  estilos y tokens de marca
tests/unit/       Vitest · tests/e2e/ Playwright · tests/fixtures/static/ (diminutas, en git)
vite.config.ts    CSP del sitio y del archivo único; plugin que mete todo en un solo HTML
```

Flujo: versiones (`Recipe`) × imágenes → `buildSpec` (clave estable de lo que se pide) →
`syncRenders` lanza trabajos en los workers → `results[imagen|versión]` → tarjetas, resumen
y ZIP. Solo se muestra un resultado si su clave coincide con la de los ajustes actuales.

## Estilo de código

- Comentarios y textos de interfaz en español; tono cálido, profesional y breve.
- Seguir el estilo existente (TypeScript estricto, componentes funcionales, sin dependencias
  nuevas sin necesidad).
- Los selectores de Zustand que devuelven objetos o listas nuevos van con `useShallow`.
- Avisos junto a lo que cuentan (`Notice` por zona) y con camino para resolverlos; nada de
  barras flotantes que tapen contenido.
- Commits en español, descriptivos.
