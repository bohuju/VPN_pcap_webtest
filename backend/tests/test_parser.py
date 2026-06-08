import tempfile
import os
from backend.parser import parse_pcap, file_hash
from scapy.all import IP, TCP, DNS, UDP, wrpcap, Ether, Raw


def make_test_pcap():
    """Create a minimal test pcap with a few packets and return path."""
    pkts = [
        Ether() / IP(src="10.0.0.1", dst="10.0.0.2") / TCP(sport=12345, dport=443) / Raw(b"\x16\x03\x01"),
        Ether() / IP(src="10.0.0.1", dst="10.0.0.2") / UDP(sport=9999, dport=53),
        Ether() / IP(src="10.0.0.1", dst="10.0.0.2") / TCP(sport=11111, dport=80) / Raw(b"GET / HTTP/1.1"),
    ]
    tmp = tempfile.NamedTemporaryFile(suffix=".pcap", delete=False)
    wrpcap(tmp.name, pkts)
    return tmp.name


def test_parse_pcap_returns_list():
    path = make_test_pcap()
    try:
        result = parse_pcap(path)
        assert isinstance(result, list)
        assert len(result) == 3
    finally:
        os.unlink(path)


def test_parse_pcap_has_expected_fields():
    path = make_test_pcap()
    try:
        result = parse_pcap(path)
        pkt = result[0]
        for field in ("timestamp", "src_ip", "dst_ip", "src_port", "dst_port", "protocol", "length", "info"):
            assert field in pkt, f"Missing field: {field}"
    finally:
        os.unlink(path)


def test_classify_protocol_https():
    path = make_test_pcap()
    try:
        result = parse_pcap(path)
        assert result[0]["protocol"] == "HTTPS"
    finally:
        os.unlink(path)


def test_classify_protocol_dns():
    path = make_test_pcap()
    try:
        result = parse_pcap(path)
        assert result[1]["protocol"] == "DNS"
    finally:
        os.unlink(path)


def test_classify_protocol_http():
    path = make_test_pcap()
    try:
        result = parse_pcap(path)
        assert result[2]["protocol"] == "HTTP"
    finally:
        os.unlink(path)


def test_file_hash():
    path = make_test_pcap()
    try:
        h1 = file_hash(path)
        h2 = file_hash(path)
        assert h1 == h2
        assert len(h1) == 32
    finally:
        os.unlink(path)
