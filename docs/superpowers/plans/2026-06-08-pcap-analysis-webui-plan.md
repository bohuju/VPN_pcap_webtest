# Pcap 流量分析 WebUI 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 FastAPI + React SPA 的 Web 应用，对 Common/Proxy/VPN 三类 pcap 流量包进行实时解析和多维度可视化分析。

**Architecture:** FastAPI 后端用 scapy 解析 pcap 文件，LRU 内存缓存解析结果，通过 REST JSON API 暴露统计端点。React 前端每 10s 轮询 `/api/stats`，通过 SWR 按需加载各分析维度数据，ECharts 渲染对比图表。侧边栏提供分析维度导航和拖放上传入口。

**Tech Stack:** Python 3.10+, FastAPI, scapy, watchdog, pytest · React 18, TypeScript, Vite, Tailwind CSS, ECharts (echarts-for-react), SWR, React Router v6, vitest

---

## File Structure

```
backend/
├── __init__.py          # (empty) package marker for relative imports
├── main.py              # FastAPI app entry, CORS, static serve, startup/shutdown
├── parser.py            # scapy pcap parsing -> list[PacketDict]
├── analyzer.py          # Statistical analysis functions -> analysis results
├── cache.py             # LRU in-memory cache for parsed + analyzed results
├── pool_manager.py      # Pcap pool file management (scan, classify, upload)
├── models.py            # Pydantic request/response models
├── requirements.txt     # Python dependencies
└── tests/
    ├── __init__.py
    ├── test_parser.py
    ├── test_analyzer.py
    ├── test_cache.py
    ├── test_pool_manager.py
    └── test_api.py

frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── types/
│   │   └── index.ts          # All TypeScript interfaces
│   ├── context/
│   │   └── StatsContext.tsx  # Global stats via React Context + usePolling
│   ├── hooks/
│   │   └── useAnalysis.ts    # useSWR wrappers for analysis endpoints
│   ├── components/
│   │   ├── Sidebar.tsx       # Sidebar container
│   │   ├── AnalysisNav.tsx   # Navigation links
│   │   ├── TrafficPool.tsx   # File count display
│   │   ├── UploadZone.tsx    # Drag-drop upload
│   │   ├── RefreshBar.tsx    # Status + refresh button
│   │   ├── StatCards.tsx     # 3-column summary cards
│   │   └── charts/
│   │       ├── ProtocolChart.tsx
│   │       ├── PacketSizeChart.tsx
│   │       ├── FlowChart.tsx
│   │       ├── TimeSeriesChart.tsx
│   │       ├── TlsVersionChart.tsx
│   │       └── PacketTable.tsx
│   └── pages/
│       ├── OverviewPage.tsx
│       ├── ProtocolPage.tsx
│       ├── PacketSizePage.tsx
│       ├── FlowPage.tsx
│       ├── TimeSeriesPage.tsx
│       ├── TlsPage.tsx
│       └── DataTablePage.tsx
└── src/__tests__/
    ├── StatCards.test.tsx
    ├── RefreshBar.test.tsx
    └── charts/
        └── ProtocolChart.test.tsx
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`

- [ ] **Step 1: Create backend requirements.txt**

```txt
fastapi==0.115.12
uvicorn[standard]==0.34.2
scapy==2.6.1
watchdog==6.0.0
python-multipart==0.0.20
pytest==8.3.5
httpx==0.28.1
```

Write `backend/requirements.txt` with the above content.

- [ ] **Step 2: Create frontend package.json**

```json
{
  "name": "pcap-analyzer",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "echarts": "^5.6.0",
    "echarts-for-react": "^3.0.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.30.2",
    "swr": "^2.3.6"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@types/react": "^18.3.22",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react": "^4.4.1",
    "autoprefixer": "^10.4.21",
    "jsdom": "^26.1.0",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.7.2",
    "vite": "^6.3.5",
    "vitest": "^3.1.4"
  }
}
```

Write `frontend/package.json` with the above content.

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
});
```

Write `frontend/vite.config.ts` with the above content.

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

Write `frontend/tsconfig.json` with the above content.

- [ ] **Step 5: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

Write `frontend/tailwind.config.js` with the above content.

- [ ] **Step 6: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Write `frontend/postcss.config.js` with the above content.

- [ ] **Step 7: Create index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pcap 流量分析</title>
  </head>
  <body class="bg-slate-50">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Write `frontend/index.html` with the above content.

- [ ] **Step 8: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

Write `frontend/src/index.css` with the above content.

- [ ] **Step 9: Create src/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Write `frontend/src/main.tsx` with the above content.

- [ ] **Step 10: Create minimal src/App.tsx**

```typescript
function App() {
  return (
    <div className="flex h-screen">
      <h1 className="text-xl font-bold p-4">Pcap Analyzer</h1>
    </div>
  );
}

export default App;
```

Write `frontend/src/App.tsx` with the above content.

- [ ] **Step 11: Install dependencies and verify**

Run: `cd frontend && npm install`
Expected: Dependencies install without errors.

Run: `cd frontend && npx vitest run`
Expected: "No test files found" (tests not written yet, vitest is configured).

- [ ] **Step 12: Commit**

```bash
git add backend/requirements.txt frontend/
git commit -m "chore: scaffold project with FastAPI backend deps and React+Vite+Tailwind frontend"
```

---

### Task 2: TypeScript Types + StatsContext + Hooks

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/context/StatsContext.tsx`
- Create: `frontend/src/hooks/useAnalysis.ts`

- [ ] **Step 1: Write types/index.ts**

```typescript
// === Traffic category ===
export type TrafficType = 'common' | 'proxy' | 'vpn';

// === /api/stats response ===
export interface CategoryStats {
  file_count: number;
  total_packets: number;
  total_bytes: number;
  avg_pkt_size: number;
}

export interface GlobalStats {
  common: CategoryStats;
  proxy: CategoryStats;
  vpn: CategoryStats;
  last_updated: number;
}

// === /api/analysis/protocol response ===
export interface ProtocolData {
  categories: string[];
  common: number[];
  proxy: number[];
  vpn: number[];
  unit: string;
}

// === /api/analysis/packet-size response ===
export interface PacketSizeBin {
  bin_start: number;
  bin_end: number;
  common: number;
  proxy: number;
  vpn: number;
}

export interface PacketSizeData {
  bins: PacketSizeBin[];
  stats: {
    common: { mean: number; min: number; max: number; std: number };
    proxy: { mean: number; min: number; max: number; std: number };
    vpn: { mean: number; min: number; max: number; std: number };
  };
}

// === /api/analysis/flow response ===
export interface FlowBoxData {
  category: string;  // "packets_per_flow" | "bytes_per_flow" | "duration"
  common: number[];  // [min, q1, median, q3, max]
  proxy: number[];
  vpn: number[];
}

export interface FlowData {
  boxplot: FlowBoxData[];
}

// === /api/analysis/time-series response ===
export interface TimeSeriesPoint {
  time: number;
  packet_rate: number;
}

export interface IATPoint {
  interval: number;
  common_cdf: number;
  proxy_cdf: number;
  vpn_cdf: number;
}

export interface TimeSeriesData {
  rate_timeline: {
    common: TimeSeriesPoint[];
    proxy: TimeSeriesPoint[];
    vpn: TimeSeriesPoint[];
  };
  iat_cdf: IATPoint[];
}

// === /api/analysis/tls response ===
export interface TlsVersionItem {
  name: string;
  value: number;
}

export interface JA3Record {
  fingerprint: string;
  count: number;
  sni: string;
}

export interface TlsData {
  version_distribution: {
    common: TlsVersionItem[];
    proxy: TlsVersionItem[];
    vpn: TlsVersionItem[];
  };
  ja3_fingerprints: {
    common: JA3Record[];
    proxy: JA3Record[];
    vpn: JA3Record[];
  };
}

// === /api/packets response ===
export interface PacketRecord {
  timestamp: number;
  src_ip: string;
  dst_ip: string;
  src_port: number;
  dst_port: number;
  protocol: string;
  length: number;
  info: string;
}

export interface PacketTableData {
  packets: PacketRecord[];
  total: number;
  page: number;
  size: number;
}

// === Color constants ===
export const TRAFFIC_COLORS: Record<TrafficType, string> = {
  common: '#4caf50',
  proxy: '#ff9800',
  vpn: '#f44336',
};

export const TRAFFIC_LABELS: Record<TrafficType, string> = {
  common: 'Common',
  proxy: 'Proxy',
  vpn: 'VPN',
};

export const TRAFFIC_TYPES: TrafficType[] = ['common', 'proxy', 'vpn'];
```

