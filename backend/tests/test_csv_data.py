"""Tests for CSV data analysis functions."""
from backend.csv_data import (
    compute_global_stats, compute_protocol, compute_packet_size,
    compute_flow, compute_time_series, compute_tls, get_packet_table,
)

SAMPLE_ROWS = [
    {"protocol": "tcp", "flow_duration": "10.5", "total_packets": "100", "total_bytes": "50000",
     "bytes_per_sec": "4761", "mean_pkt_len": "500", "std_pkt_len": "200", "max_pkt_len": "1460",
     "min_pkt_len": "40", "uplink_packet_count": "30", "uplink_byte_count": "10000",
     "uplink_mean_size": "333", "uplink_std_size": "100", "downlink_packet_count": "70",
     "downlink_byte_count": "40000", "downlink_mean_size": "571", "downlink_std_size": "200",
     "uplink_downlink_ratio": "0.43", "uplink_bytes_ratio": "0.2", "iat_mean": "0.1",
     "iat_std": "0.05", "iat_max": "1.0", "first_10_pkts_len_mean": "500",
     "first_10_pkts_len_std": "300", "pkt_len_entropy": "1.5", "label": "common",
     "source_file": "test_common.pcap"},
    {"protocol": "tcp", "flow_duration": "5.0", "total_packets": "50", "total_bytes": "25000",
     "bytes_per_sec": "5000", "mean_pkt_len": "500", "std_pkt_len": "150", "max_pkt_len": "1400",
     "min_pkt_len": "40", "uplink_packet_count": "15", "uplink_byte_count": "5000",
     "uplink_mean_size": "333", "uplink_std_size": "80", "downlink_packet_count": "35",
     "downlink_byte_count": "20000", "downlink_mean_size": "571", "downlink_std_size": "150",
     "uplink_downlink_ratio": "0.43", "uplink_bytes_ratio": "0.2", "iat_mean": "0.15",
     "iat_std": "0.06", "iat_max": "0.8", "first_10_pkts_len_mean": "450",
     "first_10_pkts_len_std": "250", "pkt_len_entropy": "1.3", "label": "common",
     "source_file": "test_common2.pcap"},
    {"protocol": "udp", "flow_duration": "2.0", "total_packets": "200", "total_bytes": "30000",
     "bytes_per_sec": "15000", "mean_pkt_len": "150", "std_pkt_len": "50", "max_pkt_len": "500",
     "min_pkt_len": "20", "uplink_packet_count": "100", "uplink_byte_count": "15000",
     "uplink_mean_size": "150", "uplink_std_size": "30", "downlink_packet_count": "100",
     "downlink_byte_count": "15000", "downlink_mean_size": "150", "downlink_std_size": "30",
     "uplink_downlink_ratio": "1.0", "uplink_bytes_ratio": "0.5", "iat_mean": "0.01",
     "iat_std": "0.005", "iat_max": "0.1", "first_10_pkts_len_mean": "100",
     "first_10_pkts_len_std": "40", "pkt_len_entropy": "0.8", "label": "proxy",
     "source_file": "test_proxy.pcap"},
    {"protocol": "tcp", "flow_duration": "30.0", "total_packets": "30", "total_bytes": "30000",
     "bytes_per_sec": "1000", "mean_pkt_len": "1000", "std_pkt_len": "400", "max_pkt_len": "3000",
     "min_pkt_len": "100", "uplink_packet_count": "10", "uplink_byte_count": "10000",
     "uplink_mean_size": "1000", "uplink_std_size": "300", "downlink_packet_count": "20",
     "downlink_byte_count": "20000", "downlink_mean_size": "1000", "downlink_std_size": "300",
     "uplink_downlink_ratio": "0.5", "uplink_bytes_ratio": "0.33", "iat_mean": "1.0",
     "iat_std": "0.5", "iat_max": "5.0", "first_10_pkts_len_mean": "800",
     "first_10_pkts_len_std": "350", "pkt_len_entropy": "1.8", "label": "vpn",
     "source_file": "test_vpn.pcap"},
]


def test_global_stats():
    result = compute_global_stats(SAMPLE_ROWS)
    assert result.common.file_count == 2
    assert result.proxy.file_count == 1
    assert result.vpn.file_count == 1
    assert result.common.total_packets == 150
    assert result.proxy.total_packets == 200


def test_protocol():
    result = compute_protocol(SAMPLE_ROWS)
    assert "tcp" in result.categories
    assert "udp" in result.categories
    assert result.unit == "percent"


def test_packet_size():
    result = compute_packet_size(SAMPLE_ROWS)
    assert len(result.bins) == 8  # 0..1500 step 200
    assert result.stats["common"].mean > 0
    assert len(result.stats) == 3


def test_flow():
    result = compute_flow(SAMPLE_ROWS)
    assert len(result.boxplot) == 3
    for fd in result.boxplot:
        assert len(fd.common) == 5


def test_time_series():
    result = compute_time_series(SAMPLE_ROWS)
    assert "common" in result.rate_timeline
    assert len(result.iat_cdf) == 101


def test_tls():
    result = compute_tls(SAMPLE_ROWS)
    assert "common" in result.version_distribution
    assert len(result.ja3_fingerprints["common"]) > 0


def test_packet_table():
    result = get_packet_table(SAMPLE_ROWS, "common", page=1, size=10)
    assert result.total == 2
    assert len(result.packets) == 2
    assert result.packets[0].protocol == "tcp"
