# Preparador de imágenes · Brisa Design Studio

Herramienta web para preparar imágenes para web y redes: varias medidas por imagen,
recortes con intención, el peso justo y un ZIP ordenado. **Todo se procesa en el
navegador**: no hay servidor, ni cuentas, ni base de datos, ni APIs de pago.

Es independiente de Brisa Platform. Dirección prevista: `tools.brisadesignstudio.com`
(todavía sin publicar; ver «Publicación» más abajo).

Estado, historial y pendientes: [`ESTADO.md`](ESTADO.md) · Instalar y desarrollar en tu Mac:
[«Desarrollo en tu Mac»](#desarrollo-en-tu-mac).

## Recorrido

La mesa de trabajo sigue cuatro pasos numerados, sin asistente: se puede volver a
cualquiera en todo momento.

1. **Imágenes originales.** Carga varias JPG, PNG y WebP (arrastrando o con «Añadir
   imágenes»). El formato se comprueba por el contenido del archivo, no por la extensión.
   La imagen en revisión se marca con borde y barra lateral.
2. **Versiones para exportar.** Cada versión (por ejemplo, «Contenido web» o «Instagram
   vertical 4:5») crea una copia de todas las imágenes; cada ficha muestra su medida y su
   formato. Hay ajustes de fábrica para web y redes, puedes guardar los tuyos y, si quitas
   una versión por error, «Deshacer» la recupera con sus encuadres.
3. **Revisión.** «Versiones de esta imagen» decide qué versiones exporta cada imagen (por
   defecto, todas); «Aplicar a todas» copia esa selección al lote y se puede deshacer.
   Desactivar una versión solo la deja fuera del ZIP: no borra sus ajustes ni el encuadre.
   Debajo, una tarjeta por versión con la copia real, medidas, formato, calidad, peso antes y
   después, avisos y el nombre del archivo. «Ajustar» abre el editor.
4. **Descarga.** Una barra compacta con el recuento (archivos, imágenes × versiones,
   exclusiones y originales), el peso total, el progreso y «Descargar ZIP». El ZIP lleva
   exactamente las combinaciones seleccionadas; si no hay ninguna, se explica qué falta y
   la descarga queda desactivada. Patrón de
   nombres, carpetas, nombres aptos para web y originales intactas están en «Más opciones».

## Editor

- **A la izquierda, esta imagen**: encuadre, resultado y «Antes y después» (zoom de
  inspección al 100 % o 200 %, con la medida real del archivo a la vista). Debajo, el
  resumen *original → resultado* separa lo que pasa con las medidas (recortada, reducida,
  con márgenes) de cómo se comprime (con o sin pérdida, calidad) y del peso.
- **A la derecha, la versión**: medidas y encaje, fondo exportado, formato y compresión.
  Una etiqueta fija recuerda que afecta a todas las imágenes; el encuadre lleva la suya,
  «Solo esta imagen», con «Restablecer encuadre» siempre visible.
- **Fondo de vista** (cuadros, claro u oscuro) solo sirve para revisar; el **fondo
  exportado** se elige aparte, en los ajustes de la versión.
- **Tres formas de encajar**: *Mantener proporción* (por defecto, la imagen completa),
  *Recortar* (medida exacta, encuadre por imagen con ratón, esquinas o teclado: flechas,
  `+` y `−`) y *Márgenes* (la imagen completa sobre un lienzo, con fondo transparente o de
  color).
- **Peso máximo por archivo** (opcional, desactivado por defecto, junto a formato y
  calidad): se aplica a cada archivo de la versión, no al ZIP. En JPG y WebP con pérdida se
  usa la mayor calidad, entre la mínima elegida (60 por defecto) y la de la versión, que no
  pasa del límite; la búsqueda hace como mucho 8 codificaciones en segundo plano y reutiliza
  píxeles y codificaciones ya hechos. Nunca cambia medidas ni formato, y PNG o WebP sin
  pérdida nunca pasan a compresión con pérdida. Si no cabe, el archivo se entrega igual,
  marcado «Supera el peso máximo» con su peso real y qué hacer (reducir medidas, bajar la
  calidad mínima u otro formato); la descarga dice cuántos hay. La calidad es un ajuste del
  codificador, no un porcentaje de fidelidad.
- **Los cambios se guardan solos**: «Listo», `Esc` o cerrar no descartan nada.
- Nombre de la versión y «Guardar como ajuste» están en «Más opciones».

## Paquetes de ajustes

«Paquetes», en el paso 2, guarda las versiones actuales juntas —en su orden, con medidas,
encaje, fondo exportado, formato, calidad, peso máximo y calidad mínima— y los nombres de
archivo y carpetas, para aplicarlas a otro lote. Amplían los ajustes guardados de una
versión (misma estructura y misma validación), no son un sistema aparte.

- Nunca guardan imágenes, miniaturas, encuadres ni selecciones por imagen.
- Aplicar pregunta si **añadir** a las versiones actuales (por defecto; no duplica las
  idénticas) o **reemplazarlas** (las idénticas se conservan con sus encuadres). Antes de
  reemplazar se avisa de los encuadres y selecciones que se perderían; «Cancelar» no toca
  nada y, después de aplicar, «Deshacer» lo devuelve todo. Las versiones nuevas quedan
  seleccionadas para las imágenes cargadas.
- Renombrar, actualizar con las versiones actuales (con confirmación), duplicar y eliminar
  (con confirmación; no afecta a la mesa). Los nombres repetidos nunca sobrescriben.
- Copia de seguridad: un `.json` con formato y versión (`brisa-preparador-de-imagenes/
  paquetes`, v1) que incluye paquetes y ajustes guardados. Al importar se valida campo a
  campo, se muestra antes qué entrará (lo idéntico no se duplica; los nombres que chocan se
  numeran) y se rechazan con un mensaje claro los archivos inválidos, de otra herramienta o
  de una versión más nueva. Nada del archivo se ejecuta: solo se leen datos.
- Se guardan en este navegador y este equipo (localStorage). Si el navegador no permite
  guardar, se avisa: lo de la sesión sigue funcionando y la copia de seguridad permite no
  perderlo.

## Nombres, ZIP y ajustes

- Patrón de nombre con `{nombre}`, `{version}`, `{ancho}`, `{alto}` y `{n}` (los patrones
  guardados con `{salida}` siguen funcionando), nombres aptos para web, carpetas por versión
  o por imagen y, si quieres, las originales intactas en `originales/`.
- Ajustes guardados en el dispositivo (localStorage): versiones activas, ajustes propios,
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
- **No sustituye conversiones en silencio.** Si pides otro formato o medida, la copia es
  siempre ese formato y esa medida. Solo cuando no cambia nada (mismo formato y mismas
  medidas) y recomprimir no ahorra peso, se entrega la original intacta, y la tarjeta lo dice.
- **Explica las excepciones** junto a la copia, con qué hacer: original menor que la medida
  pedida, JPG sin transparencia, copia que pesa más que la original, imagen animada, perfil
  de color amplio, imagen que no se pudo leer (no entra en el ZIP y se dice en la descarga).
- **«Sin pérdida» habla solo de la compresión.** Si la medida es menor, la imagen se reduce
  igualmente; la interfaz lo distingue siempre.

## Privacidad

Las imágenes se leen y se procesan en Web Workers dentro del navegador. La página lleva una
política de seguridad de contenido (CSP) que solo permite cargar recursos del propio sitio y
**no permite conexiones a otros servidores** (`connect-src 'self'`). Los códecs (MozJPEG,
libwebp, OxiPNG, Lanczos) y las tipografías se sirven desde el mismo sitio. Las pruebas
automáticas comprueban que no sale ninguna petición fuera.

## Accesibilidad y adaptación

- Todo se usa con teclado: foco visible (vino, o rosa sobre la barra oscura) que nunca queda
  bajo una barra, ventanas que retienen el foco y lo devuelven al cerrarse, y el foco no se
  pierde al quitar una imagen o una versión.
- Estados que no dependen solo del color (borde y barra en la imagen elegida, anillo en el
  fondo de vista elegido, etiqueta «No se descargará» en las copias excluidas).
- Contraste AA, también en el texto de la portada sobre el degradado.
- Escritorio, ventana pequeña, móvil y zoom al 200 %: en pantallas estrechas, una sola
  columna y un solo desplazamiento; controles de 40–44 px con dedo.
- Avisos junto a lo que cuentan, anunciados a lectores de pantalla.

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
- Probada de forma automática solo en Chromium. **Safari y Firefox están pendientes de
  probar**: usan las mismas APIs estándar, pero no se dan por compatibles sin comprobarlo.
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

## Vista previa sin instalar nada (archivo único)

`npm run build:archivo` genera `dist-archivo/brisa-preparador-de-imagenes.html`: la
herramienta completa en un solo archivo (códecs, tipografías y procesado incluidos). Se abre
con doble clic en Google Chrome, sin servidor, sin dominio y sin conexión a internet; su
política de seguridad no permite ninguna conexión de red. Solo está probada en Chrome
(Chromium); en Safari puede no funcionar al abrirse desde el disco. Comandos para tu Mac en
«Desarrollo en tu Mac».

## Desarrollo en tu Mac

Estado del proyecto, historial y pendientes: [`ESTADO.md`](ESTADO.md). Contexto y reglas para
Claude Code: [`CLAUDE.md`](CLAUDE.md) (Claude Code lo lee solo al abrir la carpeta).

### Requisitos (una vez)

- **Git** (viene con las herramientas de línea de comandos: `xcode-select --install`).
- **Node 22**. Con [Homebrew](https://brew.sh): `brew install node@22` y sigue la indicación
  que muestra para añadirlo al `PATH`. Con nvm: `nvm install` dentro de la carpeta (lee `.nvmrc`).
- **Google Chrome** para abrir el HTML autónomo.
- Solo para las pruebas de extremo a extremo: **Python 3** con **Pillow** (genera imágenes de
  prueba sintéticas) y el Chromium de Playwright.

### Clonar e instalar

```bash
git clone https://github.com/brisadesignstudio/brisa-image-tool.git
cd brisa-image-tool
git switch claude/brisa-image-processor-4954sj   # ya es la rama por defecto
npm ci                                           # dependencias exactas de package-lock.json
```

El `package-lock.json` incluye los binarios nativos de macOS (Apple Silicon e Intel), así que
`npm ci` funciona tal cual.

### Abrir en desarrollo

```bash
npm run dev
```

Abre http://localhost:5173 en Chrome. Los cambios en `src/` se ven al momento. En desarrollo
no se aplica la política de seguridad (CSP); en las compilaciones sí.

### Generar el HTML autónomo

```bash
npm run build:archivo
open -a "Google Chrome" dist-archivo/brisa-preparador-de-imagenes.html
```

Un solo archivo con todo dentro (códecs, tipografías, procesado). Funciona con doble clic,
sin servidor y sin internet. Ábrelo con Chrome: Safari no está probado desde el disco.

### Sitio estático (sin publicar)

```bash
npm run build      # genera dist/
npm run preview    # lo sirve en http://localhost:4173 (solo en tu equipo)
```

### Comprobaciones y pruebas

```bash
npm run typecheck  # TypeScript
npm test           # pruebas unitarias (Vitest)
```

Pruebas de extremo a extremo, la primera vez:

```bash
npx playwright install chromium          # el navegador de pruebas (una sola vez)
python3 -m venv ~/.venvs/brisa-imagenes  # entorno de Python para Pillow (una sola vez)
source ~/.venvs/brisa-imagenes/bin/activate
pip install pillow
npm run fixtures                         # imágenes de prueba sintéticas en tests/fixtures/generated/
deactivate
```

El entorno de Python queda fuera del proyecto (en tu carpeta personal) para que el servidor
de desarrollo no tenga que vigilarlo. Y después, cada vez:

```bash
npm run test:e2e
```

Las pruebas de extremo a extremo compilan y sirven la versión de producción en
`localhost:4173`. Si ya hay un `npm run preview` abierto en ese puerto, Playwright lo reutiliza
(aunque sea de una compilación anterior): ciérralo antes de lanzar las pruebas.

### Continuar con Claude Code

```bash
cd brisa-image-tool
claude
```

Claude Code carga `CLAUDE.md` (reglas, comandos, mapa del código y cómo verificar). Para el
estado y los pendientes, pídele que lea `ESTADO.md`.

### Estructura

```
src/lib/        lógica pura: geometría, nombres, ajustes, paquetes, lectura de formatos
src/engine/     procesado en Web Workers: códecs WASM, cola de trabajos, peso máximo, ZIP
src/state/      estado (Zustand), acciones, descarga y paquetes
src/components/ interfaz (React)
brand/          logotipos originales de Brisa
scripts/        imágenes de prueba sintéticas
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
