import WebSocket from "ws";
import { env } from "../config/env";
import type { OHLCV } from "../models/candle.model";

export class ChartManager {
  private symbolSubscriptions: Map<string, Set<string>> = new Map();

  private upstreamConnections: Map<string, WebSocket> = new Map();

  private upstreamTimers: Map<string, NodeJS.Timeout> = new Map();

  private clientConnections: Map<string, WebSocket> = new Map();

  private chartToSymbol: Map<string, string> = new Map();

  private lastCloseBySymbol: Map<string, number> = new Map();

  subscribe(chartId: string, symbol: string, clientWs: WebSocket): void {
    const existing = this.chartToSymbol.get(chartId);
    if (existing && existing !== symbol) {
      this.unsubscribe(chartId, existing);
    }

    this.clientConnections.set(chartId, clientWs);
    this.chartToSymbol.set(chartId, symbol);
    const set = this.symbolSubscriptions.get(symbol) ?? new Set<string>();
    set.add(chartId);
    this.symbolSubscriptions.set(symbol, set);

    if (!this.upstreamConnections.has(symbol) && !this.upstreamTimers.has(symbol)) {
      this.startUpstream(symbol);
    }
  }

  unsubscribe(chartId: string, symbol?: string): void {
    const mappedSymbol = symbol ?? this.chartToSymbol.get(chartId);
    this.clientConnections.delete(chartId);
    this.chartToSymbol.delete(chartId);
    if (!mappedSymbol) {
      return;
    }

    const set = this.symbolSubscriptions.get(mappedSymbol);
    if (!set) {
      return;
    }

    set.delete(chartId);
    if (set.size > 0) {
      return;
    }

    this.symbolSubscriptions.delete(mappedSymbol);
    this.stopUpstream(mappedSymbol);
  }

  broadcast(symbol: string, candle: OHLCV): void {
    this.lastCloseBySymbol.set(symbol, candle.close);
    for (const chartId of this.symbolSubscriptions.get(symbol) ?? []) {
      const ws = this.clientConnections.get(chartId);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        continue;
      }
      ws.send(JSON.stringify({ type: "CANDLE", payload: { chartId, symbol, candle } }));
    }
  }

  syncCrosshair(sourceChartId: string, timestamp: number): void {
    for (const [chartId, ws] of this.clientConnections.entries()) {
      if (chartId === sourceChartId || ws.readyState !== WebSocket.OPEN) {
        continue;
      }
      ws.send(JSON.stringify({ type: "CROSSHAIR", payload: { timestamp, sourceChartId } }));
    }
  }

  closeAll(): void {
    for (const symbol of this.symbolSubscriptions.keys()) {
      this.stopUpstream(symbol);
    }
    for (const ws of this.clientConnections.values()) {
      ws.close();
    }
    this.clientConnections.clear();
    this.chartToSymbol.clear();
    this.symbolSubscriptions.clear();
  }

  private startUpstream(symbol: string): void {
    if (env.CHART_UPSTREAM_WS_URL) {
      const url = new URL(env.CHART_UPSTREAM_WS_URL);
      url.searchParams.set("symbol", symbol);
      const ws = new WebSocket(url.toString());
      ws.on("message", (raw) => this.onUpstreamMessage(symbol, raw.toString()));
      ws.on("close", () => {
        this.upstreamConnections.delete(symbol);
        if ((this.symbolSubscriptions.get(symbol)?.size ?? 0) > 0) {
          this.startUpstream(symbol);
        }
      });
      this.upstreamConnections.set(symbol, ws);
      return;
    }

    const timer = setInterval(() => {
      this.broadcast(symbol, this.syntheticCandle(symbol));
    }, env.CHART_POLL_INTERVAL_MS);
    this.upstreamTimers.set(symbol, timer);
  }

  private stopUpstream(symbol: string): void {
    const ws = this.upstreamConnections.get(symbol);
    if (ws) {
      ws.close();
      this.upstreamConnections.delete(symbol);
    }

    const timer = this.upstreamTimers.get(symbol);
    if (timer) {
      clearInterval(timer);
      this.upstreamTimers.delete(symbol);
    }
  }

  private onUpstreamMessage(symbol: string, raw: string): void {
    try {
      const parsed = JSON.parse(raw) as Partial<OHLCV>;
      const ts = Number(parsed.timestamp ?? Date.now());
      const close = Number(parsed.close ?? this.lastCloseBySymbol.get(symbol) ?? 100);
      const open = Number(parsed.open ?? close);
      const high = Number(parsed.high ?? Math.max(open, close));
      const low = Number(parsed.low ?? Math.min(open, close));
      const volume = Number(parsed.volume ?? 0);
      this.broadcast(symbol, { timestamp: ts, open, high, low, close, volume });
    } catch {
      this.broadcast(symbol, this.syntheticCandle(symbol));
    }
  }

  private syntheticCandle(symbol: string): OHLCV {
    const prev = this.lastCloseBySymbol.get(symbol) ?? (100 + (symbol.length * 2));
    const drift = Math.sin(Date.now() / 10_000) * 0.6;
    const close = Math.max(0.5, prev + drift);
    const open = prev;
    const spread = 0.4 + Math.abs(Math.cos(Date.now() / 9000));
    const high = Math.max(open, close) + spread;
    const low = Math.min(open, close) - spread;
    return {
      timestamp: Date.now(),
      open,
      high,
      low,
      close,
      volume: 1200 + Math.round(Math.abs(close - open) * 2000),
    };
  }
}
