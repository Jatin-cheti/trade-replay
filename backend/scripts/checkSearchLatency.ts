import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { startSearchIndexService } from "../src/services/searchIndex.service";
import { searchSymbols } from "../src/services/symbol.service";

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

async function probe(query: string, runs = 6): Promise<void> {
  const timings: number[] = [];

  for (let i = 0; i < runs; i += 1) {
    const startedAt = Date.now();
    await searchSymbols({ query, limit: 12, trackMetrics: false });
    timings.push(Date.now() - startedAt);
  }

  const warm = timings.slice(1);
  const p50 = percentile(warm, 50);
  const p95 = percentile(warm, 95);
  const min = Math.min(...warm);
  const max = Math.max(...warm);

  console.log(`${query}: p50=${p50}ms p95=${p95}ms min=${min}ms max=${max}ms warmRuns=${warm.length}`);
}

async function main(): Promise<void> {
  await connectDB();
  await startSearchIndexService();

  await probe("re");
  await probe("hdfc");
  await probe("btc");

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.connection.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
