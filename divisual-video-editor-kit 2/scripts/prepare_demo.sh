#!/usr/bin/env bash
# prepare_demo.sh — Mueve a .demo_backup/ todo lo que delate que el proyecto está hecho.
# Después de ejecutar esto, el proyecto parece "vacío" salvo CLAUDE.md, README, etc.
#
# Uso: ./scripts/prepare_demo.sh

set -e

ROOT="/Users/juanpenv/Desktop/divisual-video-editor-kit 2"
BACKUP="$ROOT/.demo_backup"

cd "$ROOT"

echo "→ Preparando backup en .demo_backup/"
mkdir -p "$BACKUP"

# Lista de cosas que el "proyecto recién creado" NO debería tener todavía.
# Las movemos al backup; genesis_demo.sh las restaura.
ITEMS=(
  "skills"
  "output"
  "projects"
  "dashboard"
  "brand/logo/logo-white.png"
  "brand/logo/logo-icon.png"
  "styles/client-style.md"
  "input/IMG_0564.MOV"
  ".env"
)

# Limpiar backup previo
rm -rf "$BACKUP"
mkdir -p "$BACKUP"

for item in "${ITEMS[@]}"; do
  if [ -e "$item" ]; then
    dest="$BACKUP/$item"
    mkdir -p "$(dirname "$dest")"
    mv "$item" "$dest"
    echo "  movido: $item"
  else
    echo "  no existe (skip): $item"
  fi
done

# Estado posterior — el proyecto se ve "fresco":
#  - CLAUDE.md sigue ahí (necesario para guiar a Claude Code)
#  - README.md sigue ahí
#  - styles/ tiene solo default-style.md, aspect-ratios.md, etc. (no client)
#  - input/ vacío
#  - skills/ vacío (genesis hace git clone real)
#  - dashboard/ no existe
#  - .env no existe → onboarding la pedirá

echo ""
echo "✓ Demo preparado. El proyecto parece recién inicializado."
echo "  Para arrancar el demo: el usuario habla con Claude Code y dispara genesis_demo.sh"
echo "  Para restaurar manualmente: ./scripts/restore_demo.sh"
