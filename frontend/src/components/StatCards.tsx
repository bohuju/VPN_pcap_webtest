import { useStats } from '../context/StatsContext';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../types';

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function StatCards() {
  const { stats, isLoading } = useStats();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-5 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-16 mb-2" />
            <div className="h-8 bg-slate-200 rounded w-12 mb-2" />
            <div className="h-3 bg-slate-200 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {TRAFFIC_TYPES.map((type) => {
        const s = stats[type];
        const color = TRAFFIC_COLORS[type];
        return (
          <div key={type} className="bg-white rounded-lg shadow p-5" style={{ borderTop: `3px solid ${color}` }}>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{TRAFFIC_LABELS[type]}</div>
            <div className="text-3xl font-bold mb-1">{s.file_count}</div>
            <div className="text-sm text-slate-500">
              {s.total_packets.toLocaleString()} 包 · {formatBytes(s.total_bytes)}
            </div>
            <div className="text-xs text-slate-400 mt-1">平均包大小: {s.avg_pkt_size} B</div>
          </div>
        );
      })}
    </div>
  );
}
