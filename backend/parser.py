from __future__ import annotations
import hashlib
from typing import List, Dict, Any
from scapy.all import rdpcap, IP, TCP, UDP, DNS, Raw


def _classify_protocol(pkt) -> str:
    """Classify a single scapy packet into a protocol category."""
    if DNS in pkt:
        return "DNS"
    if TCP in pkt:
        dport = pkt[TCP].dport
        sport = pkt[TCP].sport
        if dport == 443 or sport == 443:
            return "HTTPS"
        if dport == 80 or sport == 80:
            return "HTTP"
        return "TCP"
    if UDP in pkt:
        dport = pkt[UDP].dport
        sport = pkt[UDP].sport
        if dport == 53 or sport == 53:
            return "DNS"
        return "UDP"
    return "Other"


def _extract_info(pkt) -> str:
    """Extract a short human-readable info string from a packet."""
    if DNS in pkt and pkt[DNS].qr == 0:
        return f"DNS Query: {pkt[DNS].qd.qname.decode() if pkt[DNS].qd else '?'}"
    if TCP in pkt:
        dport = pkt[TCP].dport
        if Raw in pkt and dport == 443:
            return "TLS Application Data"
        if Raw in pkt and dport == 80:
            return "HTTP Data"
        return f"TCP {pkt[TCP].sport}->{dport} flags={pkt[TCP].flags}"
    if UDP in pkt:
        return f"UDP {pkt[UDP].sport}->{pkt[UDP].dport}"
    return str(pkt.summary())[:80]


def parse_pcap(filepath: str) -> List[Dict[str, Any]]:
    """Parse a pcap file and return a list of packet dicts."""
    packets = rdpcap(filepath)
    parsed: List[Dict[str, Any]] = []

    for pkt in packets:
        info: Dict[str, Any] = {
            "timestamp": float(pkt.time),
            "src_ip": "",
            "dst_ip": "",
            "src_port": 0,
            "dst_port": 0,
            "protocol": _classify_protocol(pkt),
            "length": len(pkt),
            "info": _extract_info(pkt),
        }

        if IP in pkt:
            info["src_ip"] = pkt[IP].src
            info["dst_ip"] = pkt[IP].dst
        if TCP in pkt:
            info["src_port"] = pkt[TCP].sport
            info["dst_port"] = pkt[TCP].dport
        elif UDP in pkt:
            info["src_port"] = pkt[UDP].sport
            info["dst_port"] = pkt[UDP].dport

        parsed.append(info)

    return parsed


def file_hash(filepath: str) -> str:
    """Return MD5 hash of file contents."""
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()
