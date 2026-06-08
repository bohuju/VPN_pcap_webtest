import FlowChart from '../components/charts/FlowChart';

export default function FlowPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🌊 流/会话分析详情</h2>
      <div className="max-w-4xl">
        <FlowChart />
      </div>
    </div>
  );
}
