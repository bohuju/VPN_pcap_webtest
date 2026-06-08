from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional


class CategoryStats(BaseModel):
    file_count: int = 0
    total_packets: int = 0
    total_bytes: int = 0
    avg_pkt_size: float = 0.0


class GlobalStats(BaseModel):
    common: CategoryStats = CategoryStats()
    proxy: CategoryStats = CategoryStats()
    vpn: CategoryStats = CategoryStats()
    last_updated: float = 0.0


class ProtocolData(BaseModel):
    categories: List[str]
    common: List[float]
    proxy: List[float]
    vpn: List[float]
    unit: str = "percent"


class PacketSizeBin(BaseModel):
    bin_start: int
    bin_end: int
    common: float
    proxy: float
    vpn: float


class SizeStats(BaseModel):
    mean: float
    min: float
    max: float
    std: float


class PacketSizeData(BaseModel):
    bins: List[PacketSizeBin]
    stats: dict[str, SizeStats]


class FlowBoxData(BaseModel):
    category: str
    common: List[float]
    proxy: List[float]
    vpn: List[float]


class FlowData(BaseModel):
    boxplot: List[FlowBoxData]


class TimeSeriesPoint(BaseModel):
    time: float
    packet_rate: float


class IATPoint(BaseModel):
    interval: float
    common_cdf: float
    proxy_cdf: float
    vpn_cdf: float


class TimeSeriesData(BaseModel):
    rate_timeline: dict[str, List[TimeSeriesPoint]]
    iat_cdf: List[IATPoint]


class TlsVersionItem(BaseModel):
    name: str
    value: int


class JA3Record(BaseModel):
    fingerprint: str
    count: int
    sni: str


class TlsData(BaseModel):
    version_distribution: dict[str, List[TlsVersionItem]]
    ja3_fingerprints: dict[str, List[JA3Record]]


class PacketRecord(BaseModel):
    timestamp: float
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    length: int
    info: str


class PacketTableData(BaseModel):
    packets: List[PacketRecord]
    total: int
    page: int
    size: int
