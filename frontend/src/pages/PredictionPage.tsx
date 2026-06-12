import { useState, useEffect, useRef, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useCaptureSession } from '../hooks/useAnalysis';
import { TRAFFIC_COLORS } from '../types';
import type { CapturePrediction, ProtocolHistoryPoint, ConfidenceBin } from '../types';

// ── Stage labels ──
const STAGE_LABELS = ['初始采集', '数据累积', '特征提取', '模型预热', '稳定推理', '全量覆盖'];
const STAGE_THRESHOLDS = [500, 1000, 2500, 5000, 10000, 25000];

// ── Animated counter hook ──
function useAnimatedCounter(target: number, duration = 400) {
  const [display, setDisplay] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    const start = display;
    const diff = target - start;
    if (diff <= 0) { setDisplay(target); return; }
    const steps = Math.min(diff, 60);
    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step >= steps) { setDisplay(target); clearInterval(timer); }
      else { setDisplay(Math.round(start + (diff * step) / steps)); }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return display;
}

// ── Elapsed time formatter ──
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Protocol area chart option builder ──
function buildProtocolAreaOption(history: ProtocolHistoryPoint[]): object {
  const times = history.map(p => `${p.time}s`);
  return {
    title: { text: '实时协议分布流图', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['Common', 'Proxy', 'VPN'], bottom: 0 },
    xAxis: { type: 'category', data: times, boundaryGap: false },
    yAxis: { type: 'value', name: '包数' },
    series: [
      {
        name: 'Common', type: 'line', stack: 'total', areaStyle: {},
        data: history.map(p => p.common),
        itemStyle: { color: TRAFFIC_COLORS.common },
        smooth: true, symbol: 'none',
      },
      {
        name: 'Proxy', type: 'line', stack: 'total', areaStyle: {},
        data: history.map(p => p.proxy),
        itemStyle: { color: TRAFFIC_COLORS.proxy },
        smooth: true, symbol: 'none',
      },
      {
        name: 'VPN', type: 'line', stack: 'total', areaStyle: {},
        data: history.map(p => p.vpn),
        itemStyle: { color: TRAFFIC_COLORS.vpn },
        smooth: true, symbol: 'none',
      },
    ],
    grid: { left: 50, right: 20, top: 40, bottom: 40 },
  };
}

// ── Confidence bar chart option builder ──
function buildConfidenceBarOption(bins: ConfidenceBin[]): object {
  return {
    title: { text: '预测置信度分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: bins.map(b => b.range) },
    yAxis: { type: 'value', name: '样本数' },
    series: [{
      type: 'bar',
      data: bins.map((b, i) => ({
        value: b.count,
        itemStyle: {
          color: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][i],
          borderRadius: [4, 4, 0, 0],
        },
      })),
      barWidth: '50%',
    }],
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
  };
}

// ── Confusion matrix (static reference) ──
const cmData: number[][] = [
  [0,0,13750], [0,1,680],  [0,2,70],
  [1,0,550],   [1,1,7970], [1,2,280],
  [2,0,15],    [2,1,40],   [2,2,1645],
];

