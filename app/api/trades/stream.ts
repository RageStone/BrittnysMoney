// Next.js 13+ app directory API route for SSE streaming
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      const mockActiveSignals = [
        { id: "1", entryPrice: 100, direction: "BUY" },
        { id: "2", entryPrice: 200, direction: "SELL" },
      ];
      const interval = setInterval(() => {
        if (cancelled) {
          clearInterval(interval);
          controller.close();
          return;
        }
        mockActiveSignals.forEach(signal => {
          const change = (Math.random() - 0.5) * 2;
          const currentPrice = signal.entryPrice + change;
          const currentPnL = signal.direction === "BUY"
            ? ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100
            : ((signal.entryPrice - currentPrice) / signal.entryPrice) * 100;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ signalId: signal.id, currentPnL })}\n\n`));
        });
      }, 2000);
    },
    cancel() {
      cancelled = true;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
} 