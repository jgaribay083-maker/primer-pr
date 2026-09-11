#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "🎬 Video Editor Kit — Setup"
echo "================================"
echo ""

# ── 1. Homebrew ────────────────────────────────────────────────────────────────
if ! command -v brew &> /dev/null; then
    echo -e "${RED}❌ Homebrew no está instalado.${NC}"
    echo "   Instálalo en https://brew.sh y vuelve a ejecutar este script."
    exit 1
fi
echo -e "${GREEN}✓${NC} Homebrew detectado"

# ── 2. Dependencias del sistema ────────────────────────────────────────────────
echo ""
echo "📦 Instalando dependencias del sistema..."

install_if_missing() {
    if ! command -v "$1" &> /dev/null; then
        echo "   → Instalando $2..."
        brew install "$2" --quiet
    else
        echo -e "${GREEN}✓${NC} $1 ya instalado"
    fi
}

install_if_missing ffmpeg ffmpeg
install_if_missing node node
install_if_missing python3 python3

# bun — obligatorio para arrancar HyperFrames Studio (npm run dev no funciona)
if ! command -v bun &> /dev/null; then
    echo "   → Instalando bun..."
    curl -fsSL https://bun.sh/install | bash --quiet
    export PATH="$HOME/.bun/bin:$PATH"
else
    echo -e "${GREEN}✓${NC} bun ya instalado ($(bun --version))"
fi

# ── 3. Clonar skills ───────────────────────────────────────────────────────────
echo ""
echo "📥 Clonando skills..."

if [ ! -d "skills/video-use" ]; then
    echo "   → Clonando VideoUse..."
    git clone https://github.com/browser-use/video-use skills/video-use --quiet
else
    echo -e "${GREEN}✓${NC} VideoUse ya existe — actualizando..."
    cd skills/video-use && git pull --quiet && cd ../..
fi

if [ ! -d "skills/hyperframes" ]; then
    echo "   → Clonando HyperFrames..."
    git clone https://github.com/heygen-com/hyperframes skills/hyperframes --quiet
else
    echo -e "${GREEN}✓${NC} HyperFrames ya existe — actualizando..."
    cd skills/hyperframes && git pull --quiet && cd ../..
fi

# ── 4. Dependencias de las skills ─────────────────────────────────────────────
echo ""
echo "📦 Instalando dependencias de skills..."

echo "   → HyperFrames (npm)..."
cd skills/hyperframes && npm install --silent && cd ../..

# Fix hono/Vite SSR — sin esto HyperFrames Studio carga infinito en el navegador
VITE_CONFIG="skills/hyperframes/packages/studio/vite.config.ts"
if [ -f "$VITE_CONFIG" ] && ! grep -q "external.*hono" "$VITE_CONFIG"; then
    echo "   → Aplicando fix hono/Vite SSR..."
    sed -i '' 's/plugins: \[/ssr: { external: ["hono"] },\n    plugins: [/' "$VITE_CONFIG"
    echo -e "${GREEN}✓${NC} Fix hono aplicado"
else
    echo -e "${GREEN}✓${NC} Fix hono ya aplicado"
fi

echo -e "${GREEN}✓${NC} HyperFrames listo"

if [ -f "skills/video-use/requirements.txt" ]; then
    echo "   → VideoUse (pip)..."
    pip3 install -r skills/video-use/requirements.txt --quiet 2>/dev/null
    echo -e "${GREEN}✓${NC} VideoUse listo"
fi

# ── 5. Test ProRes 4444 con alfa ───────────────────────────────────────────────
echo ""
echo "🧪 Verificando soporte de alfa (ProRes 4444)..."

FFMPEG_BIN="/opt/homebrew/bin/ffmpeg"
FFPROBE_BIN="/opt/homebrew/bin/ffprobe"
# Fallback para entornos no-Apple
command -v "$FFMPEG_BIN" &>/dev/null || FFMPEG_BIN=$(which ffmpeg)
command -v "$FFPROBE_BIN" &>/dev/null || FFPROBE_BIN=$(which ffprobe)

$FFMPEG_BIN -f lavfi -i color=black:s=64x64:d=1 \
  -vf "format=yuva444p12le" \
  -c:v prores_ks -profile:v 4 \
  /tmp/alpha_test.mov -y 2>/dev/null

PIX_FMT=$($FFPROBE_BIN -v quiet -select_streams v:0 \
  -show_entries stream=pix_fmt -of csv=p=0 /tmp/alpha_test.mov 2>/dev/null)

if [ "$PIX_FMT" = "yuva444p12le" ]; then
    echo -e "${GREEN}✓${NC} ProRes 4444 con alfa OK ($PIX_FMT)"
else
    echo -e "${RED}❌ ProRes 4444 no funciona en este entorno (pix_fmt: '$PIX_FMT')${NC}"
    echo "   Verifica que ffmpeg es la versión ARM nativa: $FFMPEG_BIN"
    exit 1
fi
rm -f /tmp/alpha_test.mov

# ── 6. Estructura de directorios ───────────────────────────────────────────────
echo ""
echo "📁 Preparando directorios..."
mkdir -p input output/compositions projects styles brand/logo
echo -e "${GREEN}✓${NC} Directorios listos"

# ── 7. Variables de entorno ────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANTE: Abre el archivo .env y añade tus API keys.${NC}"
    echo "   Sin ellas, la transcripción no funcionará."
else
    echo -e "${GREEN}✓${NC} .env ya configurado"
fi

# ── 8. Listo ───────────────────────────────────────────────────────────────────
echo ""
echo "================================"
echo -e "${GREEN}✅ Kit instalado y listo.${NC}"
echo ""
echo "Próximos pasos:"
echo "  1. Añade tus API keys en .env"
echo "  2. Abre esta carpeta en Claude Code"
echo "  3. Mete un vídeo en /input/"
echo "  4. Dile a Claude: 'edita el vídeo X'"
echo ""
