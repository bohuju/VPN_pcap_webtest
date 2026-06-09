"""Read pre-computed CSV flow features and compute analysis results."""
from __future__ import annotations
import csv
import math
from pathlib import Path
from collections import Counter, defaultdict
from typing import List, Dict

from .models import (
    GlobalStats, CategoryStats,
    ProtocolData, PacketSizeData, PacketSizeBin, SizeStats,
    FlowData, FlowBoxData, TimeSeriesData, TimeSeriesPoint, IATPoint,
    TlsData, TlsVersionItem, JA3Record, PacketRecord, PacketTableData,
)

CSV_FILES = [
    Path(__file__).parent.parent / "experiment2_database" / "encrypted_traffic_features.csv",
    Path(__file__).parent.parent / "experiment2" / "encrypted_traffic_features.csv",
]


def load_csv_data() -> List[Dict]:
    """Load all CSV rows into memory. Each row is ~27 fields — light weight."""
    rows = []
    for csv_path in CSV_FILES:
        if not csv_path.exists():
            continue
        with open(csv_path, newline="") as f:
            for row in csv.DictReader(f):
                rows.append(row)
    return rows


def _safe_float(v: str, default: float = 0.0) -> float:
    try:
        return float(v)
    except (ValueError, TypeError):
        return default


# ---------- Global Stats ----------

def compute_global_stats(rows: List[Dict]) -> GlobalStats:
    cats: Dict[str, list] = {"common": [], "proxy": [], "vpn": []}
    for r in rows:
        label = r.get("label", "common")
        if label in cats:
            cats[label].append(r)
    stats = {}
    for cat, recs in cats.items():
        total_pkts = sum(_safe_float(r["total_packets"]) for r in recs)
        total_bytes = int(sum(_safe_float(r["total_bytes"]) for r in recs))
        n_flows = len(recs)
        stats[cat] = CategoryStats(
            file_count=n_flows,  # use flow count as "file" count
            total_packets=int(total_pkts),
            total_bytes=total_bytes,
            avg_pkt_size=round(total_bytes / total_pkts, 2) if total_pkts > 0 else 0.0,
        )
    return GlobalStats(**stats, last_updated=0.0)


# ---------- Protocol Distribution ----------

def compute_protocol(rows: List[Dict]) -> ProtocolData:
    cats: Dict[str, List[Dict]] = {"common": [], "proxy": [], "vpn": []}
    for r in rows:
        label = r.get("label", "common")
        if label in cats:
            cats[label].append(r)
    # Count protocols per category
    proto_set = set()
    for r in rows:
        proto_set.add(r.get("protocol", "TCP"))
    proto_list = sorted(proto_set)
    result = {}
    for cat in ("common", "proxy", "vpn"):
        proto_counts = Counter(r.get("protocol", "TCP") for r in cats[cat])
        total = len(cats[cat]) or 1
        result[cat] = [round(proto_counts.get(p, 0) / total * 100, 2) for p in proto_list]
    return ProtocolData(categories=proto_list, **result)


# ---------- Packet Size ----------

