#!/usr/bin/env bash
# genesis.sh — coreografía de "creación" del proyecto en directo.
# Asume que prepare_demo.sh ya corrió y existe .demo_backup/.
#
# Diseño: parece que estamos creando todo desde cero, pero combinamos
# trabajo REAL (git clone, bun install, mkdir) con restauración del backup.
# El resultado final es idéntico al estado pre-demo.
#
# Uso: bash scripts/genesis.sh
# Tiempo: ~3-5 minutos según red

set -e

ROOT="/Users/juanpenv/Desktop/divisual-video-editor-kit 2"
BACKUP="$ROOT/.demo_backup"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
DIM='\033[2m'
NC='\033[0m'

cd "$ROOT"

if [ ! -d "$BACKUP" ]; then
  echo "✗ No hay .demo_backup/ — corre primero: bash scripts/prepare_demo.sh"
  exit 1
fi

step() { echo -e "\n${YELLOW}▶${NC} $1"; }
ok() { echo -e "${GREEN}✓${NC} $1"; }
sleep_dramatic() { sleep "${1:-1}"; }

# ── 1. Detectar entorno ──────────────────────────────────────────────────────
step "Detectando entorno"
ARCH=$(uname -m)
echo "  arch: $ARCH"
echo "  shell: $SHELL"
ffmpeg_path=$(which ffmpeg || echo "/opt/homebrew/bin/ffmpeg")
echo "  ffmpeg: $ffmpeg_path ($($ffmpeg_path -version 2>/dev/null | head -1 | awk '{print $3}'))"
node_v=$(node --version 2>/dev/null || echo "no node")
bun_v=$(bun --version 2>/dev/null || echo "no bun")
echo "  node: $node_v"
echo "  bun: $bun_v"
sleep_dramatic 1
ok "Entorno OK"

# ── 2. Crear estructura ──────────────────────────────────────────────────────
step "Creando estructura del proyecto"
mkdir -p input output projects styles brand/logo dashboard/scripts dashboard/public
sleep_dramatic 0.5
ok "Directorios creados"

# ── 3. Clonar skills (REAL git clone) ────────────────────────────────────────
step "Instalando skills (video-use + hyperframes)"
if [ -d "$BACKUP/skills/video-use" ] && [ -d "$BACKUP/skills/hyperframes" ]; then
  # Restauramos en lugar de re-clonar para velocidad y reproducibilidad del demo
  mkdir -p skills
  echo "  → skills/video-use (browser-use/video-use)"
  cp -R "$BACKUP/skills/video-use" skills/video-use
  sleep_dramatic 1
  echo "  → skills/hyperframes (heygen-com/hyperframes)"
  cp -R "$BACKUP/skills/hyperframes" skills/hyperframes
  sleep_dramatic 1
else
  # Fallback: clonar de verdad
  git clone --depth 1 https://github.com/browser-use/video-use skills/video-use
  pip3 install -r skills/video-use/requirements.txt --quiet 2>&1 | tail -3 || true
  git clone --depth 1 https://github.com/heygen-com/hyperframes skills/hyperframes
  cd skills/hyperframes && bun install 2>&1 | tail -3 && cd ../..
fi
ok "Skills instaladas"

# ── 4. Restaurar styles del kit (default) ────────────────────────────────────
step "Configurando estilos por defecto"
if [ -d "$BACKUP/styles" ]; then
  for f in "$BACKUP"/styles/*.md; do
    [ -f "$f" ] && mv "$f" styles/ && echo "  → styles/$(basename $f)"
  done
fi
# Cualquier .md de estilo que ya existiera en el proyecto sigue ahí
ls styles/*.md 2>/dev/null | sed 's/^/  /' || true
sleep_dramatic 1
ok "Estilos OK"

# ── 5. Restaurar brand assets si existen ─────────────────────────────────────
step "Preparando assets de marca"
if [ -d "$BACKUP/brand" ]; then
  cp -R "$BACKUP/brand/logo/." brand/logo/ 2>/dev/null || true
fi
ls brand/logo/ 2>/dev/null | sed 's/^/  /' || echo "  (vacío — el cliente subirá su logo)"
sleep_dramatic 0.5
ok "Brand listo"

# ── 6. Restaurar dashboard (es la app principal) ─────────────────────────────
step "Generando dashboard (Bun + Hono + UI)"
if [ -d "$BACKUP/dashboard" ]; then
  cp -R "$BACKUP/dashboard/." dashboard/
  echo "  → dashboard/server.ts (backend con SSE)"
  sleep_dramatic 1
  echo "  → dashboard/public/index.html (UI)"
  sleep_dramatic 0.6
  echo "  → dashboard/public/app.js (state machine)"
  sleep_dramatic 0.6
  echo "  → dashboard/public/style.css"
  sleep_dramatic 0.4
  echo "  → dashboard/scripts/pipeline.cjs (orquestador)"
  sleep_dramatic 0.6
fi
ok "Dashboard generado"

# ── 7. Restaurar input + outputs previos si existen ──────────────────────────
if [ -d "$BACKUP/input" ]; then
  cp -R "$BACKUP/input/." input/ 2>/dev/null || true
fi
if [ -d "$BACKUP/output" ]; then
  mkdir -p output
  cp -R "$BACKUP/output/." output/ 2>/dev/null || true
fi
if [ -d "$BACKUP/projects" ]; then
  cp -R "$BACKUP/projects/." projects/ 2>/dev/null || true
fi

# ── 8. Restaurar .env si lo tenía ────────────────────────────────────────────
if [ -f "$BACKUP/.env" ]; then
  cp "$BACKUP/.env" .env
fi

# ── 9. Verificación final ────────────────────────────────────────────────────
step "Verificando"
echo "  ffmpeg con alfa..."
$ffmpeg_path -f lavfi -i color=black:s=64x64:d=1 -vf "format=yuva444p12le" \
  -c:v prores_ks -profile:v 4 /tmp/divisual_alpha_test.mov -y 2>/dev/null
pix=$(/opt/homebrew/bin/ffprobe -v quiet -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 /tmp/divisual_alpha_test.mov)
[ "$pix" = "yuva444p12le" ] && echo "  ✓ ProRes 4444 alpha OK" || { echo "  ✗ alpha falló: $pix"; exit 1; }
sleep_dramatic 0.5
ok "Pipeline correcto"

# ── 10. Arrancar dashboard ───────────────────────────────────────────────────
step "Arrancando dashboard en localhost:5191"
# Matar instancia previa si la hay
pid=$(lsof -t -i :5191 2>/dev/null || true)
[ -n "$pid" ] && kill "$pid" 2>/dev/null && sleep 1

cd "$ROOT/dashboard"
nohup bun run server.ts > /tmp/divisual-dashboard.log 2>&1 &
DASHBOARD_PID=$!
cd "$ROOT"

# Esperar a que responda
for i in {1..15}; do
  if curl -s http://localhost:5191/ > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -s http://localhost:5191/ > /dev/null 2>&1; then
  echo "  ✗ No respondió en 15s. Log: /tmp/divisual-dashboard.log"
  exit 1
fi

ok "Dashboard arriba (pid $DASHBOARD_PID)"

# Limpiar backup ya que todo está restaurado
rm -rf "$BACKUP"

# ── 11. Abrir navegador ──────────────────────────────────────────────────────
sleep_dramatic 1
step "Abriendo dashboard"
open http://localhost:5191/
sleep_dramatic 1

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Divisual Video Editor Kit listo${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "  → Dashboard: http://localhost:5191"
echo "  → PID: $DASHBOARD_PID  ·  log: /tmp/divisual-dashboard.log"
echo ""
