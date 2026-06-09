#!/bin/bash
# ============================================================
#  随机森林模型预测验证页面 — 独立启动
# ============================================================
set -e
export TERM="${TERM:-xterm-256color}"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=8001
URL="http://localhost:${BACKEND_PORT}/prediction"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

clear
echo ""
echo -e "  ${BOLD}🔮 随机森林模型 — 预测验证${NC}"
echo -e "  ${DIM}Test Set Prediction & Evaluation${NC}"
echo ""

# Deps check
echo -e "${CYAN}[1/3]${NC} Checking dependencies..."
python3 -c "import fastapi, uvicorn" 2>/dev/null || pip install --break-system-packages -q -r "$PROJECT_DIR/backend/requirements.txt" 2>&1 | tail -1
[ -d "$PROJECT_DIR/frontend/node_modules" ] || npm --prefix "$PROJECT_DIR/frontend" install --silent 2>&1 | tail -1
echo -e "     ${GREEN}✓${NC} Dependencies ready"

# Build
echo -e "${CYAN}[2/3]${NC} Building frontend..."
npm --prefix "$PROJECT_DIR/frontend" run build --silent 2>&1 | tail -1
echo -e "     ${GREEN}✓${NC} Build complete"

# Start
echo -e "${CYAN}[3/3]${NC} Starting server..."
fuser -k ${BACKEND_PORT}/tcp &>/dev/null || true
sleep 1
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port ${BACKEND_PORT} &>/tmp/prediction_server.log &
SERVER_PID=$!

for i in $(seq 1 15); do
    curl -s "http://localhost:${BACKEND_PORT}/api/health" &>/dev/null && break
    sleep 0.5
done
echo -e "     ${GREEN}✓${NC} Server ready (PID: ${SERVER_PID})"

# Open browser
if command -v xdg-open &>/dev/null; then
    xdg-open "$URL" &>/dev/null &
elif command -v open &>/dev/null; then
    open "$URL" &>/dev/null &
fi

echo ""
echo -e "  ${GREEN}✦ 已打开:${NC} ${BOLD}${BLUE}${URL}${NC}"
echo -e "  ${DIM}按 Ctrl+C 停止${NC}"
echo ""

trap "echo ''; echo -e '  已停止'; kill ${SERVER_PID} 2>/dev/null; exit 0" INT TERM
while kill -0 ${SERVER_PID} 2>/dev/null; do sleep 2; done
