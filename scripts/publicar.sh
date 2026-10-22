#!/usr/bin/env bash
# Publica el preparador de imágenes en GitHub Pages: https://tools.brisadesignstudio.com
#
#   npm run publicar               publica el commit actual (ya subido a GitHub)
#   npm run publicar -- 85bddb4    publica otro commit; así se vuelve a una versión anterior
#
# Compila el commit en una carpeta temporal (lo que no esté guardado en un commit no se
# publica), pasa la comprobación de tipos y las pruebas unitarias, y sube solo el resultado
# (dist/) como un commit nuevo de la rama gh-pages. Nunca borra publicaciones anteriores.
#
# SIN_DOMINIO=1 publica sin el dominio propio (solo para probar la dirección de github.io).
# PIE_PUBLICACION (opcional) añade líneas al final del mensaje del commit de publicación.
set -euo pipefail

DOMINIO="tools.brisadesignstudio.com"
RAMA="gh-pages"

ref="${1:-HEAD}"
cd "$(git rev-parse --show-toplevel)"
commit="$(git rev-parse --verify --quiet "$ref^{commit}")" || {
  echo "No encuentro el commit «$ref»." >&2
  exit 1
}
corto="$(git rev-parse --short "$commit")"
asunto="$(git log -1 --format=%s "$commit")"

# Solo se publica lo que ya está en GitHub, para poder recuperarlo siempre.
git fetch --quiet origin
if [ -z "$(git branch -r --contains "$commit")" ]; then
  echo "El commit $corto aún no está en GitHub. Súbelo primero con: git push" >&2
  exit 1
fi

tmp="$(mktemp -d)"
limpiar() {
  git worktree remove --force "$tmp/fuente" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap limpiar EXIT

echo "→ Compilando $corto ($asunto)…"
git worktree add --quiet --detach "$tmp/fuente" "$commit"
(
  cd "$tmp/fuente"
  npm ci --no-audit --no-fund --loglevel=error
  npm test --silent
  npm run build --silent
)

web="$tmp/fuente/dist"
touch "$web/.nojekyll" # GitHub Pages sirve los archivos tal cual, sin procesarlos
if [ "${SIN_DOMINIO:-}" != "1" ]; then
  echo "$DOMINIO" >"$web/CNAME"
fi

# Commit con solo el contenido de dist/, encima de la publicación anterior.
gitdir="$(git rev-parse --absolute-git-dir)"
(cd "$web" && GIT_INDEX_FILE="$tmp/indice" git --git-dir="$gitdir" --work-tree=. add --all --force .)
arbol="$(GIT_INDEX_FILE="$tmp/indice" git write-tree)"

padre=""
if git ls-remote --exit-code --heads origin "$RAMA" >/dev/null; then
  git fetch --quiet origin "$RAMA"
  padre="$(git rev-parse FETCH_HEAD)"
  if [ "$(git rev-parse "$padre^{tree}")" = "$arbol" ]; then
    echo "✓ $corto ya es la versión publicada: no hay nada que subir."
    exit 0
  fi
fi

mensaje="Publicar $corto: $asunto"
if [ -n "${PIE_PUBLICACION:-}" ]; then
  mensaje="$mensaje

$PIE_PUBLICACION"
fi
nuevo="$(git commit-tree "$arbol" ${padre:+-p "$padre"} -m "$mensaje")"
git push --quiet origin "$nuevo:refs/heads/$RAMA"

echo "✓ Publicado $corto en la rama $RAMA."
if [ "${SIN_DOMINIO:-}" = "1" ]; then
  echo "  En unos minutos: https://brisadesignstudio.github.io/brisa-image-tool/"
else
  echo "  En unos minutos: https://$DOMINIO/"
fi
