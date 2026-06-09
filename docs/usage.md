# VPN 流量抓包分析系统 — 使用文档

> 版本 1.0.0 | 2026-06-09

---

## 1. 项目概述

本项目是一个**加密流量分析 Web 应用**，用于对 Common（普通）、Proxy（代理）、VPN（加密隧道）三类网络流量的 CSV 特征数据进行可视化分析和对比。

**核心能力：**

- 读取预提取的流量特征 CSV 数据（~7400 条流记录 × 26 维特征）
- 提供 7 个分析维度：概览、协议分布、包大小分布、流统计、时间序列 / IAT、TLS 指纹、数据表
- 基于已训练的 Random Forest 模型提供预测验证页面
- 前端使用 React + ECharts 实现交互式图表，后端使用 FastAPI 提供 REST API 并托管前端静态文件

**适用场景：** 学术实验演示、流量分析教学、VPN/代理检测方法验证。

---

## 2. 项目结构

```
VPN_pcap_webtest/
│
├── backend/                          # Python 后端
│   ├── main.py                       # FastAPI 应用入口，定义 API 路由和 SPA 托管
│   ├── csv_data.py                   # CSV 数据读取 + 所有分析计算逻辑
│   ├── models.py                     # Pydantic 数据模型（API 返回值结构定义）
│   ├── cache.py                      # 自实现 LRU 缓存（带 TTL 过期）
│   ├── parser.py                     # pcap 文件解析器
│   ├── analyzer.py                   # 流量分析引擎
│   ├── pool_manager.py               # pcap 文件池管理
│   ├── requirements.txt              # Python 依赖清单
│   └── tests/                        # 后端单元测试
│       ├── test_api.py               # API 接口测试
│       ├── test_csv_data.py          # 数据分析函数测试
│       ├── test_cache.py             # 缓存模块测试
│       ├── test_parser.py            # 解析器测试
│       ├── test_analyzer.py          # 分析器测试
│       └── test_pool_manager.py      # 池管理测试
│
├── frontend/                         # React 前端
│   ├── package.json                  # npm 依赖声明
│   ├── vite.config.ts                # Vite 构建配置（含 /api 代理）
│   ├── tsconfig.json                 # TypeScript 配置
│   ├── tailwind.config.js            # Tailwind CSS 配置
│   ├── postcss.config.js             # PostCSS 配置
│   ├── index.html                    # HTML 入口
│   ├── .npmrc                        # npm 镜像源（npmmirror）
│   └── src/
│       ├── main.tsx                  # React 入口
│       ├── App.tsx                   # 路由定义（9 个页面）
│       ├── index.css                 # 全局样式（Tailwind + 自定义）
│       ├── types/index.ts            # TypeScript 类型定义
│       ├── context/StatsContext.tsx   # 全局状态（统计概览数据）
│       ├── hooks/useAnalysis.ts      # 通用数据请求 Hook（SWR 封装）
│       ├── components/
│       │   ├── Sidebar.tsx           # 左侧导航栏
│       │   ├── RefreshBar.tsx        # 顶部刷新栏 + 刷新按钮
│       │   ├── StatCards.tsx         # 统计概览卡片
│       │   ├── InsightCard.tsx       # 分析结论卡片
│       │   ├── UploadZone.tsx        # pcap 文件上传区域
│       │   ├── TrafficPool.tsx       # pcap 文件池状态
│       │   ├── AnalysisNav.tsx       # 分析维度导航
│       │   └── charts/
│       │       ├── ProtocolChart.tsx  # 协议分布图
│       │       ├── PacketSizeChart.tsx# 包大小分布图
│       │       ├── FlowChart.tsx      # 流统计箱线图
│       │       └── TimeSeriesChart.tsx# 时间序列图
│       └── pages/
│           ├── OverviewPage.tsx      # 概览页
│           ├── ProtocolPage.tsx      # 协议分布页
│           ├── PacketSizePage.tsx    # 包大小分布页
│           ├── FlowPage.tsx          # 流统计页
│           ├── TimeSeriesPage.tsx    # 时间序列 + IAT CDF 页
│           ├── TlsPage.tsx           # TLS 指纹页
│           ├── DataTablePage.tsx     # 数据表页（分页浏览）
│           ├── ModelPage.tsx         # 模型信息页（决策树可视化）
│           └── PredictionPage.tsx    # 预测验证页
│
├── experiment2/                      # 实验数据集（小）
│   ├── encrypted_traffic_features.csv # CSV 特征文件（60 行）
│   ├── traffic_classifier_rf.pkl     # 训练好的 Random Forest 模型
│   ├── feature_extract.py            # 特征提取脚本
│   ├── train_analyze.py              # 训练和分析脚本
│   ├── collect_common.py             # Common 流量采集脚本
│   ├── collect_proxy.py              # Proxy 流量采集脚本
│   ├── collect_vpn.py                # VPN 流量采集脚本
│   ├── common_pcaps/                 # Common 类 pcap 文件
│   ├── proxy_pcaps/                  # Proxy 类 pcap 文件
│   └── vpn_pcaps/                    # VPN 类 pcap 文件
│
├── experiment2_database/             # 实验数据集（主）
│   └── encrypted_traffic_features.csv # CSV 特征文件（7397 行，~2.6MB）
│   └── ...（结构同上）
│
├── pcap_pool/                        # 运行时 pcap 文件池
├── .pcap_cache/                      # pcap 解析缓存
├── run.sh                            # 标准启动脚本
├── prediction.sh                     # 预测页面独立启动脚本
├── start.sh                          # 完整演示脚本（模拟抓包→传输→分析→展示）
├── pip.conf                          # pip 镜像源配置
└── .gitignore
```

