// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
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
