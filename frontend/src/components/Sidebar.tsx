import AnalysisNav from './AnalysisNav';
import TrafficPool from './TrafficPool';
import UploadZone from './UploadZone';

export default function Sidebar() {
  return (
    <aside className="w-[220px] bg-slate-800 text-slate-200 flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-bold text-white">🔬 流量分析</h1>
      </div>
      <div className="p-3 border-b border-slate-700">
        <span className="text-xs uppercase text-slate-400 tracking-wider">分析维度</span>
        <AnalysisNav />
      </div>
      <div className="p-3 border-b border-slate-700">
        <span className="text-xs uppercase text-slate-400 tracking-wider">流量池</span>
        <TrafficPool />
      </div>
      <div className="mt-auto p-3">
        <UploadZone />
      </div>
    </aside>
  );
}
