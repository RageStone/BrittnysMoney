export function simSLTP({ entry, slPct, tpPct }: { entry: number; slPct: number; tpPct: number }) {
  return {
    slPrice: entry * (1 - slPct / 100),
    tpPrice: entry * (1 + tpPct / 100),
  };
} 