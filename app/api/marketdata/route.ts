import { NextRequest, NextResponse } from "next/server"

const API_KEYS = [
  /*process.env.TWELVEDATA_KEY1!,
  process.env.TWELVEDATA_KEY2!,
  process.env.TWELVEDATA_KEY3!,
  process.env.TWELVEDATA_KEY4!,*/
 "83e912998f8e471e89b62ff65512a154",
  
]

let roundRobinIndex = 0
const keyUsage: Record<string, { count: number; lastReset: number }> = {}
const CALLS_PER_KEY = 8
const KEY_COOLDOWN = 60000

function getNextApiKey() {
  const now = Date.now()
  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[i]
    if (!keyUsage[key] || now - keyUsage[key].lastReset > KEY_COOLDOWN) {
      keyUsage[key] = { count: 0, lastReset: now }
    }
    if (keyUsage[key].count < CALLS_PER_KEY) {
      keyUsage[key].count++
      console.log(`[API KEY] Using key index ${i} (${key.slice(0, 6)}...) for request at ${new Date().toISOString()}`)
      return key
    } else {
      if (keyUsage[key].count === CALLS_PER_KEY) {
        console.log(`[API KEY] Key index ${i} (${key.slice(0, 6)}...) exhausted at ${new Date().toISOString()}`)
      }
    }
  }
  console.warn('[API KEY] All keys exhausted!')
  return null
}

const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get("symbol")
    const interval = searchParams.get("interval")
    const type = searchParams.get("type") // "price", "quote", or indicator name
    const timestamp = searchParams.get("timestamp") // Add timestamp for fresh data
    
    if (!symbol || !type) return NextResponse.json({ error: "Missing params" }, { status: 400 })
    
    // For price requests, do NOT use cache. For others, use cache as before.
    const cacheKey = timestamp && type === "price" 
      ? `${type}:${symbol}:${interval || ""}:${timestamp}`
      : `${type}:${symbol}:${interval || ""}`
    
    const now = Date.now()
    if (type !== "price" && cache.has(cacheKey) && now - cache.get(cacheKey)!.timestamp < CACHE_TTL) {
      console.log(`[CACHE] Returning cached data for ${cacheKey}`)
      return NextResponse.json(cache.get(cacheKey)!.data)
    }
    
    const apiKey = getNextApiKey()
    if (!apiKey) {
      return NextResponse.json({ error: "Rate limit: All API keys exhausted. Please wait a few minutes and try again." }, { status: 429 })
    }
    
    let url = "https://api.twelvedata.com/"
    if (type === "price") {
      // Use /price endpoint for real-time price
      url += `price?symbol=${symbol}&apikey=${apiKey}`
    } else if (type === "quote") {
      // Use /quote endpoint for quote data
      url += `quote?symbol=${symbol}&apikey=${apiKey}`
    } else {
      // Use indicator endpoints
      url += `${type}?symbol=${symbol}&interval=${interval}&apikey=${apiKey}`
      if (["rsi", "sma", "ema", "mom"].includes(type)) {
        url += type === "mom" ? "&time_period=10" : "&time_period=14"
      }
    }
    
    console.log(`[API FETCH] Fetching: ${url} at ${new Date().toISOString()}`)
    const res = await fetch(url)
    if (res.status === 429) {
      return NextResponse.json({ error: "Rate limit reached for this API key. Please wait and try again." }, { status: 429 })
    }
    const data = await res.json()
    
    // Log the price data for debugging
    if (type === "price") {
      console.log(`[PRICE DATA] ${symbol} - Real-time price response:`, JSON.stringify(data, null, 2))
      console.log(`[PRICE DATA] ${symbol} - Price: ${data.price}, Timestamp: ${new Date().toISOString()}`)
    } else if (type === "quote") {
      console.log(`[QUOTE DATA] ${symbol} - Quote response:`, JSON.stringify(data, null, 2))
      console.log(`[QUOTE DATA] ${symbol} - Close: ${data.close}, Bid: ${data.bid}, Ask: ${data.ask}, Timestamp: ${new Date().toISOString()}`)
    }
    
    // Only cache if not /price
    if (type !== "price") {
      cache.set(cacheKey, { data, timestamp: now })
    }
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 })
  }
} 