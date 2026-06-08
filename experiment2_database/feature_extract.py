# feature_extract.py
import pandas as pd
import numpy as np
from scapy.all import rdpcap
from scapy.layers.inet import IP, TCP, UDP
import warnings
import glob
import os
warnings.filterwarnings('ignore')

def get_canonical_flow_key(pkt):
    """获取规范化的流键，将双向流量合并为同一流"""
    if pkt.haslayer(IP):
        src_ip = pkt[IP].src
        dst_ip = pkt[IP].dst
        
        # 获取端口（TCP或UDP）
        src_port = None
        dst_port = None
        proto = pkt[IP].proto
        
        if pkt.haslayer(TCP): # 普通加密与mitmproxy代理加密
            src_port = pkt[TCP].sport
            dst_port = pkt[TCP].dport
            proto = 6  # TCP协议号
        elif pkt.haslayer(UDP): # wireguard VPN加密
            src_port = pkt[UDP].sport
            dst_port = pkt[UDP].dport
            proto = 17  # UDP协议号
        
        if src_port is not None and dst_port is not None:
            # 规范化：将五元组按特定规则排序，使双向流量有相同的键
            # 我们按IP和端口的组合进行排序
            if (src_ip, src_port) <= (dst_ip, dst_port):
                canonical_key = (src_ip, src_port, dst_ip, dst_port, proto)
            else:
                canonical_key = (dst_ip, dst_port, src_ip, src_port, proto)
            return canonical_key
    
    return None

def extract_flow_features(packets):
    """从单个流的数据包列表中提取特征（支持TCP和UDP）"""
    if len(packets) < 4:  # 忽略非常短的流
        return None
    
    sizes = [len(p) for p in packets]
    times = [float(p.time) for p in packets] # 强制转换为float,避免typeerror
    # 区分上下行 (假设第一个包的源IP是客户端)
    # 上行（uplink）：源IP = 客户端IP 的包，即从客户端发往服务器的数据。
    client_ip = packets[0][IP].src
    is_uplink = [1 if p[IP].src == client_ip else 0 for p in packets]
    
    uplink_sizes = [s for s, ul in zip(sizes, is_uplink) if ul == 1]
    downlink_sizes = [s for s, ul in zip(sizes, is_uplink) if ul == 0]
    
    # 计算时间间隔
    if len(times) > 1:
        iats = np.diff(times)
    else:
        iats = [0]
        
    # 协议信息
    protocol = "unknown"
    if packets[0].haslayer(TCP):
        protocol = "tcp"
    elif packets[0].haslayer(UDP):
        protocol = "udp"
    
    # 特征字典
    features = {
        # 基本流特征
        'protocol': protocol,
        'flow_duration': times[-1] - times[0], # 流持续时间（最后一个包时间 - 第一个包时间）。
        'total_packets': len(packets), # 该流包含的总包数。
        'total_bytes': sum(sizes), # 总字节数
        'bytes_per_sec': sum(sizes) / (times[-1] - times[0]) if (times[-1] - times[0]) > 0 else 0, # 平均速率（总字节 / 持续时间）
        
        # 包长总体统计
        'mean_pkt_len': np.mean(sizes), # 平均包长
        'std_pkt_len': np.std(sizes), # 包长标准差
        'max_pkt_len': np.max(sizes), # 最大包长
        'min_pkt_len': np.min(sizes), # 最小包长
        
        # 前向（上行：客户端→服务器）包特征
        'uplink_packet_count': len(uplink_sizes), # 上行包数量
        'uplink_byte_count': sum(uplink_sizes) if uplink_sizes else 0, # 上行总字节
        'uplink_mean_size': np.mean(uplink_sizes) if uplink_sizes else 0, # 上行平均包长
        'uplink_std_size': np.std(uplink_sizes) if uplink_sizes else 0, # 上行包长标准差
        
        # 后向（下行：服务器→客户端）包特征
        'downlink_packet_count': len(downlink_sizes), # 下行包数量
        'downlink_byte_count': sum(downlink_sizes) if downlink_sizes else 0, # 下行总字节
        'downlink_mean_size': np.mean(downlink_sizes) if downlink_sizes else 0, # 下行平均包长
        'downlink_std_size': np.std(downlink_sizes) if downlink_sizes else 0,
        
        # 上下行比例特征
        'uplink_downlink_ratio': len(uplink_sizes) / len(downlink_sizes) if len(downlink_sizes) > 0 else 999,
        'uplink_bytes_ratio': sum(uplink_sizes) / sum(downlink_sizes) if sum(downlink_sizes) > 0 else 999,
        
        # 包到达时间间隔统计
        'iat_mean': np.mean(iats), # 间隔均值
        'iat_std': np.std(iats), # 间隔标准差
        'iat_max': np.max(iats) if len(iats) > 0 else 0, # 最大间隔
        
        # 包长序列特征（前10个包的长度，对加密识别非常关键）
        # 这类特征对识别加密协议非常重要，因为不同应用/协议的握手阶段包长模式差异显著。
        'first_10_pkts_len_mean': np.mean(sizes[:min(10, len(sizes))]), # 前10个包（若不足10则取全部）的平均包长
        'first_10_pkts_len_std': np.std(sizes[:min(10, len(sizes))]), # 前10个包长的标准差
        
        # 包大小分布特征
        'pkt_len_entropy': compute_entropy(sizes) if len(sizes) > 0 else 0,
    }
    return features

