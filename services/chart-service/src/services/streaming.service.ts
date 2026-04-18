import type { Server } from "node:http";
import type { OHLCV } from "../models/candle.model";
import { createChartWsServer } from "../websocket/ws-server";

let wsRuntime: ReturnType<typeof createChartWsServer> | null = null;

export function startStreaming(server: Server): void {
  if (wsRuntime) {
    return;
  }
  wsRuntime = createChartWsServer();
  wsRuntime.attach(server);
}

export function stopStreaming(): void {
  if (!wsRuntime) {
    return;
  }
  wsRuntime.close();
  wsRuntime = null;
}

export function broadcastCandle(symbol: string, candle: OHLCV): void {
  wsRuntime?.manager.broadcast(symbol, candle);
}
