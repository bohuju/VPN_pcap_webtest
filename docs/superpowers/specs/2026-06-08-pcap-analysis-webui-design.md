# Pcap 流量分析 WebUI 设计文档

**日期**: 2026-06-08  
**状态**: 已确认  
**目标**: 构建一个前端 Web 界面，展示对 Common/Proxy/VPN 三类网络流量包的全面数据分析和详细构成

---

## 1. 项目背景

项目目录下有两组实验数据：
- `experiment2/` — 按网站分组的对比流量包（common/proxy/vpn 各 20 个，覆盖同一组网站如 baidu、taobao、ietf 等）
- `experiment2_database/` — 按分类标签命名的流量包（common 含时间戳+class 标签，proxy 含代理类型 ssr/vmess/trojan/ss，vpn 含编号+少量命名文件）

前端不区分数据来源，统一按 Common/Proxy/VPN 三类展示分析结果。

---

## 2. 整体架构

```
浏览器 (React SPA) ←HTTP→ FastAPI 后端 ←scapy→ pcap 文件池
        ↕                        ↕
   10s 轮询/stats            watchdog 文件监控
   SWR 按需加载              LRU 内存缓存
```

- **后端**: FastAPI + scapy 实时解析 + LRU 内存缓存 + `watchdog` 监控文件变更
- **前端**: React 18 + TypeScript + ECharts + Tailwind CSS + Vite
- **通信**: RESTful JSON API，前端每 10s 轮询 `/api/stats`，详细分析按需请求（SWR）

---

## 3. 后端 API 设计

### 3.1 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 全局概览统计 — 三类流量文件数/总包数/总字节数/平均包大小，前端每 10s 轮询 |
| GET | `/api/analysis/protocol` | 协议分布 — TCP/UDP/HTTP/HTTPS/DNS/Other 按三类分别统计（百分比） |
| GET | `/api/analysis/packet-size` | 包大小分布 — 直方图 bins + 统计量(mean/min/max/std)，三类对比 |
| GET | `/api/analysis/flow` | 流特征 — 每流包数/字节数/持续时间，箱线图数据结构 |
| GET | `/api/analysis/time-series` | 时间序列 — 包速率时序、到达间隔分布 CDF |
| GET | `/api/analysis/tls` | TLS 特征 — 版本分布、SNI 列表、JA3 指纹 |
| GET | `/api/packets?type=&page=&size=` | 原始包数据表 — 分页查询，支持 type=common|proxy|vpn 过滤 |
| POST | `/api/upload` | 上传 pcap 文件，自动解析并加入对应分类池 |
| GET | `/api/health` | 健康检查，返回缓存状态 |

### 3.2 `/api/stats` 响应结构

```json
{
  "common":  { "file_count": 38, "total_packets": 284500, "total_bytes": 22345100, "avg_pkt_size": 78.5 },
  "proxy":   { "file_count": 38, "total_packets": 312800, "total_bytes": 28567800, "avg_pkt_size": 91.3 },
  "vpn":     { "file_count": 38, "total_packets": 98100,  "total_bytes": 3124500,  "avg_pkt_size": 31.8 },
  "last_updated": 1717856400
}
```

### 3.3 缓存策略

1. 首次 API 请求触发 scapy 解析，结果按 `(pcap_hash, analysis_dimension)` 缓存
2. LRU 内存缓存，避免重复解析
3. `watchdog` 监控 pcap 目录，检测到文件增删时主动更新 stats 缓存
4. POST `/api/upload` 成功后即时更新对应分类缓存
5. 前端轮询 `/api/stats` 间隔 10 秒（仅拉概览数据，轻量）

---

## 4. 前端设计

### 4.1 页面布局

```
┌─────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │   Sidebar    │  │  RefreshBar (状态 + 刷新按钮) │ │
│  │   (固定)     │  │                              │ │
│  │              │  │  ┌─────────┐ ┌─────────┐    │ │
│  │  分析维度导航 │  │  │ Common  │ │ Proxy   │ ... │ │
│  │              │  │  └─────────┘ └─────────┘    │ │
│  │  - 概览总览   │  │                              │ │
│  │  - 协议分布   │  │  ┌──────────┐ ┌──────────┐  │ │
│  │  - 包大小     │  │  │ 图表1    │ │ 图表2    │  │ │
│  │  - 流分析     │  │  └──────────┘ └──────────┘  │ │
│  │  - 时间序列   │  │  ┌──────────┐ ┌──────────┐  │ │
│  │  - TLS特征    │  │  │ 图表3    │ │ 图表4    │  │ │
│  │  - 数据表     │  │  └──────────┘ └──────────┘  │ │
│  │              │  │                              │ │
│  │  ┌──────────┐│  └──────────────────────────────┘ │
│  │  │ 上传入口 ││                                    │
│  │  └──────────┘│                                    │
│  └──────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

- **左侧固定侧边栏** (220px)：分析维度导航 + 三类流量文件计数 + 底部拖放上传区
- **顶部状态栏**：面包屑 + 上次更新时间 + 手动刷新按钮
- **右侧内容区**：滚动展示各分析维度图表

### 4.2 三色编码

| 类别 | 颜色 | Hex |
|------|------|-----|
| Common | 绿色 | `#4caf50` |
| Proxy | 橙色 | `#ff9800` |
| VPN | 红色 | `#f44336` |

