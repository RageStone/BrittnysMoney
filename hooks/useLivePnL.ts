import { useEffect, useRef, useState } from "react";

export function useLivePnL() {
  const [pnlMap, setPnlMap] = useState<Record<string, number>>({});
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/trades/stream");
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      try {
        const { signalId, currentPnL } = JSON.parse(event.data);
        setPnlMap(prev => ({ ...prev, [signalId]: currentPnL }));
      } catch {}
    };
    return () => {
      es.close();
    };
  }, []);

  return pnlMap;
} 