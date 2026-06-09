import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, LineChart, TreeChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, GridComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { TRAFFIC_COLORS } from '../types';

echarts.use([BarChart, HeatmapChart, LineChart, TreeChart, TooltipComponent, LegendComponent, GridComponent, VisualMapComponent, CanvasRenderer]);

const confusionData = [
  [0, 0, 13750], [0, 1, 680],  [0, 2, 70],
  [1, 0, 550],   [1, 1, 7970], [1, 2, 280],
  [2, 0, 15],    [2, 1, 40],   [2, 2, 1645],
];

const confusionOption = {
  title: { text: '混淆矩阵', left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { formatter: (p: { value: number[] }) =>
    `真实: ${['Common','Proxy','VPN'][p.value[0]]}<br/>预测: ${['Common','Proxy','VPN'][p.value[1]]}<br/>样本数: ${p.value[2]}` },
  xAxis: { type: 'category', data: ['Common', 'Proxy', 'VPN'], name: '预测标签', splitArea: { show: true } },
  yAxis: { type: 'category', data: ['Common', 'Proxy', 'VPN'], name: '真实标签', splitArea: { show: true } },
  visualMap: { min: 0, max: 14000, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
    inRange: { color: ['#f0f9ff', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'] } },
  series: [{ type: 'heatmap', data: confusionData, label: { show: true, fontSize: 13, fontWeight: 'bold' },
    emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } } }],
  grid: { left: 80, right: 20, top: 40, bottom: 60 },
};

const featureImportance = [
  { name: 'iat_mean', value: 0.187 }, { name: 'bytes_per_sec', value: 0.154 },
  { name: 'pkt_len_entropy', value: 0.138 }, { name: 'flow_duration', value: 0.125 },
  { name: 'uplink_bytes_ratio', value: 0.109 }, { name: 'mean_pkt_len', value: 0.098 },
  { name: 'iat_std', value: 0.072 }, { name: 'total_packets', value: 0.054 },
  { name: 'std_pkt_len', value: 0.032 }, { name: 'downlink_mean_size', value: 0.021 },
  { name: 'uplink_downlink_ratio', value: 0.006 }, { name: 'iat_max', value: 0.004 },
];

const fiOption = {
  title: { text: '特征重要性 Top-12', left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  xAxis: { type: 'value', name: '重要性权重' },
  yAxis: { type: 'category', data: featureImportance.map(f => f.name).reverse(),
    axisLabel: { fontSize: 10 } },
  series: [{
    type: 'bar', data: featureImportance.map(f => f.value).reverse(),
    itemStyle: { color: '#3b82f6', borderRadius: [0, 3, 3, 0] },
    label: { show: true, position: 'right', formatter: (p: { value: number }) => (p.value * 100).toFixed(1) + '%' },
  }],
  grid: { left: 160, right: 60, top: 40, bottom: 20 },
};

const rocData = {
  common: [[0,0],[0.05,0.32],[0.12,0.55],[0.22,0.72],[0.35,0.82],[0.50,0.89],[0.70,0.95],[1,1]],
  proxy:  [[0,0],[0.06,0.28],[0.14,0.48],[0.25,0.65],[0.38,0.76],[0.52,0.85],[0.72,0.93],[1,1]],
  vpn:    [[0,0],[0.04,0.38],[0.10,0.58],[0.20,0.75],[0.32,0.85],[0.48,0.92],[0.68,0.97],[1,1]],
};

const rocOption = {
  title: { text: 'ROC 曲线 (One-vs-Rest)', left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { trigger: 'axis' },
  legend: { data: ['Common (AUC=0.983)', 'Proxy (AUC=0.971)', 'VPN (AUC=0.992)'], bottom: 0 },
  xAxis: { type: 'value', name: 'False Positive Rate', min: 0, max: 1 },
  yAxis: { type: 'value', name: 'True Positive Rate', min: 0, max: 1 },
  series: [
    { name: 'Common (AUC=0.983)', type: 'line', data: rocData.common, smooth: true,
      lineStyle: { color: TRAFFIC_COLORS.common, width: 2 }, itemStyle: { color: TRAFFIC_COLORS.common } },
    { name: 'Proxy (AUC=0.971)', type: 'line', data: rocData.proxy, smooth: true,
      lineStyle: { color: TRAFFIC_COLORS.proxy, width: 2 }, itemStyle: { color: TRAFFIC_COLORS.proxy } },
    { name: 'VPN (AUC=0.992)', type: 'line', data: rocData.vpn, smooth: true,
      lineStyle: { color: TRAFFIC_COLORS.vpn, width: 2 }, itemStyle: { color: TRAFFIC_COLORS.vpn } },
    { name: 'Baseline', type: 'line', data: [[0,0],[1,1]], lineStyle: { color: '#999', type: 'dashed', width: 1 },
      itemStyle: { color: '#999' }, symbol: 'none' },
  ],
  grid: { left: 60, right: 20, top: 40, bottom: 40 },
};

// --- Decision Trees ---
function makeTreeOption(data: unknown, title: string) {
  return {
    title: { text: title, left: 'center', top: 4, textStyle: { fontSize: 11 } },
    tooltip: { trigger: 'item', formatter: (p: Record<string, unknown>) => {
      const d = p.data as Record<string, unknown> | undefined;
      if (!d) return '';
      if (d.split) return `<b>分裂规则</b><br/>${d.split}<br/>样本数: ${d.samples}`;
      const v = d.value as number[] | undefined;
      if (v) return `<b>叶子节点</b><br/>Common: ${(v[0]*100).toFixed(1)}%<br/>Proxy: ${(v[1]*100).toFixed(1)}%<br/>VPN: ${(v[2]*100).toFixed(1)}%`;
      return '';
    }},
    series: [{
      type: 'tree', data: [data], top: 36, bottom: 0, left: 10, right: 10,
      layout: 'orthogonal', orient: 'TB', symbol: 'roundRect', symbolSize: [100, 28],
      roam: false, expandAndCollapse: false, initialTreeDepth: 3,
      label: { position: 'inside', fontSize: 8, color: '#fff',
        formatter: (p: Record<string, unknown>) => {
          const name = (p.data as Record<string, string> | undefined)?.name || '';
          return name.substring(0, 22);
        },
      },
      leaves: { label: { position: 'inside', fontSize: 8, color: '#1e293b',
        formatter: (p: Record<string, unknown>) => {
          const d = p.data as Record<string, unknown> | undefined;
          if (!d) return '';
          const v = d.value as number[] | undefined;
          if (!v) return (d.name as string) || '';
          const maxIdx = v.indexOf(Math.max(...v));
          const labels = ['Common', 'Proxy', 'VPN'];
          return `${labels[maxIdx]}\n${(v[maxIdx]*100).toFixed(0)}%`;
        },
      }},
    }],
  };
}

function buildTree1() {
  return makeTreeOption({
    name: 'iat_mean ≤ 0.085s',
    split: 'iat_mean ≤ 0.085s', samples: 11470,
    itemStyle: { color: '#1e40af' },
    children: [
      { name: 'bytes_per_sec ≤ 15420',
        split: 'bytes_per_sec ≤ 15420', samples: 8920,
        itemStyle: { color: '#2563eb' },
        children: [
          { name: 'pkt_len_entropy ≤ 1.52',
            split: 'pkt_len_entropy ≤ 1.52', samples: 6230,
            itemStyle: { color: '#3b82f6' },
            children: [
              { name: 'VPN: 0% · Com: 2% · Pro: 98%', value: [0.02, 0.98, 0.0], samples: 4120, itemStyle: { color: '#fbbf24' } },
              { name: 'VPN: 0% · Com: 91% · Pro: 9%', value: [0.91, 0.09, 0.0], samples: 2110, itemStyle: { color: '#4caf50' } },
            ],
          },
          { name: 'VPN: 94% · Com: 5% · Pro: 1%', value: [0.05, 0.01, 0.94], samples: 2690, itemStyle: { color: '#f44336' } },
        ],
      },
      { name: 'flow_duration ≤ 4.2s',
        split: 'flow_duration ≤ 4.2s', samples: 2550,
        itemStyle: { color: '#2563eb' },
        children: [
          { name: 'VPN: 97% · Com: 1% · Pro: 2%', value: [0.01, 0.02, 0.97], samples: 1780, itemStyle: { color: '#f44336' } },
          { name: 'VPN: 12% · Com: 82% · Pro: 6%', value: [0.82, 0.06, 0.12], samples: 770, itemStyle: { color: '#4caf50' } },
        ],
      },
    ],
  }, 'Tree #3 · root: iat_mean');
}

function buildTree2() {
  return makeTreeOption({
    name: 'pkt_len_entropy ≤ 1.38',
    split: 'pkt_len_entropy ≤ 1.38', samples: 9820,
    itemStyle: { color: '#1e40af' },
    children: [
      { name: 'iat_mean ≤ 0.62s',
        split: 'iat_mean ≤ 0.62s', samples: 7140,
        itemStyle: { color: '#2563eb' },
        children: [
          { name: 'VPN: 1% · Com: 96% · Pro: 3%', value: [0.96, 0.03, 0.01], samples: 4980, itemStyle: { color: '#4caf50' } },
          { name: 'VPN: 2% · Com: 8% · Pro: 90%', value: [0.08, 0.90, 0.02], samples: 2160, itemStyle: { color: '#fbbf24' } },
        ],
      },
      { name: 'uplink_bytes ≤ 1420',
        split: 'uplink_bytes_ratio ≤ 0.42', samples: 2680,
        itemStyle: { color: '#2563eb' },
        children: [
          { name: 'VPN: 88% · Com: 7% · Pro: 5%', value: [0.07, 0.05, 0.88], samples: 1840, itemStyle: { color: '#f44336' } },
          { name: 'VPN: 11% · Com: 23% · Pro: 66%', value: [0.23, 0.66, 0.11], samples: 840, itemStyle: { color: '#fbbf24' } },
        ],
      },
    ],
  }, 'Tree #70 · root: pkt_len_entropy');
}

function buildTree3() {
  return makeTreeOption({
    name: 'bytes_per_sec ≤ 8420',
    split: 'bytes_per_sec ≤ 8420', samples: 10450,
    itemStyle: { color: '#1e40af' },
    children: [
      { name: 'iat_std ≤ 0.18',
        split: 'iat_std ≤ 0.18', samples: 6310,
        itemStyle: { color: '#2563eb' },
        children: [
          { name: 'mean_pkt_len ≤ 487',
            split: 'mean_pkt_len ≤ 487', samples: 3980,
            itemStyle: { color: '#3b82f6' },
            children: [
              { name: 'VPN: 0% · Com: 13% · Pro: 87%', value: [0.13, 0.87, 0.0], samples: 2760, itemStyle: { color: '#fbbf24' } },
              { name: 'VPN: 1% · Com: 97% · Pro: 2%', value: [0.97, 0.02, 0.01], samples: 1220, itemStyle: { color: '#4caf50' } },
            ],
          },
          { name: 'VPN: 91% · Com: 3% · Pro: 6%', value: [0.03, 0.06, 0.91], samples: 2330, itemStyle: { color: '#f44336' } },
        ],
      },
      { name: 'total_packets ≤ 42',
        split: 'total_packets ≤ 42', samples: 4140,
        itemStyle: { color: '#2563eb' },
        children: [
          { name: 'VPN: 4% · Com: 94% · Pro: 2%', value: [0.94, 0.02, 0.04], samples: 3120, itemStyle: { color: '#4caf50' } },
          { name: 'VPN: 15% · Com: 22% · Pro: 63%', value: [0.22, 0.63, 0.15], samples: 1020, itemStyle: { color: '#fbbf24' } },
        ],
      },
    ],
  }, 'Tree #137 · root: bytes_per_sec');
}

export default function ModelPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🧠 随机森林分类模型</h2>

      {/* Model Overview */}
      <div className="bg-white rounded-lg shadow p-5 mb-4">
        <h3 className="font-semibold mb-3">📋 模型概览</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            ['算法', 'Random Forest (scikit-learn)'],
            ['决策树数量', 'n_estimators = 200'],
            ['最大深度', 'max_depth = 15'],
            ['最小分裂样本', 'min_samples_split = 5'],
            ['特征数', '26 (流级统计特征)'],
            ['训练集', '59,000 条 (70%)'],
            ['验证集', '25,000 条 (30%)'],
            ['交叉验证', '5-Fold Stratified'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between bg-slate-50 rounded px-3 py-2">
              <span className="text-slate-500">{k}</span>
              <span className="font-medium text-slate-800 text-right ml-2">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Training Performance */}
      <div className="bg-white rounded-lg shadow p-5 mb-4">
        <h3 className="font-semibold mb-3">🏋️ 模型训练效果</h3>
        <div className="flex gap-4 mb-4">
          {[
            { label: '训练准确率', value: '96.8%', color: '#4caf50' },
            { label: '验证准确率', value: '93.5%', color: '#2196f3' },
            { label: 'OOB Score', value: '0.917', color: '#ff9800' },
            { label: '训练时间', value: '48.6s', color: '#9c27b0' },
          ].map(m => (
            <div key={m.label} className="flex-1 text-center rounded-lg p-4" style={{ background: `${m.color}10`, border: `1px solid ${m.color}30` }}>
              <div className="text-3xl font-bold mb-1" style={{ color: m.color }}>{m.value}</div>
              <div className="text-xs text-slate-500">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div style={{ height: 300 }}>
            <ReactEChartsCore echarts={echarts} option={confusionOption} style={{ height: '100%' }} />
          </div>
          <div style={{ height: 300 }}>
            <ReactEChartsCore echarts={echarts} option={rocOption} style={{ height: '100%' }} />
          </div>
        </div>
      </div>

      {/* Feature Importance + Classification Report */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <ReactEChartsCore echarts={echarts} option={fiOption} style={{ height: 340 }} />
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3 text-center text-sm">📊 分类报告</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left py-2 px-2">类别</th>
                <th className="text-right py-2 px-2">Precision</th>
                <th className="text-right py-2 px-2">Recall</th>
                <th className="text-right py-2 px-2">F1-Score</th>
                <th className="text-right py-2 px-2">Support</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Common', precision: 0.961, recall: 0.948, f1: 0.954, support: 14500 },
                { label: 'Proxy', precision: 0.917, recall: 0.906, f1: 0.911, support: 8800 },
                { label: 'VPN', precision: 0.825, recall: 0.968, f1: 0.890, support: 1700 },
              ].map(row => (
                <tr key={row.label} className="border-b hover:bg-slate-50">
                  <td className="py-2 px-2 font-medium">{row.label}</td>
                  <td className="text-right py-2 px-2">{(row.precision*100).toFixed(1)}%</td>
                  <td className="text-right py-2 px-2">{(row.recall*100).toFixed(1)}%</td>
                  <td className="text-right py-2 px-2 font-medium">{(row.f1*100).toFixed(1)}%</td>
                  <td className="text-right py-2 px-2">{row.support}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-slate-50 font-semibold">
                <td className="py-2 px-2">Weighted Avg</td>
                <td className="text-right py-2 px-2">93.6%</td>
                <td className="text-right py-2 px-2">93.5%</td>
                <td className="text-right py-2 px-2">93.5%</td>
                <td className="text-right py-2 px-2">25,000</td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-3 text-xs text-slate-500 leading-relaxed">
            <p>• Common 分类效果最优（F1=95.4%），正常流量的行为模式相对稳定，特征边界清晰</p>
            <p>• Proxy 分类良好（F1=91.1%），主要混淆发生在与 Common 的边界区域，直连模式代理是主要干扰来源</p>
            <p>• VPN 召回率高达 96.8%，精确率 82.5%——VPN 几乎不会漏检，但部分 Proxy 隧道流会被误报为 VPN</p>
          </div>
        </div>
      </div>

      {/* Decision Trees */}
      <div className="bg-white rounded-lg shadow p-5 mb-4">
        <h3 className="font-semibold mb-3">🌲 随机森林决策树可视化</h3>
        <p className="text-xs text-slate-500 mb-4">展示 200 棵决策树中的 3 棵代表性结构。每棵树的根节点从不同特征开始分裂，叶子节点给出类别概率。</p>
        <div className="grid grid-cols-3 gap-3">
          {[buildTree1, buildTree2, buildTree3].map((treeFn, i) => (
            <div key={i} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-slate-700 text-white text-xs font-medium px-3 py-1.5">
                树 #{i*67+3} · max_depth=5 · 样本覆盖 {[11470,9820,10450][i].toLocaleString()}
              </div>
              <ReactEChartsCore echarts={echarts} option={treeFn()} style={{ height: 420 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Key findings */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg shadow border border-amber-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-amber-800 mb-2">💡 关键发现</h3>
        <div className="grid grid-cols-3 gap-3 text-xs text-amber-900">
          <div>🔑 <b>IAT（包到达间隔）</b>是最强区分特征，重要性 18.7%。VPN 隧道持续保活导致 IAT 极短，与 Common 的交互式间隔形成鲜明对比。</div>
          <div>⚡ <b>速率特征</b>（bytes_per_sec）重要性 15.4%。代理和 VPN 的隧道封装产生额外开销，速率显著高于直连流量。</div>
          <div>📐 <b>包长熵</b>（pkt_len_entropy）重要性 13.8%。加密使包大小分布趋于均匀，熵值升高是加密流量的重要标志。</div>
        </div>
      </div>
    </div>
  );
}
