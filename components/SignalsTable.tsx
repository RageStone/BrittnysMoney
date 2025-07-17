import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Clock, Pencil, Trash2 } from "lucide-react"
import { Signal, MLExplanation } from "@/lib/utils"
import React, { useState, useEffect } from "react"
import { simSLTP } from "@/lib/risk";
import { useLivePnL } from "@/hooks/useLivePnL";

type SignalWithExplanation = Signal & { explanation?: MLExplanation[], mlUsed?: boolean, mlRaw?: any }

function toCSV(signals: SignalWithExplanation[]): string {
  const header = [
    "id","pair","direction","entryPrice","stopLoss","takeProfit","timeframe","confidence","timestamp","currentPrice","reasoning","status","exitPrice","pnl","pnlPercent","checkedAt","rsi","stoch","williams","cci","atr","sma","ema","momentum"
  ]
  const rows = signals.map(s => [
    s.id,
    s.pair,
    s.direction,
    s.entryPrice,
    s.stopLoss,
    s.takeProfit,
    s.timeframe,
    s.confidence,
    s.timestamp instanceof Date ? s.timestamp.toISOString() : s.timestamp,
    s.currentPrice,
    s.reasoning,
    s.status,
    s.exitPrice ?? "",
    s.pnl ?? "",
    s.pnlPercent ?? "",
    s.checkedAt ? (s.checkedAt instanceof Date ? s.checkedAt.toISOString() : s.checkedAt) : "",
    s.indicators.rsi,
    s.indicators.stoch,
    s.indicators.williams,
    s.indicators.cci,
    s.indicators.atr,
    s.indicators.sma,
    s.indicators.ema,
    s.indicators.momentum
  ])
  return [header, ...rows].map(row => row.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n")
}

function SignalCountdown({ timestamp, timeframe, onExpire }: { timestamp: string | Date, timeframe: string, onExpire?: () => void }) {
  // Parse timeframe to seconds
  let totalSeconds = 0;
  if (timeframe.endsWith('min')) {
    totalSeconds = parseInt(timeframe) * 60;
  } else if (timeframe.endsWith('h')) {
    totalSeconds = parseInt(timeframe) * 60 * 60;
  } else if (timeframe.endsWith('day')) {
    totalSeconds = parseInt(timeframe) * 60 * 60 * 24;
  } else {
    totalSeconds = 60; // default 1 minute
  }
  const start = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp.getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((start + totalSeconds * 1000 - Date.now()) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, Math.floor((start + totalSeconds * 1000 - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [start, totalSeconds]);

  useEffect(() => {
    if (remaining === 0 && onExpire) {
      onExpire();
    }
    // Only call onExpire once per expiration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  if (remaining <= 0) return <span className="bg-gray-700 text-white px-2 py-1 rounded">נגמר</span>;

  let value = remaining;
  let unit = "";
  if (value >= 3600) {
    value = Math.floor(value / 3600);
    unit = "ש"; // שעה
  } else if (value >= 60) {
    value = Math.floor(value / 60);
    unit = "ד"; // דקה
  } else {
    unit = "ש"; // שניה
  }

  return (
    <span className="bg-yellow-900/40 text-yellow-300 px-2 py-1 rounded font-bold flex items-center gap-1">
      <svg xmlns="http://www.w3.org/2000/svg" className="inline w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      {value} {unit}
    </span>
  );
}

interface SignalsTableProps {
  signals: SignalWithExplanation[]
  getStatusBadge: (status: Signal["status"], signal?: Signal) => React.ReactNode
  onDeleteSignal?: (id: string) => void
  onEditSignal?: (signal: Signal) => void
  onSealSignal?: (signal: Signal) => void
}

export function SignalsTable({ signals, getStatusBadge, onDeleteSignal, onEditSignal, onSealSignal }: SignalsTableProps) {
  const [direction, setDirection] = useState<string>("")
  const [status, setStatus] = useState<string>("")
  const [search, setSearch] = useState<string>("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editSignal, setEditSignal] = useState<Signal | null>(null)
  const [editConfidence, setEditConfidence] = useState<number>(0)
  const [editReasoning, setEditReasoning] = useState<string>("")
  const livePnL = useLivePnL();

  // Sort signals by timestamp descending (latest first)
  const sortedSignals = [...signals].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const filtered = sortedSignals.filter((signal) => {
    if (direction && signal.direction !== direction) return false
    if (status && signal.status !== status) return false
    if (search && !signal.pair.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleExport = () => {
    const csv = toCSV(filtered)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "signals.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = (id: string) => {
    setDeleteId(id)
  }

  const confirmDelete = () => {
    if (deleteId && onDeleteSignal) onDeleteSignal(deleteId)
    setDeleteId(null)
  }

  const handleEditClick = (signal: Signal) => {
    setEditSignal(signal)
    setEditConfidence(signal.confidence)
    setEditReasoning(signal.reasoning)
  }

  const handleEditSave = () => {
    if (editSignal && onEditSignal) {
      onEditSignal({ ...editSignal, confidence: editConfidence, reasoning: editReasoning })
    }
    setEditSignal(null)
  }

  if (!signals.length) return null
  return (
    <div className="w-full space-y-4">
      <h2 className="text-2xl font-bold text-center mb-6">אותות אחרונים</h2>
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1"
        >
          <option value="">כל הכיוונים</option>
          <option value="BUY">קנייה (BUY)</option>
          <option value="SELL">מכירה (SELL)</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1"
        >
          <option value="">כל הסטטוסים</option>
          <option value="ACTIVE">פעיל</option>
          <option value="WIN">זכייה</option>
          <option value="LOSS">הפסד</option>
          <option value="EXPIRED">פג תוקף</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חפש זוג מטבעות..."
          className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1"
        />
        <button
          onClick={handleExport}
                          className="bg-[#9c5925] hover:bg-[#8a4f1f] text-white rounded px-3 py-1 font-semibold"
        >
          ייצא CSV
        </button>
      </div>
      <div className="grid gap-4">
        {sortedSignals
          .filter((signal) =>
            (!direction || signal.direction === direction) &&
            (!status || signal.status === status) &&
            (!search || signal.pair.toLowerCase().includes(search.toLowerCase()))
          )
          .slice(0, 10)
          .map((signal, idx) => (
          <Card key={signal.id || idx} className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  {signal.direction === "BUY" ? (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                  <span className={signal.direction === "BUY" ? "text-green-400" : "text-red-400"}>
                    {signal.direction} {signal.pair}
                  </span>
                  {getStatusBadge(signal.status, signal)}
                </CardTitle>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-400">ביטחון</div>
                    <div className="font-bold text-[#9c5925] flex items-center gap-2">
                      {signal.confidence}%
                      {signal.mlUsed !== undefined && (
                        <span className={`ml-1 px-2 py-0.5 rounded text-xs ${signal.mlUsed ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-300'}`}
                          title={signal.mlUsed ? 'ML-powered confidence' : 'Fallback confidence'}>
                          {signal.mlUsed ? 'ML' : 'Fallback'}
                        </span>
                      )}
                    </div>
                  </div>
                  {livePnL[signal.id] !== undefined && (
                    <div className={`px-2 py-1 rounded font-mono text-xs ${livePnL[signal.id] >= 0 ? "bg-green-900 text-green-400" : "bg-red-900 text-red-400"}`} title="Live PnL">
                      {livePnL[signal.id] >= 0 ? "+" : ""}{livePnL[signal.id].toFixed(2)}%
                    </div>
                  )}
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>{signal.timeframe}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-gray-400">
                    <span>⏱</span>
                    <span>
                      {signal.status === "ACTIVE" && (
                        <SignalCountdown
                          timestamp={signal.timestamp}
                          timeframe={signal.timeframe}
                          onExpire={() => onSealSignal && onSealSignal(signal)}
                        />
                      )}
                      <span className="ml-2 text-xs text-gray-400">
                        {signal.timestamp ? new Date(signal.timestamp).toLocaleString("he-IL") : "N/A"}
                      </span>
                    </span>
                  </div>
                  <button
                    onClick={() => handleEditClick(signal)}
                    className="p-1 rounded hover:bg-gray-700 text-[#9c5925]"
                    title="ערוך"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(signal.id)}
                    className="p-1 rounded hover:bg-gray-700 text-red-400"
                    title="מחק"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-4">
                <div>
                  <span className="text-gray-400">מחיר כניסה:</span>
                  <div className="font-mono text-white">{signal.entryPrice.toFixed(5)}</div>
                </div>
                <div>
                  <span className="text-gray-400">סטופ לוס:</span>
                  <div className="font-mono text-red-400">{signal.stopLoss.toFixed(5)}</div>
                </div>
                <div>
                  <span className="text-gray-400">טייק פרופיט:</span>
                  <div className="font-mono text-green-400">{signal.takeProfit.toFixed(5)}</div>
                </div>
                <div>
                  <span className="text-gray-400">Profit %:</span>
                  <div className={`font-mono ${signal.profitPct !== undefined ? (signal.profitPct >= 0 ? "text-green-400" : "text-red-400") : "text-gray-400"}`}>
                    {signal.profitPct !== undefined ? `${signal.profitPct >= 0 ? "+" : ""}${signal.profitPct.toFixed(2)}%` : "N/A"}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Risk/Reward:</span>
                  <div className="font-mono text-yellow-400">
                    {(() => {
                      const slPct = signal.entryPrice !== 0 ? Math.abs((signal.entryPrice - signal.stopLoss) / signal.entryPrice) * 100 : 0;
                      const tpPct = signal.entryPrice !== 0 ? Math.abs((signal.takeProfit - signal.entryPrice) / signal.entryPrice) * 100 : 0;
                      return slPct && tpPct ? `${(tpPct / slPct).toFixed(2)} : 1` : "N/A";
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs mb-3 p-3 bg-gray-900 rounded">
                <div>
                  <span className="text-gray-400">RSI:</span>
                  <span className="mr-2 text-white">{signal.indicators.rsi.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Stoch:</span>
                  <span className="mr-2 text-white">{signal.indicators.stoch.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Williams:</span>
                  <span className="mr-2 text-white">{signal.indicators.williams.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-gray-400">CCI:</span>
                  <span className="mr-2 text-white">{signal.indicators.cci.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-gray-400">SMA:</span>
                  <span className="mr-2 text-white">{signal.indicators.sma.toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-gray-400">EMA:</span>
                  <span className="mr-2 text-white">{signal.indicators.ema.toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Mom:</span>
                  <span className="mr-2 text-white">{signal.indicators.momentum.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-gray-400">ATR:</span>
                  <span className="mr-2 text-white">{signal.indicators.atr.toFixed(5)}</span>
                </div>
                {/* New indicators */}
                <div>
                  <span className="text-gray-400">MACD:</span>
                  <span className="mr-2 text-white">{signal.indicators.macd?.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-gray-400">MACD Signal:</span>
                  <span className="mr-2 text-white">{signal.indicators.macdSignal?.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-gray-400">MACD Hist:</span>
                  <span className="mr-2 text-white">{signal.indicators.macdHist?.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-gray-400">BB Upper:</span>
                  <span className="mr-2 text-white">{signal.indicators.bbUpper?.toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-gray-400">BB Middle:</span>
                  <span className="mr-2 text-white">{signal.indicators.bbMiddle?.toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-gray-400">BB Lower:</span>
                  <span className="mr-2 text-white">{signal.indicators.bbLower?.toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-gray-400">ADX:</span>
                  <span className="mr-2 text-white">{signal.indicators.adx?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-400">OBV:</span>
                  <span className="mr-2 text-white">{signal.indicators.obv?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-400">MFI:</span>
                  <span className="mr-2 text-white">{signal.indicators.mfi?.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-gray-400">StochRSI:</span>
                  <span className="mr-2 text-white">{signal.indicators.stochrsi?.toFixed(2)}</span>
                </div>
              </div>
              {/* Reasoning/Explanation Section */}
              <div dir="rtl" className="my-2 px-3 py-2 rounded bg-green-900/20 border border-green-500 text-green-300 text-sm font-medium text-right">
                {signal.reasoning}
              </div>
              {signal.explanation && signal.explanation.length > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  <strong>Top ML Factors:</strong>
                  <ul>
                    {signal.explanation.map((e: MLExplanation, i: number) => (
                      <li key={i}>{e.feature}: {e.impact > 0 ? '+' : ''}{e.impact.toFixed(2)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Debug: Show raw ML API response if present */}
              {signal.mlRaw && (
                <details className="mt-2 text-xs text-yellow-400">
                  <summary>ML API Debug</summary>
                  <pre>{JSON.stringify(signal.mlRaw, null, 2)}</pre>
                </details>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-gray-400">לא נמצאו אותות תואמים.</div>
        )}
      </div>
      {/* Delete confirmation dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-gray-900 p-6 rounded shadow-lg text-center">
            <div className="mb-4 text-lg text-white">האם אתה בטוח שברצונך למחוק את האות?</div>
            <div className="flex justify-center gap-4">
              <button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                מחק
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded"
              >
                בטל
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit dialog */}
      {editSignal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-gray-900 p-6 rounded shadow-lg text-center w-full max-w-md">
            <div className="mb-4 text-lg text-white">עריכת אות</div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">ביטחון</label>
              <input
                type="number"
                min={0}
                max={100}
                value={editConfidence}
                onChange={e => setEditConfidence(Number(e.target.value))}
                className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">ניתוח</label>
              <textarea
                value={editReasoning}
                onChange={e => setEditReasoning(e.target.value)}
                className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white"
                rows={3}
              />
            </div>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleEditSave}
                className="bg-[#9c5925] hover:bg-[#8a4f1f] text-white px-4 py-2 rounded"
              >
                שמור
              </button>
              <button
                onClick={() => setEditSignal(null)}
                className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded"
              >
                בטל
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 