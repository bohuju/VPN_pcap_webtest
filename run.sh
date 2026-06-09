#!/bin/bash
# ============================================================
#  启动前后端 — 冷启动安全，自动安装依赖
# ============================================================
set -e
export TERM="${TERM:-xterm-256color}"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_PORT="${PORT:-8001}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

echo ""
echo -e "${BOLD}  启动 Pcap 流量分析服务${NC}"
echo -e "${DIM}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

# ---- Python deps ----
echo -e "${CYAN}[1/3]${NC} Checking Python dependencies..."
if python3 -c "import fastapi, uvicorn, scapy, watchdog" &>/dev/null; then
    echo -e "      ${GREEN}✓${NC} Python packages already installed"
else
    echo -e "      Installing backend requirements..."
    pip install --break-system-packages -q -r "$BACKEND_DIR/requirements.txt" 2>&1 | tail -1
    echo -e "      ${GREEN}✓${NC} Python packages installed"
fi

# ---- Node deps ----
echo -e "${CYAN}[2/3]${NC} Checking Node.js dependencies..."
if [ -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "      ${GREEN}✓${NC} node_modules already exists"
else
    echo -e "      npm install (this may take a minute)..."
    npm --prefix "$FRONTEND_DIR" install --silent 2>&1 | tail -1
    echo -e "      ${GREEN}✓${NC} npm packages installed"
fi

# ---- Build frontend ----
echo -e "${CYAN}[3/3]${NC} Building frontend..."
npm --prefix "$FRONTEND_DIR" run build --silent 2>&1
echo -e "      ${GREEN}✓${NC} Build complete ($(du -sh "$FRONTEND_DIR/dist" 2>/dev/null | awk '{print $1}'))"

# ---- Start backend ----
echo ""
echo -e "${BOLD}  Starting server...${NC}"
echo -e "  ${DIM}Backend : http://localhost:${BACKEND_PORT}${NC}"
echo -e "  ${DIM}API docs: http://localhost:${BACKEND_PORT}/docs${NC}"
echo ""

fuser -k ${BACKEND_PORT}/tcp &>/dev/null || true
sleep 1

python3 -m uvicorn backend.main:app --host 0.0.0.0 --port ${BACKEND_PORT} "$@"
