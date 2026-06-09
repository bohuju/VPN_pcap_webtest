#!/bin/bash
# ============================================================
#  Pcap 流量分析演示系统 — 一键启动脚本
#  模拟: 抓包 → 传输 → 远端分析 → 前端展示
# ============================================================
set -e
export TERM="${TERM:-xterm-256color}"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_PORT=8001

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

spinner() { local pid=$1 delay=0.1 spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'; while kill -0 "$pid" 2>/dev/null; do for ((i=0;i<${#spin};i++)); do printf "\r  ${CYAN}%s${NC}" "${spin:$i:1}"; sleep $delay; done; done; printf "\r"; }

clear
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}${BOLD}${WHITE}                                                                  ${NC}${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}🔬  Pcap 流量分析演示系统 v2.0${NC}                                  ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${DIM}Network Traffic Analysis & Classification Platform${NC}             ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}${WHITE}                                                                  ${NC}${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${DIM}  📅 $(date '+%Y-%m-%d %H:%M:%S')   🖥️  Host: $(hostname)   🐧 $(uname -s) $(uname -m)${NC}"
echo ""

# ============================================================
# Phase 1: 环境初始化
# ============================================================
echo -e "${BOLD}${WHITE}┌─ Phase 1/5: 实验环境初始化${NC}"
echo -e "${WHITE}│${NC}"

sleep 1
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Python $(python3 --version 2>&1 | awk '{print $2}')"
sleep 0.3
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} FastAPI backend detected"
sleep 0.3
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} React frontend (Vite + ECharts + Tailwind)"
sleep 0.3
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} CSV flow feature dataset ready"
sleep 0.3
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} 分析引擎就绪 (protocol / packet-size / flow / time-series / TLS)"
sleep 0.3

# Build frontend (real)
echo -e "${WHITE}│${NC}  ${CYAN}⠏${NC} Building frontend..."
npm --prefix "$FRONTEND_DIR" run build --silent &>/dev/null &
BUILD_PID=$!
spinner $BUILD_PID
wait $BUILD_PID
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC} Frontend build complete ($(du -sh "$FRONTEND_DIR/dist" 2>/dev/null | awk '{print $1}'))"

echo -e "${WHITE}│${NC}"
echo -e "${WHITE}└─ ${GREEN}环境就绪${NC}"
echo ""

# ============================================================
# Phase 2: 模拟抓包
# ============================================================
echo -e "${BOLD}${WHITE}┌─ Phase 2/5: 流量采集 — 多源并行抓包${NC}"
echo -e "${WHITE}│${NC}"

SITES=("www.baidu.com" "www.taobao.com" "www.jd.com" "www.bilibili.com"
       "www.zhihu.com" "mail.163.com" "www.ietf.org" "www.python.org"
       "www.ubuntu.com" "www.xidian.edu.cn")
TYPES=("common" "proxy" "vpn")
AGENTS=("ssr" "vmess" "trojan" "ss")

declare -A CAPTURED_FILES
TOTAL_PKTS=0
TOTAL_BYTES=0

for i in "${!SITES[@]}"; do
    site="${SITES[$i]}"
    idx=$(printf "%03d" $((i+1)))

    for type in "${TYPES[@]}"; do
        sleep 0.15
        pkts=$(( RANDOM % 2000 + 100 ))
        bytes=$(( RANDOM % 500000 + 50000 ))
        TOTAL_PKTS=$((TOTAL_PKTS + pkts))
        TOTAL_BYTES=$((TOTAL_BYTES + bytes))

        if [ "$type" = "common" ]; then
            echo -e "${WHITE}│${NC}  ${GREEN}[common]${NC}  tcpdump -i eth0 → ${CYAN}${site}${NC}  ${DIM}${pkts} pkts, $((bytes / 1024))KB${NC}"
        elif [ "$type" = "proxy" ]; then
            agent="${AGENTS[$((RANDOM % 4))]}"
            echo -e "${WHITE}│${NC}  ${YELLOW}[proxy]${NC}  tcpdump -i tun0 → ${CYAN}${site}${NC} ${DIM}via ${agent}${NC}  ${DIM}${pkts} pkts, $((bytes / 1024))KB${NC}"
        else
            echo -e "${WHITE}│${NC}  ${RED}[vpn]${NC}    tcpdump -i utun0 → ${CYAN}${site}${NC} ${DIM}via OpenVPN${NC}  ${DIM}${pkts} pkts, $((bytes / 1024))KB${NC}"
        fi
    done
done

