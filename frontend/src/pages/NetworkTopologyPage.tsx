import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Globe,
  Router,
  Server,
  Monitor,
  Database,
  Activity,
  Radio,
  Play,
  RotateCcw,
  Wifi,
  HardDrive,
  Shield,
  BrainCircuit,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PacketDot {
  id: number;
  pathId: string;
  progress: number;
  speed: number;
  color: string;
  shape: 'circle' | 'square';
  size: number;
}

interface DemoState {
  phase: 'idle' | 'running' | 'complete';
  step: number; // 0-5
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VB_W = 1000;
const VB_H = 660;

// Node center positions in SVG viewBox coordinates
const NODES = {
  internet: { x: 500, y: 40, r: 30 },
  gateway: { x: 500, y: 148, r: 36 },
  sw1: { x: 230, y: 300, r: 28 },
  sw2: { x: 770, y: 300, r: 28 },
  sta: { x: 230, y: 440, r: 30 },
  server: { x: 770, y: 430, r: 34 },
  dataset: { x: 770, y: 555 },
} as const;

// Probe/LCM/Capture stack position (right of gateway→sw2 line)
const MODULE_X = 648;
const MODULE_START_Y = 214;
const MODULE_W = 72;
const MODULE_H = 28;
const MODULE_GAP = 8;

// Path definitions for data packet animation
const PATHS: Record<
  string,
  { x1: number; y1: number; x2: number; y2: number }
> = {
  'internet-gateway': { x1: 500, y1: 70, x2: 500, y2: 112 },
  'gateway-sw1': { x1: 464, y1: 176, x2: 258, y2: 272 },
  'gateway-sw2': { x1: 536, y1: 176, x2: 742, y2: 272 },
  'sw1-sta': { x1: 230, y1: 328, x2: 230, y2: 410 },
  'sw2-server': { x1: 770, y1: 328, x2: 770, y2: 396 },
  // Reverse paths for outbound result return
  'server-sw2': { x1: 770, y1: 396, x2: 770, y2: 328 },
  'sw2-gateway': { x1: 742, y1: 272, x2: 536, y2: 176 },
  'gateway-sw1-via': { x1: 536, y1: 176, x2: 258, y2: 272 },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function TooltipOverlay({
  text,
  x,
  y,
  visible,
}: {
  text: string;
  x: number;
  y: number;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -120%)',
        opacity: 1,
      }}
    >
      <div className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded shadow-lg whitespace-nowrap border border-slate-600">
        {text}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 border-r border-b border-slate-600 rotate-45"
          style={{ bottom: '-4px' }}
        />
      </div>
    </div>
  );
}

