# collect_common.py
import subprocess
import time
import random
import os

def capture_with_curl_common():
    """每个网站独立保存"""
    
    with open("url_list.txt", 'r') as f:
        urls = [line.strip() for line in f if line.strip()]
    
    print(f"[*] 开始采集 'common' 流量，直接访问https,目标数: {len(urls)}")
    
    # 创建存储目录
    os.makedirs("common_pcaps", exist_ok=True)
    
    # 为每个URL单独采集
    for i, url in enumerate(urls):
        try:
            # 为每个网站创建独立的pcap文件名
            site_name = url.split('//')[1].replace('.', '_').replace('/', '_')[:30]
            pcap_file = f"common_pcaps/common_{site_name}_{i+1:03d}.pcap"
            
            print(f"\n[{i+1}/{len(urls)}] 采集: {url}")
            print(f"  保存到: {pcap_file}")
            
            # 启动抓包(443为https默认端口）
            tcpdump_cmd = ['sudo', 'tcpdump', '-i', 'ens32', 'port', '443', '-w', pcap_file]
            tcpdump_proc = subprocess.Popen(tcpdump_cmd)
            time.sleep(1)
           
            # 使用curl访问：去掉代理参数
            curl_cmd = ['curl', '-k', '-s', '--connect-timeout', '10', url]
            subprocess.run(curl_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            # 停止抓包
            time.sleep(4)
            tcpdump_proc.terminate()
            tcpdump_proc.wait()
            
            # 检查文件大小
            if os.path.exists(pcap_file) and os.path.getsize(pcap_file) > 1024:
                print(f"  √ 采集成功，文件大小: {os.path.getsize(pcap_file)//1024}KB")
            else:
                print(f"  × 文件过小，可能访问失败")
                if os.path.exists(pcap_file):
                    os.remove(pcap_file)
                
        except Exception as e:
            print(f"  × 采集失败: {e}")
            if 'tcpdump_proc' in locals():
                tcpdump_proc.terminate()
            continue
    
    print(f"\n[+] 'common' 流量采集完成！文件保存在 common_pcaps/ 目录\n")

if __name__ == "__main__":
    # 在运行此脚本前，请确保：
    # 1. mitmproxy关闭
    # 2. 不需要Firefox配置
    capture_with_curl_common()
