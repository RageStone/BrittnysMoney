import { useMemo } from "react"
import { Signal } from "@/lib/utils"

export function usePerformanceStats(signals: Signal[]) {
  return useMemo(() => {
    const completed = signals.filter((s) => s.status === "WIN" || s.status === "LOSS")
    const wins = signals.filter((s) => s.status === "WIN")
    const active = signals.filter((s) => s.status === "ACTIVE")
    let winRate = 0
    if (completed.length > 0) {
      winRate = (wins.length / completed.length) * 100
    }
    const highConfidenceSignals = completed.filter((s) => s.confidence >= 80)
    const highConfidenceWins = highConfidenceSignals.filter((s) => s.status === "WIN")
    const confidenceAccuracy =
      highConfidenceSignals.length > 0 ? (highConfidenceWins.length / highConfidenceSignals.length) * 100 : 0
    const pairStats = new Map<string, { wins: number; total: number }>()
    const timeframeStats = new Map<string, { wins: number; total: number }>()
    completed.forEach((signal) => {
      const pairStat = pairStats.get(signal.pair) || { wins: 0, total: 0 }
      pairStat.total++
      if (signal.status === "WIN") pairStat.wins++
      pairStats.set(signal.pair, pairStat)
      const tfStat = timeframeStats.get(signal.timeframe) || { wins: 0, total: 0 }
      tfStat.total++
      if (signal.status === "WIN") tfStat.wins++
      timeframeStats.set(signal.timeframe, tfStat)
    })
    let bestPair = ""
    let bestPairRate = 0
    pairStats.forEach((stat, pair) => {
      const rate = stat.wins / stat.total
      if (rate > bestPairRate && stat.total >= 1) {
        bestPairRate = rate
        bestPair = pair
      }
    })
    let bestTimeframe = ""
    let bestTimeframeRate = 0
    timeframeStats.forEach((stat, tf) => {
      const rate = stat.wins / stat.total
      if (rate > bestTimeframeRate && stat.total >= 1) {
        bestTimeframeRate = rate
        bestTimeframe = tf
      }
    })
    return {
      totalSignals: signals.length,
      activeSignals: active.length,
      completedSignals: completed.length,
      winRate,
      avgConfidence: completed.length > 0 ? completed.reduce((sum, s) => sum + s.confidence, 0) / completed.length : 0,
      confidenceAccuracy,
      bestPair: bestPair || "N/A",
      bestTimeframe: bestTimeframe || "N/A",
    }
  }, [signals])
} 