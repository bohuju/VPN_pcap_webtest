# 1.1_basic_capture.py  基础流量捕获（优化版-Ubuntu专用）
from scapy.all import sniff, IP, TCP, UDP

# 回调函数：处理捕获的数据包
def packet_callback(packet):
    # 只处理IP数据包
    if IP in packet:
        src_ip = packet[IP].src
        dst_ip = packet[IP].dst
        protocol_num = packet[IP].proto
        
        # 把数字协议翻译成名字
        protocol = "TCP" if protocol_num == 6 else "UDP" if protocol_num == 17 else str(protocol_num)
        
        print(f"源IP: {src_ip} -> 目标IP: {dst_ip} | 协议: {protocol}")

print("开始捕获流量（按 Ctrl + C 停止）...")
# 关键优化：指定网卡 ens33 + 无限抓包 + 不卡顿
sniff(prn=packet_callback, iface="ens32")
