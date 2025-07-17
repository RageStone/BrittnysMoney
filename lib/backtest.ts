import { Signal } from "./utils";
import { calcProfitPct } from "./metrics";

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestResult {
  totalTrades: number;
  winRate: number;
  avgProfitPct: number;
  maxDrawdownPct: number;
  equityCurve: number[];
}

export interface BacktestSummary {
  totalTrades: number;
  winRate: number;
  avgProfitPct: number;
  maxDrawdownPct: number;
  equityCurve: number[];
}

/**
 * Runs a backtest by replaying the signal generator on historical candles.
 * @param candles Array of OHLCV candles (sorted oldest to newest)
 * @param generateSignal Function that returns a Signal for a given candle
 * @returns BacktestResult
 */
export function runBacktest(
  candles: OHLCV[],
  generateSignal: (candle: OHLCV, idx: number, candles: OHLCV[]) => Signal | null
): BacktestResult {
  let equity = 0;
  let maxEquity = 0;
  let minEquity = 0;
  let trades = 0;
  let wins = 0;
  let profitPcts: number[] = [];
  let equityCurve: number[] = [];

  for (let i = 0; i < candles.length - 2; i++) {
    const signal = generateSignal(candles[i], i, candles);
    if (!signal) continue;
    // Simulate entry at close of this candle, exit at close of next candle
    const entry = candles[i].close;
    const exit = candles[i + 1].close;
    const profitPct = calcProfitPct({ entry, exit });
    profitPcts.push(profitPct);
    equity += profitPct;
    equityCurve.push(equity);
    maxEquity = Math.max(maxEquity, equity);
    minEquity = Math.min(minEquity, equity);
    trades++;
    if (profitPct > 0) wins++;
  }
  const avgProfitPct = profitPcts.length ? profitPcts.reduce((a, b) => a + b, 0) / profitPcts.length : 0;
  const winRate = trades ? (wins / trades) * 100 : 0;
  const maxDrawdownPct = maxEquity !== 0 ? ((minEquity - maxEquity) / Math.abs(maxEquity)) * 100 : 0;
  return {
    totalTrades: trades,
    winRate,
    avgProfitPct,
    maxDrawdownPct,
    equityCurve,
  };
} 