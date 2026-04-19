import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { getCandles } from "../services/candle.service";
import { computeIndicators } from "../services/indicator.service";
import { removeSubscription, saveSubscription } from "../services/subscription.service";
import type { Timeframe } from "../models/candle.model";
import type { IndicatorGraph } from "../models/indicator.model";
import type { ClientMessage } from "../models/subscription.model";
import { ChartManager } from "./chart-manager";

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

async function hydrateIndicators(ws: WebSocket, chartId: string, symbol: string, timeframe: Timeframe, graphs: IndicatorGraph[]): Promise<void> {
  if (!Array.isArray(graphs) || graphs.length === 0) {
    return;
  }
  const candles = await getCandles({ symbol, timeframe, limit: 300 });
  for (const graph of graphs) {
    const result = await computeIndicators(candles, graph);
    for (const [nodeId, values] of Object.entries(result.outputs)) {
      send(ws, { type: "INDICATOR", payload: { chartId, nodeId, values } });
    }
  }
}

export function createWsHandler(manager: ChartManager) {
  return function onConnection(ws: WebSocket): void {
    const chartIds = new Set<string>();

    ws.on("message", async (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as ClientMessage;
        if (message.type === "SUBSCRIBE") {
          const { chartId, symbol, timeframe, indicators = [] } = message.payload;
          manager.subscribe(chartId, symbol, ws);
          saveSubscription({ chartId, symbol, timeframe, indicators });
          chartIds.add(chartId);
          send(ws, { type: "CONNECTED", payload: { chartId, sessionId: randomUUID() } });
          await hydrateIndicators(ws, chartId, symbol, timeframe, indicators);
          return;
        }

        if (message.type === "UNSUBSCRIBE") {
          const { chartId, symbol } = message.payload;
          manager.unsubscribe(chartId, symbol);
          removeSubscription(chartId);
          chartIds.delete(chartId);
          return;
        }

        if (message.type === "CROSSHAIR") {
          manager.syncCrosshair(message.payload.chartId, message.payload.timestamp);
          return;
        }

        if (message.type === "SEEK") {
          send(ws, { type: "CROSSHAIR", payload: { timestamp: message.payload.timestamp, sourceChartId: message.payload.chartId } });
          return;
        }

        send(ws, { type: "ERROR", payload: { code: "UNKNOWN_MESSAGE", message: "Unsupported websocket message type" } });
      } catch (error) {
        send(ws, {
          type: "ERROR",
          payload: {
            code: "WS_HANDLER_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });

    ws.on("close", () => {
      for (const chartId of chartIds) {
        manager.unsubscribe(chartId);
        removeSubscription(chartId);
      }
      chartIds.clear();
    });
  };
}
