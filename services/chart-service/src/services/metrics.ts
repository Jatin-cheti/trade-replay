const counters = new Map<string, number>();

export function incrementCounter(name: string, by = 1): void {
  const current = counters.get(name) ?? 0;
  counters.set(name, current + by);
}

export function getMetricsSnapshot(): Record<string, number> {
  return Object.fromEntries(Array.from(counters.entries()).sort(([a], [b]) => a.localeCompare(b)));
}
