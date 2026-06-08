import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { GlobalStats } from '../types';

interface StatsContextValue {
  stats: GlobalStats | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

export const StatsContext = createContext<StatsContextValue>({
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

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
