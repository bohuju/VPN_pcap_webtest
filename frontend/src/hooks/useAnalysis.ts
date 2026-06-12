import useSWR from 'swr';
import type { ProtocolData, PacketSizeData, FlowData, TimeSeriesData, TlsData, PacketTableData, CaptureSession } from '../types';

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

export function usePredictionSamples() {
  return useSWR('/api/prediction-samples', fetcher);
}

export function useCaptureSession() {
  return useSWR<CaptureSession>('/api/capture-session', fetcher, {
    refreshInterval: 2000,
    dedupingInterval: 1500,
  });
}

export function usePacketTable(type: string, page: number, size: number) {
  const key = `/api/packets?type=${type}&page=${page}&size=${size}`;
  return useSWR<PacketTableData>(key, fetcher);
}