---

## 3. 环境要求

| 依赖 | 最低版本 | 用途 |
|------|----------|------|
| **Linux** | — | bash 脚本依赖（macOS 亦可，需调整 `fuser` 等命令） |
| **Python** | 3.10+ | 后端运行时 |
| **Node.js** | 18+ | 前端构建（仅构建时需要，运行时不需要） |
| **npm** | 9+ | 前端依赖管理 |
| **libpcap-dev** | — | scapy 的底层依赖（仅 pcap 解析功能需要） |

**Python 包**（`backend/requirements.txt`）：

| 包名 | 版本 | 用途 |
|------|------|------|
| `fastapi` | 0.115.12 | Web 框架 |
| `uvicorn[standard]` | 0.34.2 | ASGI 服务器 |
| `scapy` | 2.6.1 | pcap 文件解析 |
| `watchdog` | 6.0.0 | 文件系统监控（pcap 池热加载） |
| `python-multipart` | 0.0.20 | 文件上传支持 |
| `pytest` | 8.3.5 | 测试框架 |
| `httpx` | 0.28.1 | 测试用 HTTP 客户端 |

**Node.js 包**（`frontend/package.json`）：

| 类别 | 关键包 | 用途 |
|------|--------|------|
| 运行时 | `react`, `react-dom` | UI 框架 |
| 路由 | `react-router-dom` | 前端 SPA 路由 |
| 图表 | `echarts`, `echarts-for-react` | 交互式图表 |
| 数据 | `swr` | 数据请求和缓存 |
| 构建 | `vite`, `typescript` | 构建工具链 |
| 样式 | `tailwindcss`, `postcss`, `autoprefixer` | CSS 框架 |
| 测试 | `vitest`, `jsdom`, `@testing-library/react` | 前端测试 |

---

## 4. 快速开始

项目提供三个启动脚本，分别对应不同场景。

### 4.1 run.sh — 标准启动（推荐日常使用）

```bash
bash run.sh
```

**作用：** 检查依赖 → 安装缺失的包 → 构建前端 → 启动后端服务。

**逐步骤详解：**

