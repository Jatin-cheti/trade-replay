import { createHash } from "node:crypto";
import type { OHLCV } from "../models/candle.model";
import type { IndicatorExecutionResult, IndicatorGraph, IndicatorNode } from "../models/indicator.model";
import { alignSeries, closes, highs, lows, volumes } from "./candle-math";
import { bollinger } from "./indicators/bollinger";
import { macd } from "./indicators/macd";
import { dema, ema, sma, tema, wma } from "./indicators/moving-averages";
import { cci, rsi, stochastic, williamsR } from "./indicators/oscillators";
import { adx, aroon, supertrend } from "./indicators/trend";
import { cmf, mfi, obv, vwap } from "./indicators/volume";
import { atr, standardDeviation } from "./indicators/volatility";

const nodeCache = new Map<string, number[]>();

function nodeInputs(node: IndicatorNode, map: Record<string, number[]>, fallback: number[]): number[][] {
  const ids = Object.values(node.inputs ?? {});
  if (ids.length === 0) {
    return [fallback];
  }
  return ids.map((id) => map[id] ?? fallback);
}

function topo(graph: IndicatorGraph): IndicatorNode[] {
  const idToNode = new Map(graph.nodes.map((n) => [n.id, n]));
  const indegree = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  const edges = new Map<string, string[]>();
  for (const node of graph.nodes) {
    for (const dep of Object.values(node.inputs ?? {})) {
      if (!idToNode.has(dep)) {
        continue;
      }
      indegree.set(node.id, (indegree.get(node.id) ?? 0) + 1);
      edges.set(dep, [...(edges.get(dep) ?? []), node.id]);
    }
  }
  const queue = graph.nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const out: IndicatorNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    out.push(idToNode.get(id) as IndicatorNode);
    for (const next of edges.get(id) ?? []) {
      const nextIn = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextIn);
      if (nextIn === 0) {
        queue.push(next);
      }
    }
  }
  if (out.length !== graph.nodes.length) {
    throw new Error("INDICATOR_GRAPH_HAS_CYCLE");
  }
  return out;
}

function hashed(node: IndicatorNode, inputs: number[][]): string {
  return createHash("sha1").update(JSON.stringify({ type: node.type, config: node.config ?? {}, inputs: inputs.map((s) => s.slice(-10)) })).digest("hex");
}

function unary(inputs: number[][]): number[] {
  return inputs[0] ?? [];
}

function binary(inputs: number[][]): [number[], number[]] {
  return [inputs[0] ?? [], inputs[1] ?? []];
}

function mathOp(a: number[], b: number[], fn: (x: number, y: number) => number): number[] {
  return a.map((v, i) => fn(v, b[i] ?? Number.NaN));
}

