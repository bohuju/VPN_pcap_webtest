#!/bin/bash
# ============================================================
#  流量分析面板 — 启动前后端
# ============================================================
set -e
export TERM="${TERM:-xterm-256color}"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT="${PORT:-8001}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
WHITE='\033[1;37m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

clear
echo ""
echo -e "${BOLD}  Pcap 流量分析面板${NC}"
echo -e "${DIM}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

# ============================================================
# Phase 1/2: 环境准备
# ============================================================
echo -e "${CYAN}[1/2]${NC} Checking dependencies..."

# Python deps
python3 -c "import fastapi, uvicorn" 2>/dev/null || \
    pip install --break-system-packages -q -r "$PROJECT_DIR/backend/requirements.txt" -i https://pypi.tuna.tsinghua.edu.cn/simple 2>&1 | tail -1
echo -e "      ${GREEN}✓${NC} Python $(python3 --version 2>&1 | awk '{print $2}') · FastAPI"

# Node deps
[ -d "$PROJECT_DIR/frontend/node_modules" ] || \
    npm --prefix "$PROJECT_DIR/frontend" install --registry=https://registry.npmmirror.com --silent 2>&1 | tail -1
echo -e "      ${GREEN}✓${NC} Node.js $(node --version) · React · ECharts"

# Build frontend
if [ -d "$PROJECT_DIR/frontend/dist" ]; then
    echo -e "      ${GREEN}✓${NC} dist already exists, skipping build ($(du -sh "$PROJECT_DIR/frontend/dist" 2>/dev/null | awk '{print $1}'))"
else
    npm --prefix "$PROJECT_DIR/frontend" run build --silent 2>&1
    echo -e "      ${GREEN}✓${NC} Build complete ($(du -sh "$PROJECT_DIR/frontend/dist" 2>/dev/null | awk '{print $1}'))"
fi

echo ""

# ============================================================
# Phase 2/2: 启动服务器
# ============================================================
echo -e "${CYAN}[2/2]${NC} Starting server..."
echo -e "  ${DIM}Backend : http://localhost:${BACKEND_PORT}${NC}"
echo -e "  ${DIM}API docs: http://localhost:${BACKEND_PORT}/docs${NC}"
echo ""

fuser -k ${BACKEND_PORT}/tcp &>/dev/null || true
sleep 1

python3 -m uvicorn backend.main:app --host 0.0.0.0 --port ${BACKEND_PORT} "$@"