| 步骤 | 脚本行 | 说明 |
|------|--------|------|
| **变量初始化** | 第 8-11 行 | 自动探测项目根目录、设定后端端口（默认 8001，可通过 `PORT` 环境变量覆盖） |
| **[1/3] 检查 Python 依赖** | 第 27-34 行 | 用 `python3 -c "import fastapi, uvicorn, scapy, watchdog"` 检测核心包是否已安装。如果已安装则跳过；如果缺失，则执行 `pip install -r backend/requirements.txt`（已配置清华镜像源） |
| **[2/3] 检查 Node.js 依赖** | 第 37-44 行 | 检查 `frontend/node_modules/` 目录是否存在。如果存在则跳过；如果不存在，则执行 `npm install`（已配置 npmmirror 镜像源） |
| **[3/3] 构建前端** | 第 47-49 行 | 执行 `npm run build`，触发 `tsc -b && vite build`。TypeScript 编译检查通过后，Vite 将 React 代码打包到 `frontend/dist/`。构建产物大小会被打印出来 |
| **杀死旧进程** | 第 58-59 行 | `fuser -k 8001/tcp` 释放端口，防止 "Address already in use" 错误 |
| **启动服务** | 第 61 行 | 用 uvicorn 启动 FastAPI，监听 `0.0.0.0:8001`。`"$@"` 允许传入额外参数（如 `--reload` 开启热重载） |

**启动后访问：**

- 前端面板：`http://localhost:8001`
- API 文档（Swagger）：`http://localhost:8001/docs`
- 健康检查：`http://localhost:8001/api/health`

**自定义端口：**
```bash
PORT=9000 bash run.sh
```

---

### 4.2 prediction.sh — 预测验证页面独立启动

```bash
bash prediction.sh
```

**作用：** 启动服务后自动打开浏览器到 `/prediction` 页面，用于模型预测结果验证。

**逐步骤详解：**

| 步骤 | 脚本行 | 说明 |
|------|--------|------|
| **变量初始化** | 第 8-10 行 | 设定端口 8001，URL 指向 `/prediction` 路由 |
| **[1/3] 检查依赖** | 第 26-29 行 | 只检查 `fastapi` 和 `uvicorn`（预测页面不需要 scapy/watchdog）。缺失则通过清华源安装。同时检查 `node_modules`，不存在则通过 npmmirror 安装 |
| **[2/3] 构建前端** | 第 32-34 行 | 与 run.sh 相同，TypeScript 编译 + Vite 打包 |
| **[3/3] 启动服务** | 第 37-47 行 | 先 `fuser -k` 释放端口，然后后台启动 uvicorn（日志写入 `/tmp/prediction_server.log`），轮询 `/api/health` 最多 15 次（每次 0.5 秒），直到服务就绪 |
| **打开浏览器** | 第 50-54 行 | 依次尝试 `xdg-open`（Linux）、`open`（macOS）、`sensible-browser`，打开 `http://localhost:8001/prediction` |
| **等待退出** | 第 61-62 行 | 进入守护循环，直到 `Ctrl+C` 发送 SIGINT 后执行 trap 清理子进程 |

---

### 4.3 start.sh — 完整演示脚本

```bash
bash start.sh
```

**作用：** 模拟完整的流量分析实验流程——从抓包到前端展示，共 5 个 Phase。适合做 Demo 演示。

**逐 Phase 详解：**

#### Phase 1/5 — 实验环境初始化（第 50-67 行）

纯展示性步骤。逐个打印环境检测结果（Python 版本、FastAPI、React、CSV 数据集、分析引擎），让观众了解实验的技术栈。不执行实际的安装或配置。

#### Phase 2/5 — 流量采集（第 73-116 行）

模拟对 10 个网站的多源并行抓包：

- **10 个目标站点：** `www.baidu.com`, `www.taobao.com`, `www.jd.com`, `www.bilibili.com`, `www.zhihu.com`, `mail.163.com`, `www.ietf.org`, `www.python.org`, `www.ubuntu.com`, `www.xidian.edu.cn`
- **3 种流量类型：**
  - **Common（绿色）：** `tcpdump -i eth0` — 普通网卡直接抓包
  - **Proxy（黄色）：** `tcpdump -i tun0` — 代理隧道接口抓包，随机标注代理协议（ssr / vmess / trojan / ss）
  - **VPN（红色）：** `tcpdump -i utun0` — VPN 虚拟接口抓包，标注 OpenVPN
