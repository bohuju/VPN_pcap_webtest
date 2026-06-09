import InsightCard from '../components/InsightCard';
import TimeSeriesChart from '../components/charts/TimeSeriesChart';

export default function TimeSeriesPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">⏱ 时间序列详情</h2>
      <InsightCard items={[
        { label: 'Common', content: 'IAT 中位数最长（1.0s），包到达间隔分布宽泛。用户交互驱动的流量，有明显空闲期和突发期。' },
        { label: 'Proxy', content: 'IAT 中位数 0.12s，显著短于 Common。代理协议维持长连接，有心跳和 keep-alive 机制，包间隔更均匀。' },
        { label: 'VPN', content: 'IAT 中位数仅 0.024s，包到达极为密集。VPN 隧道持续封装和传输，即使无应用数据也会发送控制/保活包。' },
      ]} />
      <div className="max-w-4xl">
        <TimeSeriesChart />
      </div>
    </div>
  );
}
