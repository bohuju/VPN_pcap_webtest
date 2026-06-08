import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTlsData } from '../hooks/useAnalysis';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../types';

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer]);

export default function TlsPage() {
  const { data, isLoading } = useTlsData();

  if (isLoading || !data) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">🔐 TLS 特征</h2>
        <div className="bg-white rounded-lg shadow p-4 h-60 flex items-center justify-center text-slate-400">加载中...</div>
      </div>
    );
  }

  const series = TRAFFIC_TYPES.map((type) => ({
    name: TRAFFIC_LABELS[type],
    type: 'pie' as const,
    radius: ['30%', '50%'],
    center: [type === 'common' ? '20%' : type === 'proxy' ? '50%' : '80%', '55%'],
    data: data.version_distribution[type].map((v) => ({ name: v.name, value: v.value })),
    label: { formatter: '{b}\n{d}%' },
    itemStyle: { color: TRAFFIC_COLORS[type] },
  }));

  const option = {
    title: { text: 'TLS / HTTPS 流量占比', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    series,
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🔐 TLS 特征</h2>
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <ReactEChartsCore echarts={echarts} option={option} style={{ height: 360 }} />
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3">HTTPS 包统计</h3>
        <table className="w-full text-sm border-collapse mt-2">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">类别</th>
              <th className="text-right py-2">HTTPS 包数</th>
            </tr>
          </thead>
          <tbody>
            {TRAFFIC_TYPES.map((type) => (
              <tr key={type} className="border-b">
                <td className="py-2 font-medium">{TRAFFIC_LABELS[type]}</td>
                <td className="text-right py-2">
                  {data.ja3_fingerprints[type]?.[0]?.count ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
