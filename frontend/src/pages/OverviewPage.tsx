import StatCards from '../components/StatCards';
import ProtocolChart from '../components/charts/ProtocolChart';
import PacketSizeChart from '../components/charts/PacketSizeChart';
import FlowChart from '../components/charts/FlowChart';
import TimeSeriesChart from '../components/charts/TimeSeriesChart';

export default function OverviewPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">📈 概览总览</h2>
      <StatCards />
      <div className="grid grid-cols-2 gap-4">
        <ProtocolChart />
        <PacketSizeChart />
        <FlowChart />
        <TimeSeriesChart />
      </div>
    </div>
  );
}
