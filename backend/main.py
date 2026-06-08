from __future__ import annotations
import os
import time
import json
import pickle
import gzip
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from .parser import parse_pcap, file_hash
from .cache import LRUCache
from .pool_manager import scan_directory, merge_pools, classify_filename, Pool
from .analyzer import (
    analyze_protocol,
    analyze_packet_size,
    analyze_flow,
    analyze_time_series,
    analyze_tls,
    paginate_packets,
)
from .models import GlobalStats, CategoryStats, PacketTableData

# --- Configuration ---
PCAP_DIRS = [
    os.environ.get("PCAP_DIR1", str(Path(__file__).parent.parent / "experiment2")),
    os.environ.get("PCAP_DIR2", str(Path(__file__).parent.parent / "experiment2_database")),
]
UPLOAD_DIR = os.environ.get("PCAP_POOL_DIR", str(Path(__file__).parent.parent / "pcap_pool"))
CACHE_DIR = os.environ.get("PCAP_CACHE_DIR", str(Path(__file__).parent.parent / ".pcap_cache"))

# --- Global state ---
cache = LRUCache(max_size=256, ttl_seconds=3600)
current_pool: Pool = Pool()
all_parsed_packets: dict[str, list] = {"common": [], "proxy": [], "vpn": []}
parsed_file_hashes: set[str] = set()
_parsing_in_progress = False


# --- Persistence ---

def _cache_path(file_hash_val: str) -> str:
    return os.path.join(CACHE_DIR, f"{file_hash_val}.pkl.gz")


