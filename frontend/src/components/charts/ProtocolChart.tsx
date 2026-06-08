import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useProtocolData } from '../../hooks/useAnalysis';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../../types';

echarts.use([BarChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

export default function ProtocolChart() {
  const { data, isLoading } = useProtocolData();

  if (isLoading || !data) {
    return <div className="bg-white rounded-lg shadow p-4 h-80 flex items-center justify-center text-slate-400">加载中...</div>;
  }

  const option = {
    title: { text: '协议分布对比', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: {
      data: TRAFFIC_TYPES.map((t) => TRAFFIC_LABELS[t]),
      bottom: 0,
    },
    xAxis: { type: 'category', data: data.categories },
    yAxis: { type: 'value', name: '占比 (%)' },
    series: TRAFFIC_TYPES.map((type) => ({
      name: TRAFFIC_LABELS[type],
      type: 'bar',
      data: data[type],
      itemStyle: { color: TRAFFIC_COLORS[type] },
      barGap: '10%',
    })),
    grid: { left: 50, right: 20, top: 40, bottom: 40 },
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 320 }} />
    </div>
  );
}