function computeNode(node: IndicatorNode, inputs: number[][], candles: OHLCV[]): number[] {
  const close = closes(candles);
  const high = highs(candles);
  const low = lows(candles);
  const volume = volumes(candles);
  const period = Number(node.config?.period ?? 14);
  switch (node.type) {
    case "SOURCE": return node.config?.field === "open" ? candles.map((c) => c.open) : node.config?.field === "high" ? high : node.config?.field === "low" ? low : node.config?.field === "volume" ? volume : close;
    case "SMA": return sma(unary(inputs), period);
    case "EMA": return ema(unary(inputs), period);
    case "WMA": return wma(unary(inputs), period);
    case "DEMA": return dema(unary(inputs), period);
    case "TEMA": return tema(unary(inputs), period);
    case "RSI": return rsi(unary(inputs), period);
    case "STOCHASTIC": return stochastic(high, low, close, period);
    case "CCI": return cci(high, low, close, period);
    case "WILLIAMS_R": return williamsR(high, low, close, period);
    case "MACD": {
      const x = macd(unary(inputs), Number(node.config?.fast ?? 12), Number(node.config?.slow ?? 26), Number(node.config?.signal ?? 9));
      return node.config?.output === "signal" ? x.signal : node.config?.output === "histogram" ? x.histogram : x.macd;
    }
    case "BOLLINGER": {
      const x = bollinger(unary(inputs), period, Number(node.config?.stdDev ?? 2));
      if (node.config?.output === "lower") return x.lower;
      if (node.config?.output === "percentB") return x.percentB;
      if (node.config?.output === "bandwidth") return x.bandwidth;
      return node.config?.output === "middle" ? x.middle : x.upper;
    }
    case "ATR": return atr(high, low, close, period);
    case "VWAP": return vwap(high, low, close, volume);
    case "OBV": return obv(close, volume);
    case "ADX": return adx(high, low, close, period);
    case "MFI": return mfi(high, low, close, volume, period);
    case "CMF": return cmf(high, low, close, volume, period);
    case "AROON": return (node.config?.output === "down" ? aroon(high, low, period).down : aroon(high, low, period).up);
    case "STDDEV": return standardDeviation(unary(inputs), period);
    case "SUPERTREND": return supertrend(high, low, close, period, Number(node.config?.multiplier ?? 3));
    case "ADD": return mathOp(...binary(inputs), (x, y) => x + y);
    case "SUBTRACT": return mathOp(...binary(inputs), (x, y) => x - y);
    case "MULTIPLY": return mathOp(...binary(inputs), (x, y) => x * y);
    case "DIVIDE": return mathOp(...binary(inputs), (x, y) => y === 0 ? Number.NaN : x / y);
    case "GT": return mathOp(...binary(inputs), (x, y) => x > y ? 1 : 0);
    case "LT": return mathOp(...binary(inputs), (x, y) => x < y ? 1 : 0);
    case "GTE": return mathOp(...binary(inputs), (x, y) => x >= y ? 1 : 0);
    case "LTE": return mathOp(...binary(inputs), (x, y) => x <= y ? 1 : 0);
    case "EQ": return mathOp(...binary(inputs), (x, y) => x === y ? 1 : 0);
    case "CROSS_ABOVE": return mathOp(...binary(inputs), (_x, _y) => 0).map((_, i, arr) => i === 0 ? 0 : ((inputs[0][i - 1] ?? 0) <= (inputs[1][i - 1] ?? 0) && (inputs[0][i] ?? 0) > (inputs[1][i] ?? 0) ? 1 : 0));
    case "CROSS_BELOW": return mathOp(...binary(inputs), (_x, _y) => 0).map((_, i, arr) => i === 0 ? 0 : ((inputs[0][i - 1] ?? 0) >= (inputs[1][i - 1] ?? 0) && (inputs[0][i] ?? 0) < (inputs[1][i] ?? 0) ? 1 : 0));
    case "AND": return mathOp(...binary(inputs), (x, y) => (x > 0 && y > 0) ? 1 : 0);
    case "OR": return mathOp(...binary(inputs), (x, y) => (x > 0 || y > 0) ? 1 : 0);
    case "NOT": return unary(inputs).map((v) => v > 0 ? 0 : 1);
    case "IF": return unary(inputs).map((_, i) => (inputs[0][i] ?? 0) > 0 ? (inputs[1][i] ?? Number.NaN) : (inputs[2]?.[i] ?? Number.NaN));
    case "PLOT":
    case "FILL":
    case "LABEL":
      return unary(inputs);
    default:
      throw new Error(`UNSUPPORTED_NODE_TYPE:${node.type}`);
  }
}

export function executeGraph(candles: OHLCV[], graph: IndicatorGraph): IndicatorExecutionResult {
  const ordered = topo(graph);
  const fallback = closes(candles);
  const series: Record<string, number[]> = {};

  for (const node of ordered) {
    const inputs = nodeInputs(node, series, fallback);
    const key = hashed(node, inputs);
    const computed = nodeCache.get(key) ?? computeNode(node, inputs, candles);
    nodeCache.set(key, computed);
    series[node.id] = alignSeries(computed, candles.length);
  }

  const outputs: Record<string, number[]> = {};
  for (const id of graph.outputs) {
    outputs[id] = series[id] ?? [];
  }

  return {
    indicatorId: graph.indicatorId,
    outputs,
    computedNodeCount: ordered.length,
  };
}
