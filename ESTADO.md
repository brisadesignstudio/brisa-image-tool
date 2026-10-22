# Estado del proyecto

Preparador de imágenes de Brisa Design Studio. Herramienta independiente de Brisa Platform.
**No está publicada**: no hay dominio conectado ni DNS modificado.

- Repositorio: `brisadesignstudio/brisa-image-tool`
- Rama de trabajo (y rama por defecto del repositorio): `claude/brisa-image-processor-4954sj`
- Último commit de funcionalidad: `5c8c1fd` (paquetes de ajustes). Después solo hay
  documentación y preparación para trabajar en local; el commit más reciente lo da
  `git log -1`.

## Lo construido

| Commit | Bloque |
| --- | --- |
| `dc62724` | Primera versión: carga de JPG, PNG y WebP; varias versiones por imagen; mantener proporción, recortar o márgenes; compresión con MozJPEG, libwebp y OxiPNG en Web Workers; ZIP ordenado; ajustes guardados en el dispositivo; interfaz en español con la identidad de Brisa. |
| `3f15380` | Interfaz en blanco puro `#FFFFFF` y HTML autónomo de un solo archivo (funciona desde disco y sin internet). |
| `d80e7d6` | La barra de descarga ya no tapa las tarjetas; explicación cuando el encuadre apenas se puede mover. |
| `d7e4501` | Revisión de UX/UI: recorrido en cuatro pasos (imágenes, versiones, revisión, descarga), editor con alcance claro («Solo esta imagen» / «Para las N imágenes»), resumen original → resultado, avisos con qué hacer, accesibilidad, móvil y zoom 200 %. |
| `272cf48` | Versiones por imagen: elegir qué combinaciones imagen × versión se exportan, «Aplicar a todas» con deshacer, recuento y ZIP exactos. |
| `639705b` | Peso máximo opcional por versión: la mejor calidad que cabe (JPG y WebP con pérdida), sin cambiar medidas ni formato; sin pérdida nunca pasa a con pérdida; «Supera el peso máximo» con alternativas. |
| `5c8c1fd` | Paquetes de ajustes: guardar, aplicar (añadir o reemplazar, con aviso y deshacer), renombrar, actualizar, duplicar, eliminar y copia de seguridad `.json` validada. |

Detalle de funciones y garantías (fidelidad, privacidad, formatos): `README.md`.

## Cómo se ha verificado

- 56 pruebas unitarias (Vitest) y 34 de extremo a extremo (Playwright, Chromium), incluidas:
  privacidad sin peticiones externas, formatos y transparencias reales, logos idénticos píxel
  a píxel, nunca ampliar, recorte manual, ZIP (nombres, carpetas, formatos, medidas),
  selección mixta por imagen, peso máximo (alcanzable, imposible, sin pérdida, cambios
  rápidos), paquetes (aplicar, reemplazar, cancelar, importar archivos inválidos) y una
  comprobación de que ningún control queda tapado en cuatro tamaños de ventana.
- Un clon limpio del repositorio instala (`npm ci`), compila y pasa todas las pruebas.
- HTML autónomo abierto desde disco en Chromium: recorrido completo sin errores ni peticiones
  de red; ZIP revisado con un lector independiente (Python/Pillow).
- Auditoría automática de accesibilidad (axe-core, fuera del proyecto) sin errores en las
  pantallas principales; contraste medido del texto de portada sobre el degradado.

## Pendientes

Ninguno empezado. En orden aproximado:

1. **Revisión manual** con imágenes reales (sin subirlas al repositorio).
2. **Safari y Firefox**: no se han probado; no se dan por compatibles. En especial, el HTML
   autónomo abierto desde disco en Safari.
3. **Lector de pantalla real** (VoiceOver en el Mac): solo hay comprobaciones automáticas.
4. **Publicación** en `tools.brisadesignstudio.com` (encargo aparte): pasos en «Publicación»
   del README. Conviene enviar la política de seguridad como cabecera y añadir
   `frame-ancestors 'none'`. Los paquetes del HTML autónomo y de la web publicada se guardan
   por separado (cada uno en su navegador y origen): se pasan con la copia de seguridad.
5. **Tipografías de marca** (New Spirit, Acumin): para verlas en la web publicada hace falta
   su licencia web; ahora se usan solo si están instaladas en el equipo.
6. **Rama principal**: hoy la rama por defecto es la de trabajo. Si quieres una `main`, se
   puede crear o fusionar cuando lo decidas.

Ideas anotadas que ampliarían funciones (no hechas, a decidir): ajustes individuales por imagen
además del encuadre (calidad o formato), deshacer de varios pasos, control para el nombre del
ZIP (el ajuste existe sin control en pantalla).

## Limitaciones conocidas

- Solo JPG, PNG y WebP; las animaciones usan el primer fotograma.
- Copias en sRGB; sin metadatos EXIF (la orientación sí se aplica).
- Imágenes de más de ~100 megapíxeles pueden agotar la memoria del navegador.
- Los ajustes y paquetes viven en el navegador donde se crean.
- Con límites de peso muy ajustados y lotes grandes el cálculo tarda más (hasta 8
  codificaciones por archivo, en segundo plano).
- «Deshacer» recupera solo la última acción.
