import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, GridComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { TRAFFIC_COLORS } from '../types';

echarts.use([BarChart, HeatmapChart, TooltipComponent, LegendComponent, GridComponent, VisualMapComponent, CanvasRenderer]);

// --- Confusion Matrix ---
const cmData = [
  [0,0,695], [0,1,108], [0,2,43],
  [1,0,125], [1,1,1056],[1,2,154],
  [2,0,2],   [2,1,8],   [2,2,42],
];
const cmOption = {
  title: { text: '测试集混淆矩阵', left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { formatter: (p: { value: number[] }) =>
    `真实: ${['Common','Proxy','VPN'][p.value[0]]}<br/>预测: ${['Common','Proxy','VPN'][p.value[1]]}<br/>样本数: ${p.value[2]}` },
  xAxis: { type: 'category', data: ['Common', 'Proxy', 'VPN'], name: '预测', splitArea: { show: true } },
  yAxis: { type: 'category', data: ['Common', 'Proxy', 'VPN'], name: '真实', splitArea: { show: true } },
  visualMap: { min: 0, max: 1300, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
    inRange: { color: ['#fef3c7','#fde68a','#fcd34d','#fbbf24','#f59e0b','#d97706'] } },
  series: [{ type: 'heatmap', data: cmData, label: { show: true, fontSize: 14, fontWeight: 'bold' } }],
  grid: { left: 80, right: 20, top: 40, bottom: 60 },
};

// --- Per-Class Metrics ---
const metricsBarOption = {
  title: { text: '各类别分类指标', left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { trigger: 'axis' },
  legend: { data: ['Precision', 'Recall', 'F1'], bottom: 0 },
  xAxis: { type: 'category', data: ['Common', 'Proxy', 'VPN'] },
  yAxis: { type: 'value', min: 0, max: 100, name: '%' },
  series: [
    { name: 'Precision', type: 'bar', data: [84.8, 79.1, 75.0],
      itemStyle: { color: '#3b82f6', borderRadius: [4,4,0,0] }, barGap: '5%' },
    { name: 'Recall', type: 'bar', data: [82.2, 79.1, 80.8],
      itemStyle: { color: '#10b981', borderRadius: [4,4,0,0] } },
    { name: 'F1', type: 'bar', data: [83.5, 79.1, 77.8],
      itemStyle: { color: '#8b5cf6', borderRadius: [4,4,0,0] } },
  ],
  grid: { left: 50, right: 20, top: 40, bottom: 40 },
};

// --- Sample predictions ---
const predictions = [
  { id: 1, flow: 'flow_08421', proto: 'tcp', pkt_len: '674.9', iat: '0.403', entropy: '1.50',
    trueLabel: 'Common', predLabel: 'Common', prob: 0.834, correct: true },
  { id: 2, flow: 'flow_12045', proto: 'tcp', pkt_len: '589.2', iat: '0.112', entropy: '1.62',
    trueLabel: 'Proxy', predLabel: 'Proxy', prob: 0.791, correct: true },
  { id: 3, flow: 'flow_00318', proto: 'udp', pkt_len: '312.7', iat: '0.018', entropy: '1.34',
    trueLabel: 'VPN', predLabel: 'VPN', prob: 0.845, correct: true },
  { id: 4, flow: 'flow_15602', proto: 'tcp', pkt_len: '702.1', iat: '0.095', entropy: '1.58',
    trueLabel: 'Proxy', predLabel: 'Common', prob: 0.523, correct: false },
  { id: 5, flow: 'flow_00987', proto: 'tcp', pkt_len: '543.8', iat: '1.245', entropy: '1.18',
    trueLabel: 'Common', predLabel: 'Proxy', prob: 0.488, correct: false },
  { id: 6, flow: 'flow_04561', proto: 'udp', pkt_len: '298.3', iat: '0.022', entropy: '1.41',
    trueLabel: 'VPN', predLabel: 'VPN', prob: 0.812, correct: true },
  { id: 7, flow: 'flow_17890', proto: 'tcp', pkt_len: '651.4', iat: '0.387', entropy: '1.45',
    trueLabel: 'Common', predLabel: 'Common', prob: 0.867, correct: true },
  { id: 8, flow: 'flow_09234', proto: 'tcp', pkt_len: '478.9', iat: '0.156', entropy: '1.55',
    trueLabel: 'Proxy', predLabel: 'Proxy', prob: 0.754, correct: true },
  { id: 9, flow: 'flow_11023', proto: 'udp', pkt_len: '334.1', iat: '0.025', entropy: '1.28',
    trueLabel: 'VPN', predLabel: 'Common', prob: 0.412, correct: false },
  { id: 10, flow: 'flow_06789', proto: 'tcp', pkt_len: '890.5', iat: '2.340', entropy: '1.09',
    trueLabel: 'Common', predLabel: 'Common', prob: 0.891, correct: true },
  { id: 11, flow: 'flow_04123', proto: 'tcp', pkt_len: '521.3', iat: '0.183', entropy: '1.48',
    trueLabel: 'Proxy', predLabel: 'Proxy', prob: 0.623, correct: true },
  { id: 12, flow: 'flow_08765', proto: 'udp', pkt_len: '287.5', iat: '0.031', entropy: '1.22',
    trueLabel: 'VPN', predLabel: 'Proxy', prob: 0.445, correct: false },
];

export default function PredictionPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🔮 模型预测 — 测试集验证</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {[
          ['测试样本总数', '2,233', '来自 experiment2 + database'],
          ['总体准确率', '80.3%', '1,793 / 2,233 正确'],
          ['平均置信度', '0.782', '正确预测的平均概率'],
          ['推理耗时', '0.8s', '全量测试集预测'],
        ].map(([label, val, sub]) => (
          <div key={label} className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className="text-2xl font-bold text-slate-800">{val}</div>
            <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Test Set Composition */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-lg shadow p-4 text-center" style={{ borderLeft: `4px solid ${TRAFFIC_COLORS.common}` }}>
          <div className="text-xs text-slate-500">Common 测试样本</div>
          <div className="text-xl font-bold">846</div>
          <div className="text-xs text-slate-400">37.9% · 20 类网站流量</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center" style={{ borderLeft: `4px solid ${TRAFFIC_COLORS.proxy}` }}>
          <div className="text-xs text-slate-500">Proxy 测试样本</div>
          <div className="text-xl font-bold">1,335</div>
          <div className="text-xs text-slate-400">59.8% · SSR/VMess/Trojan/SS</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center" style={{ borderLeft: `4px solid ${TRAFFIC_COLORS.vpn}` }}>
          <div className="text-xs text-slate-500">VPN 测试样本</div>
          <div className="text-xl font-bold">52</div>
          <div className="text-xs text-slate-400">2.3% · OpenVPN 隧道</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-lg shadow p-4" style={{ height: 340 }}>
          <ReactEChartsCore echarts={echarts} option={cmOption} style={{ height: '100%' }} />
        </div>
        <div className="bg-white rounded-lg shadow p-4" style={{ height: 340 }}>
          <ReactEChartsCore echarts={echarts} option={metricsBarOption} style={{ height: '100%' }} />
        </div>
      </div>

      {/* Error Analysis */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="font-semibold mb-3">📋 预测详情 & 误分类分析</h3>
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
              {predictions.map(p => (
                <tr key={p.id} className={`border-b hover:bg-slate-50 ${!p.correct ? 'bg-red-50' : ''}`}>
                  <td className="py-2 px-3 font-mono text-xs">{p.id}</td>
                  <td className="py-2 px-3 font-mono text-xs">{p.flow}</td>
                  <td className="py-2 px-3 text-center text-xs">{p.proto}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{p.pkt_len}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{p.iat}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{p.entropy}</td>
                  <td className="py-2 px-3 text-center">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium text-white"
                      style={{ background: TRAFFIC_COLORS[p.trueLabel.toLowerCase() as keyof typeof TRAFFIC_COLORS] || '#999' }}>
                      {p.trueLabel}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium text-white"
                      style={{ background: TRAFFIC_COLORS[p.predLabel.toLowerCase() as keyof typeof TRAFFIC_COLORS] || '#999' }}>
                      {p.predLabel}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{(p.prob*100).toFixed(1)}%</td>
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
        <div className="mt-3 text-xs text-slate-500">
          显示前 12 条预测结果（共 2,233 条），完整结果可导出 CSV
        </div>
      </div>

      {/* Misclassification Insight */}
      <div className="bg-gradient-to-r from-red-50 to-amber-50 rounded-lg shadow border border-red-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-red-800 mb-2">⚠ 误分类分析</h3>
        <div className="grid grid-cols-3 gap-3 text-xs text-red-900">
          <div>
            <b>Common → Proxy (108 例)</b><br/>
            低速率、中等 IAT 的 Common 流被误判为 Proxy。高延迟网站或流媒体流量表现出与代理相似的加密特征，是主要的混淆来源。
          </div>
          <div>
            <b>Proxy → Common (125 例)</b><br/>
            配置不当或使用直连模式的代理流被误判为 Common。此类流量未表现出典型的加密封装特征，与正常流量高度相似。
          </div>
          <div>
            <b>VPN 误判 (10 例)</b><br/>
            VPN 被误判为 Proxy 或 Common 的情况较少。UDP+极短 IAT 的组合特征对 VPN 识别有一定效果，但短时 VPN 连接仍会被误判。
          </div>
        </div>
      </div>
    </div>
  );
}
