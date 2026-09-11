#!/usr/bin/env bash
# restore_demo.sh — Recupera todo desde .demo_backup/ a su sitio original.
# Útil si el demo se corta o quieres deshacer un prepare_demo.sh.
#
# Uso: ./scripts/restore_demo.sh

set -e
ROOT="/Users/juanpenv/Desktop/divisual-video-editor-kit 2"
BACKUP="$ROOT/.demo_backup"

cd "$ROOT"

if [ ! -d "$BACKUP" ]; then
  echo "✗ No hay backup en .demo_backup/"
  exit 1
fi

echo "→ Restaurando desde .demo_backup/"

# Recorre todos los items del backup y los mueve de vuelta
find "$BACKUP" -mindepth 1 -maxdepth 1 -print | while read -r path; do
  rel="${path#$BACKUP/}"
  dest="$ROOT/$rel"
  if [ -e "$dest" ]; then
    echo "  ya existe (skip): $rel"
  else
    mkdir -p "$(dirname "$dest")"
    mv "$path" "$dest"
    echo "  restaurado: $rel"
  fi
done

# Si quedó vacío, eliminar
rmdir "$BACKUP" 2>/dev/null || rm -rf "$BACKUP"
echo "✓ Restaurado."
