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
  category: string;
  common: number[];
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
