import { describe, it, expect } from 'vitest';
import { calcProfitPct } from '../lib/metrics';
import { simSLTP } from '../lib/risk';

// Profit percentage tests

describe('calcProfitPct', () => {
  it('calculates positive profit', () => {
    expect(calcProfitPct({ entry: 100, exit: 110 })).toBeCloseTo(10);
  });
  it('calculates negative profit', () => {
    expect(calcProfitPct({ entry: 100, exit: 90 })).toBeCloseTo(-10);
  });
  it('returns 0 for zero entry', () => {
    expect(calcProfitPct({ entry: 0, exit: 100 })).toBe(0);
  });
  it('handles no change', () => {
    expect(calcProfitPct({ entry: 100, exit: 100 })).toBe(0);
  });
});

describe('simSLTP', () => {
  it('calculates correct SL and TP prices', () => {
    const { slPrice, tpPrice } = simSLTP({ entry: 100, slPct: 2, tpPct: 5 });
    expect(slPrice).toBeCloseTo(98);
    expect(tpPrice).toBeCloseTo(105);
  });
  it('handles zero percentages', () => {
    const { slPrice, tpPrice } = simSLTP({ entry: 100, slPct: 0, tpPct: 0 });
    expect(slPrice).toBe(100);
    expect(tpPrice).toBe(100);
  });
  it('handles negative entry', () => {
    const { slPrice, tpPrice } = simSLTP({ entry: -100, slPct: 2, tpPct: 5 });
    expect(slPrice).toBeCloseTo(-98);
    expect(tpPrice).toBeCloseTo(-105);
  });
}); 