def compute_entropy(values):
    """计算值的熵（用于衡量包长分布的随机性）"""
    if len(values) == 0:
        return 0
    
    # 将值分组到bins中
    hist, _ = np.histogram(values, bins=10)
    hist = hist[hist > 0]
    probs = hist / np.sum(hist)
    return -np.sum(probs * np.log2(probs))


def pcap_to_features(pcap_file, label):
    """将单个PCAP文件转换为特征DataFrame（支持TCP和UDP）"""
    print(f"正在处理 {pcap_file} ...")
    
    try:
        packets = rdpcap(pcap_file)
    except Exception as e:
        print(f"  无法读取 {pcap_file}: {e}")
        return pd.DataFrame()
    
    if len(packets) == 0:
        print(f"  {pcap_file} 为空文件")
        return pd.DataFrame()
    
   # 使用规范化的流键聚合双向流量
    flows_dict = {}
    for pkt in packets:
        if pkt.haslayer(IP) and (pkt.haslayer(TCP) or pkt.haslayer(UDP)):
            flow_key = get_canonical_flow_key(pkt)
            if flow_key:
                flows_dict.setdefault(flow_key, []).append(pkt)
                
    # 为每条流提取特征
    # 即对每个流（即每个五元组对应的数据包列表）调用 extract_flow_features
    features_list = []
    for flow_key, flow_packets in flows_dict.items():
        # 按时间排序
        flow_packets.sort(key=lambda x: x.time)
        
        feats = extract_flow_features(flow_packets)
        if feats:
            feats['label'] = label
            feats['source_file'] = os.path.basename(pcap_file)
            features_list.append(feats)
    
    df = pd.DataFrame(features_list)
    print(f"  从 {pcap_file} 中提取了 {len(df)} 条流特征。")
    return df
 
def process_directory(pcap_dir, label):
    """处理目录下的所有pcap文件"""
    pcap_files = glob.glob(os.path.join(pcap_dir, "*.pcap"))
    print(f"\n处理目录: {pcap_dir}")
    print(f"文件数量: {len(pcap_files)}")
    print(f"标签: {label}")
    
    if len(pcap_files) == 0:
        print("警告: 没有找到pcap文件")
        return pd.DataFrame()
    
    all_features = []
    for pcap_file in pcap_files:
        df = pcap_to_features(pcap_file, label)
        if not df.empty:
            all_features.append(df)
    
    if all_features:
        return pd.concat(all_features, ignore_index=True)
    else:
        return pd.DataFrame()   


def main():
    """主函数：处理三种流量类型"""
    print("开始特征提取...")
    
    # 定义目录和标签
    # 注意：根据您的实际目录结构调整
    datasets = [
        {"dir": "common_pcaps", "label": "common"},
        {"dir": "proxy_pcaps", "label": "proxy"},
        {"dir": "vpn_pcaps", "label": "vpn"},  # VPN物理接口IP
    ]
    
    # 处理每个目录
    all_dfs = []
    for dataset in datasets:
        if os.path.exists(dataset["dir"]):
            df = process_directory(dataset["dir"], dataset["label"])
            if not df.empty:
                all_dfs.append(df)
                print(f"  {dataset['label']}: {len(df)} 条流")
        else:
            print(f"警告: 目录 {dataset['dir']} 不存在")
    
    if not all_dfs:
        print("错误: 没有提取到任何特征")
        return
    
    # 合并所有数据
    df_all = pd.concat(all_dfs, ignore_index=True)
    
    # 保存为CSV文件
    output_file = "encrypted_traffic_features.csv"
    df_all.to_csv(output_file, index=False)
    
    print("\n" + "="*50)
    print("特征提取完成！")
    print("="*50)
    print(f"总样本数（流数量）: {len(df_all)}")
    print("\n标签分布:")
    print(df_all['label'].value_counts())
    
    print("\n协议分布:")
    if 'protocol' in df_all.columns:
        print(df_all['protocol'].value_counts())
    
    print("\n前3行数据预览:")
    print(df_all.head(3))
    
    print(f"\n数据已保存到: {output_file}")
    
    # 基本统计分析
    print("\n基本统计信息:")
    numeric_cols = df_all.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        print(df_all[numeric_cols[:5]].describe())  # 只显示前5个数值列

if __name__ == "__main__":
    main()
