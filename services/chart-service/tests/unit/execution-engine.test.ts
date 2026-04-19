import assert from "node:assert/strict";
import { executeGraph } from "../../src/lib/execution-engine";

const candles = Array.from({ length: 40 }, (_, i) => ({
  timestamp: Date.now() + i * 60_000,
  open: 100 + i,
  high: 101 + i,
  low: 99 + i,
  close: 100 + i,
  volume: 1000 + i * 10,
}));

const graph = {
  indicatorId: "graph-test",
  version: 1,
  nodes: [
    { id: "src", type: "SOURCE", config: { field: "close" } },
    { id: "ma", type: "SMA", inputs: { input: "src" }, config: { period: 5 } },
    { id: "gt", type: "GT", inputs: { left: "src", right: "ma" } },
  ],
  outputs: ["ma", "gt"],
} as const;

const result = executeGraph(candles, graph as any);
assert.equal(result.indicatorId, "graph-test");
assert.equal(result.computedNodeCount, 3);
assert.equal(result.outputs.ma.length, candles.length);
assert.equal(result.outputs.gt.length, candles.length);

process.stdout.write("execution-engine.test.ts passed\n");