- 每个站点 × 3 种类型 = 30 个 pcap，每个 pcap 的包数和字节数为随机值（模拟真实场景）
- 最后打印采集汇总：包数、字节数、pcap 文件数

> **注意：** 此 Phase 为纯模拟，不执行真实的 `tcpdump`。目的是展示实验设计逻辑。

#### Phase 3/5 — 数据传输（第 121-157 行）

模拟将采集到的 pcap 数据通过 SSH 传输到远端实验服务器：

- 随机生成远端服务器 IP（`10.20.x.x` 网段）和路径
- 依次传输 `common_pcaps`、`proxy_pcaps`、`vpn_pcaps` 三个批次
- 每个批次显示文件大小和传输速度，带进度条动画
- 最后显示传输汇总和 SHA256 校验通过

> **注意：** 同样为纯模拟，不建立真实 SSH 连接。

#### Phase 4/5 — 远端分析（第 162-213 行）

模拟在远端服务器上运行分析流水线：

1. **特征提取**（10 秒进度条）：`python3 feature_extract.py` → 产出 `encrypted_traffic_features.csv`（7457 flows × 26 features）
2. **模型训练**（5-fold CV）：`python3 train_analyze.py --model random_forest --kfold 5`，显示每折准确率
3. **多维度对比分析**（10 秒进度条）：`python3 analyze.py --compare common,proxy,vpn`
4. **分析产出清单：** 协议分布、包大小直方图、流箱线图、IAT CDF 曲线、TLS 指纹、混淆矩阵、特征重要性 Top-15、分类报告

> **注意：** 数据为预先计算好的——实际的 CSV 文件和模型文件已经存在于 `experiment2/` 和 `experiment2_database/` 中。此 Phase 模拟的是计算过程。

#### Phase 5/5 — 启动 Web 面板（第 219-281 行）

真正执行的操作：

1. 后台调用 `run.sh`（安装依赖 + 构建前端 + 启动后端），日志写入 `/tmp/pcap_demo_server.log`
2. 轮询 `/api/health` 等待服务就绪（最多等 30 秒）
3. 调用 `/api/health` 获取加载的数据行数
4. 打印分析缓存状态
5. 打开浏览器到 `http://localhost:8001`
6. 进入守护循环，`Ctrl+C` 停止全部服务

---

## 5. 前端页面说明

应用共 9 个页面，通过左侧导航栏切换。

### 5.1 概览页（OverviewPage）

- **路由：** `/`
- **展示内容：**
  - 三类流量统计卡片（Common / Proxy / VPN）：每个卡片显示流数、总包数、总字节数、平均包大小
  - 分析结论卡片
- **数据来源：** `GET /api/stats`

### 5.2 协议分布页（ProtocolPage）

- **路由：** `/protocol`
- **展示内容：** 堆叠柱状图，展示三类流量中各协议（TCP/UDP 等）的占比百分比
- **数据来源：** `GET /api/analysis/protocol`

### 5.3 包大小分布页（PacketSizePage）

- **路由：** `/packet-size`
- **展示内容：**
  - 分组柱状图（bin 宽度 200 字节，共 8 个 bin：0-200, 200-400, ..., 1400-1500）
  - 统计表：每类流量的 mean / min / max / std
- **数据来源：** `GET /api/analysis/packet-size`

### 5.4 流统计页（FlowPage）

- **路由：** `/flow`
- **展示内容：** 箱线图对比三类流量的每流包数、每流字节数、持续时间
- **数据来源：** `GET /api/analysis/flow`

### 5.5 时间序列 / IAT 页（TimeSeriesPage）

- **路由：** `/time-series`
- **展示内容：**
  - 包速率时间折线图（前 100 个流）
  - IAT（Inter-Arrival Time）CDF 累积分布曲线
- **数据来源：** `GET /api/analysis/time-series`

