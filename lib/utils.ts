import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { z } from "zod"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
  // New indicators
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

export interface Signal {
  id: string
  pair: string
  direction: "BUY" | "SELL"
  entryPrice: number
  stopLoss: number
  takeProfit: number
  timeframe: string
  confidence: number
  timestamp: Date
  currentPrice: number
  indicators: TechnicalIndicators
  reasoning: string
  status: "ACTIVE" | "WIN" | "LOSS" | "EXPIRED"
  exitPrice?: number
  pnl?: number
  pnlPercent?: number
  checkedAt?: Date
}

// Centralized signal parsing/validation utility
export function parseSignal(raw: any): Signal | null {
  if (!raw) {
    console.warn("parseSignal: Skipping null/undefined row", raw)
    return null
  }
  const id = raw.id || raw[0] || ""
  const pair = raw.pair || raw[1] || ""
  const direction = raw.direction || raw[2] || "BUY"
  const entryPrice = Number.parseFloat(raw.entryPrice ?? raw[3]) || 0
  const timestamp = new Date(raw.timestamp ?? raw[8] ?? Date.now())
  if (!id || !pair || !direction || !entryPrice || isNaN(timestamp.getTime())) {
    // Incomplete or invalid row, log and skip
    console.warn("parseSignal: Skipping invalid row", raw)
    return null
  }
  try {
    return {
      id,
      pair,
      direction,
      entryPrice,
      stopLoss: Number.parseFloat(raw.stopLoss ?? raw[4]) || 0,
      takeProfit: Number.parseFloat(raw.takeProfit ?? raw[5]) || 0,
      timeframe: raw.timeframe || raw[6] || "",
      confidence: Number.parseInt(raw.confidence ?? raw[7]) || 0,
      timestamp,
      currentPrice: Number.parseFloat(raw.currentPrice ?? raw[9]) || 0,
      reasoning: raw.reasoning || raw[10] || "",
      status: raw.status || raw[11] || "ACTIVE",
      exitPrice: raw.exitPrice !== undefined ? Number.parseFloat(raw.exitPrice) : (raw[12] ? Number.parseFloat(raw[12]) : undefined),
      pnl: raw.pnl !== undefined ? Number.parseFloat(raw.pnl) : (raw[13] ? Number.parseFloat(raw[13]) : undefined),
      pnlPercent: raw.pnlPercent !== undefined ? Number.parseFloat(raw.pnlPercent) : (raw[14] ? Number.parseFloat(raw[14]) : undefined),
      checkedAt: raw.checkedAt ? new Date(raw.checkedAt) : (raw[15] ? new Date(raw[15]) : undefined),
      indicators: {
        rsi: Number.parseFloat(raw.indicators?.rsi ?? raw[16]) || 50,
        stoch: Number.parseFloat(raw.indicators?.stoch ?? raw[17]) || 50,
        williams: Number.parseFloat(raw.indicators?.williams ?? raw[18]) || -50,
        cci: Number.parseFloat(raw.indicators?.cci ?? raw[19]) || 0,
        atr: Number.parseFloat(raw.indicators?.atr ?? raw[20]) || 0.001,
        sma: Number.parseFloat(raw.indicators?.sma ?? raw[21]) || 1,
        ema: Number.parseFloat(raw.indicators?.ema ?? raw[22]) || 1,
        momentum: Number.parseFloat(raw.indicators?.momentum ?? raw[23]) || 0,
        // New indicators
        macd: Number.parseFloat(raw.indicators?.macd ?? raw[24]) || 0,
        macdSignal: Number.parseFloat(raw.indicators?.macdSignal ?? raw[25]) || 0,
        macdHist: Number.parseFloat(raw.indicators?.macdHist ?? raw[26]) || 0,
        bbUpper: Number.parseFloat(raw.indicators?.bbUpper ?? raw[27]) || 0,
        bbLower: Number.parseFloat(raw.indicators?.bbLower ?? raw[28]) || 0,
        bbMiddle: Number.parseFloat(raw.indicators?.bbMiddle ?? raw[29]) || 0,
        adx: Number.parseFloat(raw.indicators?.adx ?? raw[30]) || 20,
        obv: Number.parseFloat(raw.indicators?.obv ?? raw[31]) || 0,
        mfi: Number.parseFloat(raw.indicators?.mfi ?? raw[32]) || 50,
        stochrsi: Number.parseFloat(raw.indicators?.stochrsi ?? raw[33]) || 0.5,
      },
    }
  } catch (err) {
    console.error("parseSignal: Error parsing row", raw, err)
    return null
  }
}

export function filterValidSignals<T>(signals: (T | null)[]): T[] {
  return signals.filter((s): s is T => s !== null)
}

export interface BacktestResult {
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

export interface BacktestSummary {
  totalTrades: number
  winTrades: number
  lossTrades: number
  winRate: number
  totalPnL: number
  avgWin: number
  avgLoss: number
  profitFactor: number
}

export const TechnicalIndicatorsSchema = z.object({
  rsi: z.number(),
  stoch: z.number(),
  williams: z.number(),
  cci: z.number(),
  atr: z.number(),
  sma: z.number(),
  ema: z.number(),
  momentum: z.number(),
  // New indicators
  macd: z.number(),
  macdSignal: z.number(),
  macdHist: z.number(),
  bbUpper: z.number(),
  bbLower: z.number(),
  bbMiddle: z.number(),
  adx: z.number(),
  obv: z.number(),
  mfi: z.number(),
  stochrsi: z.number(),
})

export const SignalSchema = z.object({
  id: z.string(),
  pair: z.string(),
  direction: z.enum(["BUY", "SELL"]),
  entryPrice: z.number(),
  stopLoss: z.number(),
  takeProfit: z.number(),
  timeframe: z.string(),
  confidence: z.number(),
  timestamp: z.union([z.string(), z.date()]),
  currentPrice: z.number(),
  indicators: TechnicalIndicatorsSchema,
  reasoning: z.string(),
  status: z.enum(["ACTIVE", "WIN", "LOSS", "EXPIRED"]),
  exitPrice: z.number().optional(),
  pnl: z.number().optional(),
  pnlPercent: z.number().optional(),
  checkedAt: z.union([z.string(), z.date()]).optional(),
})

export const BacktestResultSchema = z.object({
  date: z.string(),
  pair: z.string(),
  direction: z.enum(["BUY", "SELL"]),
  entryPrice: z.number(),
  exitPrice: z.number(),
  pnl: z.number(),
  pnlPercent: z.number(),
  confidence: z.number(),
  outcome: z.enum(["WIN", "LOSS"]),
})

export const BacktestSummarySchema = z.object({
  totalTrades: z.number(),
  winTrades: z.number(),
  lossTrades: z.number(),
  winRate: z.number(),
  totalPnL: z.number(),
  avgWin: z.number(),
  avgLoss: z.number(),
  profitFactor: z.number(),
})