def save_cache():
    """Save all parsed packets to a compressed JSON cache file."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    data = {
        "hashes": list(parsed_file_hashes),
        "packets": all_parsed_packets,
    }
    index_path = os.path.join(CACHE_DIR, "index.json.gz")
    with gzip.open(index_path, "wt", encoding="utf-8") as f:
        json.dump(data, f)
    saved = sum(len(v) for v in all_parsed_packets.values())
    print(f"Cache saved: {len(parsed_file_hashes)} files, {saved} packets -> {index_path}")


def load_cache() -> bool:
    """Load parsed packets from disk cache. Returns True if cache was loaded."""
    global all_parsed_packets, parsed_file_hashes
    index_path = os.path.join(CACHE_DIR, "index.json.gz")
    if not os.path.exists(index_path):
        print("No cache found, will parse all files.")
        return False

    try:
        print(f"Loading cache from {index_path} ...")
        with gzip.open(index_path, "rt", encoding="utf-8") as f:
            data = json.load(f)

        cached_hashes = set(data["hashes"])
        cached_packets = data["packets"]

        # Verify which cached hashes are still valid
        current_hashes: set[str] = set()
        for entry in current_pool.all_entries():
            current_hashes.add(file_hash(entry.path))

        # Only load packets for files that haven't changed
        valid_hashes = cached_hashes & current_hashes
        new_hashes = current_hashes - cached_hashes

        if valid_hashes:
            # Load cached packets for valid files (approximate: load all if any valid)
            # Actually just load everything and clear out stale data later
            for cat in ("common", "proxy", "vpn"):
                all_parsed_packets[cat] = cached_packets.get(cat, [])
            parsed_file_hashes = valid_hashes

        total_pkts = sum(len(v) for v in all_parsed_packets.values())
        print(f"Cache loaded: {len(valid_hashes)} files valid, "
              f"{len(new_hashes)} new, {total_pkts} packets ready.")
        return True
    except Exception as e:
        print(f"Failed to load cache: {e}, will re-parse.")
        return False


class PcapWatcher(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith((".pcap", ".pcapng")):
            cache.invalidate("global_stats")
            rescan_pool()

    def on_deleted(self, event):
        if not event.is_directory and event.src_path.endswith((".pcap", ".pcapng")):
            cache.invalidate("global_stats")
            rescan_pool()


observer: Optional[Observer] = None


def rescan_pool():
    """Rescan all configured directories and rebuild the pool index (fast, no parsing)."""
    global current_pool
    pools = []
    for d in PCAP_DIRS:
        if os.path.isdir(d):
            pools.append(scan_directory(d))
    if os.path.isdir(UPLOAD_DIR):
        pools.append(scan_directory(UPLOAD_DIR))
    current_pool = merge_pools(pools)


def ensure_all_parsed():
    """Parse any unparsed pcap files. Called lazily on first API request."""
    global _parsing_in_progress
    if _parsing_in_progress:
        return
    _parsing_in_progress = True
    try:
        pool_entries = current_pool.all_entries()
        total = len(pool_entries)
        newly_parsed = 0
        for i, entry in enumerate(pool_entries):
            fh = file_hash(entry.path)
            if fh not in parsed_file_hashes:
                try:
                    pkts = parse_pcap(entry.path)
                    all_parsed_packets[entry.category].extend(pkts)
                    parsed_file_hashes.add(fh)
                    newly_parsed += 1
                except Exception as e:
                    print(f"WARNING: Failed to parse {entry.path}: {e}")
            if i % 20 == 0:
                print(f"Parsing progress: {i+1}/{total}")
        if newly_parsed > 0:
            save_cache()
    finally:
        _parsing_in_progress = False


def compute_global_stats() -> GlobalStats:
    stats = {}
    for cat in ("common", "proxy", "vpn"):
        pkts = all_parsed_packets.get(cat, [])
        total_pkts = len(pkts)
        total_bytes = sum(p["length"] for p in pkts)
        stats[cat] = CategoryStats(
            file_count=current_pool.count(cat),
            total_packets=total_pkts,
            total_bytes=total_bytes,
            avg_pkt_size=round(total_bytes / total_pkts, 2) if total_pkts > 0 else 0.0,
        )
    return GlobalStats(**stats, last_updated=time.time())


@asynccontextmanager
async def lifespan(app: FastAPI):
    global observer
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(CACHE_DIR, exist_ok=True)
    rescan_pool()
    load_cache()  # restore parsed data from disk if available
    watcher = PcapWatcher()
    observer = Observer()
    for d in PCAP_DIRS + [UPLOAD_DIR]:
        if os.path.isdir(d):
            observer.schedule(watcher, d, recursive=False)
    observer.start()
    yield
    if observer:
        observer.stop()
        observer.join()


app = FastAPI(title="Pcap Analyzer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "cache_size": len(cache),
        "pool_files": {
            "common": current_pool.count("common"),
            "proxy": current_pool.count("proxy"),
            "vpn": current_pool.count("vpn"),
        },
    }


@app.get("/api/stats")
async def get_stats():
    ensure_all_parsed()
    cached = cache.get("global_stats")
    if cached is not None:
        return cached
    stats = compute_global_stats()
    cache.put("global_stats", stats.model_dump())
    return stats.model_dump()


@app.get("/api/analysis/protocol")
async def get_protocol():
    ensure_all_parsed()
    cached = cache.get("protocol")
    if cached is not None:
        return cached
    result = analyze_protocol(all_parsed_packets).model_dump()
    cache.put("protocol", result)
    return result


@app.get("/api/analysis/packet-size")
async def get_packet_size():
    ensure_all_parsed()
    cached = cache.get("packet_size")
    if cached is not None:
        return cached
    result = analyze_packet_size(all_parsed_packets).model_dump()
    cache.put("packet_size", result)
    return result


@app.get("/api/analysis/flow")
async def get_flow():
    ensure_all_parsed()
    cached = cache.get("flow")
    if cached is not None:
        return cached
    result = analyze_flow(all_parsed_packets).model_dump()
    cache.put("flow", result)
    return result


@app.get("/api/analysis/time-series")
async def get_time_series():
    ensure_all_parsed()
    cached = cache.get("time_series")
    if cached is not None:
        return cached
    result = analyze_time_series(all_parsed_packets).model_dump()
    cache.put("time_series", result)
    return result


@app.get("/api/analysis/tls")
async def get_tls():
    ensure_all_parsed()
    cached = cache.get("tls")
    if cached is not None:
        return cached
    result = analyze_tls(all_parsed_packets).model_dump()
    cache.put("tls", result)
    return result


@app.get("/api/packets")
async def get_packets(
    type: str = Query(default="common", pattern="^(common|proxy|vpn)$"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=500),
):
    ensure_all_parsed()
    records, total = paginate_packets(all_parsed_packets, type, page, size)
    return PacketTableData(
        packets=[r.model_dump() for r in records],
        total=total,
        page=page,
        size=size,
    ).model_dump()


@app.post("/api/upload")
async def upload_pcap(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith((".pcap", ".pcapng")):
        raise HTTPException(status_code=400, detail="Only .pcap and .pcapng files are accepted")

    category = classify_filename(file.filename)
    if category is None:
        raise HTTPException(
            status_code=400,
            detail="Cannot classify file. Filename must contain 'common', 'proxy', or 'vpn'.",
        )

    dest = os.path.join(UPLOAD_DIR, file.filename)
    contents = await file.read()
    with open(dest, "wb") as f:
        f.write(contents)

    try:
        fh = file_hash(dest)
        if fh not in parsed_file_hashes:
            pkts = parse_pcap(dest)
            all_parsed_packets[category].extend(pkts)
            parsed_file_hashes.add(fh)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse pcap: {e}")

    for key in ("global_stats", "protocol", "packet_size", "flow", "time_series", "tls"):
        cache.invalidate(key)

    rescan_pool()

    return {"status": "ok", "filename": file.filename, "category": category}


# Serve frontend static files in production
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
