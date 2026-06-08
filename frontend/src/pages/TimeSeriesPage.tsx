import TimeSeriesChart from '../components/charts/TimeSeriesChart';

export default function TimeSeriesPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">⏱ 时间序列详情</h2>
      <div className="max-w-4xl">
        <TimeSeriesChart />
      </div>
    </div>
  );
}