Write `frontend/src/types/index.ts` with the above content.

- [ ] **Step 2: Write StatsContext.tsx**

```typescript
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { GlobalStats } from '../types';

interface StatsContextValue {
  stats: GlobalStats | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

const StatsContext = createContext<StatsContextValue>({
  stats: null,
  isLoading: true,
  error: null,
  lastUpdated: null,
  refresh: () => {},
});

const POLL_INTERVAL = 10_000;

export function StatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GlobalStats = await res.json();
      setStats(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Polling
  useEffect(() => {
    const id = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchStats]);

  return (
    <StatsContext.Provider value={{ stats, isLoading, error, lastUpdated, refresh: fetchStats }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  return useContext(StatsContext);
}
```

Write `frontend/src/context/StatsContext.tsx` with the above content.

- [ ] **Step 3: Write hooks/useAnalysis.ts**

```typescript
import useSWR from 'swr';
import type { ProtocolData, PacketSizeData, FlowData, TimeSeriesData, TlsData, PacketTableData } from '../types';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

export function useProtocolData() {
  return useSWR<ProtocolData>('/api/analysis/protocol', fetcher);
}

export function usePacketSizeData() {
  return useSWR<PacketSizeData>('/api/analysis/packet-size', fetcher);
}

export function useFlowData() {
  return useSWR<FlowData>('/api/analysis/flow', fetcher);
}

export function useTimeSeriesData() {
  return useSWR<TimeSeriesData>('/api/analysis/time-series', fetcher);
}

export function useTlsData() {
  return useSWR<TlsData>('/api/analysis/tls', fetcher);
}

export function usePacketTable(type: string, page: number, size: number) {
  const key = `/api/packets?type=${type}&page=${page}&size=${size}`;
  return useSWR<PacketTableData>(key, fetcher);
}
```

Write `frontend/src/hooks/useAnalysis.ts` with the above content.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/ frontend/src/context/ frontend/src/hooks/
git commit -m "feat: add TypeScript types, StatsContext with polling, and SWR analysis hooks"
```

---

### Task 3: Backend Core — Parser + Cache + Pool Manager

**Files:**
- Create: `backend/__init__.py`, `backend/parser.py`, `backend/cache.py`, `backend/pool_manager.py`, `backend/models.py`
- Create: `backend/tests/__init__.py`, `backend/tests/test_parser.py`, `backend/tests/test_cache.py`, `backend/tests/test_pool_manager.py`

- [ ] **Step 0: Create __init__.py files**

Create `backend/__init__.py` (empty file):
```bash
touch backend/__init__.py backend/tests/__init__.py
```

- [ ] **Step 1: Write backend/models.py**

```python
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
    stats: dict[str, SizeStats]  # keys: "common", "proxy", "vpn"


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
```

Write `backend/models.py` with the above content.

- [ ] **Step 2: Write backend/parser.py**

```python
from __future__ import annotations
import hashlib
from typing import List, Dict, Any
from scapy.all import rdpcap, IP, TCP, UDP, DNS, Raw, TLS


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
    """
    Parse a pcap file and return a list of packet dicts.
    Raises Exception if file cannot be read (corrupt, not pcap, etc).
    """
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
```

Write `backend/parser.py` with the above content.

- [ ] **Step 3: Write backend/cache.py**

```python
from __future__ import annotations
import time
from collections import OrderedDict
from typing import Any, Optional


class LRUCache:
    """Thread-unsafe LRU cache with per-key TTL."""

    def __init__(self, max_size: int = 128, ttl_seconds: float = 3600.0):
        self.max_size = max_size
        self.ttl = ttl_seconds
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()

    def get(self, key: str) -> Optional[Any]:
        if key not in self._store:
            return None
        ts, val = self._store[key]
        if time.time() - ts > self.ttl:
            del self._store[key]
            return None
        # Move to end (most recently used)
        self._store.move_to_end(key)
        return val

    def put(self, key: str, value: Any) -> None:
        if key in self._store:
            self._store.move_to_end(key)
        self._store[key] = (time.time(), value)
        while len(self._store) > self.max_size:
            self._store.popitem(last=False)  # evict LRU

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    def clear(self) -> None:
        self._store.clear()

    def __len__(self) -> int:
        return len(self._store)
```

Write `backend/cache.py` with the above content.

- [ ] **Step 4: Write backend/pool_manager.py**

```python
from __future__ import annotations
import os
import glob
from dataclasses import dataclass, field
from typing import List

PCAP_EXTENSIONS = (".pcap", ".pcapng")


@dataclass
class PoolEntry:
    path: str
    category: str  # "common" | "proxy" | "vpn"
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
    if "proxy" in name or "ssr" in name or "vmess" in name or "trojan" in name or "ss_" in name or "_ss" in name:
        return "proxy"
    if "vpn" in name:
        return "vpn"
    # Heuristic: names like "0_01.pcap", "5_02.pcap", "8_03.pcap" (in vpn folder) are vpn
    # Names like "1690183802_clear_class_0__type_null..." are common
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
```

Write `backend/pool_manager.py` with the above content.

- [ ] **Step 5: Write test__parser.py**

```python
import tempfile
import os
from backend.parser import parse_pcap, _classify_protocol, file_hash
from scapy.all import IP, TCP, DNS, UDP, wrpcap, Ether, Raw


def make_test_pcap():
    """Create a minimal test pcap with a few packets and return path."""
    pkts = [
        Ether() / IP(src="10.0.0.1", dst="10.0.0.2") / TCP(sport=12345, dport=443) / Raw(b"\x16\x03\x01"),
        Ether() / IP(src="10.0.0.1", dst="10.0.0.2") / UDP(sport=9999, dport=53),
        Ether() / IP(src="10.0.0.1", dst="10.0.0.2") / TCP(sport=11111, dport=80) / Raw(b"GET / HTTP/1.1"),
    ]
    tmp = tempfile.NamedTemporaryFile(suffix=".pcap", delete=False)
    wrpcap(tmp.name, pkts)
    return tmp.name


def test_parse_pcap_returns_list():
    path = make_test_pcap()
    try:
        result = parse_pcap(path)
        assert isinstance(result, list)
        assert len(result) == 3
    finally:
        os.unlink(path)


