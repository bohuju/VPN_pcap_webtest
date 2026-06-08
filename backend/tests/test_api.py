import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from backend.main import app


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "pool_files" in data


@pytest.mark.asyncio
async def test_stats(client):
    resp = await client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    for key in ("common", "proxy", "vpn", "last_updated"):
        assert key in data


@pytest.mark.asyncio
async def test_protocol(client):
    resp = await client.get("/api/analysis/protocol")
    assert resp.status_code == 200
    data = resp.json()
    assert "categories" in data
    assert "common" in data


@pytest.mark.asyncio
async def test_packet_size(client):
    resp = await client.get("/api/analysis/packet-size")
    assert resp.status_code == 200
    data = resp.json()
    assert "bins" in data
    assert "stats" in data


@pytest.mark.asyncio
async def test_flow(client):
    resp = await client.get("/api/analysis/flow")
    assert resp.status_code == 200
    data = resp.json()
    assert "boxplot" in data


@pytest.mark.asyncio
async def test_time_series(client):
    resp = await client.get("/api/analysis/time-series")
    assert resp.status_code == 200
    data = resp.json()
    assert "rate_timeline" in data
    assert "iat_cdf" in data


@pytest.mark.asyncio
async def test_tls(client):
    resp = await client.get("/api/analysis/tls")
    assert resp.status_code == 200
    data = resp.json()
    assert "version_distribution" in data


@pytest.mark.asyncio
async def test_packets(client):
    resp = await client.get("/api/packets?type=common&page=1&size=10")
    assert resp.status_code == 200
    data = resp.json()
    assert "packets" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_upload_rejects_non_pcap(client):
    resp = await client.post("/api/upload", files={"file": ("test.txt", b"not a pcap", "text/plain")})
    assert resp.status_code == 400
