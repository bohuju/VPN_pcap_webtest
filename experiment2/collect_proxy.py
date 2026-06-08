# collect_proxy.py
import subprocess
import time
import random
import os

def capture_with_curl_proxy():
    """通过配置了代理的curl采集流量，每个网站独立保存"""
    
    with open("url_list.txt", 'r') as f:
        urls = [line.strip() for line in f if line.strip()]
    
    print(f"[*] 开始采集 'proxy' 流量，使用curl+代理，目标数: {len(urls)}")
    
    # 创建存储目录
    os.makedirs("proxy_pcaps", exist_ok=True)
    
    # 为每个URL单独采集
    for i, url in enumerate(urls):
        try:
            # 为每个网站创建独立的pcap文件名
            site_name = url.split('//')[1].replace('.', '_').replace('/', '_')[:30]
            pcap_file = f"proxy_pcaps/proxy_{site_name}_{i+1:03d}.pcap"
            
            print(f"\n[{i+1}/{len(urls)}] 采集: {url}")
            print(f"  保存到: {pcap_file}")
            
            # 启动抓包
            tcpdump_cmd = ['sudo', 'tcpdump', '-i', 'lo', 'port', '8080', '-w', pcap_file]
            tcpdump_proc = subprocess.Popen(tcpdump_cmd)
            time.sleep(1)
            
            # 使用curl通过代理访问
            # -x: 指定代理
            # -k: 忽略证书错误
            curl_cmd = ['curl', '-x', 'http://127.0.0.1:8080', '-k', '-s', '--connect-timeout', '10', url]
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
    
    print(f"\n[+] 'proxy' 流量采集完成！文件保存在 proxy_pcaps/ 目录\n")

if __name__ == "__main__":
    # 在运行此脚本前，请确保：
    # 1. mitmproxy正在运行 (mitmproxy -p 8080)
    # 2. 不需要Firefox配置
    capture_with_curl_proxy()