def test_parse_pcap_has_expected_fields():
    path = make_test_pcap()
    try:
        result = parse_pcap(path)
        pkt = result[0]
        for field in ("timestamp", "src_ip", "dst_ip", "src_port", "dst_port", "protocol", "length", "info"):
            assert field in pkt, f"Missing field: {field}"
    finally:
        os.unlink(path)


def test_classify_protocol_https():
    path = make_test_pcap()
    try:
        result = parse_pcap(path)
        # First packet has dport=443 -> HTTPS
        assert result[0]["protocol"] == "HTTPS"
    finally:
        os.unlink(path)


def test_classify_protocol_dns():
    path = make_test_pcap()
    try:
        result = parse_pcap(path)
        # Second packet has UDP dport=53 -> DNS
        assert result[1]["protocol"] == "DNS"
    finally:
        os.unlink(path)


def test_classify_protocol_http():
    path = make_test_pcap()
    try:
        result = parse_pcap(path)
        # Third packet has dport=80 -> HTTP
        assert result[2]["protocol"] == "HTTP"
    finally:
        os.unlink(path)


def test_file_hash():
    path = make_test_pcap()
    try:
        h1 = file_hash(path)
        h2 = file_hash(path)
        assert h1 == h2
        assert len(h1) == 32
    finally:
        os.unlink(path)
```

Write `backend/tests/test_parser.py` with the above content.

- [ ] **Step 6: Write test_cache.py**

```python
from backend.cache import LRUCache


def test_cache_put_and_get():
    c = LRUCache(max_size=10)
    c.put("a", 123)
    assert c.get("a") == 123
    assert c.get("nonexistent") is None


def test_cache_eviction():
    c = LRUCache(max_size=2)
    c.put("a", 1)
    c.put("b", 2)
    c.put("c", 3)
    assert c.get("a") is None  # evicted (LRU)
    assert c.get("b") == 2
    assert c.get("c") == 3


def test_cache_invalidate():
    c = LRUCache(max_size=10)
    c.put("a", 1)
    c.put("b", 2)
    c.invalidate("a")
    assert c.get("a") is None
    assert c.get("b") == 2


def test_cache_clear():
    c = LRUCache(max_size=10)
    c.put("a", 1)
    c.put("b", 2)
    c.clear()
    assert c.get("a") is None
    assert c.get("b") is None
```

Write `backend/tests/test_cache.py` with the above content.

- [ ] **Step 7: Write test_pool_manager.py**

```python
import os
import tempfile
from backend.pool_manager import classify_filename, scan_directory, Pool, merge_pools


def test_classify_common():
    assert classify_filename("common_www_baidu_com_003.pcap") == "common"
    assert classify_filename("1690183802_clear_class_0__type_null_url_0_normal.pcap") == "common"


def test_classify_proxy():
    assert classify_filename("proxy_www_baidu_com_003.pcap") == "proxy"
    assert classify_filename("1690558470_clear_class_16__type_ssr_url_1-1_global.pcap") == "proxy"
    assert classify_filename("1690810305_clear_class_5__type_vmess_url_2-1_global.pcap") == "proxy"


def test_classify_vpn():
    assert classify_filename("vpn_www_baidu_com_003.pcap") == "vpn"
    assert classify_filename("vpn_mail_163_com_015.pcap") == "vpn"


def test_classify_unknown():
    assert classify_filename("unknown_traffic_001.pcap") is None
    assert classify_filename("0_01.pcap") is None  # heuristic needs _clear_class_


def test_scan_directory():
    with tempfile.TemporaryDirectory() as d:
        # Create test files
        for name in ["common_test.pcap", "proxy_test.pcap", "vpn_test.pcap", "unknown.pcap"]:
            with open(os.path.join(d, name), "w") as f:
                f.write("dummy")
        pool = scan_directory(d)
        assert pool.count("common") == 1
        assert pool.count("proxy") == 1
        assert pool.count("vpn") == 1
        assert pool.count("nonexistent_category") == 0


def test_merge_pools():
    p1 = Pool()
    p1.common.append(type("e", (), {"path": "/a", "category": "common", "name": "a.pcap"})())
    p2 = Pool()
    p2.proxy.append(type("e", (), {"path": "/b", "category": "proxy", "name": "b.pcap"})())
    merged = merge_pools([p1, p2])
    assert merged.count("common") == 1
    assert merged.count("proxy") == 1
    assert merged.count("vpn") == 0
```

Write `backend/tests/test_pool_manager.py` with the above content.

- [ ] **Step 8: Run backend tests to verify they pass**

Run: `cd /home/bohuju/self_project/VPN_pcap_webtest && python -m pytest backend/tests/test_parser.py backend/tests/test_cache.py backend/tests/test_pool_manager.py -v`
Expected: All tests pass.

Note: If scapy is not installed yet, first run `pip install -r backend/requirements.txt`.

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: backend core — pcap parser, LRU cache, pool manager with tests"
```

---

### Task 4: Backend — Analyzer with Tests

**Files:**
- Create: `backend/analyzer.py`
- Create: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Write backend/analyzer.py**

```python
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
        # Fill bins
        for s in sizes:
            idx = min(s // 100, len(bins) - 1)
            setattr(bins[idx], cat, getattr(bins[idx], cat) + 1)

    # Normalize bins to percentage
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
        """Group packets into flows by 5-tuple."""
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
        window = 1.0  # 1-second windows
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

    # IAT CDF
    all_iats: Dict[str, List[float]] = {}
    for cat in ("common", "proxy", "vpn"):
        pkts = all_packets.get(cat, [])
        if not pkts:
            all_iats[cat] = []
            continue
        sorted_pkts = sorted(pkts, key=lambda x: x["timestamp"])
        iats = [sorted_pkts[i]["timestamp"] - sorted_pkts[i - 1]["timestamp"] for i in range(1, len(sorted_pkts))]
        all_iats[cat] = sorted(iats)

    # Build common CDF x-axis (merged from all categories)
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
    # Note: Full TLS parsing requires scapy TLS layer support (scapy>=2.5 with tls module).
    # We provide stub data when TLS parsing is unavailable.
    version_dist: Dict[str, List[TlsVersionItem]] = {}
    ja3_fingerprints: Dict[str, List[JA3Record]] = {}

    for cat in ("common", "proxy", "vpn"):
        pkts = all_packets.get(cat, [])
        https_count = sum(1 for p in pkts if p.get("protocol") == "HTTPS")
        # Stub: report HTTPS packet count as "TLS 1.2/1.3" combined
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
```

Write `backend/analyzer.py` with the above content.

- [ ] **Step 2: Write test_analyzer.py**

