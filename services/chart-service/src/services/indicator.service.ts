import { Worker } from "node:worker_threads";
import { env } from "../config/env";
import { executeGraph } from "../lib/execution-engine";
import type { OHLCV } from "../models/candle.model";
import type { IndicatorExecutionInput, IndicatorExecutionResult, IndicatorGraph, IndicatorPreset } from "../models/indicator.model";

const presets: IndicatorPreset[] = [
  {
    id: "rsi-14",
    name: "RSI (14)",
    graph: {
      indicatorId: "rsi-14",
      version: 1,
      nodes: [
        { id: "src", type: "SOURCE", config: { field: "close" } },
        { id: "rsi", type: "RSI", inputs: { input: "src" }, config: { period: 14 } },
      ],
      outputs: ["rsi"],
    },
  },
  {
    id: "macd-12-26-9",
    name: "MACD (12, 26, 9)",
    graph: {
      indicatorId: "macd-12-26-9",
      version: 1,
      nodes: [
        { id: "src", type: "SOURCE", config: { field: "close" } },
        { id: "macd", type: "MACD", inputs: { input: "src" }, config: { fast: 12, slow: 26, signal: 9 } },
      ],
      outputs: ["macd"],
    },
  },
];

function runWorker(input: IndicatorExecutionInput): Promise<IndicatorExecutionResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/indicator-worker.ts", import.meta.url), {
      workerData: input,
      execArgv: ["--import", "tsx"],
    });
    worker.once("message", (message) => resolve(message as IndicatorExecutionResult));
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`INDICATOR_WORKER_EXITED:${code}`));
      }
    });
  });
}

export async function computeIndicators(candles: OHLCV[], graph: IndicatorGraph): Promise<IndicatorExecutionResult> {
  const warmWindow = env.WARM_WINDOW;
  const sliced = candles.length > warmWindow ? candles.slice(-warmWindow) : candles;
  const input: IndicatorExecutionInput = { candles: sliced, graph };

  if (!env.ENABLE_INDICATOR_WORKER) {
    return executeGraph(input.candles, input.graph);
  }

  try {
    return await runWorker(input);
  } catch {
    return executeGraph(input.candles, input.graph);
  }
}

export function getIndicatorPresets(): IndicatorPreset[] {
  return presets;
}