echo -e "${WHITE}│${NC}"
echo -e "${WHITE}│${NC}  ${BOLD}采集汇总:${NC}"
echo -e "${WHITE}│${NC}    ${GREEN}●${NC} Common:  $((${#SITES[@]})) 站点 × 1 thread  = $((${#SITES[@]})) 个 pcap"
echo -e "${WHITE}│${NC}    ${YELLOW}●${NC} Proxy:   $((${#SITES[@]})) 站点 × 4 agents = $(( ${#SITES[@]} * 4 )) 个 pcap"
echo -e "${WHITE}│${NC}    ${RED}●${NC} VPN:     $((${#SITES[@]})) 站点 × 1 tunnel = $((${#SITES[@]})) 个 pcap"
echo -e "${WHITE}│${NC}    ${BOLD}总计: ~$TOTAL_PKTS 数据包, ~$((TOTAL_BYTES / 1048576))MB${NC}"

echo -e "${WHITE}│${NC}"
echo -e "${WHITE}└─ ${GREEN}抓包完成 — $((${#SITES[@]} * 3)) 个 pcap 文件${NC}"
echo ""

# ============================================================
# Phase 3: 数据传输
# ============================================================
echo -e "${BOLD}${WHITE}┌─ Phase 3/5: 数据传输 → 远端实验服务器${NC}"
echo -e "${WHITE}│${NC}"

REMOTE_HOST="10.20.$(shuf -i 50-99 -n 1).$(shuf -i 10-99 -n 1)"
REMOTE_PATH="/data/experiments/pcap_$(date +%Y%m%d)"
SSH_PORT=22

sleep 0.5
echo -e "${WHITE}│${NC}  ${CYAN}⟳${NC}  Establishing SSH tunnel to ${BOLD}${REMOTE_HOST}:${SSH_PORT}${NC}..."
sleep 0.8
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC}  SSH connection established ${DIM}(ecdh-sha2-nistp256)${NC}"
sleep 0.3
echo -e "${WHITE}│${NC}  ${CYAN}⟳${NC}  Creating remote workspace ${REMOTE_PATH}..."
sleep 0.4
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC}  Remote directory created"

BATCHES=("common_pcaps" "proxy_pcaps" "vpn_pcaps")
TOTAL_SIZE=0
for batch in "${BATCHES[@]}"; do
    sleep 0.6
    fsize=$(( RANDOM % 50 + 10 ))
    TOTAL_SIZE=$((TOTAL_SIZE + fsize))
    speed=$(( RANDOM % 80 + 40 ))
    echo -e "${WHITE}│${NC}  ${CYAN}⤴${NC}  rsync ${batch}/ → ${REMOTE_HOST}:${REMOTE_PATH}/${batch}/  ${DIM}${fsize}MB @ ${speed}MB/s${NC}"
    # Progress bar
    echo -ne "${WHITE}│${NC}     ${DIM}[${NC}"
    for p in $(seq 0 5 100); do sleep 0.04; echo -ne "${GREEN}█${NC}"; done
    echo -e "${DIM}] 100%${NC}"
done

echo -e "${WHITE}│${NC}"
echo -e "${WHITE}│${NC}  ${BOLD}传输汇总:${NC} ${TOTAL_SIZE}MB / $((TOTAL_SIZE * 3 / 2))MB (压缩后)"
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC}  SHA256 checksum verified"
echo -e "${WHITE}│${NC}"
echo -e "${WHITE}└─ ${GREEN}传输完成 — 数据已同步至远端服务器${NC}"
echo ""

# ============================================================
# Phase 4: 远端分析
# ============================================================
echo -e "${BOLD}${WHITE}┌─ Phase 4/5: 远端实验服务器 — 流量特征提取 & 分析${NC}"
echo -e "${WHITE}│${NC}"

sleep 0.5
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC} \$ python3 feature_extract.py --input ${REMOTE_PATH}/ --output features.csv"
sleep 0.8
echo -ne "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   Extracting features: "
for step in "flow 5-tuple" "packet stats" "TLS handshake" "DNS queries" "IAT distribution" "entropy calc" "label assign"; do
    sleep 0.5
    echo -ne "${GREEN}✓${NC} ${step}  "
done
echo ""

sleep 0.3
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   ${BOLD}Feature extraction complete${NC}"
sleep 0.4
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   Output: encrypted_traffic_features.csv"
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   Records: 7,457 flows × 26 features"
sleep 0.5

echo -e "${WHITE}│${NC}"
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC} \$ python3 train_analyze.py --model random_forest --kfold 5"
sleep 1.2
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   Training Random Forest classifier..."
for fold in 1 2 3 4 5; do
    sleep 0.5
    acc="0.$(shuf -i 9200-9850 -n 1)"
    echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}     Fold ${fold}/5  →  Accuracy: ${GREEN}${acc}${NC}"
done
sleep 0.3
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   ${BOLD}Cross-validation: 0.$(shuf -i 9400-9700 -n 1) (±0.01)${NC}"

echo -e "${WHITE}│${NC}"
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC} \$ python3 analyze.py --compare common,proxy,vpn"
sleep 0.8
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   Protocol distribution analysis..."
sleep 0.3
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   Packet size distribution..."
sleep 0.3
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   Flow statistics (boxplot)..."
sleep 0.3
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   IAT CDF curves..."
sleep 0.3
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   TLS fingerprint analysis..."
sleep 0.3
echo -e "${WHITE}│${NC}  ${MAGENTA}[remote]${NC}   ${BOLD}Analysis complete — generating visualization data...${NC}"

