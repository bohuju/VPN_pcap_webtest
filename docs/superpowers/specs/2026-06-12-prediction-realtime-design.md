# PredictionPage 实时抓包动态改造 — 设计文档

日期: 2026-06-12 | 状态: 已确认

## 目标

将 PredictionPage 从静态演示页改造为"实时在线抓包推理"动态演示页，凸显实时抓包效果。纯演示导向，不依赖真实 pcap 数据。

## 数据驱动机制

- 后端新增 `GET /api/capture-session`，维护全局递增计数器，模拟抓包会话状态
- 前端通过 SWR `refreshInterval: 2000` 高频轮询
- 按数据量阈值分阶段: 500 → 1000 → 2500 → 5000 → 10000 → 25000 个包
- 每到达一个阈值，所有图表/表格自动刷新重置

## 页面布局 (从上到下)

### 1. 动态统计卡片 (4列 grid)
- 📦 实时抓包计数 — 数字跳动递增，黄色脉冲到达阈值
- ⚡ 抓包速率 — 随机波动 800~1500 pkt/s
- 📊 阶段进度 — 进度条 + 当前阶段标签
- ⏱ 已运行时间 — 从页面打开开始计时

### 2. 动态图表区 (2列 grid)
- 实时协议分布流图 — ECharts 堆叠面积图，X轴=时间，Y轴=占比，三类流量随时间滚动
- 实时预测置信度分布 — ECharts 柱状图，按置信度区间(0-60%/60-80%/80-90%/90-100%)统计

### 3. 动态预测结果表
- 新记录从顶部插入，新行黄色高亮 1s 后 CSS transition 渐隐
- 列: #, 流标识, 协议, 包长, IAT, 真实/预测标签, 置信度, 结果
- 显示最近 20 条

### 4. 实时误分类监控
- 三列布局，动态累计各方向误分类计数
- Common→Proxy / Proxy→Common / VPN相关

## 技术栈

- React 18 + TypeScript + Tailwind CSS 3
- ECharts 5 (echarts-for-react) — 项目现有
- SWR 2 — 项目现有，启用 refreshInterval
- CSS animation/keyframes — 闪烁高亮、脉冲动画

## 后端改动

文件: `backend/main.py`
- 新增 `/api/capture-session` 端点
- 维护全局 `_capture_state` 字典，包含 counter, stage, start_time 等
- 每次调用递增 counter，模拟抓包进程

## 前端改动

文件: `frontend/src/pages/PredictionPage.tsx` — 重写
文件: `frontend/src/hooks/useAnalysis.ts` — 新增 `useCaptureSession()`
文件: `frontend/src/components/AnalysisNav.tsx` — 添加导航入口

## 风格约束

- 卡片: `bg-white rounded-lg shadow p-4`
- 布局: Tailwind grid (grid-cols-4, grid-cols-2, grid-cols-3)
- 颜色: TRAFFIC_COLORS (common=#4caf50, proxy=#ff9800, vpn=#f44336)
- 字体: text-xl font-bold 标题, text-xs text-slate-500 副文本
