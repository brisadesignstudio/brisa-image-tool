# Preparador de imágenes · Brisa Design Studio

Herramienta web para preparar imágenes para web y redes: varias medidas por imagen,
recortes con intención, el peso justo y un ZIP ordenado. **Todo se procesa en el
navegador**: no hay servidor, ni cuentas, ni base de datos, ni APIs de pago.

Es independiente de Brisa Platform. Dirección prevista: `tools.brisadesignstudio.com`
(todavía sin publicar; ver «Publicación» más abajo).

## Qué hace

- **Carga varias imágenes** JPG, PNG y WebP (arrastrando o con el selector). El formato se
  comprueba por el contenido del archivo, no por la extensión.
- **Varias salidas por imagen.** Cada salida (por ejemplo, «Contenido web» o «Instagram
  vertical 4:5») crea una copia de todas las imágenes. Hay ajustes de fábrica para web y
  redes, y puedes guardar los tuyos.
- **Tres formas de encajar**:
  - *Mantener proporción* (por defecto): la imagen completa, sin recortes ni bordes.
  - *Recortar*: medida exacta con encuadre manual por imagen (arrastrar, esquinas o teclado).
  - *Márgenes*: la imagen completa sobre un lienzo, con aire alrededor y fondo transparente
    o de color.
- **Compresión con control**: calidad ajustable, peso y calidad de la original y de la copia,
  y una vista «Antes / después» al 100 % o 200 % para revisar la compresión.
- **Nombres y ZIP**: patrón de nombre (`{nombre}`, `{salida}`, `{ancho}`, `{alto}`, `{n}`),
  nombres aptos para web, carpetas por salida o por imagen y, si quieres, las originales
  intactas en `originales/`.
- **Ajustes guardados en el dispositivo** (localStorage): salidas activas, ajustes propios,
  patrón de nombres y preferencias. Nunca se guardan imágenes.

## Fidelidad: lo que la herramienta nunca hace

- **No regenera ni inventa píxeles.** No hay IA, filtros, enfoque ni retoque de color.
- **No amplía.** Si una medida pide más resolución de la que tiene la original, la copia se
  entrega a su resolución real y se avisa.
- **No altera logos.** Los PNG y WebP se leen con un decodificador exacto (sin gestión de
  color del navegador). Si no cambia el tamaño y el formato es sin pérdida, la copia sale
  idéntica píxel a píxel; está comprobado en las pruebas con logos y con un degradado de
  transparencia de 256 niveles.
- **No toca las originales.** Cada copia sale directamente de la original, en un solo paso.
  Si una copia sin cambios de medida ni de formato no pesa menos, se entrega el archivo
  original tal cual.
- **Conserva las transparencias** en PNG y WebP, incluidas las sombras suaves. El
  redimensionado (Lanczos3) trabaja con alfa premultiplicado para que no aparezcan halos
  oscuros en los bordes. JPG no admite transparencia: se rellena con el color de fondo
  elegido y la herramienta lo avisa.

## Privacidad

Las imágenes se leen y se procesan en Web Workers dentro del navegador. La página lleva una
política de seguridad de contenido (CSP) que solo permite cargar recursos del propio sitio y
**no permite conexiones a otros servidores** (`connect-src 'self'`). Los códecs (MozJPEG,
libwebp, OxiPNG, Lanczos) y las tipografías se sirven desde el mismo sitio. Las pruebas
automáticas comprueban que no sale ninguna petición fuera.

## Formatos

| Salida | Transparencia | Calidad | Uso recomendado |
| --- | --- | --- | --- |
| JPG (MozJPEG, progresivo) | No | 1–100 | Fotos para redes |
| PNG (optimizado con OxiPNG) | Sí | Sin pérdida | Logos e ilustraciones |
| WebP | Sí | 1–100 o sin pérdida | Web |
| «Igual que la original» | Según formato | — | Optimizar sin cambiar de formato |