```python
from backend.analyzer import analyze_protocol, analyze_packet_size, analyze_flow, analyze_time_series, paginate_packets


SAMPLE_PACKETS = {
    "common": [
        {"timestamp": 0.0, "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2", "src_port": 12345, "dst_port": 443, "protocol": "HTTPS", "length": 150, "info": "TLS"},
        {"timestamp": 0.1, "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2", "src_port": 11111, "dst_port": 80, "protocol": "HTTP", "length": 200, "info": "GET /"},
        {"timestamp": 0.2, "src_ip": "10.0.0.1", "dst_ip": "8.8.8.8", "src_port": 55555, "dst_port": 53, "protocol": "DNS", "length": 80, "info": "DNS Query"},
    ],
    "proxy": [
        {"timestamp": 0.0, "src_ip": "10.0.0.1", "dst_ip": "1.2.3.4", "src_port": 54321, "dst_port": 443, "protocol": "HTTPS", "length": 300, "info": "TLS via proxy"},
    ],
    "vpn": [
        {"timestamp": 0.0, "src_ip": "10.8.0.1", "dst_ip": "10.8.0.2", "src_port": 1111, "dst_port": 2222, "protocol": "TCP", "length": 100, "info": "VPN tunnel"},
        {"timestamp": 0.5, "src_ip": "10.8.0.1", "dst_ip": "10.8.0.2", "src_port": 1111, "dst_port": 2222, "protocol": "TCP", "length": 120, "info": "VPN tunnel"},
    ],
}


def test_analyze_protocol():
    result = analyze_protocol(SAMPLE_PACKETS)
    assert result.categories == ["TCP", "UDP", "HTTP", "HTTPS", "DNS", "Other"]
    assert len(result.common) == 6
    assert sum(result.common) > 0  # at least one protocol found
    assert result.unit == "percent"


def test_analyze_packet_size():
    result = analyze_packet_size(SAMPLE_PACKETS)
    assert len(result.bins) == 15  # 0..1500 in steps of 100
    assert result.stats["common"].mean > 0
    assert len(result.stats) == 3


def test_analyze_flow():
    result = analyze_flow(SAMPLE_PACKETS)
    assert len(result.boxplot) == 3  # 3 metrics
    for fd in result.boxplot:
        assert len(fd.common) == 5  # boxplot 5-number summary


def test_analyze_time_series():
    result = analyze_time_series(SAMPLE_PACKETS)
    assert "common" in result.rate_timeline
    assert "proxy" in result.rate_timeline
    assert "vpn" in result.rate_timeline
    assert len(result.iat_cdf) > 0


def test_paginate_packets():
    records, total = paginate_packets(SAMPLE_PACKETS, "common", page=1, size=2)
    assert total == 3
    assert len(records) == 2
    assert records[0].protocol == "HTTPS"
```

Write `backend/tests/test_analyzer.py` with the above content.

- [ ] **Step 3: Run analyzer tests**

Run: `cd /home/bohuju/self_project/VPN_pcap_webtest && python -m pytest backend/tests/test_analyzer.py -v`
Expected: All 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/analyzer.py backend/tests/test_analyzer.py
git commit -m "feat: add statistical analyzers for protocol, packet-size, flow, time-series, TLS"
```

---

### Task 5: Backend — FastAPI Application + API Endpoints

**Files:**
- Create: `backend/main.py`
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Write backend/main.py**

```python
from __future__ import annotations
import os
import time
import asyncio
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
from .pool_manager import scan_directory, merge_pools, classify_filename, Pool, PoolEntry
from .analyzer import (
    analyze_protocol,
    analyze_packet_size,
    analyze_flow,
    analyze_time_series,
    analyze_tls,
    paginate_packets,
)
from .models import GlobalStats, CategoryStats, PacketTableData, TlsData

# --- Configuration ---
PCAP_DIRS = [
    os.environ.get("PCAP_DIR1", str(Path(__file__).parent.parent / "experiment2")),
    os.environ.get("PCAP_DIR2", str(Path(__file__).parent.parent / "experiment2_database")),
]
UPLOAD_DIR = os.environ.get("PCAP_POOL_DIR", str(Path(__file__).parent.parent / "pcap_pool"))

# --- Global state ---
cache = LRUCache(max_size=256, ttl_seconds=3600)
current_pool: Pool = Pool()
all_parsed_packets: dict[str, list] = {"common": [], "proxy": [], "vpn": []}
parsed_file_hashes: set[str] = set()


class PcapWatcher(FileSystemEventHandler):
    """Watchdog handler: invalidate cache on file changes."""

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
    """Rescan all configured directories and rebuild the pool."""
    global current_pool, all_parsed_packets, parsed_file_hashes
    pools = []
    for d in PCAP_DIRS:
        if os.path.isdir(d):
            pools.append(scan_directory(d))
    if os.path.isdir(UPLOAD_DIR):
        pools.append(scan_directory(UPLOAD_DIR))

    new_pool = merge_pools(pools)
    # Check which files are new and need parsing
    for entry in new_pool.all_entries():
        fh = file_hash(entry.path)
        if fh not in parsed_file_hashes:
            try:
                pkts = parse_pcap(entry.path)
                all_parsed_packets[entry.category].extend(pkts)
                parsed_file_hashes.add(fh)
            except Exception as e:
                print(f"WARNING: Failed to parse {entry.path}: {e}")

    current_pool = new_pool


def compute_global_stats() -> GlobalStats:
    """Compute GlobalStats from current pool and parsed packets."""
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
    # Startup: rescan and start watchdog
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    rescan_pool()
    watcher = PcapWatcher()
    observer = Observer()
    for d in PCAP_DIRS + [UPLOAD_DIR]:
        if os.path.isdir(d):
            observer.schedule(watcher, d, recursive=False)
    observer.start()
    yield
    # Shutdown
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
    cached = cache.get("global_stats")
    if cached is not None:
        return cached
    stats = compute_global_stats()
    cache.put("global_stats", stats.model_dump())
    return stats.model_dump()


@app.get("/api/analysis/protocol")
async def get_protocol():
    cached = cache.get("protocol")
    if cached is not None:
        return cached
    result = analyze_protocol(all_parsed_packets).model_dump()
    cache.put("protocol", result)
    return result


@app.get("/api/analysis/packet-size")
async def get_packet_size():
    cached = cache.get("packet_size")
    if cached is not None:
        return cached
    result = analyze_packet_size(all_parsed_packets).model_dump()
    cache.put("packet_size", result)
    return result


@app.get("/api/analysis/flow")
async def get_flow():
    cached = cache.get("flow")
    if cached is not None:
        return cached
    result = analyze_flow(all_parsed_packets).model_dump()
    cache.put("flow", result)
    return result


@app.get("/api/analysis/time-series")
async def get_time_series():
    cached = cache.get("time_series")
    if cached is not None:
        return cached
    result = analyze_time_series(all_parsed_packets).model_dump()
    cache.put("time_series", result)
    return result


@app.get("/api/analysis/tls")
async def get_tls():
    cached = cache.get("tls")
    if cached is not None:
        return cached
    result = analyze_tls(all_parsed_packets).model_dump()
    cache.put("tls", result)
    return result


@app.get("/api/packets")
async def get_packets(
    type: str = Query(default="common", regex="^(common|proxy|vpn)$"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=500),
):
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

    # Classify
    category = classify_filename(file.filename)
    if category is None:
        raise HTTPException(
            status_code=400,
            detail="Cannot classify file. Filename must contain 'common', 'proxy', or 'vpn'.",
        )

    # Save
    dest = os.path.join(UPLOAD_DIR, file.filename)
    contents = await file.read()
    with open(dest, "wb") as f:
        f.write(contents)

    # Parse and add to memory
    try:
        fh = file_hash(dest)
        if fh not in parsed_file_hashes:
            pkts = parse_pcap(dest)
            all_parsed_packets[category].extend(pkts)
            parsed_file_hashes.add(fh)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse pcap: {e}")

    # Invalidate caches
    for key in ("global_stats", "protocol", "packet_size", "flow", "time_series", "tls"):
        cache.invalidate(key)

    # Update pool
    rescan_pool()

    return {"status": "ok", "filename": file.filename, "category": category}


# Serve frontend static files in production
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
```

Write `backend/main.py` with the above content.

- [ ] **Step 2: Write test_api.py**

```python
import pytest
from httpx import ASGITransport, AsyncClient
from backend.main import app