### 5.6 TLS 指纹页（TlsPage）

- **路由：** `/tls`
- **展示内容：**
  - TLS 版本分布饼图
  - JA3 指纹 Top-5 列表
- **数据来源：** `GET /api/analysis/tls`

### 5.7 数据表页（DataTablePage）

- **路由：** `/data-table`
- **展示内容：** 分页表格，按流量类别（Common / Proxy / VPN）筛选，每页显示 50 条流记录。字段包括：时间戳、源 IP、目的 IP、源端口、目的端口、协议、包长度、附加信息
- **数据来源：** `GET /api/packets?type=common&page=1&size=50`
- **交互：** 顶部按钮切换类别，底部分页导航

### 5.8 模型信息页（ModelPage）

- **路由：** `/model`
- **展示内容：** Random Forest 模型信息，包含 3 棵样本决策树的可视化（含分裂规则）
- **数据来源：** 前端硬编码的模型元信息和决策树结构数据

### 5.9 预测验证页（PredictionPage）

- **路由：** `/prediction`
- **展示内容：**
  - 测试集预测结果表格
  - 混淆矩阵
  - 分类指标（Precision / Recall / F1-score）
  - ROC 曲线
- **数据来源：** 前端内置的预测结果数据（与已训练的 Random Forest 模型一致，准确率约 80%）

---

## 6. 后端 API 说明

所有 API 返回 JSON 格式。基础路径为 `http://localhost:8001`。

### 6.1 健康检查

```
GET /api/health
```

**返回示例：**
```json
{
  "status": "ok",
  "cache_size": 8,
  "rows": 7397
}
```

| 字段 | 含义 |
|------|------|
| `status` | 固定为 `"ok"` |
| `cache_size` | LRU 缓存当前条目数 |
| `rows` | 已加载的 CSV 行数 |

### 6.2 全局统计

```
GET /api/stats
```

**返回结构**（`GlobalStats`）：

| 字段 | 类型 | 含义 |
|------|------|------|
| `common` | CategoryStats | Common 类流量统计 |
| `proxy` | CategoryStats | Proxy 类流量统计 |
| `vpn` | CategoryStats | VPN 类流量统计 |
| `last_updated` | float | 最后更新时间戳 |

`CategoryStats` 包含：`file_count`（流数）、`total_packets`（总包数）、`total_bytes`（总字节数）、`avg_pkt_size`（平均包大小）。

### 6.3 协议分布

```
GET /api/analysis/protocol
```

**返回结构**（`ProtocolData`）：

| 字段 | 类型 | 含义 |
|------|------|------|
| `categories` | List[str] | 协议名列表（如 `["TCP", "UDP"]`） |
| `common` | List[float] | Common 类各协议占比（%） |
| `proxy` | List[float] | Proxy 类各协议占比（%） |
| `vpn` | List[float] | VPN 类各协议占比（%） |
| `unit` | str | 单位，固定为 `"percent"` |

### 6.4 包大小分布

```
GET /api/analysis/packet-size
```

**返回结构**（`PacketSizeData`）：

| 字段 | 类型 | 含义 |
|------|------|------|
| `bins` | List[PacketSizeBin] | 8 个 bin 的分布数据，每个 bin 含 `bin_start`, `bin_end`, `common`, `proxy`, `vpn`（百分比） |
| `stats` | Dict[str, SizeStats] | 三类流量的 `mean`/`min`/`max`/`std` |

### 6.5 流统计

```
GET /api/analysis/flow
```

**返回结构**（`FlowData`）：

| 字段 | 类型 | 含义 |
|------|------|------|
| `boxplot` | List[FlowBoxData] | 3 个指标（每流包数、每流字节数、持续时间）的箱线图数据，每组为 `[min, Q1, median, Q3, max]` |

### 6.6 时间序列

```
GET /api/analysis/time-series
```

**返回结构**（`TimeSeriesData`）：

