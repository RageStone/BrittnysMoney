import { useState } from "react"
import { TechnicalIndicators, Signal, BacktestResult, BacktestSummary } from "@/lib/utils"

export function useBacktest() {
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([])
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null)
  const [isBacktesting, setIsBacktesting] = useState(false)
  const [error, setError] = useState("")

  const runBacktest = async (selectedPair: string, selectedTimeframe: string, generateAdvancedTradingSignal: any) => {
    if (!selectedPair || !selectedTimeframe) return
    setIsBacktesting(true)
    setError("")
    try {
      const response = await fetch(`/api/marketdata?symbol=${selectedPair}&interval=${selectedTimeframe}&type=time_series`)
      const data = await response.json()
      if (data.status === "error") {
        throw new Error(data.message || "Failed to fetch historical data")
      }
      const historicalData = data.values || []
      const results: BacktestResult[] = []
      for (let i = 10; i < Math.min(historicalData.length - 5, 50); i++) {
        const currentBar = historicalData[i]
        const futureBar = historicalData[i - 5]
        const [rsi, stoch, williams, cci, atr, sma, ema, momentum] = await Promise.all([
          fetch(`/api/marketdata?symbol=${selectedPair}&interval=${selectedTimeframe}&type=rsi`).then(r => r.json()),
          fetch(`/api/marketdata?symbol=${selectedPair}&interval=${selectedTimeframe}&type=stoch`).then(r => r.json()),
          fetch(`/api/marketdata?symbol=${selectedPair}&interval=${selectedTimeframe}&type=willr`).then(r => r.json()),
          fetch(`/api/marketdata?symbol=${selectedPair}&interval=${selectedTimeframe}&type=cci`).then(r => r.json()),
          fetch(`/api/marketdata?symbol=${selectedPair}&interval=${selectedTimeframe}&type=atr`).then(r => r.json()),
          fetch(`/api/marketdata?symbol=${selectedPair}&interval=${selectedTimeframe}&type=sma`).then(r => r.json()),
          fetch(`/api/marketdata?symbol=${selectedPair}&interval=${selectedTimeframe}&type=ema`).then(r => r.json()),
          fetch(`/api/marketdata?symbol=${selectedPair}&interval=${selectedTimeframe}&type=mom`).then(r => r.json()),
        ])
        const mockMarketData = {
          price: Number.parseFloat(currentBar.close),
          change: Number.parseFloat(currentBar.close) - Number.parseFloat(currentBar.open),
          changePercent:
            ((Number.parseFloat(currentBar.close) - Number.parseFloat(currentBar.open)) /
              Number.parseFloat(currentBar.open)) *
            100,
          high: Number.parseFloat(currentBar.high),
          low: Number.parseFloat(currentBar.low),
          volume: Number.parseInt(currentBar.volume) || 0,
        }
        const mockIndicators: TechnicalIndicators = {
          rsi: Number.parseFloat(rsi?.values?.[i]?.rsi) || 50,
          stoch: Number.parseFloat(stoch?.values?.[i]?.slow_k) || 50,
          williams:
            Array.isArray(williams?.values) && williams.values.length > i
              ? Number.parseFloat(williams.values[i].willr)
              : -50,
          cci: Number.parseFloat(cci?.values?.[i]?.cci) || 0,
          atr: Number.parseFloat(atr?.values?.[i]?.atr) || 0.001,
          sma: Number.parseFloat(sma?.values?.[i]?.sma) || 1,
          ema: Number.parseFloat(ema?.values?.[i]?.ema) || 1,
          momentum:
            Array.isArray(momentum?.values) && momentum.values.length > i
              ? Number.parseFloat(momentum.values[i].mom)
              : 0,
        }
        const { direction, confidence } = generateAdvancedTradingSignal(
          mockMarketData,
          mockIndicators,
          selectedPair,
          selectedTimeframe,
        )
        const entryPrice = mockMarketData.price
        const exitPrice = Number.parseFloat(futureBar.close)
        let pnl = 0
        if (direction === "BUY") {
          pnl = exitPrice - entryPrice
        } else {
          pnl = entryPrice - exitPrice
        }
        const pnlPercent = (pnl / entryPrice) * 100
        const outcome: "WIN" | "LOSS" = pnl > 0 ? "WIN" : "LOSS"
        results.push({
          date: currentBar.datetime,
          pair: selectedPair,
          direction,
          entryPrice,
          exitPrice,
          pnl,
          pnlPercent,
          confidence,
          outcome,
        })
      }
      const winTrades = results.filter((r) => r.outcome === "WIN").length
      const lossTrades = results.filter((r) => r.outcome === "LOSS").length
      const totalPnL = results.reduce((sum, r) => sum + r.pnlPercent, 0)
      const wins = results.filter((r) => r.outcome === "WIN")
      const losses = results.filter((r) => r.outcome === "LOSS")
      const avgWin = wins.length > 0 ? wins.reduce((sum, r) => sum + r.pnlPercent, 0) / wins.length : 0
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, r) => sum + r.pnlPercent, 0) / losses.length) : 0
      const profitFactor = avgLoss > 0 ? (avgWin * winTrades) / (avgLoss * lossTrades) : 0
      const summary: BacktestSummary = {
        totalTrades: results.length,
        winTrades,
        lossTrades,
        winRate: (winTrades / results.length) * 100,
        totalPnL,
        avgWin,
        avgLoss,
        profitFactor,
      }
      setBacktestResults(results)
      setBacktestSummary(summary)
    } catch (err: any) {
      setError(err.message || "שגיאה בביצוע בדיקה אחורה")
    } finally {
      setIsBacktesting(false)
    }
  }

  return {
    backtestResults,
    backtestSummary,
    isBacktesting,
    error,
    runBacktest,
    setBacktestResults,
    setBacktestSummary,
    setError,
  }
} 