import { parentPort, workerData } from "node:worker_threads";
import { executeGraph } from "../lib/execution-engine";
import type { IndicatorExecutionInput } from "../models/indicator.model";

const input = workerData as IndicatorExecutionInput;
const result = executeGraph(input.candles, input.graph);
parentPort?.postMessage(result);
