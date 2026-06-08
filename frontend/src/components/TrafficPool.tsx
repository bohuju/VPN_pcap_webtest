import { useStats } from '../context/StatsContext';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../types';

export default function TrafficPool() {
  const { stats } = useStats();

  return (
    <div className="mt-2 space-y-1.5">
      {TRAFFIC_TYPES.map((type) => (
        <div key={type} className="flex justify-between items-center px-2 py-1 rounded text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: TRAFFIC_COLORS[type] }}
            />
            {TRAFFIC_LABELS[type]}
          </span>
          <span className="text-slate-400 font-mono text-xs">
            {stats ? stats[type].file_count : '-'} 个
          </span>
        </div>
      ))}
    </div>
  );
}
