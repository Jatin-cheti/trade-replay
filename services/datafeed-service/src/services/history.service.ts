type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };

type UdfHistoryResponse =
  | { s: "ok"; t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[] }
  | { s: "no_data"; nextTime?: number }
  | { s: "error"; errmsg: string };

function resolutionToMs(resolution: string): number {
  if (resolution === "D") return 1440 * 60_000;
  if (resolution === "W") return 10080 * 60_000;
  if (resolution === "M") return 43200 * 60_000;
  return (Number.parseInt(resolution, 10) || 60) * 60_000;
}

function generateSyntheticBars(symbol: string, fromSec: number, toSec: number, candleMs: number): Bar[] {
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bars: Bar[] = [];
  let price = 100 + (seed % 900);
  let tSec = fromSec;

  while (tSec <= toSec) {
    const t = tSec + seed;
    const move = (Math.sin(t / 8000) * 0.015) + (Math.cos(t / 3333) * 0.008) + ((seed % 11 - 5) * 0.0001);
    const open = price;
    const close = Math.max(0.01, price * (1 + move));
    const spread = Math.max(open, close) * 0.005;
    bars.push({
      time: tSec,
      open: +open.toFixed(2),
      high: +(Math.max(open, close) + spread).toFixed(2),
      low: +(Math.max(0.01, Math.min(open, close) - spread)).toFixed(2),
      close: +close.toFixed(2),
      volume: Math.max(1000, (seed * 100 + tSec) % 1000000),
    });
    price = close;
    tSec += Math.floor(candleMs / 1000);
  }
  return bars;
}

export async function getHistoricalBars(symbol: string, resolution: string, fromSec: number, toSec: number): Promise<UdfHistoryResponse> {
  const upper = symbol.trim().toUpperCase();
  const rawSymbol = upper.includes(":") ? upper.split(":").pop()! : upper;
  const candleMs = resolutionToMs(resolution);

  const bars = generateSyntheticBars(rawSymbol, fromSec, toSec, candleMs);
  if (bars.length === 0) return { s: "no_data" };

  return {
    s: "ok",
    t: bars.map((b) => b.time),
    o: bars.map((b) => b.open),
    h: bars.map((b) => b.high),
    l: bars.map((b) => b.low),
    c: bars.map((b) => b.close),
    v: bars.map((b) => b.volume),
  };
}
