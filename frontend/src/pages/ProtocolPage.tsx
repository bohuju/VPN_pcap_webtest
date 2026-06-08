import ProtocolChart from '../components/charts/ProtocolChart';

export default function ProtocolPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🌐 协议分布详情</h2>
      <div className="max-w-4xl">
        <ProtocolChart />
      </div>
    </div>
  );
}
