import InsightCard from '../components/InsightCard';
import FlowChart from '../components/charts/FlowChart';

export default function FlowPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🌊 流/会话分析详情</h2>
      <InsightCard items={[
        { label: 'Common', content: '流数量少但每流数据量大，持续时间长。网页浏览、文件下载等行为产生少量长流。' },
        { label: 'Proxy', content: '流数量多，每条流包数适中。代理服务器维持大量并发连接，流复用和连接池机制产生中等密度流量。' },
        { label: 'VPN', content: '上行占比最高（61%），VPN 隧道双向对称传输，客户端上行数据量与服务端下行接近，隧道维持需要持续心跳。' },
      ]} />
      <div className="max-w-4xl">
        <FlowChart />
      </div>
    </div>
  );
}
