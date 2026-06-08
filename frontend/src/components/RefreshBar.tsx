import { useStats } from '../context/StatsContext';

export default function RefreshBar() {
  const { isLoading, error, lastUpdated, refresh } = useStats();

  return (
    <div className="h-10 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : isLoading ? 'bg-yellow-500' : 'bg-green-500'}`} />
        <span>
          {error
            ? `错误: ${error}`
            : isLoading
            ? '加载中...'
            : `上次更新: ${lastUpdated?.toLocaleTimeString() ?? '-'}`}
        </span>
      </div>
      <button
        onClick={refresh}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        🔄 刷新
      </button>
    </div>
  );
}