function PacketDotSvg({ dot }: { dot: PacketDot }) {
  const path = PATHS[dot.pathId];
  if (!path) return null;
  const cx = path.x1 + (path.x2 - path.x1) * dot.progress;
  const cy = path.y1 + (path.y2 - path.y1) * dot.progress;

  if (dot.shape === 'square') {
    const half = dot.size;
    return (
      <rect
        x={cx - half}
        y={cy - half}
        width={half * 2}
        height={half * 2}
        rx={1.5}
        fill={dot.color}
        opacity={0.9}
        style={{ filter: `drop-shadow(0 0 3px ${dot.color})` }}
      />
    );
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={dot.size}
      fill={dot.color}
      opacity={0.9}
      style={{ filter: `drop-shadow(0 0 3px ${dot.color})` }}
    />
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NetworkTopologyPage() {
  const [demo, setDemo] = useState<DemoState>({ phase: 'idle', step: 0 });
  const [packets, setPackets] = useState<PacketDot[]>([]);
  const [highlightCapturePath, setHighlightCapturePath] = useState(false);
  const [modulesLit, setModulesLit] = useState([false, false, false]); // probe, lcm, capture
  const [serverCaptureActive, setServerCaptureActive] = useState(false);
  const [llmActive, setLlmActive] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const animFrameRef = useRef<number>(0);
  const packetIdRef = useRef(0);
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Tooltip definitions ──────────────────────────────────────────────────

  const tooltips: Record<string, string> = {
    internet: 'External Network / Internet — 外部网络流量入口',
    gateway: 'Gateway / AP — 网络入口与核心转发点',
    sw1: 'SW1 — 客户端侧交换机',
    sw2: 'SW2 — 服务器侧交换机',
    sta: 'STA / Client — 客户端测试终端，接收 LLM 分析结果',
    server: 'Server — 采集与处理服务器，运行 LLM Agent',
    probe: 'Probe — 链路探测，监控 Gateway↔Server 链路状态',
    lcm: 'LCM — 链路/生命周期管理模块',
    capture: 'Capture — 采集 Gateway 与 Server 通信路径上的数据',
    'llm-agent': 'LLM Agent — 分析采集到的数据，生成结果回传 STA',
    dataset: 'Dataset (data 5.8GB) — Server 上存放的数据集，不是网络节点',
    'server-capture': 'Server Local Capture — 服务器本地抓取的额外数据',
  };

  // ── Node mouse handlers ──────────────────────────────────────────────────

  const handleNodeEnter = useCallback(
    (nodeId: string, cx: number, cy: number) => {
      setHoveredNode({ text: tooltips[nodeId] || '', x: cx, y: cy });
    },
    [],
  );

  const handleNodeLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const addPackets = useCallback(
    (
      pathId: string,
      count: number,
      color: string,
      shape: 'circle' | 'square',
      size: number,
      delay: number,
      speedRange: [number, number] = [0.003, 0.006],
    ) => {
      const timer = setTimeout(() => {
        setPackets((prev) => {
          const now = [...prev];
          for (let i = 0; i < count; i++) {
            now.push({
              id: ++packetIdRef.current,
              pathId,
              progress: 0,
              speed: speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]),
              color,
              shape,
              size,
            });
          }
          return now;
        });
      }, delay);
      timeoutIdsRef.current.push(timer);
      return timer;
    },
    [],
  );

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];
    setDemo({ phase: 'idle', step: 0 });
    setPackets([]);
    setHighlightCapturePath(false);
    setModulesLit([false, false, false]);
    setServerCaptureActive(false);
    setLlmActive(false);
    packetIdRef.current = 0;
  }, []);

  // ── Start Demo ───────────────────────────────────────────────────────────

  const startDemo = useCallback(() => {
    if (demo.phase === 'running') return;
    // Clean up any stale timers
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];
    setDemo({ phase: 'running', step: 0 });
    setPackets([]);
    setHighlightCapturePath(false);
    setModulesLit([false, false, false]);
    setServerCaptureActive(false);
    setLlmActive(false);
    packetIdRef.current = 0;

    // ── Phase 0: Internet → Gateway (ingress) ──
    addPackets('internet-gateway', 8, '#60a5fa', 'circle', 5, 0);

    // ── Phase 1: Gateway distributes to SW1 and SW2 ──
    setTimeout(() => setDemo((d) => (d.phase === 'running' ? { ...d, step: 1 } : d)), 800);
    addPackets('gateway-sw1', 6, '#22d3ee', 'circle', 4, 800);
    addPackets('gateway-sw2', 6, '#f59e0b', 'circle', 4, 800);

    // ── Phase 2: SW2→Server capture + Probe/LCM/Capture light up ──
    setTimeout(
      () => {
        setDemo((d) => (d.phase === 'running' ? { ...d, step: 2 } : d));
        setHighlightCapturePath(true);
      },
      1600,
    );
    addPackets('sw2-server', 5, '#c084fc', 'circle', 4, 1600);
    // Probe
    setTimeout(() => setModulesLit((m) => [true, m[1], m[2]]), 1900);
    // LCM
    setTimeout(() => setModulesLit((m) => [m[0], true, m[2]]), 2150);
    // Capture
    setTimeout(() => setModulesLit((m) => [m[0], m[1], true]), 2400);

    // ── Phase 3: LLM Agent analysis + Server Local Capture ──
    setTimeout(
      () => {
        setDemo((d) => (d.phase === 'running' ? { ...d, step: 3 } : d));
        setServerCaptureActive(true);
        setLlmActive(true);
      },
      2800,
    );

    // ── Phase 4: Result return — Server → SW2 → Gateway → SW1 → STA ──
    setTimeout(
      () => setDemo((d) => (d.phase === 'running' ? { ...d, step: 4 } : d)),
      3600,
    );
    // Outbound green square packets
    addPackets('server-sw2', 5, '#4ade80', 'square', 5, 3600);
    addPackets('sw2-gateway', 5, '#4ade80', 'square', 5, 3700);
    addPackets('gateway-sw1-via', 5, '#4ade80', 'square', 5, 3800);
    // Also add packets from sw1 to sta for the final leg
    addPackets('sw1-sta', 5, '#4ade80', 'square', 5, 3900);

    // ── Complete ──
    setTimeout(
      () => setDemo((d) => (d.phase === 'running' ? { phase: 'complete', step: 5 } : d)),
      5000,
    );
  }, [demo.phase, addPackets, reset]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach(clearTimeout);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ── Animation loop ───────────────────────────────────────────────────────

  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      setPackets((prev) => {
        const next = prev
          .map((p) => ({ ...p, progress: p.progress + p.speed }))
          .filter((p) => p.progress < 1);
        return next;
      });
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ── VB to screen coordinate conversion ───────────────────────────────────

  const vbToScreen = (vx: number, vy: number): { x: number; y: number } => {
    if (!svgRef.current) return { x: vx, y: vy };
    const rect = svgRef.current.getBoundingClientRect();
    const parentRect =
      svgRef.current.parentElement?.getBoundingClientRect() ?? rect;
    const scaleX = rect.width / VB_W;
    const scaleY = rect.height / VB_H;
    return {
      x: rect.left - parentRect.left + vx * scaleX,
      y: vy * scaleY,
    };
  };

  // ── Line style helper ────────────────────────────────────────────────────

  const isCapturePath = (key: string) =>
    key === 'gateway-sw2' || key === 'sw2-server';

  const linkStyle = (key: string): React.CSSProperties => {
    const highlight = isCapturePath(key);
    return {
      stroke: highlight
        ? highlightCapturePath
          ? '#f59e0b'
          : '#475569'
        : demo.step >= 1
          ? '#94a3b8'
          : '#475569',
      strokeWidth: highlight ? 2.8 : 1.8,
      strokeDasharray: highlight ? '8,4' : 'none',
      transition: 'stroke 0.5s, stroke-width 0.5s',
    };
  };

  // ── Step label ───────────────────────────────────────────────────────────

  const stepLabel = (): string => {
    if (demo.phase === 'idle') return 'Ready';
    if (demo.phase === 'complete') return 'Demo complete';
    switch (demo.step) {
      case 0: return 'Step 1/5 — Traffic enters Gateway';
      case 1: return 'Step 2/5 — Gateway distributes to switches';
      case 2: return 'Step 3/5 — Probe → LCM → Capture observing traffic';
      case 3: return 'Step 4/5 — LLM Agent analyzing captured data';
      case 4: return 'Step 5/5 — Results sent back to STA';
      default: return 'Running';
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const gatewayToSw2MidX = (NODES.gateway.x + 30 + NODES.sw2.x) / 2;
  const gatewayToSw2MidY =
    (NODES.gateway.y + NODES.gateway.r + NODES.sw2.y - NODES.sw2.r) / 2;

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-0">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-blue-600 shrink-0" />
          Network Capture Topology Demo
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Gateway-to-Server traffic is observed by Probe / LCM / Capture,
          analyzed by LLM Agent, and results are returned to STA.
        </p>
      </div>

      {/* ── Controls ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <button
          onClick={startDemo}
          disabled={demo.phase === 'running'}
          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md text-sm font-medium
                     bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors shadow-sm"
        >
          <Play className="w-4 h-4" />
          Start Demo
        </button>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md text-sm font-medium
                     border border-slate-300 bg-white text-slate-700 hover:bg-slate-50
                     transition-colors shadow-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              demo.phase === 'running'
                ? 'bg-green-500 animate-pulse'
                : demo.phase === 'complete'
                  ? 'bg-blue-400'
                  : 'bg-slate-300'
            }`}
          />
          <span className="hidden sm:inline">{stepLabel()}</span>
          <span className="sm:hidden">
            {demo.phase === 'idle'
              ? 'Ready'
              : demo.phase === 'complete'
                ? 'Done'
                : `Step ${demo.step + 1}/5`}
          </span>
        </div>
      </div>

      {/* ── SVG Topology Canvas ─────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-lg overflow-hidden relative">
        <div className="relative w-full" style={{ paddingBottom: '66%' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <filter
                id="glow-orange"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter
                id="glow-purple"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter
                id="glow-blue"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
              </marker>
            </defs>

            {/* ── Grid background ─────────────────────────────────── */}
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#1e293b"
                strokeWidth="0.5"
              />
            </pattern>
            <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#grid)" />

            {/* ══════════════════════════════════════════════════════
                CONNECTION LINES
               ══════════════════════════════════════════════════════ */}

            {/* Internet → Gateway */}
            <line
              x1={NODES.internet.x}
              y1={NODES.internet.y + NODES.internet.r}
              x2={NODES.gateway.x}
              y2={NODES.gateway.y - NODES.gateway.r}
              stroke={demo.step >= 1 ? '#94a3b8' : '#475569'}
              strokeWidth={1.8}
              markerEnd={demo.step >= 1 ? 'url(#arrowhead)' : undefined}
            />

            {/* Gateway → SW1 */}
            <line
              x1={NODES.gateway.x - 30}
              y1={NODES.gateway.y + NODES.gateway.r}
              x2={NODES.sw1.x}
              y2={NODES.sw1.y - NODES.sw1.r}
              stroke={demo.step >= 1 ? '#94a3b8' : '#475569'}
              strokeWidth={1.8}
            />

            {/* Gateway → SW2 (capture path) */}
            <line
              x1={NODES.gateway.x + 30}
              y1={NODES.gateway.y + NODES.gateway.r}
              x2={NODES.sw2.x}
              y2={NODES.sw2.y - NODES.sw2.r}
              style={linkStyle('gateway-sw2')}
            />

            {/* SW1 → STA */}
            <line
              x1={NODES.sw1.x}
              y1={NODES.sw1.y + NODES.sw1.r}
              x2={NODES.sta.x}
              y2={NODES.sta.y - NODES.sta.r}
              stroke={demo.step >= 2 ? '#94a3b8' : '#475569'}
              strokeWidth={1.8}
            />

            {/* SW2 → Server (capture path) */}
            <line
              x1={NODES.sw2.x}
              y1={NODES.sw2.y + NODES.sw2.r}
              x2={NODES.server.x}
              y2={NODES.server.y - NODES.server.r}
              style={linkStyle('sw2-server')}
            />

            {/* ── Capture Path Highlight Box ───────────────────────── */}
            {highlightCapturePath && (
              <rect
                x={510}
                y={160}
                width={305}
                height={290}
                rx={12}
                fill="rgba(245, 158, 11, 0.06)"
                stroke="rgba(245, 158, 11, 0.4)"
                strokeWidth={1.5}
                strokeDasharray="6,3"
              >
                <animate
                  attributeName="opacity"
                  from="0"
                  to="1"
                  dur="0.6s"
                />
              </rect>
            )}

            {/* ── Tap line: Gateway→SW2 line → Probe/LCM/Capture stack ── */}
            {/* Horizontal indicator from the link to the modules */}
            <line
              x1={gatewayToSw2MidX}
              y1={gatewayToSw2MidY}
              x2={MODULE_X - 4}
              y2={(MODULE_START_Y + MODULE_H + MODULE_GAP) / 2 + MODULE_START_Y}
              stroke={highlightCapturePath ? '#f59e0b' : '#334155'}
              strokeWidth={1.2}
              strokeDasharray="4,3"
              className="transition-all duration-500"
            />
            {/* Small perpendicular tick on the link line */}
            <line
              x1={gatewayToSw2MidX - 6}
              y1={gatewayToSw2MidY - 8}
              x2={gatewayToSw2MidX + 6}
              y2={gatewayToSw2MidY + 8}
              stroke={highlightCapturePath ? '#f59e0b' : '#334155'}
              strokeWidth={1.5}
              className="transition-all duration-500"
            />

            {/* ── Path label: "capture path" ────────────────────────── */}
            <text
              x={gatewayToSw2MidX + 20}
              y={gatewayToSw2MidY - 10}
              textAnchor="middle"
              fill={highlightCapturePath ? '#f59e0b' : '#64748b'}
              fontSize="9"
              fontWeight={600}
              fontFamily="system-ui, sans-serif"
              className="transition-colors duration-500"
            >
              capture path
            </text>

            {/* ══════════════════════════════════════════════════════
                ANIMATED PACKETS
               ══════════════════════════════════════════════════════ */}
            {packets.map((dot) => (
              <PacketDotSvg key={dot.id} dot={dot} />
            ))}

            {/* ══════════════════════════════════════════════════════
                PROBE / LCM / CAPTURE MODULES (right of capture path)
               ══════════════════════════════════════════════════════ */}

            {/* Probe */}
            <g
              className="cursor-default"
              onMouseEnter={() => handleNodeEnter('probe', MODULE_X + MODULE_W / 2, MODULE_START_Y + MODULE_H / 2)}
              onMouseLeave={handleNodeLeave}
            >
              <rect
                x={MODULE_X}
                y={MODULE_START_Y}
                width={MODULE_W}
                height={MODULE_H}
                rx={6}
                fill={modulesLit[0] ? '#fef3c7' : '#1e293b'}
                stroke={modulesLit[0] ? '#f59e0b' : '#475569'}
                strokeWidth={modulesLit[0] ? 1.5 : 1}
                filter={modulesLit[0] ? 'url(#glow-orange)' : undefined}
                className="transition-all duration-400"
              />
              <Radio
                x={MODULE_X + 6}
                y={MODULE_START_Y + 6}
                width={14}
                height={14}
                color={modulesLit[0] ? '#f59e0b' : '#64748b'}
                className="transition-colors duration-400"
              />
              <text
                x={MODULE_X + 24}
                y={MODULE_START_Y + 18}
                fill={modulesLit[0] ? '#92400e' : '#cbd5e1'}
                fontSize="11"
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
                className="transition-colors duration-400"
              >
                Probe
              </text>
            </g>

            {/* LCM */}
            <g
              className="cursor-default"
              onMouseEnter={() =>
                handleNodeEnter(
                  'lcm',
                  MODULE_X + MODULE_W / 2,
                  MODULE_START_Y + MODULE_H + MODULE_GAP + MODULE_H / 2,
                )
              }
              onMouseLeave={handleNodeLeave}
            >
              <rect
                x={MODULE_X}
                y={MODULE_START_Y + MODULE_H + MODULE_GAP}
                width={MODULE_W}
                height={MODULE_H}
                rx={6}
                fill={modulesLit[1] ? '#fef3c7' : '#1e293b'}
                stroke={modulesLit[1] ? '#f59e0b' : '#475569'}
                strokeWidth={modulesLit[1] ? 1.5 : 1}
                filter={modulesLit[1] ? 'url(#glow-orange)' : undefined}
                className="transition-all duration-400"
              />
              <Shield
                x={MODULE_X + 6}
                y={MODULE_START_Y + MODULE_H + MODULE_GAP + 6}
                width={14}
                height={14}
                color={modulesLit[1] ? '#f59e0b' : '#64748b'}
                className="transition-colors duration-400"
              />
              <text
                x={MODULE_X + 24}
                y={MODULE_START_Y + MODULE_H + MODULE_GAP + 18}
                fill={modulesLit[1] ? '#92400e' : '#cbd5e1'}
                fontSize="11"
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
                className="transition-colors duration-400"
              >
                LCM
              </text>
            </g>

            {/* Capture */}
            <g
              className="cursor-default"
              onMouseEnter={() =>
                handleNodeEnter(
                  'capture',
                  MODULE_X + MODULE_W / 2,
                  MODULE_START_Y + (MODULE_H + MODULE_GAP) * 2 + MODULE_H / 2,
                )
              }
              onMouseLeave={handleNodeLeave}
            >
              <rect
                x={MODULE_X}
                y={MODULE_START_Y + (MODULE_H + MODULE_GAP) * 2}
                width={MODULE_W}
                height={MODULE_H}
                rx={6}
                fill={modulesLit[2] ? '#fef3c7' : '#1e293b'}
                stroke={modulesLit[2] ? '#f59e0b' : '#475569'}
                strokeWidth={modulesLit[2] ? 1.5 : 1}
                filter={modulesLit[2] ? 'url(#glow-orange)' : undefined}
                className="transition-all duration-400"
              />
              <Activity
                x={MODULE_X + 6}
                y={MODULE_START_Y + (MODULE_H + MODULE_GAP) * 2 + 6}
                width={14}
                height={14}
                color={modulesLit[2] ? '#f59e0b' : '#64748b'}
                className="transition-colors duration-400"
              />
              <text
                x={MODULE_X + 24}
                y={MODULE_START_Y + (MODULE_H + MODULE_GAP) * 2 + 18}
                fill={modulesLit[2] ? '#92400e' : '#cbd5e1'}
                fontSize="11"
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
                className="transition-colors duration-400"
              >
                Capture
              </text>
            </g>

            {/* ── Module stack label ────────────────────────────────── */}
            {highlightCapturePath && (
              <text
                x={MODULE_X + MODULE_W / 2}
                y={MODULE_START_Y - 8}
                textAnchor="middle"
                fill="#f59e0b"
                fontSize="9"
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
                opacity={0.8}
              >
                TAP
              </text>
            )}

            {/* ══════════════════════════════════════════════════════
                NODES
               ══════════════════════════════════════════════════════ */}

            {/* Internet */}
            <g
              className="cursor-default"
              onMouseEnter={() =>
                handleNodeEnter('internet', NODES.internet.x, NODES.internet.y)
              }
              onMouseLeave={handleNodeLeave}
            >
              <circle
                cx={NODES.internet.x}
                cy={NODES.internet.y}
                r={NODES.internet.r}
                fill="#1e3a5f"
                stroke="#3b82f6"
                strokeWidth={2}
                filter={demo.step >= 1 ? 'url(#glow-blue)' : undefined}
                className="transition-all duration-500"
              />
              <Globe
                x={NODES.internet.x - 16}
                y={NODES.internet.y - 16}
                width={32}
                height={32}
                color="#93c5fd"
              />
              <text
                x={NODES.internet.x}
                y={NODES.internet.y + NODES.internet.r + 16}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="11"
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
              >
                Internet
              </text>
              <text
                x={NODES.internet.x}
                y={NODES.internet.y + NODES.internet.r + 29}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                External Network
              </text>
            </g>

            {/* Gateway / AP */}
            <g
              className="cursor-default"
              onMouseEnter={() =>
                handleNodeEnter('gateway', NODES.gateway.x, NODES.gateway.y)
              }
              onMouseLeave={handleNodeLeave}
            >
              <circle
                cx={NODES.gateway.x}
                cy={NODES.gateway.y}
                r={NODES.gateway.r}
                fill="#1e3a5f"
                stroke="#3b82f6"
                strokeWidth={2.5}
                filter={demo.step >= 1 ? 'url(#glow-blue)' : undefined}
                className="transition-all duration-500"
              />
              <Router
                x={NODES.gateway.x - 18}
                y={NODES.gateway.y - 18}
                width={36}
                height={36}
                color="#60a5fa"
              />
              <text
                x={NODES.gateway.x}
                y={NODES.gateway.y + NODES.gateway.r + 16}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="11"
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
              >
                Gateway / AP
              </text>
            </g>

            {/* SW1 */}
            <g
              className="cursor-default"
              onMouseEnter={() =>
                handleNodeEnter('sw1', NODES.sw1.x, NODES.sw1.y)
              }
              onMouseLeave={handleNodeLeave}
            >
              <rect
                x={NODES.sw1.x - NODES.sw1.r}
                y={NODES.sw1.y - NODES.sw1.r}
                width={NODES.sw1.r * 2}
                height={NODES.sw1.r * 2}
                rx={6}
                fill="#0f172a"
                stroke={demo.step >= 2 ? '#22d3ee' : '#475569'}
                strokeWidth={2}
                className="transition-all duration-500"
              />
              <Wifi
                x={NODES.sw1.x - 14}
                y={NODES.sw1.y - 14}
                width={28}
                height={28}
                color="#22d3ee"
              />
              <text
                x={NODES.sw1.x}
                y={NODES.sw1.y + NODES.sw1.r + 16}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="11"
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
              >
                SW1
              </text>
            </g>

            {/* SW2 */}
            <g
              className="cursor-default"
              onMouseEnter={() =>
                handleNodeEnter('sw2', NODES.sw2.x, NODES.sw2.y)
              }
              onMouseLeave={handleNodeLeave}
            >
              <rect
                x={NODES.sw2.x - NODES.sw2.r}
                y={NODES.sw2.y - NODES.sw2.r}
                width={NODES.sw2.r * 2}
                height={NODES.sw2.r * 2}
                rx={6}
                fill="#0f172a"
                stroke={demo.step >= 2 ? '#22d3ee' : '#475569'}
                strokeWidth={2}
                className="transition-all duration-500"
              />
              <Wifi
                x={NODES.sw2.x - 14}
                y={NODES.sw2.y - 14}
                width={28}
                height={28}
                color="#22d3ee"
              />
              <text
                x={NODES.sw2.x}
                y={NODES.sw2.y + NODES.sw2.r + 16}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="11"
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
              >
                SW2
              </text>
            </g>

            {/* STA / Client */}
            <g
              className="cursor-default"
              onMouseEnter={() =>
                handleNodeEnter('sta', NODES.sta.x, NODES.sta.y)
              }
              onMouseLeave={handleNodeLeave}
            >
              <circle
                cx={NODES.sta.x}
                cy={NODES.sta.y}
                r={NODES.sta.r}
                fill="#14532d"
                stroke="#4ade80"
                strokeWidth={2}
                filter={demo.step >= 4 ? 'url(#glow-blue)' : undefined}
                className="transition-all duration-500"
              />
              <Monitor
                x={NODES.sta.x - 16}
                y={NODES.sta.y - 16}
                width={32}
                height={32}
                color="#4ade80"
              />
              <text
                x={NODES.sta.x}
                y={NODES.sta.y + NODES.sta.r + 16}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="11"
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
              >
                STA / Client
              </text>
              {demo.step >= 4 && (
                <text
                  x={NODES.sta.x}
                  y={NODES.sta.y - NODES.sta.r - 10}
                  textAnchor="middle"
                  fill="#4ade80"
                  fontSize="9"
                  fontWeight={600}
                  fontFamily="system-ui, sans-serif"
                  opacity={0.8}
                >
                  ← results
                </text>
              )}
            </g>

            {/* Server */}
            <g
              className="cursor-default"
              onMouseEnter={() =>
                handleNodeEnter('server', NODES.server.x, NODES.server.y)
              }
              onMouseLeave={handleNodeLeave}
            >
              <circle
                cx={NODES.server.x}
                cy={NODES.server.y}
                r={NODES.server.r}
                fill="#2e1065"
                stroke="#c084fc"
                strokeWidth={2.5}
                filter={
                  llmActive
                    ? 'url(#glow-purple)'
                    : demo.step >= 3
                      ? 'url(#glow-blue)'
                      : undefined
                }
                className="transition-all duration-500"
              />
              <Server
                x={NODES.server.x - 18}
                y={NODES.server.y - 18}
                width={36}
                height={36}
                color="#c084fc"
              />
              <text
                x={NODES.server.x}
                y={NODES.server.y + NODES.server.r + 16}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="11"
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
              >
                Server
              </text>
              {/* LLM Agent badge */}
              {llmActive && (
                <g>
                  <rect
                    x={NODES.server.x - 32}
                    y={NODES.server.y - NODES.server.r - 28}
                    width={64}
                    height={20}
                    rx={5}
                    fill="#4c1d95"
                    stroke="#a78bfa"
                    strokeWidth={1}
                    className="animate-pulse"
                  />
                  <BrainCircuit
                    x={NODES.server.x - 28}
                    y={NODES.server.y - NODES.server.r - 24}
                    width={12}
                    height={12}
                    color="#c4b5fd"
                  />
                  <text
                    x={NODES.server.x - 12}
                    y={NODES.server.y - NODES.server.r - 13}
                    fill="#c4b5fd"
                    fontSize="9"
                    fontWeight={700}
                    fontFamily="system-ui, sans-serif"
                  >
                    LLM Agent
                  </text>
                </g>
              )}
            </g>

            {/* ══════════════════════════════════════════════════════
                SERVER LOCAL CAPTURE PANEL
               ══════════════════════════════════════════════════════ */}
            <g
              className="transition-all duration-500"
              opacity={serverCaptureActive ? 1 : 0.35}
            >
              <rect
                x={818}
                y={390}
                width={160}
                height={100}
                rx={8}
                fill="#1e1b4b"
                stroke={serverCaptureActive ? '#a78bfa' : '#4c1d95'}
                strokeWidth={1.5}
                className="transition-all duration-500"
              />
              <text
                x={898}
                y={408}
                textAnchor="middle"
                fill="#c4b5fd"
                fontSize="10"
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
              >
                Server Local Capture
              </text>
              <line
                x1={828}
                y1={415}
                x2={968}
                y2={415}
                stroke="#4c1d95"
                strokeWidth={0.5}
              />
              {/* Extra data captured */}
              <g>
                <circle
                  cx={834}
                  cy={430}
                  r={3}
                  fill={serverCaptureActive ? '#4ade80' : '#64748b'}
                  className="transition-colors duration-500"
                />
                <text
                  x={844}
                  y={433}
                  fill="#a5b4fc"
                  fontSize="9"
                  fontFamily="system-ui, sans-serif"
                >
                  Extra data captured
                </text>
              </g>
              {/* Capture status */}
              <g>
                <circle
                  cx={834}
                  cy={447}
                  r={3}
                  fill={serverCaptureActive ? '#4ade80' : '#64748b'}
                  className="transition-colors duration-500"
                />
                <text
                  x={844}
                  y={450}
                  fill="#a5b4fc"
                  fontSize="9"
                  fontFamily="system-ui, sans-serif"
                >
                  Capture status:{' '}
                  <tspan
                    fill={serverCaptureActive ? '#4ade80' : '#64748b'}
                    fontWeight={700}
                  >
                    {serverCaptureActive ? 'active' : 'idle'}
                  </tspan>
                </text>
              </g>
              {/* LLM Agent status */}
              <g>
                <circle
                  cx={834}
                  cy={464}
                  r={3}
                  fill={llmActive ? '#4ade80' : '#64748b'}
                  className="transition-colors duration-500"
                />
                <text
                  x={844}
                  y={467}
                  fill={llmActive ? '#a5b4fc' : '#94a3b8'}
                  fontSize="9"
                  fontFamily="system-ui, sans-serif"
                >
                  LLM Agent:{' '}
                  <tspan
                    fill={llmActive ? '#4ade80' : '#64748b'}
                    fontWeight={700}
                  >
                    {llmActive ? 'analyzing' : 'standby'}
                  </tspan>
                </text>
              </g>
              {/* Traffic mirrored */}
              <g>
                <circle cx={834} cy={481} r={3} fill="#64748b" />
                <text
                  x={844}
                  y={484}
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="system-ui, sans-serif"
                >
                  Traffic mirrored
                </text>
              </g>
            </g>

            {/* ══════════════════════════════════════════════════════
                DATASET — no connecting lines, stored on Server
               ══════════════════════════════════════════════════════ */}
            <g
              className="cursor-default"
              onMouseEnter={() =>
                handleNodeEnter('dataset', NODES.dataset.x, NODES.dataset.y)
              }
              onMouseLeave={handleNodeLeave}
            >
              {/* Card */}
              <rect
                x={NODES.dataset.x - 65}
                y={NODES.dataset.y - 28}
                width={130}
                height={60}
                rx={8}
                fill="#1e293b"
                stroke="#475569"
                strokeWidth={1.5}
                className="transition-colors duration-300 hover:stroke-slate-400"
              />
              {/* Stacked database layers */}
              <rect
                x={NODES.dataset.x - 46}
                y={NODES.dataset.y - 18}
                width={20}
                height={6}
                rx={1.5}
                fill="#64748b"
              />
              <rect
                x={NODES.dataset.x - 48}
                y={NODES.dataset.y - 10}
                width={24}
                height={6}
                rx={1.5}
                fill="#94a3b8"
              />
              <rect
                x={NODES.dataset.x - 50}
                y={NODES.dataset.y - 2}
                width={28}
                height={6}
                rx={1.5}
                fill="#cbd5e1"
              />
              <Database
                x={NODES.dataset.x - 46}
                y={NODES.dataset.y - 18}
                width={20}
                height={18}
                color="#94a3b8"
              />
              {/* Labels */}
              <text
                x={NODES.dataset.x + 2}
                y={NODES.dataset.y - 9}
                fill="#e2e8f0"
                fontSize="11"
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
              >
                Dataset
              </text>
              <text
                x={NODES.dataset.x + 2}
                y={NODES.dataset.y + 4}
                fill="#fbbf24"
                fontSize="10"
                fontWeight={600}
                fontFamily="monospace"
              >
                data 5.8GB
              </text>
              <text
                x={NODES.dataset.x + 2}
                y={NODES.dataset.y + 16}
                fill="#64748b"
                fontSize="8"
                fontFamily="system-ui, sans-serif"
              >
                Stored on Server
              </text>
            </g>

            {/* ── Path labels ──────────────────────────────────────── */}
            <text
              x={370}
              y={225}
              textAnchor="middle"
              fill="#64748b"
              fontSize="9"
              fontFamily="system-ui, sans-serif"
            >
              client path
            </text>

            {/* ── "no network link" annotation for Dataset ──────────── */}
            <text
              x={NODES.dataset.x}
              y={NODES.dataset.y + 48}
              textAnchor="middle"
              fill="#475569"
              fontSize="8"
              fontStyle="italic"
              fontFamily="system-ui, sans-serif"
            >
              (not a network node)
            </text>

            {/* ══════════════════════════════════════════════════════
                LEGEND
               ══════════════════════════════════════════════════════ */}
            <g transform="translate(15, 15)">
              <rect
                x={0}
                y={0}
                width={180}
                height={148}
                rx={6}
                fill="rgba(15,23,42,0.88)"
                stroke="#334155"
                strokeWidth={1}
              />
              <text
                x={10}
                y={18}
                fill="#94a3b8"
                fontSize="9"
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
              >
                LEGEND
              </text>
              {/* Gateway */}
              <circle
                cx={16}
                cy={34}
                r={5}
                fill="#1e3a5f"
                stroke="#3b82f6"
                strokeWidth={1.5}
              />
              <text
                x={28}
                y={37}
                fill="#cbd5e1"
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                Gateway / Router
              </text>
              {/* Switch */}
              <rect
                x={11}
                y={46}
                width={10}
                height={10}
                rx={2}
                fill="#0f172a"
                stroke="#22d3ee"
                strokeWidth={1.5}
              />
              <text
                x={28}
                y={54}
                fill="#cbd5e1"
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                Switch
              </text>
              {/* Client */}
              <circle
                cx={16}
                cy={66}
                r={5}
                fill="#14532d"
                stroke="#4ade80"
                strokeWidth={1.5}
              />
              <text
                x={28}
                y={69}
                fill="#cbd5e1"
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                Client / STA
              </text>
              {/* Server */}
              <circle
                cx={16}
                cy={82}
                r={5}
                fill="#2e1065"
                stroke="#c084fc"
                strokeWidth={1.5}
              />
              <text
                x={28}
                y={85}
                fill="#cbd5e1"
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                Server
              </text>
              {/* Capture modules */}
              <rect
                x={11}
                y={94}
                width={10}
                height={10}
                rx={2}
                fill="#fef3c7"
                stroke="#f59e0b"
                strokeWidth={1}
              />
              <text
                x={28}
                y={102}
                fill="#cbd5e1"
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                Probe / LCM / Capture
              </text>
              {/* LLM Agent */}
              <rect
                x={11}
                y={112}
                width={10}
                height={10}
                rx={2}
                fill="#4c1d95"
                stroke="#a78bfa"
                strokeWidth={1}
              />
              <BrainCircuit width={8} height={8} x={12} y={113} color="#c4b5fd" />
              <text
                x={28}
                y={120}
                fill="#cbd5e1"
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                LLM Agent
              </text>
              {/* Dataset */}
              <HardDrive width={10} height={10} x={11} y={129} color="#94a3b8" />
              <text
                x={28}
                y={137}
                fill="#cbd5e1"
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                Dataset (no network link)
              </text>
            </g>

            {/* ── "client path" label ─────────────────────────────── */}
            <text
              x={370}
              y={225}
              textAnchor="middle"
              fill="#64748b"
              fontSize="9"
              fontFamily="system-ui, sans-serif"
            >
              client path
            </text>
          </svg>

          {/* ── HTML tooltip overlay ───────────────────────────────── */}
          {hoveredNode && (
            <TooltipOverlay
              text={hoveredNode.text}
              x={vbToScreen(hoveredNode.x, hoveredNode.y).x}
              y={vbToScreen(hoveredNode.x, hoveredNode.y).y}
              visible={true}
            />
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-400 gap-1">
        <span>
          Hover over nodes for details · Capture path: Gateway → SW2 → Server
        </span>
        <span className="flex items-center gap-1">
          <HardDrive className="w-3 h-3 shrink-0" />
          Dataset data 5.8GB — stored on Server, not a network link
        </span>
      </div>
    </div>
  );
}
