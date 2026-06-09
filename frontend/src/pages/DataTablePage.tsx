import { useState } from 'react';
import InsightCard from '../components/InsightCard';
import { usePacketTable } from '../hooks/useAnalysis';
import { TRAFFIC_TYPES, TRAFFIC_LABELS } from '../types';

export default function DataTablePage() {
  const [category, setCategory] = useState('common');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = usePacketTable(category, page, pageSize);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">📋 详细数据表</h2>
      <InsightCard items={[
        { label: 'Common', content: '覆盖 20 个网站的正常访问流量（占比最高），IP 地址直接对应目标服务器，包长和 IAT 分布稳定。' },
        { label: 'Proxy', content: '包含 SSR/VMess/Trojan/SS 四种代理类型，源 IP 多为代理服务器地址，加密特征明显。' },
        { label: 'VPN', content: '单流包密度最高、IAT 极短，所有 IP 均为 VPN 隧道内网地址（10.8.x.x），外部不可见真实通信端点。' },
      ]} />
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center gap-4">
          <span className="text-sm text-slate-500">类别:</span>
          {TRAFFIC_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => { setCategory(t); setPage(1); }}
              className={`px-3 py-1 rounded text-sm ${
                category === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {TRAFFIC_LABELS[t]}
            </button>
          ))}
        </div>
        {isLoading || !data ? (
          <div className="p-8 text-center text-slate-400">加载中...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-2 px-3">时间戳</th>
                    <th className="text-left py-2 px-3">源 IP</th>
                    <th className="text-left py-2 px-3">目的 IP</th>
                    <th className="text-right py-2 px-3">源端口</th>
                    <th className="text-right py-2 px-3">目的端口</th>
                    <th className="text-center py-2 px-3">协议</th>
                    <th className="text-right py-2 px-3">长度</th>
                    <th className="text-left py-2 px-3">信息</th>
                  </tr>
                </thead>
                <tbody>
                  {data.packets.map((p, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-mono text-xs">{new Date(p.timestamp * 1000).toISOString().substring(11, 23)}</td>
                      <td className="py-1.5 px-3 font-mono text-xs">{p.src_ip}</td>
                      <td className="py-1.5 px-3 font-mono text-xs">{p.dst_ip}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs">{p.src_port}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs">{p.dst_port}</td>
                      <td className="py-1.5 px-3 text-center text-xs">{p.protocol}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs">{p.length}</td>
                      <td className="py-1.5 px-3 text-xs max-w-60 truncate">{p.info}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex items-center justify-between">
              <span className="text-sm text-slate-500">
                共 {data.total.toLocaleString()} 条，第 {data.page}/{Math.ceil(data.total / data.size)} 页
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * pageSize >= data.total}
                  className="px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