@pytest.fixture
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
```

Write `backend/tests/test_api.py` with the above content.

- [ ] **Step 3: Run API tests**

Run: `cd /home/bohuju/self_project/VPN_pcap_webtest && python -m pytest backend/tests/test_api.py -v`
Expected: All 9 tests pass (health check, stats, all analysis endpoints, packet pagination, upload validation).

- [ ] **Step 4: Start backend and verify with curl**

Run in background: `cd /home/bohuju/self_project/VPN_pcap_webtest && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &`

Run: `curl -s http://localhost:8000/api/health | python -m json.tool`
Expected: `{"status": "ok", ...}` with pool_files showing file counts.

Run: `curl -s http://localhost:8000/api/stats | python -m json.tool`
Expected: GlobalStats with common/proxy/vpn counts.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat: FastAPI application with all endpoints, watchdog, upload, and API tests"
```

---

### Task 6: Frontend — Layout Shell (Sidebar + RefreshBar + Router)

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/components/Sidebar.tsx`, `frontend/src/components/AnalysisNav.tsx`, `frontend/src/components/TrafficPool.tsx`, `frontend/src/components/RefreshBar.tsx`

- [ ] **Step 1: Update App.tsx with router and layout**

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StatsProvider } from './context/StatsContext';
import Sidebar from './components/Sidebar';
import RefreshBar from './components/RefreshBar';
import OverviewPage from './pages/OverviewPage';
import ProtocolPage from './pages/ProtocolPage';
import PacketSizePage from './pages/PacketSizePage';
import FlowPage from './pages/FlowPage';
import TimeSeriesPage from './pages/TimeSeriesPage';
import TlsPage from './pages/TlsPage';
import DataTablePage from './pages/DataTablePage';

function App() {
  return (
    <BrowserRouter>
      <StatsProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <RefreshBar />
            <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/protocol" element={<ProtocolPage />} />
                <Route path="/packet-size" element={<PacketSizePage />} />
                <Route path="/flow" element={<FlowPage />} />
                <Route path="/time-series" element={<TimeSeriesPage />} />
                <Route path="/tls" element={<TlsPage />} />
                <Route path="/data-table" element={<DataTablePage />} />
              </Routes>
            </main>
          </div>
        </div>
      </StatsProvider>
    </BrowserRouter>
  );
}

export default App;
```

Replace the content of `frontend/src/App.tsx` with the above.

- [ ] **Step 2: Create Sidebar.tsx**

```typescript
import AnalysisNav from './AnalysisNav';
import TrafficPool from './TrafficPool';
import UploadZone from './UploadZone';

export default function Sidebar() {
  return (
    <aside className="w-[220px] bg-slate-800 text-slate-200 flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-bold text-white">🔬 流量分析</h1>
      </div>
      <div className="p-3 border-b border-slate-700">
        <span className="text-xs uppercase text-slate-400 tracking-wider">分析维度</span>
        <AnalysisNav />
      </div>
      <div className="p-3 border-b border-slate-700">
        <span className="text-xs uppercase text-slate-400 tracking-wider">流量池</span>
        <TrafficPool />
      </div>
      <div className="mt-auto p-3">
        <UploadZone />
      </div>
    </aside>
  );
}
```

Write `frontend/src/components/Sidebar.tsx` with the above content.

- [ ] **Step 3: Create AnalysisNav.tsx**

```typescript
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: '📈 概览总览', end: true },
  { to: '/protocol', label: '🌐 协议分布', end: false },
  { to: '/packet-size', label: '📦 包大小分析', end: false },
  { to: '/flow', label: '🌊 流/会话分析', end: false },
  { to: '/time-series', label: '⏱ 时间序列', end: false },
  { to: '/tls', label: '🔐 TLS 特征', end: false },
  { to: '/data-table', label: '📋 详细数据表', end: false },
];

export default function AnalysisNav() {
  return (
    <nav className="mt-2 flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `px-3 py-1.5 rounded text-sm transition-colors ${
              isActive
                ? 'bg-slate-700 text-white font-medium'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

Write `frontend/src/components/AnalysisNav.tsx` with the above content.

- [ ] **Step 4: Create TrafficPool.tsx**

```typescript
import { useStats } from '../context/StatsContext';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../types';

export default function TrafficPool() {
  const { stats } = useStats();

  return (
    <div className="mt-2 space-y-1.5">
      {TRAFFIC_TYPES.map((type) => (
        <div key={type} className="flex justify-between items-center px-2 py-1 rounded text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: TRAFFIC_COLORS[type] }}
            />
            {TRAFFIC_LABELS[type]}
          </span>
          <span className="text-slate-400 font-mono text-xs">
            {stats ? stats[type].file_count : '-'} 个
          </span>
        </div>
      ))}
    </div>
  );
}
```

Write `frontend/src/components/TrafficPool.tsx` with the above content.

- [ ] **Step 5: Create RefreshBar.tsx**

```typescript
import { useStats } from '../context/StatsContext';

export default function RefreshBar() {
  const { isLoading, error, lastUpdated, refresh } = useStats();

  return (
    <div className="h-10 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : isLoading ? 'bg-yellow-500' : 'bg-green-500'}`} />
        <span>
          {error
            ? `错误: ${error}`
            : isLoading
            ? '加载中...'
            : `上次更新: ${lastUpdated?.toLocaleTimeString() ?? '-'}`}
        </span>
      </div>
      <button
        onClick={refresh}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        🔄 刷新
      </button>
    </div>
  );
}
```

Write `frontend/src/components/RefreshBar.tsx` with the above content.

- [ ] **Step 6: Create placeholder UploadZone.tsx**

```typescript
import { useCallback, useState } from 'react';

export default function UploadZone() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setMessage('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.filename}`);
      } else {
        setMessage(`❌ ${data.detail}`);
      }
    } catch {
      setMessage('❌ 上传失败');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.pcap') || file.name.endsWith('.pcapng'))) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-slate-600 rounded-lg p-3 text-center cursor-pointer hover:border-slate-400 transition-colors"
    >
      <input
        type="file"
        accept=".pcap,.pcapng"
        onChange={handleChange}
        className="hidden"
        id="upload-input"
      />
      <label htmlFor="upload-input" className="cursor-pointer block">
        <div className="text-2xl mb-1">📤</div>
        <div className="text-xs text-slate-400">
          {uploading ? '解析中...' : '拖放或点击上传'}
        </div>
        <div className="text-xs text-slate-500">.pcap / .pcapng</div>
      </label>
      {message && <div className="mt-1 text-xs">{message}</div>}
    </div>
  );
}
```

Write `frontend/src/components/UploadZone.tsx` with the above content.

- [ ] **Step 7: Create stub page files**

Run: `mkdir -p frontend/src/pages`

Write stub content for each page in `frontend/src/pages/`:

```typescript
// OverviewPage.tsx
export default function OverviewPage() {
  return <div><h2 className="text-xl font-bold mb-4">📈 概览总览</h2><p className="text-slate-500">加载中...</p></div>;
}
```

```typescript
// ProtocolPage.tsx
export default function ProtocolPage() {
  return <div><h2 className="text-xl font-bold mb-4">🌐 协议分布</h2><p className="text-slate-500">加载中...</p></div>;
}
```

```typescript
// PacketSizePage.tsx
export default function PacketSizePage() {
  return <div><h2 className="text-xl font-bold mb-4">📦 包大小分析</h2><p className="text-slate-500">加载中...</p></div>;
}
```

```typescript
// FlowPage.tsx
export default function FlowPage() {
  return <div><h2 className="text-xl font-bold mb-4">🌊 流/会话分析</h2><p className="text-slate-500">加载中...</p></div>;
}
```

```typescript
// TimeSeriesPage.tsx
export default function TimeSeriesPage() {
  return <div><h2 className="text-xl font-bold mb-4">⏱ 时间序列</h2><p className="text-slate-500">加载中...</p></div>;
}
```

```typescript
// TlsPage.tsx
export default function TlsPage() {
  return <div><h2 className="text-xl font-bold mb-4">🔐 TLS 特征</h2><p className="text-slate-500">加载中...</p></div>;
}
```

```typescript
// DataTablePage.tsx
export default function DataTablePage() {
  return <div><h2 className="text-xl font-bold mb-4">📋 详细数据表</h2><p className="text-slate-500">加载中...</p></div>;
}
```

Create each of the 7 page files with the content shown above.

- [ ] **Step 8: Verify TypeScript compiles and frontend builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 9: Write unit tests for RefreshBar and TrafficPool**

Create `frontend/src/__tests__/RefreshBar.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsContext } from '../context/StatsContext';
import RefreshBar from '../components/RefreshBar';

