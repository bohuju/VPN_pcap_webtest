from __future__ import annotations
import os
import glob
from dataclasses import dataclass, field
from typing import List

PCAP_EXTENSIONS = (".pcap", ".pcapng")


@dataclass
class PoolEntry:
    path: str
    category: str
    name: str


@dataclass
class Pool:
    common: List[PoolEntry] = field(default_factory=list)
    proxy: List[PoolEntry] = field(default_factory=list)
    vpn: List[PoolEntry] = field(default_factory=list)

    def all_entries(self) -> List[PoolEntry]:
        return self.common + self.proxy + self.vpn

    def count(self, category: str) -> int:
        return len(getattr(self, category))


def classify_filename(filename: str) -> str | None:
    """Classify a pcap filename into 'common', 'proxy', or 'vpn'. Returns None if ambiguous."""
    name = filename.lower()
    if "common" in name:
        return "common"
    if "proxy" in name or "ssr" in name or "vmess" in name or "trojan" in name or "type_ss_" in name:
        return "proxy"
    if "vpn" in name:
        return "vpn"
    if "_clear_class_" in name:
        if "type_null" in name or "type_http" in name:
            return "common"
        if "type_ssr" in name or "type_vmess" in name or "type_trojan" in name or "type_ss" in name:
            return "proxy"
    return None


def scan_directory(dir_path: str) -> Pool:
    """Scan a directory for pcap files and classify them."""
    pool = Pool()
    if not os.path.isdir(dir_path):
        return pool

    for ext in PCAP_EXTENSIONS:
        for fpath in glob.glob(os.path.join(dir_path, f"*{ext}")):
            fname = os.path.basename(fpath)
            category = classify_filename(fname)
            if category is None:
                continue
            entry = PoolEntry(path=fpath, category=category, name=fname)
            getattr(pool, category).append(entry)

    return pool


def merge_pools(pools: List[Pool]) -> Pool:
    """Merge multiple pools into one."""
    merged = Pool()
    for p in pools:
        merged.common.extend(p.common)
        merged.proxy.extend(p.proxy)
        merged.vpn.extend(p.vpn)
    return merged


def get_file_count_by_category(pool: Pool) -> dict[str, int]:
    return {
        "common": len(pool.common),
        "proxy": len(pool.proxy),
        "vpn": len(pool.vpn),
    }
