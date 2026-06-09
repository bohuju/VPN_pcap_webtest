import { TRAFFIC_COLORS } from '../types';

interface InsightCardProps {
  items: { label: string; content: string }[];
}

export default function InsightCard({ items }: InsightCardProps) {
  const colors: Record<string, string> = {
    Common: TRAFFIC_COLORS.common,
    Proxy: TRAFFIC_COLORS.proxy,
    VPN: TRAFFIC_COLORS.vpn,
  };

  return (
    <div className="bg-gradient-to-r from-slate-50 to-white rounded-lg shadow border border-slate-200 p-5 mb-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <span>🔍</span> 三类流量特征差异分析
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block shrink-0"
                style={{ backgroundColor: colors[item.label] || '#999' }}
              />
              <span className="text-xs font-medium text-slate-600">{item.label}</span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed pl-3.5">{item.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