describe('RefreshBar', () => {
  it('renders loading state', () => {
    render(
      <StatsContext.Provider value={{ stats: null, isLoading: true, error: null, lastUpdated: null, refresh: vi.fn() }}>
        <RefreshBar />
      </StatsContext.Provider>
    );
    expect(screen.getByText('加载中...')).toBeTruthy();
  });

  it('renders updated time when loaded', () => {
    const d = new Date();
    render(
      <StatsContext.Provider value={{ stats: null, isLoading: false, error: null, lastUpdated: d, refresh: vi.fn() }}>
        <RefreshBar />
      </StatsContext.Provider>
    );
    expect(screen.getByText(new RegExp(`上次更新:.*${d.toLocaleTimeString()}`))).toBeTruthy();
  });

  it('renders error state', () => {
    render(
      <StatsContext.Provider value={{ stats: null, isLoading: false, error: 'Network error', lastUpdated: null, refresh: vi.fn() }}>
        <RefreshBar />
      </StatsContext.Provider>
    );
    expect(screen.getByText('错误: Network error')).toBeTruthy();
  });
});
```

Write `frontend/src/__tests__/RefreshBar.test.tsx` with the above content.

Create `frontend/src/__tests__/StatCards.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsContext } from '../context/StatsContext';
import StatCards from '../components/StatCards';

const mockStats = {
  common: { file_count: 10, total_packets: 1000, total_bytes: 50000, avg_pkt_size: 50.0 },
  proxy: { file_count: 20, total_packets: 2000, total_bytes: 100000, avg_pkt_size: 50.0 },
  vpn: { file_count: 30, total_packets: 3000, total_bytes: 150000, avg_pkt_size: 50.0 },
  last_updated: Date.now() / 1000,
};

describe('StatCards', () => {
  it('renders three category cards', () => {
    render(
      <StatsContext.Provider value={{ stats: mockStats, isLoading: false, error: null, lastUpdated: new Date(), refresh: () => {} }}>
        <StatCards />
      </StatsContext.Provider>
    );
    expect(screen.getByText('Common')).toBeTruthy();
    expect(screen.getByText('Proxy')).toBeTruthy();
    expect(screen.getByText('VPN')).toBeTruthy();
  });

  it('shows file counts', () => {
    render(
      <StatsContext.Provider value={{ stats: mockStats, isLoading: false, error: null, lastUpdated: new Date(), refresh: () => {} }}>
        <StatCards />
      </StatsContext.Provider>
    );
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
  });
});
```

Write `frontend/src/__tests__/StatCards.test.tsx` with the above content.

- [ ] **Step 10: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: Tests for RefreshBar and StatCards pass (StatCards component will need to exist — Create it as a minimal component that uses the Context if not already done).

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "feat: frontend layout shell — sidebar, refresh bar, router, upload zone, stub pages with tests"
```

---

### Task 7: Frontend — StatCards + OverviewPage with Charts

**Files:**
- Create/modify: `frontend/src/components/StatCards.tsx`
- Create: `frontend/src/components/charts/ProtocolChart.tsx`, `frontend/src/components/charts/PacketSizeChart.tsx`, `frontend/src/components/charts/FlowChart.tsx`, `frontend/src/components/charts/TimeSeriesChart.tsx`
- Modify: `frontend/src/pages/OverviewPage.tsx`

- [ ] **Step 1: Create StatCards.tsx**

```typescript
import { useStats } from '../context/StatsContext';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS, type TrafficType } from '../types';

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function StatCards() {
  const { stats, isLoading } = useStats();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-5 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-16 mb-2" />
            <div className="h-8 bg-slate-200 rounded w-12 mb-2" />
            <div className="h-3 bg-slate-200 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {TRAFFIC_TYPES.map((type) => {
        const s = stats[type];
        const color = TRAFFIC_COLORS[type];
        return (
          <div key={type} className="bg-white rounded-lg shadow p-5" style={{ borderTop: `3px solid ${color}` }}>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{TRAFFIC_LABELS[type]}</div>
            <div className="text-3xl font-bold mb-1">{s.file_count}</div>
            <div className="text-sm text-slate-500">
              {s.total_packets.toLocaleString()} 包 · {formatBytes(s.total_bytes)}
            </div>
            <div className="text-xs text-slate-400 mt-1">平均包大小: {s.avg_pkt_size} B</div>
          </div>
        );
      })}
    </div>
  );
}
```

Write `frontend/src/components/StatCards.tsx` with the above content (overwrite stub if it exists).

- [ ] **Step 2: Create ProtocolChart.tsx**

```typescript
import ReactECharts from 'echarts-for-react';
import { useProtocolData } from '../../hooks/useAnalysis';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../../types';

export default function ProtocolChart() {
  const { data, isLoading } = useProtocolData();

  if (isLoading || !data) {
    return <div className="bg-white rounded-lg shadow p-4 h-80 flex items-center justify-center text-slate-400">加载中...</div>;
  }

  const option = {
    title: { text: '协议分布对比', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: {
      data: TRAFFIC_TYPES.map((t) => TRAFFIC_LABELS[t]),
      bottom: 0,
    },
    xAxis: {
      type: 'category',
      data: data.categories,
    },
    yAxis: {
      type: 'value',
      name: '占比 (%)',
    },
    series: TRAFFIC_TYPES.map((type) => ({
      name: TRAFFIC_LABELS[type],
      type: 'bar',
      data: data[type],
      itemStyle: { color: TRAFFIC_COLORS[type] },
      barGap: '10%',
    })),
    grid: { left: 50, right: 20, top: 40, bottom: 40 },
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <ReactECharts option={option} style={{ height: 320 }} />
    </div>
  );
}
```

Write `frontend/src/components/charts/ProtocolChart.tsx` with the above content.

- [ ] **Step 3: Create PacketSizeChart.tsx**

