import mongoose from "mongoose";
import { env } from "../src/config/env";

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/tradereplay");
  const db = mongoose.connection.db!;

  // Check exchange distribution
  const exchangeDist = await db.collection("symbols").aggregate([
    { $group: { _id: "$exchange", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 25 },
  ]).toArray();
  console.log("Top 25 exchanges in symbols:");
  for (const e of exchangeDist) {
    console.log(`  ${String(e._id).padEnd(25)} ${e.count}`);
  }

  // Check UNKNOWN exchange
  const unknown = await db.collection("symbols").countDocuments({ exchange: "UNKNOWN" });
  const empty = await db.collection("symbols").countDocuments({ exchange: { $in: ["", null] } });
  console.log("\nUNKNOWN exchange:", unknown);
  console.log("Empty exchange:", empty);

  // Check type distribution
  const typeDist = await db.collection("symbols").aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
  console.log("\nType distribution:");
  for (const t of typeDist) {
    console.log(`  ${String(t._id).padEnd(15)} ${t.count}`);
  }

  // Sample some UNKNOWN exchange symbols
  const unknownSamples = await db.collection("symbols").find(
    { exchange: "UNKNOWN" },
    { projection: { symbol: 1, name: 1, exchange: 1, type: 1, source: 1 } }
  ).limit(10).toArray();
  console.log("\nSample UNKNOWN exchange symbols:");
  for (const s of unknownSamples) {
    console.log(`  ${s.symbol} | ${s.name} | ${s.type} | ${s.source}`);
  }

  // Check what percentage has proper names
  const total = await db.collection("symbols").estimatedDocumentCount();
  console.log("\nTotal symbols:", total);

  await mongoose.connection.close();
}
main();
