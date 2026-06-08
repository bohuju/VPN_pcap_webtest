// @vitest-environment jsdom
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
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30').length).toBeGreaterThan(0);
  });
});
