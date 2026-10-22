# Estado del proyecto

Preparador de imágenes de Brisa Design Studio. Herramienta independiente de Brisa Platform.

**Publicada** el 22-10-2026 en GitHub Pages: **https://tools.brisadesignstudio.com**. El DNS
está conectado y la web responde; falta que GitHub emita el certificado HTTPS del dominio (ver
«Pendientes», punto 1).

- Repositorio: `brisadesignstudio/brisa-image-tool`
- Rama de trabajo (y rama por defecto del repositorio): `claude/brisa-image-processor-4954sj`
- Rama publicada: `gh-pages` (solo el sitio compilado; cada publicación es un commit
  «Publicar ‹commit›»).
- Commit publicado: `f5fe00e`. La aplicación es la misma que en `5c8c1fd` (último cambio de
  funciones); después solo hay documentación, el script de publicación y pruebas. El commit
  más reciente lo da `git log -1`.

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
| `85bddb4` | Preparación para seguir en el Mac: `CLAUDE.md`, este archivo y «Desarrollo en tu Mac» en el README. |
| `f5fe00e` | Publicación: `npm run publicar` (rama `gh-pages`; volver atrás es publicar un commit anterior), comprobación «Comprobar la web publicada» en GitHub Actions y pruebas e2e contra cualquier dirección. |
| `919010b` | La comprobación consulta el DNS en el servidor del dominio y en resolutores públicos. |

Detalle de funciones y garantías (fidelidad, privacidad, formatos): `README.md`.

## Publicación

- **Alojamiento**: GitHub Pages, incluido gratis para repositorios públicos (sin cuentas, planes
  ni pagos nuevos). Límites: sitio de hasta 1 GB (este ocupa ~2,2 MB) y ~100 GB de tráfico al
  mes; no se permite usarlo como tienda ni para vender software como servicio.
- **DNS** (Namecheap): un único registro nuevo, `CNAME` · `tools` → `brisadesignstudio.github.io`
  · TTL Automatic. Nameservers, web principal, correo y demás registros, sin tocar. Antes de
  añadirlo, `tools` no tenía ningún registro, no había comodín (`*`) ni restricciones CAA.
- **Dirección temporal** de GitHub: https://brisadesignstudio.github.io/brisa-image-tool/ (desde
  que se añadió el dominio, redirige a él).
- Actualizar, volver atrás y comprobar la web: «Publicación» del README.

## Cómo se ha verificado

- 56 pruebas unitarias (Vitest) y 34 de extremo a extremo (Playwright, Chromium), incluidas:
  privacidad sin peticiones externas ni errores en consola, formatos y transparencias reales,
  logos idénticos píxel a píxel, nunca ampliar, recorte manual, ZIP (nombres, carpetas,
  formatos, medidas), selección mixta por imagen, peso máximo (alcanzable, imposible, sin
  pérdida, cambios rápidos), paquetes (aplicar, reemplazar, cancelar, importar archivos
  inválidos) y una comprobación de que ningún control queda tapado en cuatro tamaños de ventana.
- **Publicación (22-10-2026)**:
  - Las 34 pruebas e2e contra la web publicada en la dirección temporal, ejecutadas en los
    servidores de GitHub (no contra una copia local): todas correctas.
  - Las 34 también contra el dominio por `http://tools.brisadesignstudio.com` (aún sin
    certificado), desde GitHub: todas correctas. Los códecs se sirven como `application/wasm`.
  - En local, las 34 en la raíz y bajo la subcarpeta `/brisa-image-tool/` (como en github.io).
  - Lo publicado es idéntico, archivo por archivo, a lo compilado y probado.
  - El sitio compilado no lleva analíticas ni conexiones externas; la política de seguridad
    solo deja conectar con el propio sitio.
  - DNS: el servidor de Namecheap, Cloudflare (1.1.1.1) y Google (8.8.8.8) responden el CNAME
    correcto.
- Un clon limpio del repositorio instala (`npm ci`), compila y pasa todas las pruebas.
- HTML autónomo abierto desde disco en Chromium: recorrido completo, paquetes y peso máximo sin
  errores ni peticiones de red; ZIP revisado con un lector independiente (Python/Pillow).
- Auditoría automática de accesibilidad (axe-core, fuera del proyecto) sin errores en las
  pantallas principales; contraste medido del texto de portada sobre el degradado.

## Pendientes

1. **Certificado HTTPS de `tools.brisadesignstudio.com`**. A las 08:32 UTC del 22-10-2026 GitHub
   aún servía su certificado genérico (`*.github.io`), casi 80 minutos después de propagarse el
   DNS. Mientras tanto la web funciona por `http://` (sin candado): mejor no usarla ni
   compartirla hasta tener HTTPS.
   Paso: GitHub → repositorio → Settings → Pages → en «Custom domain», «Check again». Si no
   aparece o no se emite, quitar el dominio y volver a escribirlo ahí mismo (queda sin asignar
   unos segundos). Cuando esté emitido: marcar «Enforce HTTPS» y lanzar «Comprobar la web
   publicada» (pestaña Actions) con la dirección por defecto.
2. **Verificar el dominio en GitHub** (recomendado): impide que otra cuenta use el subdominio si
   algún día se desactiva la web y el registro sigue apuntando a GitHub. Pide un registro `TXT`
   más en Namecheap; no se ha hecho porque solo se autorizó el `CNAME`.
3. **Revisión manual** con imágenes reales (sin subirlas al repositorio).
4. **Safari y Firefox**: no se han probado; no se dan por compatibles. En especial, el HTML
   autónomo abierto desde disco en Safari.
5. **Lector de pantalla real** (VoiceOver en el Mac): solo hay comprobaciones automáticas.
6. **Tipografías de marca** (New Spirit, Acumin): para verlas en la web publicada hace falta
   su licencia web; ahora se usan solo si están instaladas en el equipo.
7. **Rama principal**: hoy la rama por defecto es la de trabajo. Si quieres una `main`, se
   puede crear o fusionar cuando lo decidas.

Ideas anotadas que ampliarían funciones (no hechas, a decidir): ajustes individuales por imagen
además del encuadre (calidad o formato), deshacer de varios pasos, control para el nombre del
ZIP (el ajuste existe sin control en pantalla).

## Limitaciones conocidas

- Solo JPG, PNG y WebP; las animaciones usan el primer fotograma.
- Copias en sRGB; sin metadatos EXIF (la orientación sí se aplica).
- Imágenes de más de ~100 megapíxeles pueden agotar la memoria del navegador.
- Los ajustes y paquetes viven en el navegador donde se crean: los de la web publicada y los del
  HTML autónomo van por separado; se pasan con la copia de seguridad de paquetes.
- Con límites de peso muy ajustados y lotes grandes el cálculo tarda más (hasta 8
  codificaciones por archivo, en segundo plano).
- «Deshacer» recupera solo la última acción.
- GitHub Pages no permite cabeceras HTTP propias: la política de seguridad va dentro de la
  página y `frame-ancestors` no se aplica (riesgo bajo: no hay cuentas ni datos que proteger).
  Los navegadores pueden guardar la versión anterior hasta 10 minutos tras publicar.
