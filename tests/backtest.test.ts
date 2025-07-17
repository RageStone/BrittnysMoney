import { describe, it, expect } from 'vitest';
import { runBacktest, OHLCV } from '../lib/backtest';

describe('runBacktest', () => {
  it('returns zero stats for empty candles', () => {
    const result = runBacktest([], () => null);
    expect(result.totalTrades).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.avgProfitPct).toBe(0);
    expect(result.maxDrawdownPct).toBe(0);
    expect(result.equityCurve).toEqual([]);
  });

  it('calculates stats for simple candles', () => {
    const candles: OHLCV[] = [
      { timestamp: 1, open: 100, high: 110, low: 90, close: 100, volume: 1 },
      { timestamp: 2, open: 100, high: 110, low: 90, close: 110, volume: 1 },
      { timestamp: 3, open: 110, high: 120, low: 100, close: 120, volume: 1 },
    ];
    const result = runBacktest(candles, () => ({ direction: 'BUY' } as any));
    expect(result.totalTrades).toBe(1);
    expect(result.winRate).toBe(1 * 100);
    expect(result.avgProfitPct).toBeCloseTo(10);
    expect(result.equityCurve.length).toBe(1);
  });
}); 