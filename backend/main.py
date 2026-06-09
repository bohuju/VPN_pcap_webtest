"""Pcap Analyzer API — serves pre-computed CSV flow features to frontend."""
from __future__ import annotations
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .cache import LRUCache
from .csv_data import (
    load_csv_data, compute_global_stats, compute_protocol, compute_packet_size,
    compute_flow, compute_time_series, compute_tls, get_packet_table,
)

# --- Global state ---
cache = LRUCache(max_size=64, ttl_seconds=3600)
csv_rows: list[dict] = []


def _generate_prediction_samples():
    """Generate randomized demo prediction data once at startup."""
    import random
    labels = ["Common", "Proxy", "VPN"]
    ranges = {
        "Common": {"pkt_len": (400, 900), "iat": (0.15, 3.5), "entropy": (0.80, 1.65), "proto": ["tcp"]*4+["udp"]},
        "Proxy":  {"pkt_len": (450, 750), "iat": (0.05, 0.50), "entropy": (1.30, 1.85), "proto": ["tcp"]*5+["udp"]},
        "VPN":    {"pkt_len": (250, 380), "iat": (0.008, 0.06), "entropy": (1.10, 1.60), "proto": ["udp"]*4+["tcp"]},
    }
    samples = []
    for _ in range(12):
        true_label = random.choice(labels)
        r = ranges[true_label]
        correct = random.random() < 0.80
        pred_label = true_label if correct else random.choice([l for l in labels if l != true_label])
        prob = round(random.uniform(0.65, 0.92) if correct else random.uniform(0.35, 0.58), 3)
        samples.append({
            "id": random.randint(1000, 99999),
            "flow": f"flow_{random.randint(1,99999):05d}",
            "proto": random.choice(r["proto"]),
            "pkt_len": f"{random.uniform(*r['pkt_len']):.1f}",
            "iat": f"{random.uniform(*r['iat']):.3f}",
            "entropy": f"{random.uniform(*r['entropy']):.2f}",
            "trueLabel": true_label,
            "predLabel": pred_label,
            "prob": prob,
            "correct": correct,
        })
    return samples


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
    cache.put("prediction_samples", _generate_prediction_samples())


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


@app.get("/api/prediction-samples")
async def get_prediction_samples():
    """Return randomized prediction data, generated once at startup."""
    return cache.get("prediction_samples")


# Serve frontend static files
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))