La calidad de un JPG original se estima a partir de sus tablas de cuantización («calidad ≈ 92»).

## Limitaciones conocidas

- Solo JPG, PNG y WebP (ni HEIC, ni AVIF, ni TIFF, ni SVG). Las imágenes animadas usan solo
  el primer fotograma (se avisa).
- Las copias se guardan en sRGB, el estándar web. Las imágenes con perfiles amplios (Display
  P3, Adobe RGB) se convierten y los colores muy saturados pueden suavizarse (se avisa).
- Las copias no conservan metadatos EXIF (cámara, ubicación). Es más privado para publicar,
  pero conviene saberlo. La orientación sí se aplica a los píxeles.
- Imágenes enormes (más de ~100 megapíxeles) pueden superar la memoria del navegador,
  sobre todo en el móvil.
- Probada de forma automática en Chromium. Safari (16.4 o posterior) y Firefox deberían
  funcionar porque usan las mismas APIs estándar, pero no se han probado aún.
- Los ajustes viven en el navegador donde se crean: no se sincronizan entre equipos, y
  borrar los datos del sitio los elimina.

## Identidad de marca

- Logotipo y monograma: trazados originales en `brand/` (sin redibujar; en la interfaz solo
  se ajusta el área de trabajo del SVG). El favicon usa el monograma crema sobre vino.
- Paleta: vino `#631028`, coral `#E57056`, crema `#F6F0E8`, oliva `#A69F4D`, orquídea
  `#E28AC0` y rosa `#F2CEDD` (`src/styles/app.css`).
- Tipografías: New Spirit y Acumin Variable son de pago y no pueden ir en un repositorio
  público. La interfaz las usa si están instaladas en el equipo; si no, recurre a Fraunces y
  Archivo (licencia OFL, incluidas en el sitio). Para usar las de marca en la web publicada
  hay que añadir su licencia web (por ejemplo, un proyecto de Adobe Fonts para Acumin).

## Desarrollo

Requisitos: Node 22. Para generar imágenes de prueba, Python 3 con Pillow.

```bash
npm install
npm run dev          # servidor de desarrollo
npm run build        # comprueba tipos y genera dist/ (sitio estático)
npm test             # pruebas unitarias (Vitest)
npm run fixtures     # genera imágenes de prueba en tests/fixtures/generated/
npm run test:e2e     # pruebas de extremo a extremo en Chromium (Playwright)
```

Estructura:

```
src/lib/        lógica pura: geometría, nombres, ajustes, lectura de formatos
src/engine/     procesado en Web Workers: códecs WASM, cola de trabajos, ZIP
src/state/      estado (Zustand), acciones y exportación
src/components/ interfaz (React)
brand/          logotipos originales de Brisa
tests/          pruebas unitarias, de extremo a extremo e imágenes de prueba
```

## Publicación (pendiente, no realizada)

`npm run build` genera `dist/`, un sitio estático que se puede alojar en cualquier servicio
(Cloudflare Pages, Netlify, Vercel o GitHub Pages) y funciona también en una subcarpeta.
Cuando decidas publicarlo en `tools.brisadesignstudio.com`:

1. Crear el proyecto en el servicio elegido, con `npm run build` y la carpeta `dist`.
2. Añadir el dominio personalizado en ese servicio.
3. En el DNS de `brisadesignstudio.com`, crear el registro `CNAME` de `tools` que indique el
   servicio. **No se ha modificado ningún DNS.**
4. Recomendado: enviar la misma política de seguridad como cabecera HTTP y añadir
   `frame-ancestors 'none'`.

## Licencias de terceros

Códecs de [jSquash](https://github.com/jamsinclair/jSquash) / Squoosh (Apache-2.0; MozJPEG,
libwebp, OxiPNG y resize con sus licencias BSD/MIT), fflate (MIT), React (MIT), Zustand (MIT),
Fraunces y Archivo (SIL OFL 1.1).
