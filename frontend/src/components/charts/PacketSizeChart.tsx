import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { usePacketSizeData } from '../../hooks/useAnalysis';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../../types';

echarts.use([LineChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

export default function PacketSizeChart() {
  const { data, isLoading } = usePacketSizeData();

  if (isLoading || !data) {
    return <div className="bg-white rounded-lg shadow p-4 h-80 flex items-center justify-center text-slate-400">加载中...</div>;
  }

  const xData = data.bins.map((b) => `${b.bin_start}-${b.bin_end}`);

  const option = {
    title: { text: '包大小分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: TRAFFIC_TYPES.map((t) => TRAFFIC_LABELS[t]), bottom: 0 },
    xAxis: { type: 'category', data: xData, axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', name: '占比 (%)' },
    series: TRAFFIC_TYPES.map((type) => ({
      name: TRAFFIC_LABELS[type],
      type: 'line',
      data: data.bins.map((b) => b[type]),
      smooth: true,
      lineStyle: { color: TRAFFIC_COLORS[type], width: 2 },
      itemStyle: { color: TRAFFIC_COLORS[type] },
    })),
    grid: { left: 50, right: 20, top: 40, bottom: 60 },
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 320 }} />
    </div>
  );
}
