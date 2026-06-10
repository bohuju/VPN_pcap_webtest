import ReactECharts from 'echarts-for-react';
import { usePredictionSamples } from '../hooks/useAnalysis';
import { TRAFFIC_COLORS } from '../types';

const cmData: number[][] = [
  [0,0,13750], [0,1,680],  [0,2,70],
  [1,0,550],   [1,1,7970], [1,2,280],
  [2,0,15],    [2,1,40],   [2,2,1645],
];

const cmOption = {
  title: { text: '测试集混淆矩阵', left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { formatter: (p: { value: number[] }) =>
    `真实: ${['Common','Proxy','VPN'][p.value[0]]}<br/>预测: ${['Common','Proxy','VPN'][p.value[1]]}<br/>样本数: ${p.value[2]}` },
  xAxis: { type: 'category', data: ['Common', 'Proxy', 'VPN'], name: '预测', splitArea: { show: true } },
  yAxis: { type: 'category', data: ['Common', 'Proxy', 'VPN'], name: '真实', splitArea: { show: true } },
  visualMap: { min: 0, max: 14000, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
    inRange: { color: ['#fef3c7','#fde68a','#fcd34d','#fbbf24','#f59e0b','#d97706'] } },
  series: [{ type: 'heatmap', data: cmData, label: { show: true, fontSize: 14, fontWeight: 'bold' } }],
  grid: { left: 80, right: 20, top: 40, bottom: 60 },
};

const metricsBarOption = {
  title: { text: '各类别分类指标', left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { trigger: 'axis' },
  legend: { data: ['Precision', 'Recall', 'F1'], bottom: 0 },
  xAxis: { type: 'category', data: ['Common', 'Proxy', 'VPN'] },
  yAxis: { type: 'value', min: 0, max: 100, name: '%' },
  series: [
    { name: 'Precision', type: 'bar', data: [96.1, 91.7, 82.5],
      itemStyle: { color: '#3b82f6', borderRadius: [4,4,0,0] }, barGap: '5%' },
    { name: 'Recall', type: 'bar', data: [94.8, 90.6, 96.8],
      itemStyle: { color: '#10b981', borderRadius: [4,4,0,0] } },
    { name: 'F1', type: 'bar', data: [95.4, 91.1, 89.0],
      itemStyle: { color: '#8b5cf6', borderRadius: [4,4,0,0] } },
  ],
  grid: { left: 50, right: 20, top: 40, bottom: 40 },
};

export default function PredictionPage() {
  const { data: samples, isLoading } = usePredictionSamples();

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🔮 模型预测 — 测试集验证</h2>

      <div className="grid grid-cols-4 gap-4 mb-4">
        {[
          ['测试样本总数', '25,000', '5.3GB PCAP 真实采集'],
          ['总体准确率', '93.5%', '23,365 / 25,000 正确'],
          ['平均置信度', '0.847', '正确预测的平均概率'],
          ['推理耗时', '3.2s', '全量测试集预测'],
        ].map(([label, val, sub]) => (
          <div key={label} className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className="text-2xl font-bold text-slate-800">{val}</div>
            <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
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

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-lg shadow p-4" style={{ height: 340 }}>
          <ReactECharts option={cmOption} style={{ height: '100%' }} />
        </div>
        <div className="bg-white rounded-lg shadow p-4" style={{ height: 340 }}>
          <ReactECharts option={metricsBarOption} style={{ height: '100%' }} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="font-semibold mb-3">📋 预测详情 & 误分类分析</h3>
        {isLoading || !samples ? (
          <div className="p-8 text-center text-slate-400">加载中...</div>
        ) : (
          <>
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
                  {(samples as Array<Record<string, unknown>>).map((p, i) => (
                    <tr key={i} className={`border-b hover:bg-slate-50 ${!p.correct ? 'bg-red-50' : ''}`}>
                      <td className="py-2 px-3 font-mono text-xs">{p.id as number}</td>
                      <td className="py-2 px-3 font-mono text-xs">{p.flow as string}</td>
                      <td className="py-2 px-3 text-center text-xs">{p.proto as string}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{p.pkt_len as string}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{p.iat as string}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{p.entropy as string}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium text-white"
                          style={{ background: TRAFFIC_COLORS[(p.trueLabel as string).toLowerCase() as keyof typeof TRAFFIC_COLORS] || '#999' }}>
                          {p.trueLabel as string}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium text-white"
                          style={{ background: TRAFFIC_COLORS[(p.predLabel as string).toLowerCase() as keyof typeof TRAFFIC_COLORS] || '#999' }}>
                          {p.predLabel as string}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{((p.prob as number)*100).toFixed(1)}%</td>
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
              显示前 {(samples as unknown[]).length} 条预测结果（共 25,000 条），完整结果可导出 CSV
            </div>
          </>
        )}
      </div>

      <div className="bg-gradient-to-r from-red-50 to-amber-50 rounded-lg shadow border border-red-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-red-800 mb-2">⚠ 误分类分析</h3>
        <div className="grid grid-cols-3 gap-3 text-xs text-red-900">
          <div>
            <b>Common → Proxy (680 例)</b><br/>
            最主要的误分类方向。部分 Common 流量（大文件下载、视频流）表现为持续高吞吐、低 IAT，与 Proxy 的隧道行为特征重叠，是混淆的主要来源。
          </div>
          <div>
            <b>Proxy → Common (550 例)</b><br/>
            使用直连模式或弱加密配置的代理流被误判为 Common。此类流量未表现出典型的加密封装特征，包长分布与正常 HTTPS 流量高度相似。
          </div>
          <div>
            <b>VPN 相关误判 (55 例)</b><br/>
            VPN 误判率仅 3.2%（55/1,700），总体识别稳定。主要混淆发生在 VPN ↔ Proxy 之间（40+280 例），两者均为加密隧道，UDP 封装和极短 IAT 是区分关键特征。
          </div>
        </div>
      </div>
    </div>
  );
}
