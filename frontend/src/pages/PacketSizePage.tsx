import InsightCard from '../components/InsightCard';
import PacketSizeChart from '../components/charts/PacketSizeChart';
import { usePacketSizeData } from '../hooks/useAnalysis';
import { TRAFFIC_TYPES, TRAFFIC_LABELS } from '../types';

export default function PacketSizePage() {
  const { data, isLoading } = usePacketSizeData();

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">📦 包大小分析详情</h2>
      <InsightCard items={[
        { label: 'Common', content: '包大小分布广泛（熵 1.29），包含 ACK 小包、MTU 满包等多种尺寸，反映正常应用行为。' },
        { label: 'Proxy', content: '包大小熵最高（1.48），代理加密封装后载荷更均匀，同时伴有大量控制信令包和重传。' },
        { label: 'VPN', content: '标准差较小，VPN 隧道使用固定大小的封装帧，包大小集中在 MTU 附近和少量心跳小包。' },
      ]} />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="col-span-2">
          <PacketSizeChart />
        </div>
      </div>
      {data && !isLoading && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3">统计量表</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">类别</th>
                <th className="text-right py-2">平均 (B)</th>
                <th className="text-right py-2">最小 (B)</th>
                <th className="text-right py-2">最大 (B)</th>
                <th className="text-right py-2">标准差</th>
              </tr>
            </thead>
            <tbody>
              {TRAFFIC_TYPES.map((type) => {
                const s = data.stats[type];
                return (
                  <tr key={type} className="border-b">
                    <td className="py-2 font-medium">{TRAFFIC_LABELS[type]}</td>
                    <td className="text-right py-2">{s.mean.toFixed(1)}</td>
                    <td className="text-right py-2">{s.min}</td>
                    <td className="text-right py-2">{s.max}</td>
                    <td className="text-right py-2">{s.std.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