const cmOption = {
  title: { text: '测试集混淆矩阵 (基准)', left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { formatter: (p: { value: number[] }) =>
    `真实: ${['Common','Proxy','VPN'][p.value[0]]}<br/>预测: ${['Common','Proxy','VPN'][p.value[1]]}<br/>样本数: ${p.value[2]}` },
  xAxis: { type: 'category', data: ['Common', 'Proxy', 'VPN'], name: '预测', splitArea: { show: true } },
  yAxis: { type: 'category', data: ['Common', 'Proxy', 'VPN'], name: '真实', splitArea: { show: true } },
  visualMap: { min: 0, max: 14000, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
    inRange: { color: ['#fef3c7','#fde68a','#fcd34d','#fbbf24','#f59e0b','#d97706'] } },
  series: [{ type: 'heatmap', data: cmData, label: { show: true, fontSize: 14, fontWeight: 'bold' } }],
  grid: { left: 80, right: 20, top: 40, bottom: 60 },
};

// ── Metrics bar chart (static reference) ──
const metricsBarOption = {
  title: { text: '各类别分类指标 (基准)', left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { trigger: 'axis' },
  legend: { data: ['Precision', 'Recall', 'F1'], bottom: 0 },
  xAxis: { type: 'category', data: ['Common', 'Proxy', 'VPN'] },
  yAxis: { type: 'value', min: 0, max: 100, name: '%' },
  series: [
    { name: 'Precision', type: 'bar', data: [96.1, 91.7, 82.5], itemStyle: { color: '#3b82f6', borderRadius: [4,4,0,0] }, barGap: '5%' },
    { name: 'Recall', type: 'bar', data: [94.8, 90.6, 96.8], itemStyle: { color: '#10b981', borderRadius: [4,4,0,0] } },
    { name: 'F1', type: 'bar', data: [95.4, 91.1, 89.0], itemStyle: { color: '#8b5cf6', borderRadius: [4,4,0,0] } },
  ],
  grid: { left: 50, right: 20, top: 40, bottom: 40 },
};

// ── Main component ──
export default function PredictionPage() {
  const { data: session, isLoading } = useCaptureSession();
  const animatedCount = useAnimatedCounter(session?.total_packets ?? 0);

  // Local elapsed timer (ticks every second for smooth display)
  const [localElapsed, setLocalElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalElapsed(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync local elapsed with server elapsed when stage advances
  useEffect(() => {
    if (session?.elapsed_seconds !== undefined) {
      setLocalElapsed(session.elapsed_seconds);
    }
  }, [session?.stage_advanced]);

  // Track new prediction IDs for flash animation
  const [flashingIds, setFlashingIds] = useState<Set<number>>(new Set());
  const prevPredictionIds = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!session?.new_predictions?.length) return;
    const currentIds = new Set(session.new_predictions.map((p: CapturePrediction) => p.id));
    const newIds = new Set([...currentIds].filter(id => !prevPredictionIds.current.has(id)));
    if (newIds.size > 0) {
      setFlashingIds(newIds);
      const timer = setTimeout(() => setFlashingIds(new Set()), 1200);
      prevPredictionIds.current = currentIds;
      return () => clearTimeout(timer);
    }
  }, [session?.new_predictions]);

  // Build chart options (memoized)
  const protocolAreaOption = useCallback(
    () => buildProtocolAreaOption(session?.protocol_history ?? []),
    [session?.protocol_history]
  );
  const confidenceBarOption = useCallback(
    () => buildConfidenceBarOption(session?.confidence_distribution ?? []),
    [session?.confidence_distribution]
  );

  // Stage progress
  const currentStage = session?.current_stage ?? 0;
  const nextThreshold = session?.next_threshold ?? STAGE_THRESHOLDS[0];
  const prevThreshold = currentStage > 0 ? STAGE_THRESHOLDS[currentStage - 1] : 0;
  const stageProgress = Math.min(100, Math.round(
    ((session?.total_packets ?? 0) - prevThreshold) / (nextThreshold - prevThreshold) * 100
  ));
  const stageAdvanced = session?.stage_advanced;

  if (isLoading && !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 animate-pulse">⏳ 正在初始化抓包会话...</div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">🔮 实时流量预测 — 在线抓包推理</h2>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
          <span className="text-xs text-green-600 font-medium">抓包中</span>
        </div>
      </div>

      {/* ── Dynamic Stat Cards ── */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {/* Card 1: Total packets */}
        <div className="bg-white rounded-lg shadow p-4 text-center relative overflow-hidden">
          <div className="text-xs text-slate-500 mb-1">📦 实时抓包计数</div>
          <div className={`text-3xl font-bold text-slate-800 font-mono tabular-nums transition-colors ${
            stageAdvanced ? 'text-amber-600' : ''
          }`}>
            {animatedCount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            目标: {STAGE_THRESHOLDS[currentStage]?.toLocaleString() ?? '完成'}
          </div>
          {stageAdvanced && (
            <div className="absolute inset-0 bg-amber-400/10 animate-pulse pointer-events-none" />
          )}
        </div>

        {/* Card 2: Packet rate */}
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-slate-500 mb-1">⚡ 抓包速率</div>
          <div className="text-3xl font-bold text-blue-600 font-mono">
            {session?.packet_rate?.toLocaleString() ?? '—'}
            <span className="text-sm font-normal text-slate-400 ml-0.5">pkt/s</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {currentStage < STAGE_THRESHOLDS.length - 1 ? '持续加速中' : '全速采集'}
          </div>
        </div>

        {/* Card 3: Stage progress */}
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-slate-500 mb-1">📊 采集阶段</div>
          <div className={`text-xl font-bold mb-1.5 ${stageAdvanced ? 'text-amber-600' : 'text-slate-800'}`}>
            {STAGE_LABELS[currentStage]}
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                stageAdvanced ? 'bg-amber-400 animate-pulse' : 'bg-blue-500'
              }`}
              style={{ width: `${stageProgress}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {session?.total_packets?.toLocaleString() ?? 0} / {nextThreshold.toLocaleString()}
          </div>
        </div>

        {/* Card 4: Elapsed time */}
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-slate-500 mb-1">⏱ 已运行时间</div>
          <div className="text-3xl font-bold text-slate-800 font-mono">
            {formatElapsed(localElapsed)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            准确率: {session?.accuracy ?? '—'}%
          </div>
        </div>
      </div>

      {/* ── Real-time Charts ── */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-lg shadow p-4" style={{ height: 360 }}>
          <ReactECharts option={protocolAreaOption()} style={{ height: '100%' }} />
        </div>
        <div className="bg-white rounded-lg shadow p-4" style={{ height: 360 }}>
          <ReactECharts option={confidenceBarOption()} style={{ height: '100%' }} />
        </div>
      </div>

      {/* ── Real-time Prediction Table ── */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="font-semibold mb-3">🎯 实时预测结果 — 最近数据包</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left py-2 px-3">#</th>
                <th className="text-left py-2 px-3">流标识</th>
                <th className="text-center py-2 px-3">协议</th>
                <th className="text-right py-2 px-3">包长均值</th>
                <th className="text-right py-2 px-3">IAT (s)</th>
                <th className="text-right py-2 px-3">熵</th>
                <th className="text-center py-2 px-3">真实标签</th>
                <th className="text-center py-2 px-3">预测标签</th>
                <th className="text-right py-2 px-3">置信度</th>
                <th className="text-center py-2 px-3">结果</th>
              </tr>
            </thead>
            <tbody>
              {(session?.recent_predictions ?? []).slice().reverse().map((p: CapturePrediction) => (
                <tr
                  key={p.id}
                  className={`border-b hover:bg-slate-50 transition-colors ${
                    flashingIds.has(p.id) ? 'animate-flash-row' : ''
                  } ${!p.correct ? 'bg-red-50' : ''}`}
                >
                  <td className="py-2 px-3 font-mono text-xs">{p.id}</td>
                  <td className="py-2 px-3 font-mono text-xs">{p.flow}</td>
                  <td className="py-2 px-3 text-center text-xs">{p.proto}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{p.pkt_len}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{p.iat}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{p.entropy}</td>
                  <td className="py-2 px-3 text-center">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium text-white"
                      style={{ background: TRAFFIC_COLORS[(p.trueLabel as string).toLowerCase() as keyof typeof TRAFFIC_COLORS] || '#999' }}>
                      {p.trueLabel}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium text-white"
                      style={{ background: TRAFFIC_COLORS[(p.predLabel as string).toLowerCase() as keyof typeof TRAFFIC_COLORS] || '#999' }}>
                      {p.predLabel}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{(p.prob * 100).toFixed(1)}%</td>
                  <td className="py-2 px-3 text-center">
                    {p.correct
                      ? <span className="text-green-600 text-xs">✓</span>
                      : <span className="text-red-600 text-xs font-medium">✗</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!session?.recent_predictions?.length) && (
          <div className="p-8 text-center text-slate-400">等待抓包数据...</div>
        )}
        <div className="mt-3 text-xs text-slate-500">
          实时显示最近 20 条预测结果 · 新数据高亮闪烁 · 总抓包: {session?.total_packets?.toLocaleString() ?? 0} 个
        </div>
      </div>

      {/* ── Misclassification Panel ── */}
      <div className="bg-gradient-to-r from-red-50 to-amber-50 rounded-lg shadow border border-red-200 p-4 mb-4">
        <h3 className="text-sm font-semibold text-red-800 mb-3">⚠ 实时误分类监控</h3>
        <div className="grid grid-cols-3 gap-3 text-xs text-red-900">
          <div className="bg-white/60 rounded p-2">
            <b>Common → Proxy</b>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {session?.misclass?.common_to_proxy ?? 0}
            </div>
            <div className="text-red-700 mt-0.5">
              最常见混淆。大文件下载/视频流与代理隧道行为特征重叠。
            </div>
          </div>
          <div className="bg-white/60 rounded p-2">
            <b>Proxy → Common</b>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {session?.misclass?.proxy_to_common ?? 0}
            </div>
            <div className="text-red-700 mt-0.5">
              直连模式或弱加密代理流被误判，包长分布与正常 HTTPS 高度相似。
            </div>
          </div>
          <div className="bg-white/60 rounded p-2">
            <b>VPN 相关误判</b>
            <div className="text-2xl font-bold text-orange-600 mt-1">
              {session?.misclass?.vpn_related ?? 0}
            </div>
            <div className="text-red-700 mt-0.5">
              VPN ↔ Proxy 互相混淆，UDP 封装和极短 IAT 是区分关键。
            </div>
          </div>
        </div>
      </div>

      {/* ── Static Reference: Confusion Matrix & Metrics ── */}
      <div className="border-t border-slate-200 pt-4 mt-4">
        <h3 className="text-sm font-semibold text-slate-500 mb-3">📋 离线基准参考 (25,000 测试集)</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-lg shadow p-4" style={{ height: 340 }}>
            <ReactECharts option={cmOption} style={{ height: '100%' }} />
          </div>
          <div className="bg-white rounded-lg shadow p-4" style={{ height: 340 }}>
            <ReactECharts option={metricsBarOption} style={{ height: '100%' }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center" style={{ borderLeft: `4px solid ${TRAFFIC_COLORS.common}` }}>
            <div className="text-xs text-slate-500">Common 测试样本</div>
            <div className="text-xl font-bold">14,500</div>
            <div className="text-xs text-slate-400">58.0% · 20 类网站流量</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center" style={{ borderLeft: `4px solid ${TRAFFIC_COLORS.proxy}` }}>
            <div className="text-xs text-slate-500">Proxy 测试样本</div>
            <div className="text-xl font-bold">8,800</div>
            <div className="text-xs text-slate-400">35.2% · SSR/VMess/Trojan/SS</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center" style={{ borderLeft: `4px solid ${TRAFFIC_COLORS.vpn}` }}>
            <div className="text-xs text-slate-500">VPN 测试样本</div>
            <div className="text-xl font-bold">1,700</div>
            <div className="text-xs text-slate-400">6.8% · OpenVPN 隧道</div>
          </div>
        </div>
      </div>

      {/* ── Flash animation style ── */}
      <style>{`
        @keyframes flashRow {
          0%   { background-color: #fef3c7; }
          100% { background-color: transparent; }
        }
        .animate-flash-row {
          animation: flashRow 1.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
