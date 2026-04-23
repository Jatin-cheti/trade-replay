export function snapshotCacheKey(userId: string): string {
  return `portfolio:snapshot:${userId}`;
}

export function positionsCacheKey(userId: string): string {
  return `portfolio:positions:${userId}`;
}

export function pnlCacheKey(userId: string): string {
  return `portfolio:pnl:${userId}`;
}

export function symbolPriceKey(symbol: string): string {
  return `portfolio:price:${symbol.toUpperCase()}`;
}
