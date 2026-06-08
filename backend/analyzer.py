from __future__ import annotations
import math
from collections import defaultdict
from typing import List, Dict, Any
from .models import (
    ProtocolData, PacketSizeData, PacketSizeBin, SizeStats,
    FlowData, FlowBoxData, TimeSeriesData, TimeSeriesPoint, IATPoint,
    TlsData, TlsVersionItem, JA3Record, PacketRecord,
)


def analyze_protocol(all_packets: Dict[str, List[Dict[str, Any]]]) -> ProtocolData:
    """Protocol distribution for each traffic category."""
    categories = ["TCP", "UDP", "HTTP", "HTTPS", "DNS", "Other"]
    result: Dict[str, List[float]] = {"common": [], "proxy": [], "vpn": []}

    for cat in ("common", "proxy", "vpn"):
        pkts = all_packets.get(cat, [])
        total = len(pkts) or 1
        counts = {c: 0 for c in categories}
        for p in pkts:
            proto = p.get("protocol", "Other")
            counts[proto] = counts.get(proto, 0) + 1
        result[cat] = [round(counts[c] / total * 100, 2) for c in categories]

    return ProtocolData(categories=categories, **result)


def analyze_packet_size(all_packets: Dict[str, List[Dict[str, Any]]]) -> PacketSizeData:
    """Packet size distribution with histogram bins and stats."""
    bins = []
    for i in range(0, 1500, 100):
        bins.append(PacketSizeBin(bin_start=i, bin_end=i + 100, common=0, proxy=0, vpn=0))

    stats = {}
    for cat in ("common", "proxy", "vpn"):
        sizes = [p["length"] for p in all_packets.get(cat, [])]
        n = len(sizes)
        if n == 0:
            stats[cat] = SizeStats(mean=0, min=0, max=0, std=0)
            continue
        mean = sum(sizes) / n
        variance = sum((s - mean) ** 2 for s in sizes) / n
        stats[cat] = SizeStats(
            mean=round(mean, 2),
            min=min(sizes),
            max=max(sizes),
            std=round(math.sqrt(variance), 2),
        )
        for s in sizes:
            idx = min(s // 100, len(bins) - 1)
            setattr(bins[idx], cat, getattr(bins[idx], cat) + 1)

    for b in bins:
        for cat in ("common", "proxy", "vpn"):
            n = len(all_packets.get(cat, [])) or 1
            setattr(b, cat, round(getattr(b, cat) / n * 100, 2))

    return PacketSizeData(bins=bins, stats=stats)


def _boxplot_values(values: List[float]) -> List[float]:
    """Return [min, q1, median, q3, max] for a list of values."""
    if not values:
        return [0, 0, 0, 0, 0]
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    return [
        sorted_vals[0],
        sorted_vals[n // 4],
        sorted_vals[n // 2],
        sorted_vals[3 * n // 4],
        sorted_vals[-1],
    ]


def analyze_flow(all_packets: Dict[str, List[Dict[str, Any]]]) -> FlowData:
    """Flow-level statistics: packets per flow, bytes per flow, duration per flow."""

    def compute_flows(pkts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        flow_map: Dict[tuple, List[Dict]] = defaultdict(list)
        for p in pkts:
            key = (p["src_ip"], p["dst_ip"], p["src_port"], p["dst_port"], p["protocol"])
            flow_map[key].append(p)
        flows = []
        for (src_ip, dst_ip, src_port, dst_port, proto), fp in flow_map.items():
            sorted_pkts = sorted(fp, key=lambda x: x["timestamp"])
            flows.append({
                "packet_count": len(fp),
                "byte_count": sum(p["length"] for p in fp),
                "duration": sorted_pkts[-1]["timestamp"] - sorted_pkts[0]["timestamp"],
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "src_port": src_port,
                "dst_port": dst_port,
                "protocol": proto,
            })
        return flows

    boxplot = []
    for metric, label in [("packet_count", "每流包数"), ("byte_count", "每流字节数"), ("duration", "持续时间(s)")]:
        fd = FlowBoxData(category=label, common=[], proxy=[], vpn=[])
        for cat in ("common", "proxy", "vpn"):
            flows = compute_flows(all_packets.get(cat, []))
            values = [f[metric] for f in flows]
            setattr(fd, cat, _boxplot_values(values))
        boxplot.append(fd)

    return FlowData(boxplot=boxplot)


def analyze_time_series(all_packets: Dict[str, List[Dict[str, Any]]]) -> TimeSeriesData:
    """Packet rate timeline and inter-arrival time CDF."""
    rate_timeline: Dict[str, List[TimeSeriesPoint]] = {}

    for cat in ("common", "proxy", "vpn"):
        pkts = all_packets.get(cat, [])
        if not pkts:
            rate_timeline[cat] = []
            continue
        sorted_pkts = sorted(pkts, key=lambda x: x["timestamp"])
        t0 = sorted_pkts[0]["timestamp"]
        window = 1.0
        points: List[TimeSeriesPoint] = []
        current_window_start = t0
        count = 0
        for p in sorted_pkts:
            while p["timestamp"] > current_window_start + window:
                points.append(TimeSeriesPoint(
                    time=round(current_window_start - t0, 2),
                    packet_rate=count,
                ))
                count = 0
                current_window_start += window
            count += 1
        points.append(TimeSeriesPoint(
            time=round(current_window_start - t0, 2),
            packet_rate=count,
        ))
        rate_timeline[cat] = points

    all_iats: Dict[str, List[float]] = {}
    for cat in ("common", "proxy", "vpn"):
        pkts = all_packets.get(cat, [])
        if not pkts:
            all_iats[cat] = []
            continue
        sorted_pkts = sorted(pkts, key=lambda x: x["timestamp"])
        iats = [sorted_pkts[i]["timestamp"] - sorted_pkts[i - 1]["timestamp"] for i in range(1, len(sorted_pkts))]
        all_iats[cat] = sorted(iats)

    max_iat = 0.0
    for iats in all_iats.values():
        if iats:
            max_iat = max(max_iat, iats[-1])
    if max_iat == 0:
        max_iat = 1.0

    num_points = 100
    step = max_iat / num_points
    iat_cdf: List[IATPoint] = []
    for i in range(num_points + 1):
        x = i * step
        cdf_values = {}
        for cat in ("common", "proxy", "vpn"):
            if not all_iats[cat]:
                cdf_values[cat] = 0.0
            else:
                count = sum(1 for v in all_iats[cat] if v <= x)
                cdf_values[cat] = round(count / len(all_iats[cat]), 4)
        iat_cdf.append(IATPoint(
            interval=round(x, 4),
            common_cdf=cdf_values["common"],
            proxy_cdf=cdf_values["proxy"],
            vpn_cdf=cdf_values["vpn"],
        ))

    return TimeSeriesData(rate_timeline=rate_timeline, iat_cdf=iat_cdf)


def analyze_tls(all_packets: Dict[str, List[Dict[str, Any]]]) -> TlsData:
    """TLS version distribution and JA3 fingerprints."""
    version_dist: Dict[str, List[TlsVersionItem]] = {}
    ja3_fingerprints: Dict[str, List[JA3Record]] = {}

    for cat in ("common", "proxy", "vpn"):
        pkts = all_packets.get(cat, [])
        https_count = sum(1 for p in pkts if p.get("protocol") == "HTTPS")
        version_dist[cat] = [
            TlsVersionItem(name=f"HTTPS packets ({https_count})", value=https_count),
        ]
        ja3_fingerprints[cat] = [
            JA3Record(fingerprint="TLS parsing requires scapy TLS layer",
                      count=https_count,
                      sni="(TLS detail parsing to be added)"),
        ]

    return TlsData(version_distribution=version_dist, ja3_fingerprints=ja3_fingerprints)


def paginate_packets(
    all_packets: Dict[str, List[Dict[str, Any]]],
    category: str,
    page: int,
    size: int,
) -> tuple[List[PacketRecord], int]:
    """Paginate raw packet records for a given category."""
    pkts = all_packets.get(category, [])
    total = len(pkts)
    start = (page - 1) * size
    end = start + size
    page_pkts = pkts[start:end]
    records = [
        PacketRecord(
            timestamp=p["timestamp"],
            src_ip=p["src_ip"],
            dst_ip=p["dst_ip"],
            src_port=p["src_port"],
            dst_port=p["dst_port"],
            protocol=p["protocol"],
            length=p["length"],
            info=p["info"],
        )
        for p in page_pkts
    ]
    return records, total