| 字段 | 类型 | 含义 |
|------|------|------|
| `rate_timeline` | Dict[str, List[TimeSeriesPoint]] | 三类流量的包速率时间序列（前 100 个流），每个点为 `{time, packet_rate}` |
| `iat_cdf` | List[IATPoint] | IAT CDF 曲线的 101 个采样点，每个点为 `{interval, common_cdf, proxy_cdf, vpn_cdf}` |

### 6.7 TLS 指纹

```
GET /api/analysis/tls
```

**返回结构**（`TlsData`）：

| 字段 | 类型 | 含义 |
|------|------|------|
| `version_distribution` | Dict[str, List[TlsVersionItem]] | 三类流量的 TLS 版本分布，每个 item 为 `{name, value}` |
| `ja3_fingerprints` | Dict[str, List[JA3Record]] | 三类流量的 Top-5 JA3 指纹，每个 record 为 `{fingerprint, count, sni}` |

> 当前 TLS 数据由协议字段近似生成，非真实 TLS 解析。

### 6.8 数据表

```
GET /api/packets?type=common&page=1&size=50
```

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | enum(`common`, `proxy`, `vpn`) | `common` | 流量类别筛选 |
| `page` | int (≥1) | `1` | 页码 |
| `size` | int (1-500) | `50` | 每页行数 |

**返回结构**（`PacketTableData`）：

| 字段 | 类型 | 含义 |
|------|------|------|
| `packets` | List[PacketRecord] | 当前页的流记录列表 |
| `total` | int | 该类别总记录数 |
| `page` | int | 当前页码 |
| `size` | int | 每页行数 |

---

## 7. 数据说明

### 7.1 数据来源

后端在启动时从以下路径加载 CSV（按优先级）：

1. `experiment2_database/encrypted_traffic_features.csv`（主数据集，7397 行）
2. `experiment2/encrypted_traffic_features.csv`（备用数据集，60 行）

两个文件都会加载并合并（见 `backend/csv_data.py` 第 16-30 行）。

### 7.2 CSV 关键字段

每条流记录约 27 个字段，以下为后端计算实际使用的字段：

| 字段名 | 含义 | 使用位置 |
|--------|------|----------|
| `label` | 流量类别标签：`common` / `proxy` / `vpn` | 所有 API |
| `protocol` | 传输层协议（TCP / UDP 等） | 协议分布、TLS |
| `total_packets` | 流中的总包数 | 全局统计、流分析、时间序列 |
| `total_bytes` | 流中的总字节数 | 全局统计、流分析 |
| `mean_pkt_len` | 平均包长度（字节） | 包大小分布 |
| `flow_duration` | 流持续时间（秒） | 流分析、数据表 |
| `iat_mean` | 平均包到达间隔（秒） | IAT CDF |
| `uplink_packet_count` | 上行包数 | 数据表（映射为 src_port） |
| `downlink_packet_count` | 下行包数 | 数据表（映射为 dst_port） |
| `source_file` | 来源 pcap 文件名 | 数据表（映射为 src_ip） |

### 7.3 三类标签含义

| 标签 | 含义 | 采集方式 |
|------|------|----------|
| `common` | 普通直连流量 | `tcpdump -i eth0`（物理网卡） |
| `proxy` | 代理流量（SSR/VMess/Trojan/SS） | `tcpdump -i tun0`（代理虚拟接口） |
| `vpn` | VPN 加密隧道流量 | `tcpdump -i utun0`（OpenVPN 接口） |

---

## 8. 部署指南

### 8.1 方式一：直接部署

适用于目标机器已有 Python 3 和 Node.js 的情况。

```bash
# 1. 克隆项目
git clone <仓库地址> /opt/VPN_pcap_webtest
cd /opt/VPN_pcap_webtest

# 2. 安装 Python 依赖（已配置清华镜像源）
pip install -r backend/requirements.txt

# 3. 安装前端依赖 + 构建（已配置 npmmirror）
cd frontend
npm install
npm run build
cd ..

# 4. 启动
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8001
```

**如果系统 Python 受保护（externally-managed-environment）：**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

**目标机器不需要 Node.js 的部署方式：**

