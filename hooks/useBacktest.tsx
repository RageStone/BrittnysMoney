import { useState } from "react"
import { runBacktest, OHLCV, BacktestSummary } from "@/lib/backtest";
import { Signal } from "@/lib/utils";

export function useBacktest() {
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null)
  const [isBacktesting, setIsBacktesting] = useState(false)
  const [error, setError] = useState("")

  const run = async (symbol: string, timeframe: string, generateSignal: (candle: OHLCV, idx: number, candles: OHLCV[]) => Signal | null) => {
    if (!symbol || !timeframe) return
    setIsBacktesting(true)
    setError("")
    try {
      const response = await fetch(`/api/marketdata?symbol=${symbol}&interval=${timeframe}&type=time_series`)
      const data = await response.json()
      if (data.status === "error") {
        throw new Error(data.message || "Failed to fetch historical data")
      }
      const candles: OHLCV[] = (data.values || []).map((row: any) => ({
        timestamp: new Date(row.datetime).getTime(),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume),
      }))
      const summary = runBacktest(candles, generateSignal)
      setBacktestSummary(summary)
      // Log the backtest summary to Google Sheets
      try {
        await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "log_backtest",
            pair: symbol,
            timeframe,
            timestamp: new Date().toISOString(),
            totalTrades: summary.totalTrades,
            winRate: summary.winRate,
            avgProfitPct: summary.avgProfitPct,
            maxDrawdownPct: summary.maxDrawdownPct,
            equityCurve: summary.equityCurve,
          }),
        })
      } catch (logErr) {
        // Logging is best-effort; ignore errors
        console.warn("Failed to log backtest to Google Sheets", logErr)
      }
    } catch (err: any) {
      setError(err.message || "שגיאה בביצוע בדיקה אחורה")
    } finally {
      setIsBacktesting(false)
    }
  }

  return {
    backtestSummary,
    isBacktesting,
    error,
    runBacktest: run,
    setBacktestSummary,
    setError,
  }
} 