def compute_packet_size(rows: List[Dict]) -> PacketSizeData:
    cats: Dict[str, List[Dict]] = {"common": [], "proxy": [], "vpn": []}
    for r in rows:
        label = r.get("label", "common")
        if label in cats:
            cats[label].append(r)
    bins = [PacketSizeBin(bin_start=i, bin_end=i + 200, common=0, proxy=0, vpn=0)
            for i in range(0, 1500, 200)]
    stats = {}
    for cat in ("common", "proxy", "vpn"):
        means = [_safe_float(r["mean_pkt_len"]) for r in cats[cat]]
        n = len(means)
        if n == 0:
            stats[cat] = SizeStats(mean=0, min=0, max=0, std=0)
            continue
        mean_val = sum(means) / n
        variance = sum((m - mean_val) ** 2 for m in means) / n
        stats[cat] = SizeStats(
            mean=round(mean_val, 2),
            min=round(min(means), 2),
            max=round(max(means), 2),
            std=round(math.sqrt(variance), 2),
        )
        for m in means:
            idx = min(int(m // 200), len(bins) - 1)
            setattr(bins[idx], cat, getattr(bins[idx], cat) + 1)
    for b in bins:
        for cat in ("common", "proxy", "vpn"):
            n = len(cats[cat]) or 1
            setattr(b, cat, round(getattr(b, cat) / n * 100, 2))
    return PacketSizeData(bins=bins, stats=stats)


# ---------- Flow Analysis ----------

def _boxplot_vals(values: List[float]) -> List[float]:
    if not values:
        return [0, 0, 0, 0, 0]
    sv = sorted(values)
    n = len(sv)
    return [sv[0], sv[n // 4], sv[n // 2], sv[3 * n // 4], sv[-1]]


def compute_flow(rows: List[Dict]) -> FlowData:
    cats: Dict[str, List[Dict]] = {"common": [], "proxy": [], "vpn": []}
    for r in rows:
        label = r.get("label", "common")
        if label in cats:
            cats[label].append(r)
    boxplot = []
    for metric, key in [("每流包数", "total_packets"), ("每流字节数", "total_bytes"), ("持续时间(s)", "flow_duration")]:
        fd = FlowBoxData(category=metric, common=[], proxy=[], vpn=[])
        for cat in ("common", "proxy", "vpn"):
            vals = [_safe_float(r[key]) for r in cats[cat]]
            setattr(fd, cat, _boxplot_vals(vals))
        boxplot.append(fd)
    return FlowData(boxplot=boxplot)


# ---------- Time Series / IAT ----------

def compute_time_series(rows: List[Dict]) -> TimeSeriesData:
    cats: Dict[str, List[Dict]] = {"common": [], "proxy": [], "vpn": []}
    for r in rows:
        label = r.get("label", "common")
        if label in cats:
            cats[label].append(r)
    rate_timeline: Dict[str, List[TimeSeriesPoint]] = {}
    for cat in ("common", "proxy", "vpn"):
        pkts_per_flow = [_safe_float(r["total_packets"]) for r in cats[cat]]
        dur_per_flow = [_safe_float(r["flow_duration"], 0.001) for r in cats[cat]]
        rates = [p / max(d, 0.001) for p, d in zip(pkts_per_flow, dur_per_flow)]
        points = [TimeSeriesPoint(time=float(i), packet_rate=round(r, 2)) for i, r in enumerate(rates[:100])]
        rate_timeline[cat] = points
    # IAT CDF from iat_mean
    all_iats = {}
    for cat in ("common", "proxy", "vpn"):
        vals = sorted([_safe_float(r["iat_mean"]) for r in cats[cat]])
        all_iats[cat] = vals
    max_iat = max((max(v) if v else 0 for v in all_iats.values()), default=0.001)
    num_points = 100
    step = max_iat / num_points
    iat_cdf = []
    for i in range(num_points + 1):
        x = i * step
        iat_cdf.append(IATPoint(
            interval=round(x, 4),
            common_cdf=round(sum(1 for v in all_iats.get("common", []) if v <= x) / max(len(all_iats.get("common", [])), 1), 4),
            proxy_cdf=round(sum(1 for v in all_iats.get("proxy", []) if v <= x) / max(len(all_iats.get("proxy", [])), 1), 4),
            vpn_cdf=round(sum(1 for v in all_iats.get("vpn", []) if v <= x) / max(len(all_iats.get("vpn", [])), 1), 4),
        ))
    return TimeSeriesData(rate_timeline=rate_timeline, iat_cdf=iat_cdf)


# ---------- TLS (approximated from protocol) ----------

def compute_tls(rows: List[Dict]) -> TlsData:
    cats: Dict[str, List[Dict]] = {"common": [], "proxy": [], "vpn": []}
    for r in rows:
        label = r.get("label", "common")
        if label in cats:
            cats[label].append(r)
    version_dist = {}
    ja3 = {}
    for cat in ("common", "proxy", "vpn"):
        proto_counts = Counter(r.get("protocol", "TCP") for r in cats[cat])
        items = [TlsVersionItem(name=proto, value=count) for proto, count in proto_counts.most_common()]
        version_dist[cat] = items
        ja3[cat] = [JA3Record(fingerprint=f"{proto} flows", count=count, sni="") for proto, count in proto_counts.most_common(5)]
    return TlsData(version_distribution=version_dist, ja3_fingerprints=ja3)


# ---------- Packet Table (rows as packets) ----------

def get_packet_table(rows: List[Dict], label: str, page: int, size: int) -> PacketTableData:
    filtered = [r for r in rows if r.get("label") == label]
    total = len(filtered)
    start = (page - 1) * size
    page_rows = filtered[start:start + size]
    packets = []
    for i, r in enumerate(page_rows):
        packets.append(PacketRecord(
            timestamp=_safe_float(r.get("flow_duration", "0")),
            src_ip=r.get("source_file", "")[:30],
            dst_ip=r.get("protocol", ""),
            src_port=int(_safe_float(r.get("uplink_packet_count", "0"))),
            dst_port=int(_safe_float(r.get("downlink_packet_count", "0"))),
            protocol=r.get("protocol", "TCP"),
            length=int(_safe_float(r.get("mean_pkt_len", "0"))),
            info=f"flow #{start + i + 1}, {r.get('total_packets', '?')} pkts, {r.get('total_bytes', '?')} bytes",
        ))
    return PacketTableData(packets=packets, total=total, page=page, size=size)
