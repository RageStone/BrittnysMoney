"use client";
import { useState } from "react";
import { useBacktest } from "@/hooks/useBacktest";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OHLCV } from "@/lib/backtest";
import dynamic from "next/dynamic";

const EquityCurveChart = dynamic(() => import("@/components/EquityCurveChart"), { ssr: false });

export default function BacktestPage() {
  const { backtestSummary, isBacktesting, error, runBacktest } = useBacktest();
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("");

  // Example signal logic: always trade (for demo)
  function dummySignal(candle: OHLCV) {
    return { direction: "BUY" } as any;
  }

  const handleRun = () => {
    if (!symbol || !timeframe) return;
    runBacktest(symbol, timeframe, dummySignal);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Backtest Dashboard</h1>
      <div className="flex flex-col md:flex-row gap-4 justify-center mb-8">
        <Input
          placeholder="Symbol (e.g. EUR/USD)"
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Timeframe (e.g. 1h)"
          value={timeframe}
          onChange={e => setTimeframe(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={handleRun} disabled={isBacktesting}>
          {isBacktesting ? "Running..." : "Run Backtest"}
        </Button>
      </div>
      {error && <div className="text-red-400 text-center mb-4">{error}</div>}
      {backtestSummary && (
        <div className="max-w-3xl mx-auto">
          <Card className="mb-8 bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-gray-400">Total Trades</div>
                  <div className="text-2xl font-bold">{backtestSummary.totalTrades}</div>
                </div>
                <div>
                  <div className="text-gray-400">Win Rate</div>
                  <div className="text-2xl font-bold text-green-400">{backtestSummary.winRate.toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-gray-400">Avg Profit %</div>
                  <div className="text-2xl font-bold text-yellow-400">{backtestSummary.avgProfitPct.toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-gray-400">Max Drawdown</div>
                  <div className="text-2xl font-bold text-red-400">{backtestSummary.maxDrawdownPct.toFixed(2)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle>Equity Curve</CardTitle>
            </CardHeader>
            <CardContent>
              <EquityCurveChart data={backtestSummary.equityCurve.map((y, i) => ({ x: i + 1, y }))} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 