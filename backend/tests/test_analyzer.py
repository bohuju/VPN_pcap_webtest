from backend.analyzer import analyze_protocol, analyze_packet_size, analyze_flow, analyze_time_series, paginate_packets


SAMPLE_PACKETS = {
    "common": [
        {"timestamp": 0.0, "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2", "src_port": 12345, "dst_port": 443, "protocol": "HTTPS", "length": 150, "info": "TLS"},
        {"timestamp": 0.1, "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2", "src_port": 11111, "dst_port": 80, "protocol": "HTTP", "length": 200, "info": "GET /"},
        {"timestamp": 0.2, "src_ip": "10.0.0.1", "dst_ip": "8.8.8.8", "src_port": 55555, "dst_port": 53, "protocol": "DNS", "length": 80, "info": "DNS Query"},
    ],
    "proxy": [
        {"timestamp": 0.0, "src_ip": "10.0.0.1", "dst_ip": "1.2.3.4", "src_port": 54321, "dst_port": 443, "protocol": "HTTPS", "length": 300, "info": "TLS via proxy"},
    ],
    "vpn": [
        {"timestamp": 0.0, "src_ip": "10.8.0.1", "dst_ip": "10.8.0.2", "src_port": 1111, "dst_port": 2222, "protocol": "TCP", "length": 100, "info": "VPN tunnel"},
        {"timestamp": 0.5, "src_ip": "10.8.0.1", "dst_ip": "10.8.0.2", "src_port": 1111, "dst_port": 2222, "protocol": "TCP", "length": 120, "info": "VPN tunnel"},
    ],
}


def test_analyze_protocol():
    result = analyze_protocol(SAMPLE_PACKETS)
    assert result.categories == ["TCP", "UDP", "HTTP", "HTTPS", "DNS", "Other"]
    assert len(result.common) == 6
    assert sum(result.common) > 0
    assert result.unit == "percent"


def test_analyze_packet_size():
    result = analyze_packet_size(SAMPLE_PACKETS)
    assert len(result.bins) == 15
    assert result.stats["common"].mean > 0
    assert len(result.stats) == 3


def test_analyze_flow():
    result = analyze_flow(SAMPLE_PACKETS)
    assert len(result.boxplot) == 3
    for fd in result.boxplot:
        assert len(fd.common) == 5


def test_analyze_time_series():
    result = analyze_time_series(SAMPLE_PACKETS)
    assert "common" in result.rate_timeline
    assert "proxy" in result.rate_timeline
    assert "vpn" in result.rate_timeline
    assert len(result.iat_cdf) > 0


def test_paginate_packets():
    records, total = paginate_packets(SAMPLE_PACKETS, "common", page=1, size=2)
    assert total == 3
    assert len(records) == 2
    assert records[0].protocol == "HTTPS"
