"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart3,
  Database,
  CloudIcon as CloudSync,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { parseSignal, filterValidSignals, Signal } from "@/lib/utils"
import { SignalsTable } from "@/components/SignalsTable"
import { useSignals } from "@/hooks/useSignals"
import { usePerformanceStats } from "@/hooks/usePerformanceStats"
import { useBacktest } from "@/hooks/useBacktest"
import { SignalSchema, BacktestResultSchema, BacktestSummarySchema } from "@/lib/utils"
import { z } from "zod"

// API Key rotation system
const API_KEYS = [
  "d8edf0bacb6048ea8b12e71ffc0a6bc7", // Original key
  "d6b8b9dd760c4c288f0ef04b90285492", // Second key
  "c4f369c946214a97b04fbc1ff0405bcb", // Third key for checking
]

const currentKeyIndex = 0
const keyLastUsed = new Map<string, number>()
const KEY_COOLDOWN = 60000 // 1 minute cooldown
const CALLS_PER_KEY = 8
const keyCalls = new Map<string, number>()

const getNextApiKey = () => {
  const now = Date.now()

  // Reset call counts every minute
  for (const [key, lastReset] of keyLastUsed.entries()) {
    if (now - lastReset > 60000) {
      keyCalls.set(key, 0)
      keyLastUsed.set(key, now)
    }
  }

  // Find an available key
  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[i]
    const calls = keyCalls.get(key) || 0

    if (calls < CALLS_PER_KEY) {
      keyCalls.set(key, calls + 1)
      if (!keyLastUsed.has(key)) {
        keyLastUsed.set(key, now)
      }
      return key
    }
  }

  // All keys are rate limited
  return null
}

// — safe JSON helper ----------------------------------------------------------
const safeJson = async (res: Response) => {
  try {
    if (res.headers.get("content-type")?.includes("application/json")) {
      return await res.json()
    }
    console.warn("Non-JSON response from TwelveData:", await res.text().catch(() => ""))
    return null
  } catch {
    return null
  }
}

interface MarketData {
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  volume: number
  quote: any
  priceRaw: any
}

interface BacktestResult {
  date: string
  pair: string
  direction: "BUY" | "SELL"
  entryPrice: number
  exitPrice: number
  pnl: number
  pnlPercent: number
  confidence: number
  outcome: "WIN" | "LOSS"
}

interface BacktestSummary {
  totalTrades: number
  winTrades: number
  lossTrades: number
  winRate: number
  totalPnL: number
  avgWin: number
  avgLoss: number
  profitFactor: number
}

interface PerformanceStats {
  totalSignals: number
  activeSignals: number
  completedSignals: number
  winRate: number
  avgConfidence: number
  confidenceAccuracy: number
  bestPair: string
  bestTimeframe: string
}

export interface TechnicalIndicators {
  rsi: number
  stoch: number
  williams: number
  cci: number
  atr: number
  sma: number
  ema: number
  momentum: number
  // Added indicators
  macd: number
  macdSignal: number
  macdHist: number
  bbUpper: number
  bbLower: number
  bbMiddle: number
  adx: number
  obv: number
  mfi: number
  stochrsi: number
}

function LocalTime() {
  const [time, setTime] = useState("");
  useEffect(() => {
    setTime(new Date().toLocaleTimeString("he-IL"));
    // Optionally, update every second:
    // const interval = setInterval(() => {
    //   setTime(new Date().toLocaleTimeString("he-IL"));
    // }, 1000);
    // return () => clearInterval(interval);
  }, []);
  return <div className="text-gray-400">שעה מקומית: {time}</div>;
}