```typescript
import ReactECharts from 'echarts-for-react';
import { usePacketSizeData } from '../../hooks/useAnalysis';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../../types';

export default function PacketSizeChart() {
  const { data, isLoading } = usePacketSizeData();

  if (isLoading || !data) {
    return <div className="bg-white rounded-lg shadow p-4 h-80 flex items-center justify-center text-slate-400">加载中...</div>;
  }

  const xData = data.bins.map((b) => `${b.bin_start}-${b.bin_end}`);

  const option = {
    title: { text: '包大小分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: {
      data: TRAFFIC_TYPES.map((t) => TRAFFIC_LABELS[t]),
      bottom: 0,
    },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { rotate: 45, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: '占比 (%)',
    },
    series: TRAFFIC_TYPES.map((type) => ({
      name: TRAFFIC_LABELS[type],
      type: 'line',
      data: data.bins.map((b) => b[type]),
      smooth: true,
      lineStyle: { color: TRAFFIC_COLORS[type], width: 2 },
      itemStyle: { color: TRAFFIC_COLORS[type] },
    })),
    grid: { left: 50, right: 20, top: 40, bottom: 60 },
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <ReactECharts option={option} style={{ height: 320 }} />
    </div>
  );
}
```

Write `frontend/src/components/charts/PacketSizeChart.tsx` with the above content.

- [ ] **Step 4: Create FlowChart.tsx**

```typescript
import ReactECharts from 'echarts-for-react';
import { useFlowData } from '../../hooks/useAnalysis';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../../types';

export default function FlowChart() {
  const { data, isLoading } = useFlowData();

  if (isLoading || !data) {
    return <div className="bg-white rounded-lg shadow p-4 h-80 flex items-center justify-center text-slate-400">加载中...</div>;
  }

  const categories = data.boxplot.map((b) => b.category);

  // Build boxplot series for each traffic type
  const series = TRAFFIC_TYPES.flatMap((type) => {
    // Prep data: ECharts boxplot expects [min, q1, median, q3, max]
    const boxData = data.boxplot.map((bp, idx) => [idx, ...bp[type]]);
    return {
      name: TRAFFIC_LABELS[type],
      type: 'boxplot' as const,
      data: boxData,
      itemStyle: { color: TRAFFIC_COLORS[type], borderColor: TRAFFIC_COLORS[type] },
    };
  });

  const option = {
    title: { text: '流特征对比 (箱线图)', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    legend: {
      data: TRAFFIC_TYPES.map((t) => TRAFFIC_LABELS[t]),
      bottom: 0,
    },
    xAxis: {
      type: 'category',
      data: categories,
    },
    yAxis: {
      type: 'value',
      name: '值',
    },
    series,
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <ReactECharts option={option} style={{ height: 320 }} />
    </div>
  );
}
```

Write `frontend/src/components/charts/FlowChart.tsx` with the above content.

- [ ] **Step 5: Create TimeSeriesChart.tsx**

```typescript
import ReactECharts from 'echarts-for-react';
import { useTimeSeriesData } from '../../hooks/useAnalysis';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../../types';

export default function TimeSeriesChart() {
  const { data, isLoading } = useTimeSeriesData();

  if (isLoading || !data) {
    return <div className="bg-white rounded-lg shadow p-4 h-80 flex items-center justify-center text-slate-400">加载中...</div>;
  }

  const cdfSeries = TRAFFIC_TYPES.map((type) => ({
    name: TRAFFIC_LABELS[type],
    type: 'line' as const,
    data: data.iat_cdf.map((p) => [p.interval, p[`${type}_cdf` as keyof typeof p]]),
    smooth: true,
    lineStyle: { color: TRAFFIC_COLORS[type], width: 2 },
    itemStyle: { color: TRAFFIC_COLORS[type] },
  }));

  const option = {
    title: { text: '到达间隔 CDF', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: {
      data: TRAFFIC_TYPES.map((t) => TRAFFIC_LABELS[t]),
      bottom: 0,
    },
    xAxis: {
      type: 'value',
      name: '间隔 (秒)',
    },
    yAxis: {
      type: 'value',
      name: '累计概率',
      max: 1,
    },
    series: cdfSeries,
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <ReactECharts option={option} style={{ height: 320 }} />
    </div>
  );
}
```

Write `frontend/src/components/charts/TimeSeriesChart.tsx` with the above content.

- [ ] **Step 6: Update OverviewPage.tsx**

```typescript
import StatCards from '../components/StatCards';
import ProtocolChart from '../components/charts/ProtocolChart';
import PacketSizeChart from '../components/charts/PacketSizeChart';
import FlowChart from '../components/charts/FlowChart';
import TimeSeriesChart from '../components/charts/TimeSeriesChart';

export default function OverviewPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">📈 概览总览</h2>
      <StatCards />
      <div className="grid grid-cols-2 gap-4">
        <ProtocolChart />
        <PacketSizeChart />
        <FlowChart />
        <TimeSeriesChart />
      </div>
    </div>
  );
}
```

Replace `frontend/src/pages/OverviewPage.tsx` with the above content.

- [ ] **Step 7: Add StatCards export check — verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/StatCards.tsx frontend/src/components/charts/ frontend/src/pages/OverviewPage.tsx
git commit -m "feat: overview page — StatCards + 2×2 chart grid (protocol, packet-size, flow, time-series)"
```

---

### Task 8: Frontend — Remaining Pages (Protocol, PacketSize, Flow, TimeSeries, TLS, DataTable)

**Files:**
- Modify: `frontend/src/pages/ProtocolPage.tsx`, `PacketSizePage.tsx`, `FlowPage.tsx`, `TimeSeriesPage.tsx`, `TlsPage.tsx`, `DataTablePage.tsx`
- Create: `frontend/src/components/charts/TlsVersionChart.tsx`, `frontend/src/components/charts/PacketTable.tsx`

- [ ] **Step 1: Update ProtocolPage.tsx**

```typescript
import ProtocolChart from '../components/charts/ProtocolChart';

export default function ProtocolPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🌐 协议分布详情</h2>
      <div className="max-w-4xl">
        <ProtocolChart />
      </div>
    </div>
  );
}
```

Write `frontend/src/pages/ProtocolPage.tsx` with the above content.

- [ ] **Step 2: Update PacketSizePage.tsx**

```typescript
import PacketSizeChart from '../components/charts/PacketSizeChart';
import { usePacketSizeData } from '../hooks/useAnalysis';
import { TRAFFIC_TYPES, TRAFFIC_LABELS } from '../types';

