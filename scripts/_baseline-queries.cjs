/**
 * Pre-wave baseline query dump — Section 3.1.
 * Mirrors the 6 queries in the spec but implemented for MongoDB (cleanassets).
 * Emits CSV + JSON to /tmp/ and prints summary.
 * Run on server: node scripts/_baseline-queries.cjs
 */

"use strict";
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

(async () => {
  const uri = process.env.MONGO_URI || "mongodb://10.122.0.2:27017/tradereplay";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const ca = db.collection("cleanassets");

  const out = { ts: new Date().toISOString(), queries: {} };
  const ACTIVE = { isActive: true };

  // Q1: global total
  out.queries.q1_global_total = await ca.countDocuments(ACTIVE);

  // Q2: by country (top 30)
  out.queries.q2_by_country = await ca.aggregate([
    { $match: { ...ACTIVE, type: "stock" } },
    { $group: { _id: "$country", count: { $sum: 1 } } },
    { $sort: { count: -1 } }, { $limit: 30 },
  ]).toArray();

  // Q3: by asset class
  out.queries.q3_by_asset_class = await ca.aggregate([
    { $match: ACTIVE },
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  // Q4: India by exchange+asset_class
  out.queries.q4_india_by_exchange_type = await ca.aggregate([
    { $match: { ...ACTIVE, country: "IN" } },
    { $group: { _id: { exchange: "$exchange", type: "$type" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  // Q5: enrichment completeness per country (top 20)
  const completenessFields = ["name", "industry", "marketCap", "pe", "iconUrl", "price"];
  out.queries.q5_enrichment_pct = await ca.aggregate([
    { $match: { ...ACTIVE, type: "stock" } },
    {
      $group: {
        _id: "$country",
        total: { $sum: 1 },
        ...Object.fromEntries(completenessFields.map((f) => [
          `has_${f}`,
          { $sum: { $cond: [{ $and: [{ $ne: [`$${f}`, null] }, { $ne: [`$${f}`, ""] }, { $ne: [`$${f}`, 0] }] }, 1, 0] } },
        ])),
      },
    },
    { $sort: { total: -1 } }, { $limit: 20 },
    {
      $addFields: Object.fromEntries(completenessFields.map((f) => [
        `pct_has_${f}`,
        { $round: [{ $multiply: [{ $divide: [`$has_${f}`, "$total"] }, 100] }, 2] },
      ])),
    },
  ]).toArray();

  // Q6: coverage vs targets
  const global = out.queries.q1_global_total;
  const indiaStock = (out.queries.q2_by_country.find((x) => x._id === "IN") || { count: 0 }).count;
  const usStock = (out.queries.q2_by_country.find((x) => x._id === "US") || { count: 0 }).count;
  out.queries.q6_coverage_vs_target = [
    { region: "Global", current: global, target: 2_000_000, gap: 2_000_000 - global, pct: +(100 * global / 2_000_000).toFixed(2) },
    { region: "India (stock)", current: indiaStock, target: 800_000, gap: 800_000 - indiaStock, pct: +(100 * indiaStock / 800_000).toFixed(2) },
    { region: "US (stock)", current: usStock, target: 200_000, gap: 200_000 - usStock, pct: +(100 * usStock / 200_000).toFixed(2) },
  ];

  const outDir = process.env.BASELINE_OUT_DIR || "/tmp";
  fs.writeFileSync(path.join(outDir, "baseline_queries.json"), JSON.stringify(out, null, 2));
  // Summary CSV
  const lines = [
    "metric,value",
    `global_total,${global}`,
    `india_stock,${indiaStock}`,
    `us_stock,${usStock}`,
    `pct_of_2M,${out.queries.q6_coverage_vs_target[0].pct}`,
    `pct_of_800k_india,${out.queries.q6_coverage_vs_target[1].pct}`,
  ];
  fs.writeFileSync(path.join(outDir, "baseline_summary.csv"), lines.join("\n"));

  console.log("Global:", global, "| India stock:", indiaStock, "| US stock:", usStock);
  console.log("Coverage:", out.queries.q6_coverage_vs_target);
  console.log(`Wrote: ${outDir}/baseline_queries.json, ${outDir}/baseline_summary.csv`);
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