export default function SignalsPage() {
  // Use custom hooks for signals, performance, and backtesting
  const {
    signals,
    setSignals,
    isSyncing,
    error,
    lastSyncTime,
    loadSignalsFromSheets,
    saveSignalToSheets,
    handleDeleteSignal,
    handleEditSignal,
    setError,
  } = useSignals()
  const performanceStats = usePerformanceStats(signals)
  const {
    backtestResults,
    backtestSummary,
    isBacktesting,
    error: backtestError,
    runBacktest,
    setBacktestResults,
    setBacktestSummary,
    setError: setBacktestError,
  } = useBacktest()

  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("")
  const [selectedPair, setSelectedPair] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCheckingTrades, setIsCheckingTrades] = useState(false)
  const [marketData, setMarketData] = useState<MarketData | null>(null)

  const timeframes = [
    { value: "1min", label: "דקה אחת" },
    { value: "5min", label: "5 דקות" },
    { value: "15min", label: "15 דקות" },
    { value: "30min", label: "30 דקות" },
    { value: "1h", label: "שעה אחת" },
    { value: "4h", label: "4 שעות" },
    { value: "1day", label: "יום אחד" },
  ]

  const currencyPairs = [
    "EUR/USD",
    "GBP/USD",
    "USD/JPY",
    "USD/CHF",
    "AUD/USD",
    "USD/CAD",
    "NZD/USD",
    "EUR/JPY",
    "GBP/JPY",
    "CHF/JPY",
    "EUR/GBP",
    "AUD/CAD",
    "GBP/CHF",
    "EUR/AUD",
    "AUD/NZD",
  ]

  // Initialize Google Sheets and load data on component mount
  useEffect(() => {
    loadSignalsFromSheets()
  }, [])

  // Auto-sync with sheets every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      loadSignalsFromSheets()
    }, 5 * 60 * 1000) // 5 minutes
    return () => clearInterval(interval)
  }, [loadSignalsFromSheets])

  // Auto-check trades every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      checkActiveTradesPerformance()
    }, 30000) // 30 seconds
    return () => clearInterval(interval)
  }, [signals])

  // Calculate performance stats whenever signals change
  useEffect(() => {
    calculatePerformanceStats()
  }, [signals])

  const calculatePerformanceStats = () => {
    const completed = signals.filter((s: Signal) => s.status === "WIN" || s.status === "LOSS")
    const wins = signals.filter((s: Signal) => s.status === "WIN")
    const active = signals.filter((s: Signal) => s.status === "ACTIVE")

    // Always calculate winRate based on all completed trades
    let winRate = 0
    if (completed.length > 0) {
      winRate = (wins.length / completed.length) * 100
    }

    // Calculate confidence accuracy (how often high confidence signals win)
    const highConfidenceSignals = completed.filter((s: Signal) => s.confidence >= 80)
    const highConfidenceWins = highConfidenceSignals.filter((s: Signal) => s.status === "WIN")
    const confidenceAccuracy =
      highConfidenceSignals.length > 0 ? (highConfidenceWins.length / highConfidenceSignals.length) * 100 : 0

    // Find best performing pair and timeframe
    const pairStats = new Map<string, { wins: number; total: number }>()
    const timeframeStats = new Map<string, { wins: number; total: number }>()

    completed.forEach((signal: Signal) => {
      // Pair stats
      const pairStat = pairStats.get(signal.pair) || { wins: 0, total: 0 }
      pairStat.total++
      if (signal.status === "WIN") pairStat.wins++
      pairStats.set(signal.pair, pairStat)

      // Timeframe stats
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

    const stats: PerformanceStats = {
      totalSignals: signals.length,
      activeSignals: active.length,
      completedSignals: completed.length,
      winRate,
      avgConfidence: completed.length > 0 ? completed.reduce((sum: number, s: Signal) => sum + s.confidence, 0) / completed.length : 0,
      confidenceAccuracy,
      bestPair: bestPair || "N/A",
      bestTimeframe: bestTimeframe || "N/A",
    }

    // ... existing code ...
  }

  const checkActiveTradesPerformance = async () => {
    const activeSignals = signals.filter((s: Signal) => s.status === "ACTIVE")
    if (activeSignals.length === 0) return

    setIsCheckingTrades(true)

    try {
      const updatedSignals = [...signals]
      let hasUpdates = false

      for (const signal of activeSignals) {
        const getTradeHoldTimeMinutes = (timeframe: string) => {
          switch (timeframe) {
            case "1min":
              return 1
            case "5min":
              return 5
            case "15min":
              return 15
            case "30min":
              return 30
            case "1h":
              return 60
            case "4h":
              return 240
            case "1day":
              return 1440
            default:
              return 60
          }
        }

        const minutesOld = (Date.now() - signal.timestamp.getTime()) / (1000 * 60)
        const holdTimeMinutes = getTradeHoldTimeMinutes(signal.timeframe)

        if (minutesOld >= holdTimeMinutes) {
          try {
            // Add timestamp to ensure fresh exit price data and add small delay
            const timestamp = Date.now()
            await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
            const priceRes = await fetch(`/api/marketdata?symbol=${signal.pair}&type=price&timestamp=${timestamp}`)
            const priceData = await priceRes.json()
            console.log(`[DEBUG] Real-time price API response for ${signal.pair}:`, priceData)
            // For exit price, use the real-time price (this is the current market price)
            let exitPrice = Number.parseFloat(priceData.price)
            console.log(`[TRADE CHECK] Real-time exit price for ${signal.pair}: ${exitPrice} (entry: ${signal.entryPrice}, direction: ${signal.direction}) at ${new Date().toISOString()}`)
            let newStatus: "WIN" | "LOSS" | "EXPIRED" = "EXPIRED"
            let pnl = 0
            let pnlPercent = 0

            if (!isNaN(exitPrice)) {
              if (signal.direction === "BUY") {
                if (exitPrice >= signal.takeProfit) {
                  newStatus = "WIN"
                  pnl = signal.takeProfit - signal.entryPrice
                  exitPrice = signal.takeProfit
                } else if (exitPrice <= signal.stopLoss) {
                  newStatus = "LOSS"
                  pnl = signal.stopLoss - signal.entryPrice
                  exitPrice = signal.stopLoss
                } else {
                  pnl = exitPrice - signal.entryPrice
                  newStatus = pnl >= 0 ? "WIN" : "LOSS"
                }
              } else {
                // SELL
                if (exitPrice <= signal.takeProfit) {
                  newStatus = "WIN"
                  pnl = signal.entryPrice - signal.takeProfit
                  exitPrice = signal.takeProfit
                } else if (exitPrice >= signal.stopLoss) {
                  newStatus = "LOSS"
                  pnl = signal.entryPrice - signal.stopLoss
                  exitPrice = signal.stopLoss
                } else {
                  pnl = signal.entryPrice - exitPrice
                  newStatus = pnl >= 0 ? "WIN" : "LOSS"
                }
              }
              pnlPercent = (pnl / signal.entryPrice) * 100
            }

            const index = updatedSignals.findIndex((s) => s.id === signal.id)
            if (index !== -1) {
              const updatedSignal = {
                ...signal,
                status: newStatus,
                exitPrice,
                pnl,
                pnlPercent,
                checkedAt: new Date(),
              }
              updatedSignals[index] = updatedSignal
              hasUpdates = true
              await saveSignalToSheets(updatedSignal, true)
              toast.success(
                `העסקה הסתיימה: ${signal.pair} (${signal.timeframe}) - ${newStatus === "WIN" ? "רווח" : newStatus === "LOSS" ? "הפסד" : "פג תוקף"} (${pnl.toFixed(2)})`
              )
            }
          } catch (err) {
            console.error("Error checking trade outcome at expiration:", err)
          }
          continue
        }

        try {
          // Add timestamp to ensure fresh current price data and add small delay
          const timestamp = Date.now()
          await new Promise(resolve => setTimeout(resolve, 500)) // 0.5 second delay
          const currentMarket = await fetch(`/api/marketdata?symbol=${signal.pair}&type=price&timestamp=${timestamp}`).then((res) => res.json())

          if (!currentMarket || currentMarket.status === "error") {
            console.warn(`Could not check signal ${signal.id}: API error`)
            continue
          }

          // For current price check, use the real-time price
          const currentPrice = Number.parseFloat(currentMarket.price)
          console.log(`[TRADE CHECK] Real-time current price for ${signal.pair}: ${currentPrice} (entry: ${signal.entryPrice}, direction: ${signal.direction}) at ${new Date().toISOString()}`)

          let newStatus: "ACTIVE" | "WIN" | "LOSS" = "ACTIVE"
          let exitPrice = currentPrice
          let pnl = 0
          let pnlPercent = 0

          // Check if stop loss or take profit was hit
          if (signal.direction === "BUY") {
            if (currentPrice <= signal.stopLoss) {
              newStatus = "LOSS"
              exitPrice = signal.stopLoss
              pnl = signal.stopLoss - signal.entryPrice
            } else if (currentPrice >= signal.takeProfit) {
              newStatus = "WIN"
              exitPrice = signal.takeProfit
              pnl = signal.takeProfit - signal.entryPrice
            }
          } else {
            // SELL
            if (currentPrice >= signal.stopLoss) {
              newStatus = "LOSS"
              exitPrice = signal.stopLoss
              pnl = signal.entryPrice - signal.stopLoss
            } else if (currentPrice <= signal.takeProfit) {
              newStatus = "WIN"
              exitPrice = signal.takeProfit
              pnl = signal.entryPrice - signal.takeProfit
            }
          }

          if (newStatus !== "ACTIVE") {
            pnlPercent = (pnl / signal.entryPrice) * 100

            const index = updatedSignals.findIndex((s) => s.id === signal.id)
            if (index !== -1) {
              const updatedSignal = {
                ...signal,
                status: newStatus,
                exitPrice,
                pnl,
                pnlPercent,
                checkedAt: new Date(),
              }
              updatedSignals[index] = updatedSignal
              hasUpdates = true
              // Save to sheets
              await saveSignalToSheets(updatedSignal, true)
            }
          }

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 300))
        } catch (error) {
          console.error(`Error checking signal ${signal.id}:`, error)
        }
      }

      if (hasUpdates) {
        setSignals(updatedSignals)
      }
    } catch (error) {
      console.error("Error checking trades:", error)
    } finally {
      setIsCheckingTrades(false)
    }
  }

  const fetchMarketData = async (symbol: string) => {
    try {
      // Fetch the most accurate price with timestamp for fresh data
      const timestamp = Date.now()
      const priceRes = await fetch(`/api/marketdata?symbol=${symbol}&type=price&timestamp=${timestamp}`)
      const priceData = await priceRes.json()
      // Fetch richer quote data with timestamp for fresh data
      const quoteRes = await fetch(`/api/marketdata?symbol=${symbol}&type=quote&timestamp=${timestamp}`)
      const quoteData = await quoteRes.json()
      if (!priceData || priceData.status === "error") {
        throw new Error(priceData.message || "Failed to fetch price data")
      }
      if (!quoteData || quoteData.status === "error") {
        throw new Error(quoteData.message || "Failed to fetch quote data")
      }
      return {
        price: Number.parseFloat(priceData.price),
        change: Number.parseFloat(quoteData.change),
        changePercent: Number.parseFloat(quoteData.percent_change),
        high: Number.parseFloat(quoteData.high),
        low: Number.parseFloat(quoteData.low),
        volume: Number.parseInt(quoteData.volume) || 0,
        quote: quoteData,
        priceRaw: priceData,
      }
    } catch (error) {
      console.error("Error fetching market data:", error)
      throw error
    }
  }

  const fetchTechnicalIndicators = async (symbol: string, interval: string) => {
    const get = async (type: string) => {
      const res = await fetch(`/api/marketdata?symbol=${symbol}&interval=${interval}&type=${type}`)
      const j = await res.json()
      return j ?? {}
    }
    try {
      const [rsi, stoch, williams, cci, atr, sma, ema, momentum, macd, bbands, adx, obv, mfi, stochrsi] = await Promise.all([
        get("rsi"),
        get("stoch"),
        get("willr"),
        get("cci"),
        get("atr"),
        get("sma"),
        get("ema"),
        get("mom"),
        get("macd"), // MACD
        get("bbands"), // Bollinger Bands
        get("adx"), // ADX
        get("obv"), // OBV
        get("mfi"), // MFI
        get("stochrsi"), // Stochastic RSI
      ])
      return {
        rsi: Number.parseFloat(rsi?.values?.[0]?.rsi) || 50,
        stoch: Number.parseFloat(stoch?.values?.[0]?.slow_k) || 50,
        williams:
          Array.isArray(williams?.values) && williams.values.length > 0
            ? Number.parseFloat(williams.values[0].willr)
            : -50,
        cci: Number.parseFloat(cci?.values?.[0]?.cci) || 0,
        atr: Number.parseFloat(atr?.values?.[0]?.atr) || 0.001,
        sma: Number.parseFloat(sma?.values?.[0]?.sma) || 1,
        ema: Number.parseFloat(ema?.values?.[0]?.ema) || 1,
        momentum:
          Array.isArray(momentum?.values) && momentum.values.length > 0
            ? Number.parseFloat(momentum.values[0].mom)
            : 0,
        // New indicators
        macd: Number.parseFloat(macd?.values?.[0]?.macd) || 0,
        macdSignal: Number.parseFloat(macd?.values?.[0]?.signal) || 0,
        macdHist: Number.parseFloat(macd?.values?.[0]?.histogram) || 0,
        bbUpper: Number.parseFloat(bbands?.values?.[0]?.upper) || 0,
        bbLower: Number.parseFloat(bbands?.values?.[0]?.lower) || 0,
        bbMiddle: Number.parseFloat(bbands?.values?.[0]?.middle) || 0,
        adx: Number.parseFloat(adx?.values?.[0]?.adx) || 20,
        // New indicators
        obv: Number.parseFloat(obv?.values?.[0]?.obv) || 0,
        mfi: Number.parseFloat(mfi?.values?.[0]?.mfi) || 50,
        stochrsi: Number.parseFloat(stochrsi?.values?.[0]?.stochrsi) || 0.5,
      }
    } catch (error) {
      console.error("Error fetching technical indicators:", error)
      return {
        rsi: 50,
        stoch: 50,
        williams: -50,
        cci: 0,
        atr: 0.001,
        sma: 1,
        ema: 1,
        momentum: 0,
        macd: 0,
        macdSignal: 0,
        macdHist: 0,
        bbUpper: 0,
        bbLower: 0,
        bbMiddle: 0,
        adx: 20,
        obv: 0,
        mfi: 50,
        stochrsi: 0.5,
      }
    }
  }

  const generateAdvancedTradingSignal = (
    marketData: MarketData,
    indicators: TechnicalIndicators,
    pair: string,
    timeframe: string,
  ) => {
    // Indicator weights
    const weights = {
      rsi: 10,
      stoch: 8,
      williams: 6,
      cci: 8,
      ma: 10,
      priceVsMA: 6,
      momentum: 5,
      priceChange: 4,
    }
    let buyScore = 0
    let sellScore = 0
    let confidence = 50 // base
    let reasoning = ""

    // 1. RSI
    if (indicators.rsi < 30) {
      buyScore += weights.rsi
      reasoning += "RSI מציין מכירת יתר. "
    } else if (indicators.rsi > 70) {
      sellScore += weights.rsi
      reasoning += "RSI מציין קנייה יתר. "
    }
    // 2. Stochastic
    if (indicators.stoch < 20) {
      buyScore += weights.stoch
      reasoning += "Stochastic מציין מכירת יתר. "
    } else if (indicators.stoch > 80) {
      sellScore += weights.stoch
      reasoning += "Stochastic מציין קנייה יתר. "
    }
    // 3. Williams %R
    if (indicators.williams < -80) {
      buyScore += weights.williams
      reasoning += "Williams %R מציין מכירת יתר. "
    } else if (indicators.williams > -20) {
      sellScore += weights.williams
      reasoning += "Williams %R מציין קנייה יתר. "
    }
    // 4. CCI
    if (indicators.cci < -100) {
      buyScore += weights.cci
      reasoning += "CCI מציין מכירת יתר. "
    } else if (indicators.cci > 100) {
      sellScore += weights.cci
      reasoning += "CCI מציין קנייה יתר. "
    }
    // 5. MA Crossover
    if (indicators.ema > indicators.sma) {
      buyScore += weights.ma
      reasoning += "EMA מעל SMA - מגמה עולה. "
    } else if (indicators.ema < indicators.sma) {
      sellScore += weights.ma
      reasoning += "EMA מתחת SMA - מגמה יורדת. "
    }
    // 6. Price vs MA
    if (marketData.price > indicators.sma) {
      buyScore += weights.priceVsMA
      reasoning += "מחיר מעל ממוצע נע. "
    } else if (marketData.price < indicators.sma) {
      sellScore += weights.priceVsMA
      reasoning += "מחיר מתחת ממוצע נע. "
    }
    // 7. Momentum
    if (indicators.momentum > 0) {
      buyScore += weights.momentum
      reasoning += "מומנטום חיובי. "
    } else if (indicators.momentum < 0) {
      sellScore += weights.momentum
      reasoning += "מומנטום שלילי. "
    }
    // 8. Price Change
    if (marketData.changePercent > 0.3) {
      buyScore += weights.priceChange
      reasoning += "שינוי מחיר חיובי. "
    } else if (marketData.changePercent < -0.3) {
      sellScore += weights.priceChange
      reasoning += "שינוי מחיר שלילי. "
    }
    // 9. Volume penalty (new)
    if (marketData.volume && marketData.volume < 100000) { // Adjust threshold as appropriate
      confidence -= 7
      reasoning += "נפח מסחר נמוך - ביטחון יורד. "
    }

    // Agreement/conflict logic (unchanged)
    if (buyScore > 0 && sellScore === 0) {
      confidence += 10
      reasoning += "כל האינדיקטורים תומכים בכיוון אחד. "
    } else if (sellScore > 0 && buyScore === 0) {
      confidence += 10
      reasoning += "כל האינדיקטורים תומכים בכיוון אחד. "
    } else if (buyScore > 0 && sellScore > 0) {
      confidence -= 10
      reasoning += "יש סתירה בין האינדיקטורים. "
    }

    // Volatility penalty (unchanged)
    if (indicators.atr > 0.002) {
      confidence -= 5
      reasoning += "תנודתיות גבוהה - ביטחון יורד. "
    }

    // Historical win rate boost (pair) - increased weight
    const completedSignals = signals.filter((s: Signal) => s.status === "WIN" || s.status === "LOSS")
    const pairSignals = completedSignals.filter((s: Signal) => s.pair === pair)
    let pairWinRate = 0
    if (pairSignals.length >= 3) {
      pairWinRate = (pairSignals.filter((s: Signal) => s.status === "WIN").length / pairSignals.length) * 100
      if (pairWinRate > 60) {
        confidence += 10 // was 5
        reasoning += `היסטוריית הצלחה גבוהה לזוג זה (${pairWinRate.toFixed(1)}%). `
      } else if (pairWinRate < 40) {
        confidence -= 10 // was 5
        reasoning += `היסטוריית הצלחה נמוכה לזוג זה (${pairWinRate.toFixed(1)}%). `
      }
    }

    // Historical win rate boost (timeframe) - increased weight
    const tfSignals = completedSignals.filter((s: Signal) => s.timeframe === timeframe)
    let tfWinRate = 0
    if (tfSignals.length >= 3) {
      tfWinRate = (tfSignals.filter((s: Signal) => s.status === "WIN").length / tfSignals.length) * 100
      if (tfWinRate > 60) {
        confidence += 6 // was 3
        reasoning += `היסטוריית הצלחה גבוהה למסגרת זמן זו (${tfWinRate.toFixed(1)}%). `
      } else if (tfWinRate < 40) {
        confidence -= 6 // was 3
        reasoning += `היסטוריית הצלחה נמוכה למסגרת זמן זו (${tfWinRate.toFixed(1)}%). `
      }
    }

    // Historical win rate for similar indicator setup (direction + high confidence) - increased weight
    const direction: "BUY" | "SELL" = buyScore > sellScore ? "BUY" : "SELL"
    const similarSignals = completedSignals.filter((s: Signal) => s.direction === direction && Math.abs(s.confidence - confidence) < 10)
    let similarWinRate = 0
    if (similarSignals.length >= 3) {
      similarWinRate = (similarSignals.filter((s: Signal) => s.status === "WIN").length / similarSignals.length) * 100
      if (similarWinRate > 60) {
        confidence += 10 // was 5
        reasoning += `אותות דומים בעבר הצליחו (${similarWinRate.toFixed(1)}%). `
      } else if (similarWinRate < 40) {
        confidence -= 10 // was 5
        reasoning += `אותות דומים בעבר נכשלו (${similarWinRate.toFixed(1)}%). `
      }
    }

    // Strong indicator value boost (unchanged)
    if (indicators.rsi < 20 || indicators.rsi > 80) {
      confidence += 5
      reasoning += "ערך קיצוני ב-RSI. "
    }

    // MACD logic
    if (typeof indicators.macd === "number" && typeof indicators.macdSignal === "number") {
      if (indicators.macd > indicators.macdSignal) {
        buyScore += 8
        reasoning += "MACD שורי (MACD מעל סיגנל). "
      } else if (indicators.macd < indicators.macdSignal) {
        sellScore += 8
        reasoning += "MACD דובי (MACD מתחת סיגנל). "
      }
      // MACD histogram strong move
      if (Math.abs(indicators.macdHist) > 0.5) {
        confidence += 3
        reasoning += "תנודתיות חזקה ב-MACD. "
      }
    }
    // Bollinger Bands logic
    if (typeof indicators.bbUpper === "number" && typeof indicators.bbLower === "number" && typeof marketData.price === "number") {
      if (marketData.price > indicators.bbUpper) {
        sellScore += 6
        reasoning += "מחיר מעל בולינגר עליון - קנייה יתר. "
      } else if (marketData.price < indicators.bbLower) {
        buyScore += 6
        reasoning += "מחיר מתחת בולינגר תחתון - מכירה יתר. "
      }
    }
    // ADX logic
    if (typeof indicators.adx === "number") {
      if (indicators.adx > 25) {
        confidence += 5
        reasoning += "מגמה חזקה לפי ADX. "
      } else if (indicators.adx < 15) {
        confidence -= 5
        reasoning += "מגמה חלשה לפי ADX. "
      }
    }

    // OBV logic
    if (typeof indicators.obv === "number" && indicators.obv !== 0) {
      if (indicators.obv > 0) {
        buyScore += 4
        reasoning += "OBV חיובי - נפח תומך בעליות. "
      } else if (indicators.obv < 0) {
        sellScore += 4
        reasoning += "OBV שלילי - נפח תומך בירידות. "
      }
    }
    // MFI logic
    if (typeof indicators.mfi === "number" && indicators.mfi !== 50) {
      if (indicators.mfi > 80) {
        sellScore += 4
        reasoning += "MFI גבוה - קנייה יתר. "
      } else if (indicators.mfi < 20) {
        buyScore += 4
        reasoning += "MFI נמוך - מכירה יתר. "
      }
    }
    // Stochastic RSI logic
    if (typeof indicators.stochrsi === "number" && indicators.stochrsi !== 0.5) {
      if (indicators.stochrsi > 0.8) {
        sellScore += 4
        reasoning += "StochRSI גבוה - קנייה יתר. "
      } else if (indicators.stochrsi < 0.2) {
        buyScore += 4
        reasoning += "StochRSI נמוך - מכירה יתר. "
      }
    }

    // Clamp confidence
    confidence = Math.max(0, Math.min(100, confidence))

    const signalStrength = Math.abs(buyScore - sellScore)

    // Minimum signal strength threshold (new)
    if (signalStrength < 3) {
      return {
        direction,
        confidence: 0,
        reasoning: reasoning + "הפרש בין קנייה למכירה נמוך מדי - אות לא חזק.",
        signalStrength,
      }
    }

    return {
      direction,
      confidence,
      reasoning: reasoning.trim() || "ניתוח טכני מתקדם",
      signalStrength: signalStrength,
    }
  }

  const generateSignal = async () => {
    if (!selectedTimeframe || !selectedPair) return
    setIsGenerating(true)
    setError("")
    try {
      // Fetch entry price with timestamp for fresh data
      const timestamp = Date.now()
      const priceRes = await fetch(`/api/marketdata?symbol=${selectedPair}&type=price&timestamp=${timestamp}`)
      const priceData = await priceRes.json()
      if (!priceData || priceData.status === "error") {
        throw new Error(priceData.message || "Failed to fetch entry price")
      }
      // For entry price, use the real-time price from /price endpoint
      const entryPrice = Number.parseFloat(priceData.price)
      console.log(`[SIGNAL GENERATION] Real-time price for ${selectedPair}: ${entryPrice} at ${new Date().toISOString()}`)
      // Fetch quote for SL/TP and other data with timestamp for fresh data
      const quoteRes = await fetch(`/api/marketdata?symbol=${selectedPair}&type=quote&timestamp=${timestamp}`)
      const quoteData = await quoteRes.json()
      if (!quoteData || quoteData.status === "error") {
        throw new Error(quoteData.message || "Failed to fetch quote data")
      }
      // Fetch indicators
      const indicators = await fetchTechnicalIndicators(selectedPair, selectedTimeframe)
      const { direction, confidence, reasoning } = generateAdvancedTradingSignal(
        { ...quoteData, price: entryPrice },
        indicators,
        selectedPair,
        selectedTimeframe,
      )
      
      // For forex, we need to account for spread. Use bid/ask from quote data
      const adjustedEntryPrice = direction === "BUY" 
        ? Number.parseFloat(quoteData.ask ?? entryPrice)
        : Number.parseFloat(quoteData.bid ?? entryPrice)
      console.log(`[SIGNAL GENERATION] Adjusted entry price for ${selectedPair} (${direction}): ${adjustedEntryPrice} (real-time: ${entryPrice}, ask: ${quoteData.ask}, bid: ${quoteData.bid}) at ${new Date().toISOString()}`)
      
      const stopLossDistance = indicators.atr * 1.5
      const takeProfitDistance = indicators.atr * 2.5
      const newSignal: Signal = {
        id: Date.now().toString(),
        pair: selectedPair,
        direction,
        entryPrice: adjustedEntryPrice,
        stopLoss:
          direction === "BUY"
            ? Number((entryPrice - stopLossDistance).toFixed(5))
            : Number((entryPrice + stopLossDistance).toFixed(5)),
        takeProfit:
          direction === "BUY"
            ? Number((entryPrice + takeProfitDistance).toFixed(5))
            : Number((entryPrice - takeProfitDistance).toFixed(5)),
        timeframe: selectedTimeframe,
        confidence,
        timestamp: new Date(),
        currentPrice: adjustedEntryPrice,
        indicators,
        reasoning,
        status: "ACTIVE",
      }
      if (confidence < 30) {
        setError("האות חלש מדי (מתחת ל-30% ביטחון). המתן דקה ונסה שוב.");
        return;
      }
      await saveSignalToSheets(newSignal)
      setSignals((prev: Signal[]) => [newSignal, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בקבלת נתונים מהשוק")
    } finally {
      setIsGenerating(false)
    }
  }

  const getStatusBadge = (status: Signal["status"], signal?: Signal) => {
    switch (status) {
      case "WIN":
        return (
          <Badge className="bg-green-600 text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            רווח
          </Badge>
        )
      case "LOSS":
        return (
          <Badge className="bg-red-600 text-white">
            <XCircle className="w-3 h-3 mr-1" />
            הפסד
          </Badge>
        )
      case "EXPIRED":
        return (
          <Badge className="bg-gray-600 text-white">
            <Clock className="w-3 h-3 mr-1" />
            פג תוקף
          </Badge>
        )
      default:
        if (signal) {
          const getTradeHoldTimeMinutes = (timeframe: string) => {
            switch (timeframe) {
              case "1min":
                return 1
              case "5min":
                return 5
              case "15min":
                return 15
              case "30min":
                return 30
              case "1h":
                return 60
              case "4h":
                return 240
              case "1day":
                return 1440
              default:
                return 60
            }
          }

          const minutesOld = (Date.now() - signal.timestamp.getTime()) / (1000 * 60)
          const holdTimeMinutes = getTradeHoldTimeMinutes(signal.timeframe)
          const minutesRemaining = Math.max(0, holdTimeMinutes - minutesOld)

                  return (
          <Badge className="bg-[#9c5925] text-white">
            <Clock className="w-3 h-3 mr-1" />
            פעיל ({minutesRemaining.toFixed(1)}פ)
          </Badge>
        )
        }
        return (
          <Badge className="bg-[#9c5925] text-white">
            <Clock className="w-3 h-3 mr-1" />
            פעיל
          </Badge>
        )
    }
  }

  const sealSignal = async (signal: Signal) => {
    try {
      const timestamp = Date.now();
      await new Promise(resolve => setTimeout(resolve, 1000));
      const priceRes = await fetch(`/api/marketdata?symbol=${signal.pair}&type=price&timestamp=${timestamp}`);
      const priceData = await priceRes.json();
      let exitPrice = Number.parseFloat(priceData.price);
      let newStatus: "WIN" | "LOSS" | "EXPIRED" = "EXPIRED";
      let pnl = 0;
      let pnlPercent = 0;
      if (!isNaN(exitPrice)) {
        if (signal.direction === "BUY") {
          if (exitPrice >= signal.takeProfit) {
            newStatus = "WIN";
            pnl = signal.takeProfit - signal.entryPrice;
            exitPrice = signal.takeProfit;
          } else if (exitPrice <= signal.stopLoss) {
            newStatus = "LOSS";
            pnl = signal.stopLoss - signal.entryPrice;
            exitPrice = signal.stopLoss;
          } else {
            pnl = exitPrice - signal.entryPrice;
            newStatus = pnl >= 0 ? "WIN" : "LOSS";
          }
        } else {
          if (exitPrice <= signal.takeProfit) {
            newStatus = "WIN";
            pnl = signal.entryPrice - signal.takeProfit;
            exitPrice = signal.takeProfit;
          } else if (exitPrice >= signal.stopLoss) {
            newStatus = "LOSS";
            pnl = signal.entryPrice - signal.stopLoss;
            exitPrice = signal.stopLoss;
          } else {
            pnl = signal.entryPrice - exitPrice;
            newStatus = pnl >= 0 ? "WIN" : "LOSS";
          }
        }
        pnlPercent = (pnl / signal.entryPrice) * 100;
      }
      const updatedSignal: Signal = {
        ...signal,
        status: newStatus,
        exitPrice,
        pnl,
        pnlPercent,
        checkedAt: new Date(),
      };
      setSignals((prev: Signal[]) => prev.map((s: Signal) => s.id === signal.id ? updatedSignal : s));
      await saveSignalToSheets(updatedSignal, true);
      toast.success(
        `העסקה נסגרה: ${signal.pair} (${signal.timeframe}) - ${newStatus === "WIN" ? "רווח" : newStatus === "LOSS" ? "הפסד" : "פג תוקף"} (${pnl.toFixed(2)})`
      );
    } catch (err) {
      console.error("Error sealing trade:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 border-b border-gray-800">
        <Button variant="outline" className="bg-[#9c5925]/20 border-[#9c5925]/30 text-[#9c5925] hover:bg-[#9c5925]/30">
          התחברות
        </Button>

        <div className="flex items-center space-x-8">
          <a href="#" className="hover:text-[#9c5925] transition-colors">
            עלינו
          </a>
          <a href="#" className="hover:text-[#9c5925] transition-colors">
            מחירים
          </a>
          <a href="#" className="hover:text-[#9c5925] transition-colors">
            מדריך
          </a>
          <a href="#" className="hover:text-[#9c5925] transition-colors">
            אות
          </a>
          <a href="#" className="hover:text-[#9c5925] transition-colors">
            עמלים
          </a>
          <div className="flex items-center space-x-1">
            <span>שפה</span>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-center space-x-2">
        <span className="text-white font-bold">MONEY</span>
          <span className="text-[#9c5925] font-bold">BRITTNY'S</span>
          
        </div>
      </nav>

      {/* Performance Stats Bar */}
      {performanceStats && (
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex justify-center items-center space-x-8 text-sm">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-[#9c5925]" />
              <span>
                אחוז הצלחה: <span className="font-bold text-green-400">{performanceStats.winRate.toFixed(1)}%</span>
              </span>
            </div>
            <div>
              <span>
                עסקאות פעילות: <span className="font-bold text-[#9c5925]">{performanceStats.activeSignals}</span>
              </span>
            </div>
            <div>
              <span>
                עסקאות הושלמו: <span className="font-bold text-white">{performanceStats.completedSignals}</span>
              </span>
            </div>
            <div>
              <span>
                זוג מוביל: <span className="font-bold text-yellow-400">{performanceStats.bestPair}</span>
              </span>
            </div>
            {isSyncing && (
              <div className="flex items-center space-x-2 text-green-400">
                <CloudSync className="w-4 h-4 animate-pulse" />
                <span>מסנכרן עם Google Sheets...</span>
              </div>
            )}
            {isCheckingTrades && (
              <div className="flex items-center space-x-2 text-[#9c5925]">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#9c5925]"></div>
                <span>בודק עסקאות...</span>
              </div>
            )}
            {lastSyncTime && (
              <div className="flex items-center space-x-2 text-gray-400">
                <Database className="w-4 h-4" />
                <span>סונכרן: {lastSyncTime.toLocaleTimeString("he-IL")}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Market Status Indicator */}
      <div className="bg-gray-800 border-b border-gray-700 p-2">
        <div className="flex justify-center items-center space-x-4 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400 font-medium">פורקס פתוח</span>
          </div>
          <LocalTime />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <Tabs defaultValue="signals" className="w-full max-w-6xl">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="signals">אותות חיים</TabsTrigger>
            <TabsTrigger value="performance">ביצועים</TabsTrigger>
            <TabsTrigger value="backtest">בדיקה אחורה</TabsTrigger>
          </TabsList>

          <TabsContent value="signals" className="space-y-6">
            <div className="w-full max-w-md mx-auto space-y-6">
              {error && (
                <Alert className="bg-red-900/20 border-red-500/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-300">{error}</AlertDescription>
                </Alert>
              )}

              {marketData && selectedPair && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">{selectedPair}</span>
                      <div className="text-right">
                        <div className="text-xl font-mono">{marketData.price.toFixed(5)}</div>
                        <div className={`text-sm ${marketData.changePercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {marketData.changePercent >= 0 ? "+" : ""}
                          {marketData.changePercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="דקת אחת" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {timeframes.map((tf) => (
                    <SelectItem key={tf.value} value={tf.value} className="text-white hover:bg-gray-700">
                      {tf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPair} onValueChange={setSelectedPair}>
                <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="CHFJPY" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {currencyPairs.map((pair) => (
                    <SelectItem key={pair} value={pair} className="text-white hover:bg-gray-700">
                      {pair}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex space-x-2">
                <Button
                  onClick={generateSignal}
                  disabled={!selectedTimeframe || !selectedPair || isGenerating}
                  className="flex-1 bg-[#9c5925] hover:bg-[#8a4f1f] text-white py-3 text-lg"
                >
                  {isGenerating ? "מייצר אות..." : "קבל אותות"}
                </Button>
                <Button
                  onClick={checkActiveTradesPerformance}
                  disabled={isCheckingTrades}
                  variant="outline"
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                >
                  {isCheckingTrades ? "בודק..." : "בדוק עסקאות"}
                </Button>
                <Button
                  onClick={loadSignalsFromSheets}
                  disabled={isSyncing}
                  variant="outline"
                  className="bg-green-700 border-green-600 text-white hover:bg-green-600"
                >
                  <CloudSync className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {signals.length > 0 && (
              <SignalsTable
                signals={signals}
                getStatusBadge={getStatusBadge}
                onDeleteSignal={handleDeleteSignal}
                onEditSignal={handleEditSignal}
                onSealSignal={sealSignal}
              />
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {performanceStats ? (
              <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-center mb-6">ביצועי המערכת</h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-white">{performanceStats.totalSignals}</div>
                      <div className="text-sm text-gray-400">סה"כ אותות</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">{performanceStats.winRate.toFixed(1)}%</div>
                      <div className="text-sm text-gray-400">אחוז הצלחה</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4 text-center">
                                        <div className="text-2xl font-bold text-[#9c5925]">
                    {performanceStats.confidenceAccuracy.toFixed(1)}%
                  </div>
                      <div className="text-sm text-gray-400">דיוק ביטחון גבוה</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-[#9c5925]">{performanceStats.activeSignals}</div>
                      <div className="text-sm text-gray-400">עסקאות פעילות</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4">
                      <h3 className="font-bold mb-2">זוג מטבעות מוביל</h3>
                      <div className="text-2xl font-bold text-yellow-400">{performanceStats.bestPair}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4">
                      <h3 className="font-bold mb-2">מסגרת זמן מובילה</h3>
                      <div className="text-2xl font-bold text-purple-400">{performanceStats.bestTimeframe}</div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex justify-between mb-2">
                      <span>אחוז הצלחה כללי</span>
                      <span>{performanceStats.winRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={performanceStats.winRate} className="h-2" />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">אין מספיק נתונים להצגת ביצועים</div>
                <div className="text-sm text-gray-500">צור לפחות 3 אותות כדי לראות סטטיסטיקות</div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="backtest" className="space-y-6">
            <div className="w-full max-w-md mx-auto space-y-6">
              <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="דקת אחת" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {timeframes.map((tf) => (
                    <SelectItem key={tf.value} value={tf.value} className="text-white hover:bg-gray-700">
                      {tf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPair} onValueChange={setSelectedPair}>
                <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="CHFJPY" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {currencyPairs.map((pair) => (
                    <SelectItem key={pair} value={pair} className="text-white hover:bg-gray-700">
                      {pair}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={() => runBacktest(selectedPair, selectedTimeframe, generateAdvancedTradingSignal)}
                disabled={!selectedTimeframe || !selectedPair || isBacktesting}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 text-lg"
              >
                {isBacktesting ? "מריץ בדיקה..." : "הרץ בדיקה אחורה"}
              </Button>
            </div>

            {backtestSummary && (
              <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-center mb-6">תוצאות בדיקה אחורה</h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-white">{backtestSummary.totalTrades}</div>
                      <div className="text-sm text-gray-400">סה"כ עסקאות</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">{backtestSummary.winRate.toFixed(1)}%</div>
                      <div className="text-sm text-gray-400">אחוז הצלחה</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <div
                        className={`text-2xl font-bold ${backtestSummary.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {backtestSummary.totalPnL >= 0 ? "+" : ""}
                        {backtestSummary.totalPnL.toFixed(2)}%
                      </div>
                      <div className="text-sm text-gray-400">רווח/הפסד כולל</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-[#9c5925]">{backtestSummary.profitFactor.toFixed(2)}</div>
                      <div className="text-sm text-gray-400">יחס רווח</div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex justify-between mb-2">
                      <span>אחוז הצלחה</span>
                      <span>{backtestSummary.winRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={backtestSummary.winRate} className="h-2" />
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold">עסקאות אחרונות</h3>
                  {backtestResults.slice(0, 10).map((result: BacktestResult, index: number) => (
                    <Card key={index} className="bg-gray-800 border-gray-700">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            {result.outcome === "WIN" ? (
                              <TrendingUp className="w-4 h-4 text-green-400" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-400" />
                            )}
                            <span className={result.direction === "BUY" ? "text-green-400" : "text-red-400"}>
                              {result.direction} {result.pair}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold ${result.pnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {result.pnlPercent >= 0 ? "+" : ""}
                              {result.pnlPercent.toFixed(2)}%
                            </div>
                            <div className="text-xs text-gray-400">{result.date}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-gray-800">
        <div className="text-center space-y-4">
                          <div className="text-gray-400 text-sm">© BRITTNY'S MONEY 2025 | כל הזכויות שמורות</div>
          <div className="flex justify-center space-x-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-300">
              מדיניות פרטיות
            </a>
            <a href="#" className="hover:text-gray-300">
              תנאי שימוש
            </a>
            <a href="#" className="hover:text-gray-300">
              צור קשר
            </a>
          </div>
          <div className="flex items-center justify-center space-x-2 text-sm">
                             <span className="text-white font-bold">MONEY</span>
                            <span className="text-[#9c5925] font-bold">BRITTNY'S</span>
                
          </div>
        </div>
      </footer>
    </div>
  )
}
