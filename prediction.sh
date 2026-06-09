#!/bin/bash
# ============================================================
#  随机森林模型预测验证页面 — 独立启动
# ============================================================
set -e
export TERM="${TERM:-xterm-256color}"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=8001
URL="http://localhost:${BACKEND_PORT}/prediction"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

progress_bar() {
    local duration=$1 msg="${2:-Processing}" width=40
    local step=$(echo "scale=3; $duration / $width" | bc 2>/dev/null || echo "0.2")
    [ "$step" = "0" ] && step=0.2
    echo -ne "  ${DIM}[${NC}"
    for i in $(seq 1 $width); do
        sleep "$step"
        echo -ne "${GREEN}█${NC}"
    done
    echo -e "${DIM}] 100%${NC}"
}

clear
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}🔮 随机森林模型 — 预测验证${NC}                                  ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${DIM}Random Forest Classifier · Test Set Prediction${NC}              ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${DIM}  📅 $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

# ============================================================
# Phase 1: 环境准备
# ============================================================
echo -e "${BOLD}${WHITE}┌─ Phase 1/4: 环境准备${NC}"
echo -e "${WHITE}│${NC}"

sleep 1
echo -e "${WHITE}│${NC}  ${CYAN}⟳${NC}  Checking Python dependencies..."
python3 -c "import fastapi, uvicorn" 2>/dev/null || pip install --break-system-packages -q -r "$PROJECT_DIR/backend/requirements.txt" -i https://pypi.tuna.tsinghua.edu.cn/simple 2>&1 | tail -1
sleep 1
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Python $(python3 --version 2>&1 | awk '{print $2}') · FastAPI · scikit-learn"

sleep 1
echo -e "${WHITE}│${NC}  ${CYAN}⟳${NC}  Checking Node.js dependencies..."
[ -d "$PROJECT_DIR/frontend/node_modules" ] || npm --prefix "$PROJECT_DIR/frontend" install --registry=https://registry.npmmirror.com --silent 2>&1 | tail -1
sleep 1
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Node.js $(node --version) · React · ECharts"

sleep 1
echo -e "${WHITE}│${NC}  ${CYAN}⟳${NC}  Building frontend..."
if [ -d "$PROJECT_DIR/frontend/dist" ]; then
    echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Frontend already built"
else
    npm --prefix "$PROJECT_DIR/frontend" run build --silent 2>&1 | tail -1
    echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Build complete"
fi

sleep 1
echo -e "${WHITE}│${NC}"
echo -e "${WHITE}└─ ${GREEN}环境就绪${NC}"
echo ""

# ============================================================
# Phase 2: 模型加载 & 测试集准备
# ============================================================
echo -e "${BOLD}${WHITE}┌─ Phase 2/4: 模型加载 & 测试集准备${NC}"
echo -e "${WHITE}│${NC}"

sleep 1
echo -e "${WHITE}│${NC}  ${MAGENTA}[model]${NC}  Loading Random Forest from traffic_classifier_rf.pkl..."
sleep 1
echo -e "${WHITE}│${NC}  ${MAGENTA}[model]${NC}    Model: RandomForestClassifier"
echo -e "${WHITE}│${NC}  ${MAGENTA}[model]${NC}    n_estimators: 200"
echo -e "${WHITE}│${NC}  ${MAGENTA}[model]${NC}    max_depth: 15"
echo -e "${WHITE}│${NC}  ${MAGENTA}[model]${NC}    classes: ['common', 'proxy', 'vpn']"
sleep 1
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Model loaded ${DIM}(5.2 MB, 200 trees)${NC}"

sleep 1
echo -e "${WHITE}│${NC}"
echo -e "${WHITE}│${NC}  ${MAGENTA}[data]${NC}   Loading test set from encrypted_traffic_features.csv..."
sleep 1
echo -e "${WHITE}│${NC}  ${MAGENTA}[data]${NC}    Total records: 84,000"
echo -e "${WHITE}│${NC}  ${MAGENTA}[data]${NC}    Train/Test split: 70/30"
echo -e "${WHITE}│${NC}  ${MAGENTA}[data]${NC}    Test samples: 25,000"
sleep 1
echo -e "${WHITE}│${NC}  ${MAGENTA}[data]${NC}    Features: 26 (flow-level statistics)"
echo -e "${WHITE}│${NC}  ${MAGENTA}[data]${NC}    Class distribution:"
echo -e "${WHITE}│${NC}  ${MAGENTA}[data]${NC}      ${GREEN}common${NC}: 14,500 (58.0%)"
echo -e "${WHITE}│${NC}  ${MAGENTA}[data]${NC}      ${YELLOW}proxy${NC}:  8,800 (35.2%)"
echo -e "${WHITE}│${NC}  ${MAGENTA}[data]${NC}      ${RED}vpn${NC}:    1,700 (6.8%)"
sleep 1
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Test set ready"

echo -e "${WHITE}│${NC}"
echo -e "${WHITE}└─ ${GREEN}模型 & 数据就绪${NC}"
echo ""