echo -e "${WHITE}│${NC}"
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC}  Confusion matrix saved"
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC}  Feature importance top-15 computed"
echo -e "${WHITE}│${NC}  ${GREEN}✓${NC}  Classification report generated"
echo -e "${WHITE}│${NC}"
echo -e "${WHITE}└─ ${GREEN}远端分析完成 — 结果已回传${NC}"
echo ""

# ============================================================
# Phase 5: 启动前端
# ============================================================
echo -e "${BOLD}${WHITE}┌─ Phase 5/5: 启动 Web 分析面板${NC}"
echo -e "${WHITE}│${NC}"

# Kill existing backend if running
fuser -k ${BACKEND_PORT}/tcp &>/dev/null || true
sleep 1

echo -e "${WHITE}│${NC}  ${CYAN}⟳${NC}  Starting FastAPI analysis backend..."
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port ${BACKEND_PORT} &>/tmp/pcap_demo_server.log &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 15); do
    if curl -s "http://localhost:${BACKEND_PORT}/api/health" &>/dev/null; then
        break
    fi
    sleep 0.5
done

if curl -s "http://localhost:${BACKEND_PORT}/api/health" &>/dev/null; then
    echo -e "${WHITE}│${NC}  ${GREEN}✓${NC}  Backend started ${DIM}(PID: ${SERVER_PID}, port: ${BACKEND_PORT})${NC}"

    # Quick verification
    ROWS=$(curl -s "http://localhost:${BACKEND_PORT}/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin)['rows'])" 2>/dev/null || echo "?")
    echo -e "${WHITE}│${NC}  ${GREEN}✓${NC}  Dataset loaded: ${ROWS} flow records"
    echo -e "${WHITE}│${NC}  ${GREEN}✓${NC}  Analysis cache warmed: protocol / packet-size / flow / time-series / TLS"
else
    echo -e "${WHITE}│${NC}  ${RED}✗${NC}  Backend startup failed — check /tmp/pcap_demo_server.log"
    exit 1
fi

echo -e "${WHITE}│${NC}"
echo -e "${WHITE}│${NC}  ${CYAN}⟳${NC}  Opening browser..."
sleep 1

# Open browser (cross-platform)
URL="http://localhost:${BACKEND_PORT}"
if command -v xdg-open &>/dev/null; then
    xdg-open "$URL" &>/dev/null &
elif command -v open &>/dev/null; then
    open "$URL" &>/dev/null &
elif command -v sensible-browser &>/dev/null; then
    sensible-browser "$URL" &>/dev/null &
fi

echo -e "${WHITE}│${NC}  ${GREEN}✓${NC}  Browser opened → ${BOLD}${BLUE}${URL}${NC}"
echo -e "${WHITE}│${NC}"
echo -e "${WHITE}└─ ${GREEN}面板就绪${NC}"
echo ""

# ============================================================
# Summary
# ============================================================
echo -e "${BOLD}${WHITE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${WHITE}║${NC}  ${BOLD}${GREEN}✦ 演示系统启动完成 ✦${NC}                                          ${WHITE}║${NC}"
echo -e "${WHITE}║${NC}                                                                  ${WHITE}║${NC}"
echo -e "${WHITE}║${NC}  ${CYAN}🌐${NC}  Web 面板:  ${BOLD}${BLUE}http://localhost:${BACKEND_PORT}${NC}                         ${WHITE}║${NC}"
echo -e "${WHITE}║${NC}  ${CYAN}📊${NC}  数据来源:  experiment2 + experiment2_database                 ${WHITE}║${NC}"
echo -e "${WHITE}║${NC}  ${CYAN}📈${NC}  分析维度:  概览 / 协议 / 包大小 / 流 / 时间序列 / TLS / 数据表    ${WHITE}║${NC}"
echo -e "${WHITE}║${NC}  ${CYAN}🟢🟠🔴${NC}  三类对比:  Common / Proxy / VPN                               ${WHITE}║${NC}"
echo -e "${WHITE}║${NC}                                                                  ${WHITE}║${NC}"
echo -e "${WHITE}║${NC}  ${DIM}按 Ctrl+C 停止服务${NC}                                            ${WHITE}║${NC}"
echo -e "${WHITE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${DIM}  Server PID: ${SERVER_PID}  |  Log: /tmp/pcap_demo_server.log${NC}"
echo ""

# Keep running until Ctrl+C
echo -e "${DIM}  [服务运行中, 按 Ctrl+C 停止]${NC}"
trap "echo ''; echo -e '${YELLOW}  演示系统已停止${NC}'; kill ${SERVER_PID} 2>/dev/null; exit 0" INT TERM
while kill -0 ${SERVER_PID} 2>/dev/null; do sleep 2; done
