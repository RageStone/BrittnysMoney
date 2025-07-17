"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/analytics/recent")
      .then(res => res.json())
      .then(setLogs)
      .catch(() => setLogs([]));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6 text-center">Analytics & Insights</h1>
      <div className="w-full max-w-3xl space-y-8">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Recent Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="px-2 py-1">Time</th>
                    <th className="px-2 py-1">Pair</th>
                    <th className="px-2 py-1">Dir</th>
                    <th className="px-2 py-1">Entry</th>
                    <th className="px-2 py-1">Exit</th>
                    <th className="px-2 py-1">Profit %</th>
                    <th className="px-2 py-1">Conf</th>
                    <th className="px-2 py-1">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-gray-400 py-4">No data</td></tr>
                  )}
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-700">
                      <td className="px-2 py-1">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-2 py-1">{log.pair}</td>
                      <td className="px-2 py-1">{log.direction}</td>
                      <td className="px-2 py-1">{log.entry}</td>
                      <td className="px-2 py-1">{log.exit}</td>
                      <td className={`px-2 py-1 ${log.profitPct >= 0 ? "text-green-400" : "text-red-400"}`}>{log.profitPct.toFixed(2)}%</td>
                      <td className="px-2 py-1">{log.confidence}</td>
                      <td className={`px-2 py-1 ${log.result === "win" ? "text-green-400" : "text-red-400"}`}>{log.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 