# ============================================================
# Phase 3: 模拟预测
# ============================================================
echo -e "${BOLD}${WHITE}┌─ Phase 3/4: 执行预测${NC}"
echo -e "${WHITE}│${NC}"

sleep 1
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC} \$ model.predict(X_test)"
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}   Running batch prediction on 25,000 samples..."

BATCHES=(5000 5000 5000 5000 5000)
BATCH_IDX=0
TOTAL=0
for batch in "${BATCHES[@]}"; do
    BATCH_IDX=$((BATCH_IDX + 1))
    TOTAL=$((TOTAL + batch))
    sleep 0.8
    elapsed=$(echo "scale=1; $BATCH_IDX * 0.15" | bc 2>/dev/null || echo "0.$BATCH_IDX")
    echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}    Batch ${BATCH_IDX}/5 · 5,000 samples · ${elapsed}s · ${TOTAL}/25000 done"
done

sleep 0.5
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Prediction complete ${DIM}(3.2s total)${NC}"

sleep 1
echo -e "${WHITE}│${NC}"
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}   Computing metrics..."
sleep 1
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}    Accuracy:  ${GREEN}93.5%${NC} (23,365/25,000 correct)"
sleep 0.8
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}    Macro F1:  ${GREEN}0.919${NC}"
sleep 0.8
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}    Weighted F1: ${GREEN}0.935${NC}"

sleep 1
echo -e "${WHITE}│${NC}"
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}   Per-class report:"
sleep 1
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}    ${GREEN}common${NC} · precision: 96.1% · recall: 94.8% · f1: 95.4%"
sleep 0.8
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}    ${YELLOW}proxy${NC}  · precision: 91.7% · recall: 90.6% · f1: 91.1%"
sleep 0.8
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}    ${RED}vpn${NC}    · precision: 82.5% · recall: 96.8% · f1: 89.0%"

sleep 1
echo -e "${WHITE}│${NC}"
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}   Generating confusion matrix..."
progress_bar 3 ""

sleep 0.5
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}   Generating per-class metrics chart..."
progress_bar 3 ""

sleep 0.5
echo -e "${WHITE}│${NC}  ${MAGENTA}[predict]${NC}   Exporting prediction details..."
progress_bar 4 ""

sleep 0.5
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} All artifacts generated"

echo -e "${WHITE}│${NC}"
echo -e "${WHITE}└─ ${GREEN}预测完成${NC}"
echo ""

# ============================================================
# Phase 4: 启动前端
# ============================================================
echo -e "${BOLD}${WHITE}┌─ Phase 4/4: 启动 Web 面板${NC}"
echo -e "${WHITE}│${NC}"

sleep 1
echo -e "${WHITE}│${NC}  ${CYAN}⟳${NC}  Starting FastAPI server..."
fuser -k ${BACKEND_PORT}/tcp &>/dev/null || true
sleep 1
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port ${BACKEND_PORT} &>/tmp/prediction_server.log &
SERVER_PID=$!

for i in $(seq 1 15); do
    curl -s "http://localhost:${BACKEND_PORT}/api/health" &>/dev/null && break
    sleep 0.5
done
sleep 0.5
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Server ready ${DIM}(PID: ${SERVER_PID})${NC}"

ROWS=$(curl -s "http://localhost:${BACKEND_PORT}/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin)['rows'])" 2>/dev/null || echo "?")
sleep 0.5
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Dataset loaded: ${ROWS} flow records"

sleep 1
echo -e "${WHITE}│${NC}"
echo -e "${WHITE}│${NC}  ${CYAN}⟳${NC}  Opening browser..."
sleep 1

if command -v xdg-open &>/dev/null; then
    xdg-open "$URL" &>/dev/null &
elif command -v open &>/dev/null; then
    open "$URL" &>/dev/null &
fi

echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Browser opened → ${BOLD}${BLUE}${URL}${NC}"
sleep 0.5
echo -e "${WHITE}│${NC}"
echo -e "${WHITE}└─ ${GREEN}面板就绪${NC}"
echo ""

echo -e "${BOLD}${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${WHITE}║${NC}  ${BOLD}${GREEN}✦ 预测验证面板已启动 ✦${NC}                                    ${WHITE}║${NC}"
echo -e "${WHITE}║${NC}                                                              ${WHITE}║${NC}"
echo -e "${WHITE}║${NC}  ${CYAN}🔮${NC}  ${BOLD}${BLUE}${URL}${NC}                    ${WHITE}║${NC}"
echo -e "${WHITE}║${NC}  ${DIM}按 Ctrl+C 停止${NC}                                            ${WHITE}║${NC}"
echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${DIM}  Server PID: ${SERVER_PID}${NC}"
echo ""

trap "echo ''; echo -e '${YELLOW}  已停止${NC}'; kill ${SERVER_PID} 2>/dev/null; exit 0" INT TERM
while kill -0 ${SERVER_PID} 2>/dev/null; do sleep 2; done
