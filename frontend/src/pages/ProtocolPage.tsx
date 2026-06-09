import InsightCard from '../components/InsightCard';
import ProtocolChart from '../components/charts/ProtocolChart';

export default function ProtocolPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🌐 协议分布详情</h2>
      <InsightCard items={[
        { label: 'Common', content: '以 TCP 为主（95%），承载 HTTP/HTTPS 等标准应用层协议，UDP 仅用于少量 DNS 查询。' },
        { label: 'Proxy', content: 'TCP 占比更高（97%），代理协议（SSR/VMess/Trojan）均基于 TCP 传输，UDP 占比极低。' },
        { label: 'VPN', content: '以 UDP 为主（83%），OpenVPN 默认使用 UDP 隧道封装所有流量，TCP 仅在 fallback 模式下出现。' },
      ]} />
      <div className="max-w-4xl">
        <ProtocolChart />
      </div>
    </div>
  );
}