### 4.3 路由设计

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | OverviewPage | 默认首页，概览总览（2×2 图表网格 + 统计卡片） |
| `/protocol` | ProtocolPage | 协议分布详情 |
| `/packet-size` | PacketSizePage | 包大小分析详情 |
| `/flow` | FlowPage | 流分析详情 |
| `/time-series` | TimeSeriesPage | 时间序列详情 |
| `/tls` | TlsPage | TLS 特征详情 |
| `/data-table` | DataTablePage | 原始包数据分页表格 |

### 4.4 组件树

```
App
├── Sidebar
│   ├── AnalysisNav        — 分析维度导航链接
│   ├── TrafficPool        — 三类流量文件数实时显示
│   └── UploadZone         — 拖放上传区（React DnD）
├── Dashboard (Routes)
│   ├── OverviewPage       — 概览：StatCards + 2×2 图表网格
│   ├── ProtocolPage       — 协议：堆叠柱状图 + 详细数据表
│   ├── PacketSizePage     — 包大小：直方图 + 统计量表
│   ├── FlowPage           — 流分析：箱线图 + 散点图
│   ├── TimeSeriesPage     — 时间序列：时序折线 + CDF 曲线
│   ├── TlsPage            — TLS：版本饼图 + JA3 表
│   └── DataTablePage      — 原始包数据：分页可筛选表格
└── RefreshBar             — 轮询状态 + 上次更新时间 + 手动刷新按钮
```

### 4.5 数据流

```
usePolling('/api/stats', 10000)   ← 自定义 Hook，全局共享
         ↓
   StatsContext                   ← React Context，全局注入
         ↓
   ├── Sidebar → TrafficPool     ← 消费 file_count
   ├── StatCards                 ← 消费概览数据
   ├── RefreshBar                ← 消费 last_updated
   └── 各分析页面                 ← useSWR('/api/analysis/xxx') 按需请求
```

### 4.6 技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| 框架 | React 18 + TypeScript | 组件化开发 |
| 路由 | React Router v6 | 客户端路由 |
| 图表 | ECharts (echarts-for-react) | 高性能图表渲染 |
| 数据请求 | SWR | 缓存、重试、去重、revalidate |
| 拖放 | React DnD | 上传区拖放 |
| 样式 | Tailwind CSS | 原子化 CSS，适合高密度信息布局 |
| 构建 | Vite | 快速开发构建 |

### 4.7 概览页图表规格

概览页（`/`）以 2×2 网格展示 4 个核心对比图表：

1. **协议分布对比** — 分组柱状图，X 轴=协议类型，分组=Common/Proxy/VPN
2. **包大小分布** — 三条半透明密度曲线叠加，X 轴=包大小(bins)，Y 轴=频率
3. **流特征对比** — 三组箱线图并排，X 轴=指标(每流包数/字节数/持续时长)，分组=三类
4. **到达间隔 CDF** — 三条 CDF 曲线叠加，X 轴=间隔时间，Y 轴=累计概率

每个图表都在同一坐标系中叠加三类数据，差异一目了然。

---

## 5. 上传池功能

1. 侧边栏底部固定上传区，支持拖放和点击选择
2. 上传时前端发送 `POST /api/upload` (multipart/form-data)
3. 后端：
   - 保存文件到 pcap 池目录
   - 扫描文件名关键字（`common`/`proxy`/`vpn`）自动分类；无法识别时提示用户选择
   - scapy 解析后加入对应分类的统计缓存
4. 前端：上传成功后概览数据即时更新（stats 缓存被标记失效，下次轮询拉取新数据）

---

## 6. 开发 & 部署

- 前端开发服务器：Vite dev server (`localhost:5173`)，通过 proxy 转发 API 到后端
- 后端开发服务器：FastAPI uvicorn (`localhost:8000`)
- 生产部署：前端 `vite build` 静态文件由 FastAPI 直接 serve，单进程部署
- pcap 池目录：通过环境变量 `PCAP_POOL_DIR` 配置，默认为项目下的 `pcap_pool/`

---

## 7. 非功能需求

- 大文件处理：超过 50MB 的 pcap 首次解析可能需 5-10 秒，前端显示 loading 状态
- 错误处理：解析失败的 pcap 记录错误日志，前端显示警告但不阻塞
- 并发：前端轮询 + 手动刷新去重（SWR dedup），避免重复请求
- 浏览器兼容：支持 Chrome/Firefox/Edge 最新两个版本
