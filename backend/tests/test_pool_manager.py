import os
import tempfile
from backend.pool_manager import classify_filename, scan_directory, Pool, merge_pools


def test_classify_common():
    assert classify_filename("common_www_baidu_com_003.pcap") == "common"
    assert classify_filename("1690183802_clear_class_0__type_null_url_0_normal.pcap") == "common"


def test_classify_proxy():
    assert classify_filename("proxy_www_baidu_com_003.pcap") == "proxy"
    assert classify_filename("1690558470_clear_class_16__type_ssr_url_1-1_global.pcap") == "proxy"
    assert classify_filename("1690810305_clear_class_5__type_vmess_url_2-1_global.pcap") == "proxy"


def test_classify_vpn():
    assert classify_filename("vpn_www_baidu_com_003.pcap") == "vpn"
    assert classify_filename("vpn_mail_163_com_015.pcap") == "vpn"


def test_classify_unknown():
    assert classify_filename("unknown_traffic_001.pcap") is None
    assert classify_filename("0_01.pcap") is None


def test_scan_directory():
    with tempfile.TemporaryDirectory() as d:
        for name in ["common_test.pcap", "proxy_test.pcap", "vpn_test.pcap", "unknown.pcap"]:
            with open(os.path.join(d, name), "w") as f:
                f.write("dummy")
        pool = scan_directory(d)
        assert pool.count("common") == 1
        assert pool.count("proxy") == 1
        assert pool.count("vpn") == 1


def test_merge_pools():
    p1 = Pool()
    p1.common.append(type("e", (), {"path": "/a", "category": "common", "name": "a.pcap"})())
    p2 = Pool()
    p2.proxy.append(type("e", (), {"path": "/b", "category": "proxy", "name": "b.pcap"})())
    merged = merge_pools([p1, p2])
    assert merged.count("common") == 1
    assert merged.count("proxy") == 1
    assert merged.count("vpn") == 0
