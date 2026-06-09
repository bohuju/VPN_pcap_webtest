"""Pcap Analyzer API — serves pre-computed CSV flow features to frontend."""
from __future__ import annotations
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .cache import LRUCache
from .csv_data import (
    load_csv_data, compute_global_stats, compute_protocol, compute_packet_size,
    compute_flow, compute_time_series, compute_tls, get_packet_table,
)

# --- Global state ---
cache = LRUCache(max_size=64, ttl_seconds=3600)
csv_rows: list[dict] = []


def refresh_cache():
    """Compute all analysis results from CSV and populate LRU cache."""
    global csv_rows
    if not csv_rows:
        csv_rows = load_csv_data()
    cache.put("global_stats", compute_global_stats(csv_rows).model_dump())
    cache.put("protocol", compute_protocol(csv_rows).model_dump())
    cache.put("packet_size", compute_packet_size(csv_rows).model_dump())
    cache.put("flow", compute_flow(csv_rows).model_dump())
    cache.put("time_series", compute_time_series(csv_rows).model_dump())
    cache.put("tls", compute_tls(csv_rows).model_dump())


@asynccontextmanager
async def lifespan(app: FastAPI):
    refresh_cache()
    yield


app = FastAPI(title="Pcap Analyzer API", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "cache_size": len(cache), "rows": len(csv_rows)}


@app.get("/api/stats")
async def get_stats():
    val = cache.get("global_stats")
    if val is None:
        refresh_cache()
        val = cache.get("global_stats")
    return val


@app.get("/api/analysis/protocol")
async def get_protocol():
    val = cache.get("protocol")
    if val is None:
        refresh_cache()
        val = cache.get("protocol")
    return val


@app.get("/api/analysis/packet-size")
async def get_packet_size():
    val = cache.get("packet_size")
    if val is None:
        refresh_cache()
        val = cache.get("packet_size")
    return val


@app.get("/api/analysis/flow")
async def get_flow():
    val = cache.get("flow")
    if val is None:
        refresh_cache()
        val = cache.get("flow")
    return val


@app.get("/api/analysis/time-series")
async def get_time_series():
    val = cache.get("time_series")
    if val is None:
        refresh_cache()
        val = cache.get("time_series")
    return val


@app.get("/api/analysis/tls")
async def get_tls():
    val = cache.get("tls")
    if val is None:
        refresh_cache()
        val = cache.get("tls")
    return val


@app.get("/api/packets")
async def get_packets(
    type: str = Query(default="common", pattern="^(common|proxy|vpn)$"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=500),
):
    result = get_packet_table(csv_rows, type, page, size)
    return result.model_dump()


# Serve frontend static files
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
