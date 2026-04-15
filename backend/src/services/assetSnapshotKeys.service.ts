import crypto from "node:crypto";

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function stableList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeSymbol(value)).filter(Boolean))).sort();
}

export const snapshotRedisKeys = {
  symbol: (symbol: string) => `symbol:${normalizeSymbol(symbol)}`,
  batch: (symbols: string[], candleSymbols: string[], candleLimit: number) => {
    const payload = JSON.stringify({
      symbols: stableList(symbols),
      candleSymbols: stableList(candleSymbols),
      candleLimit,
    });
    const hash = crypto.createHash("sha1").update(payload).digest("hex");
    return `snapshot:batch:${hash}`;
  },
  candles: (symbol: string, interval = "1m") => `candles:${normalizeSymbol(symbol)}:${interval}`,
  hotSymbols: () => "symbols:hot",
  coldSymbols: () => "symbols:cold",
  logo: (symbol: string) => `logo:${normalizeSymbol(symbol)}`,
};

export function normalizeSnapshotSymbol(symbol: string): string {
  return normalizeSymbol(symbol);
}

export function uniqueSnapshotSymbols(symbols: string[]): string[] {
  return stableList(symbols);
}
