import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BoxplotChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useFlowData } from '../../hooks/useAnalysis';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../../types';

echarts.use([BoxplotChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

export default function FlowChart() {
  const { data, isLoading } = useFlowData();

  if (isLoading || !data) {
    return <div className="bg-white rounded-lg shadow p-4 h-80 flex items-center justify-center text-slate-400">加载中...</div>;
  }

  const categories = data.boxplot.map((b) => b.category);

  const series = TRAFFIC_TYPES.flatMap((type) => {
    const boxData = data.boxplot.map((bp, idx) => [idx, ...bp[type]]);
    return [{
      name: TRAFFIC_LABELS[type],
      type: 'boxplot',
      data: boxData,
      itemStyle: { color: TRAFFIC_COLORS[type], borderColor: TRAFFIC_COLORS[type] },
    }];
  });

  const option = {
    title: { text: '流特征对比 (箱线图)', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    legend: { data: TRAFFIC_TYPES.map((t) => TRAFFIC_LABELS[t]), bottom: 0 },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value', name: '值' },
    series,
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 320 }} />
    </div>
  );
}
