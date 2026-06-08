import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTimeSeriesData } from '../../hooks/useAnalysis';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../../types';

echarts.use([LineChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

export default function TimeSeriesChart() {
  const { data, isLoading } = useTimeSeriesData();

  if (isLoading || !data) {
    return <div className="bg-white rounded-lg shadow p-4 h-80 flex items-center justify-center text-slate-400">加载中...</div>;
  }

  const cdfSeries = TRAFFIC_TYPES.map((type) => ({
    name: TRAFFIC_LABELS[type],
    type: 'line' as const,
    data: data.iat_cdf.map((p) => [p.interval, p[`${type}_cdf` as keyof typeof p]]),
    smooth: true,
    lineStyle: { color: TRAFFIC_COLORS[type], width: 2 },
    itemStyle: { color: TRAFFIC_COLORS[type] },
  }));

  const option = {
    title: { text: '到达间隔 CDF', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: TRAFFIC_TYPES.map((t) => TRAFFIC_LABELS[t]), bottom: 0 },
    xAxis: { type: 'value', name: '间隔 (秒)' },
    yAxis: { type: 'value', name: '累计概率', max: 1 },
    series: cdfSeries,
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 320 }} />
    </div>
  );
}
