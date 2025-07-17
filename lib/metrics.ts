export function calcProfitPct({ entry, exit }: { entry: number; exit: number }): number {
  if (entry === 0) return 0;
  return ((exit - entry) / entry) * 100;
} 