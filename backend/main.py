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

# --- Capture session state (for demo) ---
import time as _time
import random as _random

STAGE_THRESHOLDS = [500, 1000, 2500, 5000, 10000, 25000]
_capture_state = {
    "start_time": _time.time(),
    "total_packets": 0,
    "current_stage": 0,
    "protocol_history": [],  # list of {time, common, proxy, vpn}
    "all_predictions": [],   # list of prediction dicts
    "misclass": {"common_to_proxy": 0, "proxy_to_common": 0, "vpn_related": 0},
    "confidence_bins": {"90-100%": 0, "80-90%": 0, "60-80%": 0, "0-60%": 0},
}

def _reset_capture_session():
    """Reset capture session for demo restart."""
    _capture_state["start_time"] = _time.time()
    _capture_state["total_packets"] = 0
    _capture_state["current_stage"] = 0
    _capture_state["protocol_history"] = []
    _capture_state["all_predictions"] = []
    _capture_state["misclass"] = {"common_to_proxy": 0, "proxy_to_common": 0, "vpn_related": 0}
    _capture_state["confidence_bins"] = {"90-100%": 0, "80-90%": 0, "60-80%": 0, "0-60%": 0}

def _generate_capture_batch():
    """Generate a batch of simulated packet predictions."""
    import random
    labels = ["Common", "Proxy", "VPN"]
    ranges = {
        "Common": {"pkt_len": (400, 900), "iat": (0.15, 3.5), "proto": ["tcp"]*4+["udp"]},
        "Proxy":  {"pkt_len": (450, 750), "iat": (0.05, 0.50), "proto": ["tcp"]*5+["udp"]},
        "VPN":    {"pkt_len": (250, 380), "iat": (0.008, 0.06), "proto": ["udp"]*4+["tcp"]},
    }
    batch = []
    for _ in range(random.randint(15, 35)):
        true_label = random.choice(labels)
        r = ranges[true_label]
        correct = random.random() < 0.82
        pred_label = true_label if correct else random.choice([l for l in labels if l != true_label])
        prob = round(random.uniform(0.65, 0.95) if correct else random.uniform(0.32, 0.58), 3)
        batch.append({
            "id": _capture_state["total_packets"] + len(batch) + 1,
            "flow": f"flow_{random.randint(1,99999):05d}",
            "proto": random.choice(r["proto"]),
            "pkt_len": f"{random.uniform(*r['pkt_len']):.1f}",
            "iat": f"{random.uniform(*r['iat']):.3f}",
            "entropy": f"{random.uniform(0.80, 1.85):.2f}",
            "trueLabel": true_label,
            "predLabel": pred_label,
            "prob": prob,
            "correct": correct,
        })
    return batch


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
    return {"status": "ok", "cache_size": len(cache), "rows": 84000}


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


@app.get("/api/capture-session")
async def get_capture_session():
    """Simulate real-time packet capture session for demo.
    Each call increments the counter and may advance the stage."""
    import random

    state = _capture_state

    # Check for reset (elapsed > 120s or reached max)
    elapsed = _time.time() - state["start_time"]
    if elapsed > 120 or state["total_packets"] >= STAGE_THRESHOLDS[-1]:
        # Loop back for continuous demo
        if state["total_packets"] >= STAGE_THRESHOLDS[-1]:
            _reset_capture_session()
            elapsed = 0
            state = _capture_state

    # Generate a batch of new packets
    batch = _generate_capture_batch()
    state["total_packets"] += len(batch)
    state["all_predictions"] = (state["all_predictions"] + batch)[-200:]  # keep last 200

    # Update protocol history for area chart
    common_count = sum(1 for p in batch if p["trueLabel"] == "Common")
    proxy_count = sum(1 for p in batch if p["trueLabel"] == "Proxy")
    vpn_count = sum(1 for p in batch if p["trueLabel"] == "VPN")
    state["protocol_history"].append({
        "time": int(elapsed),
        "common": common_count,
        "proxy": proxy_count,
        "vpn": vpn_count,
    })
    # Keep last 60 data points for the chart
    if len(state["protocol_history"]) > 60:
        state["protocol_history"] = state["protocol_history"][-60:]

    # Update confidence bins
    for p in batch:
        prob = p["prob"]
        if prob >= 0.9:
            state["confidence_bins"]["90-100%"] += 1
        elif prob >= 0.8:
            state["confidence_bins"]["80-90%"] += 1
        elif prob >= 0.6:
            state["confidence_bins"]["60-80%"] += 1
        else:
            state["confidence_bins"]["0-60%"] += 1

    # Update misclassification counts
    for p in batch:
        if not p["correct"]:
            if p["trueLabel"] == "Common" and p["predLabel"] == "Proxy":
                state["misclass"]["common_to_proxy"] += 1
            elif p["trueLabel"] == "Proxy" and p["predLabel"] == "Common":
                state["misclass"]["proxy_to_common"] += 1
            elif (p["trueLabel"] == "VPN" and p["predLabel"] != "VPN") or \
                 (p["trueLabel"] != "VPN" and p["predLabel"] == "VPN"):
                state["misclass"]["vpn_related"] += 1

    # Check stage advancement
    new_stage = state["current_stage"]
    for i, threshold in enumerate(STAGE_THRESHOLDS):
        if state["total_packets"] >= threshold and i > new_stage:
            new_stage = i

    stage_advanced = new_stage != state["current_stage"]
    state["current_stage"] = new_stage

    # Packet rate with some randomness
    base_rate = 800 + (state["current_stage"] * 150)
    packet_rate = round(base_rate + random.uniform(-200, 300), 1)

    # Build confidence distribution for chart
    conf_bins = [
        {"range": "90-100%", "count": state["confidence_bins"]["90-100%"]},
        {"range": "80-90%", "count": state["confidence_bins"]["80-90%"]},
        {"range": "60-80%", "count": state["confidence_bins"]["60-80%"]},
        {"range": "0-60%", "count": state["confidence_bins"]["0-60%"]},
    ]

    return {
        "total_packets": state["total_packets"],
        "packet_rate": packet_rate,
        "current_stage": state["current_stage"],
        "stage_thresholds": STAGE_THRESHOLDS,
        "next_threshold": STAGE_THRESHOLDS[state["current_stage"]] if state["current_stage"] < len(STAGE_THRESHOLDS) else STAGE_THRESHOLDS[-1],
        "elapsed_seconds": int(elapsed),
        "stage_advanced": stage_advanced,
        "protocol_history": state["protocol_history"],
        "confidence_distribution": conf_bins,
        "new_predictions": batch,
        "recent_predictions": state["all_predictions"][-20:],  # last 20 for table
        "misclass": state["misclass"],
        "accuracy": round(sum(1 for p in state["all_predictions"] if p["correct"]) / max(len(state["all_predictions"]), 1) * 100, 1),
    }


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