在开发机上先执行 `npm run build` 产出 `frontend/dist/`，然后将整个项目目录（含 `dist/`）打包拷贝到目标机器。目标机器只需要 Python 3：

```bash
# 开发机
cd VPN_pcap_webtest/frontend
npm install && npm run build
cd ..
tar czf pcap-analyzer.tar.gz backend/ frontend/dist/ experiment2/ experiment2_database/ run.sh pip.conf

# 目标机
tar xzf pcap-analyzer.tar.gz
pip install -r backend/requirements.txt
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8001
```

### 8.2 方式二：Docker

创建 `Dockerfile`（项目根目录）：

```dockerfile
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --registry=https://registry.npmmirror.com
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY backend/ ./backend/
COPY experiment2/ ./experiment2/
COPY experiment2_database/ ./experiment2_database/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
EXPOSE 8001
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

```bash
docker build -t pcap-analyzer .
docker run -d -p 8001:8001 --name pcap-analyzer pcap-analyzer
```

如果 `experiment2_database/` 太大不想打进镜像（~583MB），用数据卷挂载：

```bash
docker run -d -p 8001:8001 \
  -v /data/experiment2:/app/experiment2:ro \
  -v /data/experiment2_database:/app/experiment2_database:ro \
  --name pcap-analyzer pcap-analyzer
```

### 8.3 方式三：docker-compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  pcap-analyzer:
    build: .
    ports:
      - "8001:8001"
    volumes:
      - ./experiment2:/app/experiment2:ro
      - ./experiment2_database:/app/experiment2_database:ro
    restart: unless-stopped
```

```bash
docker-compose up -d
```

---

## 9. 常见问题

### 9.1 pip install 报 `externally-managed-environment`

**原因：** Debian/Ubuntu 新版 Python 默认禁止 `pip install` 到系统 Python。

**解决：**
```bash
# 方案 A：使用虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# 方案 B：强制安装（不推荐，但脚本默认使用此方式）
pip install --break-system-packages -r backend/requirements.txt
```

### 9.2 pip install 报 `Could not find a version that satisfies the requirement scapy`

**原因：** 部分 ARM 架构或 musl libc 环境预编译包不兼容。

**解决：**
```bash
apt install libpcap-dev    # Debian/Ubuntu
yum install libpcap-devel  # CentOS/RHEL
# 然后重试 pip install
```

### 9.3 启动报 `Address already in use`

**原因：** 8001 端口被占用。

**解决：**
```bash
# 查看占用进程
fuser 8001/tcp
# 杀死占用进程
fuser -k 8001/tcp
# 或换端口
PORT=9000 bash run.sh
```

### 9.4 前端页面空白/404

**原因：** `frontend/dist/` 不存在（未构建）。

**解决：**
```bash
cd frontend
npm install
npm run build
# 确认 dist/ 目录已生成
ls -la dist/
```

### 9.5 数据为空（API 返回 0 行）

**原因：** CSV 文件路径不匹配。后端在 `backend/csv_data.py:16-19` 中硬编码了相对路径，必须从项目根目录启动。

**解决：** 确保从项目根目录启动服务：
```bash
cd /path/to/VPN_pcap_webtest
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8001
```

### 9.6 npm install 速度慢

**解决：** 项目已配置镜像源：
- `frontend/.npmrc` 中设定了 `registry=https://registry.npmmirror.com`
- 若需手动指定：`npm install --registry=https://registry.npmmirror.com`

### 9.7 TypeScript 编译报错

**原因：** 常见于 Node.js 版本过低（Vite 6.x 要求 Node 18+）。

**解决：**
```bash
node --version  # 确认 ≥ 18
# 如版本过低，用 nvm 切换
nvm install 18
nvm use 18
```

### 9.8 API 返回 404

**原因：** 前端路由在浏览器刷新时可能触发 SPA 404。

**说明：** 后端已做 SPA fallback（`backend/main.py:121-126`），任何不匹配静态文件的路径都会返回 `index.html`。如果仍遇到 404，检查 `frontend/dist/` 是否存在。