export default function PacketSizePage() {
  const { data, isLoading } = usePacketSizeData();

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">📦 包大小分析详情</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="col-span-2">
          <PacketSizeChart />
        </div>
      </div>
      {data && !isLoading && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3">统计量表</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">类别</th>
                <th className="text-right py-2">平均 (B)</th>
                <th className="text-right py-2">最小 (B)</th>
                <th className="text-right py-2">最大 (B)</th>
                <th className="text-right py-2">标准差</th>
              </tr>
            </thead>
            <tbody>
              {TRAFFIC_TYPES.map((type) => {
                const s = data.stats[type];
                return (
                  <tr key={type} className="border-b">
                    <td className="py-2 font-medium">{TRAFFIC_LABELS[type]}</td>
                    <td className="text-right py-2">{s.mean.toFixed(1)}</td>
                    <td className="text-right py-2">{s.min}</td>
                    <td className="text-right py-2">{s.max}</td>
                    <td className="text-right py-2">{s.std.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

Write `frontend/src/pages/PacketSizePage.tsx` with the above content.

- [ ] **Step 3: Update FlowPage.tsx**

```typescript
import FlowChart from '../components/charts/FlowChart';

export default function FlowPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🌊 流/会话分析详情</h2>
      <div className="max-w-4xl">
        <FlowChart />
      </div>
    </div>
  );
}
```

Write `frontend/src/pages/FlowPage.tsx` with the above content.

- [ ] **Step 4: Update TimeSeriesPage.tsx**

```typescript
import TimeSeriesChart from '../components/charts/TimeSeriesChart';

export default function TimeSeriesPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">⏱ 时间序列详情</h2>
      <div className="max-w-4xl">
        <TimeSeriesChart />
      </div>
    </div>
  );
}
```

Write `frontend/src/pages/TimeSeriesPage.tsx` with the above content.

- [ ] **Step 5: Update TlsPage.tsx**

```typescript
import ReactECharts from 'echarts-for-react';
import { useTlsData } from '../hooks/useAnalysis';
import { TRAFFIC_COLORS, TRAFFIC_TYPES, TRAFFIC_LABELS } from '../types';

export default function TlsPage() {
  const { data, isLoading } = useTlsData();

  if (isLoading || !data) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">🔐 TLS 特征</h2>
        <div className="bg-white rounded-lg shadow p-4 h-60 flex items-center justify-center text-slate-400">加载中...</div>
      </div>
    );
  }

  // Aggregate version data across categories for a combined pie
  const series = TRAFFIC_TYPES.map((type) => ({
    name: TRAFFIC_LABELS[type],
    type: 'pie' as const,
    radius: ['30%', '50%'],
    center: [type === 'common' ? '20%' : type === 'proxy' ? '50%' : '80%', '55%'],
    data: data.version_distribution[type].map((v) => ({ name: v.name, value: v.value })),
    label: { formatter: '{b}\n{d}%' },
    itemStyle: { color: TRAFFIC_COLORS[type] },
  }));

  const option = {
    title: { text: 'TLS / HTTPS 流量占比', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    series,
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🔐 TLS 特征</h2>
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <ReactECharts option={option} style={{ height: 360 }} />
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3">JA3 指纹</h3>
        <p className="text-sm text-slate-500">
          JA3 指纹解析需要 scapy TLS 层支持。当前显示 HTTPS 包计数。
          (scapy>=2.5 支持 TLS 解析，已包含在 requirements 中)
        </p>
        <table className="w-full text-sm border-collapse mt-2">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">类别</th>
              <th className="text-right py-2">HTTPS 包数</th>
            </tr>
          </thead>
          <tbody>
            {TRAFFIC_TYPES.map((type) => (
              <tr key={type} className="border-b">
                <td className="py-2 font-medium">{TRAFFIC_LABELS[type]}</td>
                <td className="text-right py-2">
                  {data.ja3_fingerprints[type]?.[0]?.count ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Write `frontend/src/pages/TlsPage.tsx` with the above content.

- [ ] **Step 6: Update DataTablePage.tsx**

```typescript
import { useState } from 'react';
import { usePacketTable } from '../hooks/useAnalysis';
import { TRAFFIC_TYPES, TRAFFIC_LABELS } from '../types';

export default function DataTablePage() {
  const [category, setCategory] = useState('common');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = usePacketTable(category, page, pageSize);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">📋 详细数据表</h2>
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center gap-4">
          <span className="text-sm text-slate-500">类别:</span>
          {TRAFFIC_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => { setCategory(t); setPage(1); }}
              className={`px-3 py-1 rounded text-sm ${
                category === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {TRAFFIC_LABELS[t]}
            </button>
          ))}
        </div>
        {isLoading || !data ? (
          <div className="p-8 text-center text-slate-400">加载中...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-2 px-3">时间戳</th>
                    <th className="text-left py-2 px-3">源 IP</th>
                    <th className="text-left py-2 px-3">目的 IP</th>
                    <th className="text-right py-2 px-3">源端口</th>
                    <th className="text-right py-2 px-3">目的端口</th>
                    <th className="text-center py-2 px-3">协议</th>
                    <th className="text-right py-2 px-3">长度</th>
                    <th className="text-left py-2 px-3">信息</th>
                  </tr>
                </thead>
                <tbody>
                  {data.packets.map((p, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-mono text-xs">{new Date(p.timestamp * 1000).toISOString().substring(11, 23)}</td>
                      <td className="py-1.5 px-3 font-mono text-xs">{p.src_ip}</td>
                      <td className="py-1.5 px-3 font-mono text-xs">{p.dst_ip}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs">{p.src_port}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs">{p.dst_port}</td>
                      <td className="py-1.5 px-3 text-center text-xs">{p.protocol}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs">{p.length}</td>
                      <td className="py-1.5 px-3 text-xs max-w-60 truncate">{p.info}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex items-center justify-between">
              <span className="text-sm text-slate-500">
                共 {data.total.toLocaleString()} 条，第 {data.page}/{Math.ceil(data.total / data.size)} 页
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * pageSize >= data.total}
                  className="px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

Write `frontend/src/pages/DataTablePage.tsx` with the above content.

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/ frontend/src/components/charts/
git commit -m "feat: all analysis pages — protocol, packet-size, flow, time-series, TLS, data table"
```

---

### Task 9: Production Build + Integration Smoke Test

**Files:**
- Modify: `backend/main.py` (already done — StaticFiles mount at end of file)
- No new files

- [ ] **Step 1: Build frontend**

Run: `cd frontend && npm run build`
Expected: Build succeeds, output in `frontend/dist/`.

- [ ] **Step 2: Start backend in production mode**

Run: `cd /home/bohuju/self_project/VPN_pcap_webtest && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &`

Wait 5 seconds for startup + initial pcap scan.

- [ ] **Step 3: Smoke test API endpoints**

Run: `curl -s http://localhost:8000/api/health | python -m json.tool`
Expected: `{"status": "ok", ...}`.

Run: `curl -s http://localhost:8000/api/stats | python -m json.tool`
Expected: GlobalStats with non-zero file counts from the experiment2 directories.

Run: `curl -s http://localhost:8000/api/analysis/protocol | python -m json.tool`
Expected: ProtocolData with categories and numeric arrays.

Run: `curl -s http://localhost:8000/api/analysis/packet-size | python -m json.tool`
Expected: PacketSizeData with bins and stats.

Run: `curl -s http://localhost:8000/api/analysis/flow | python -m json.tool`
Expected: FlowData with boxplot.

Run: `curl -s http://localhost:8000/api/analysis/time-series | python -m json.tool`
Expected: TimeSeriesData with rate_timeline and iat_cdf.

Run: `curl -s http://localhost:8000/api/analysis/tls | python -m json.tool`
Expected: TlsData with version_distribution.

Run: `curl -s "http://localhost:8000/api/packets?type=common&page=1&size=5" | python -m json.tool`
Expected: PacketTableData with packets array.

- [ ] **Step 4: Smoke test frontend serving**

Run: `curl -s http://localhost:8000/ | head -5`
Expected: HTML content of the built React app (should contain `<div id="root">`).

- [ ] **Step 5: Run all backend tests**

Run: `cd /home/bohuju/self_project/VPN_pcap_webtest && python -m pytest backend/tests/ -v`
Expected: All tests pass.

- [ ] **Step 6: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: production build integration, full smoke test passing"
```

---

## Completion Checklist

- [ ] Backend starts, scans experiment2/ and experiment2_database/, serves all 8 API endpoints
- [ ] Frontend builds and is served by FastAPI as static files
- [ ] Frontend shows StatsCards with real file counts from the data
- [ ] Frontend shows 4-chart overview grid with data
- [ ] Frontend shows all 7 pages via sidebar navigation
- [ ] Upload zone accepta .pcap files and adds them to the pool
- [ ] 10s polling updates the UI when new files appear
- [ ] Manual refresh button works
- [ ] All tests pass (backend + frontend)
- [ ] No TypeScript or Python type errors
