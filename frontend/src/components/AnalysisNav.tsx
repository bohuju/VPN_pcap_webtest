import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: '📈 概览总览', end: true },
  { to: '/protocol', label: '🌐 协议分布', end: false },
  { to: '/packet-size', label: '📦 包大小分析', end: false },
  { to: '/flow', label: '🌊 流/会话分析', end: false },
  { to: '/time-series', label: '⏱ 时间序列', end: false },
  { to: '/tls', label: '🔐 TLS 特征', end: false },
  { to: '/data-table', label: '📋 详细数据表', end: false },
];

export default function AnalysisNav() {
  return (
    <nav className="mt-2 flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `px-3 py-1.5 rounded text-sm transition-colors ${
              isActive
                ? 'bg-slate-700 text-white font-medium'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
