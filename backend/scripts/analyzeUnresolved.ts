import { connectDB } from "../src/config/db";
import { SymbolModel } from "../src/models/Symbol";

async function main() {
  await connectDB();

  const byType = await SymbolModel.aggregate([
    { $match: { $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }] } },
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  console.log("UNRESOLVED BY TYPE:", JSON.stringify(byType));

  const byExchange = await SymbolModel.aggregate([
    { $match: { $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }] } },
    { $group: { _id: "$exchange", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  console.log("UNRESOLVED BY EXCHANGE:", JSON.stringify(byExchange));

  const stockSamples = await SymbolModel.find(
    { $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }], type: "stock" },
  ).select("symbol fullSymbol name exchange logoAttempts").limit(20).lean();
  console.log("SAMPLE STOCKS:", JSON.stringify(stockSamples.map((s) => ({ s: s.symbol, n: s.name, e: s.exchange, a: s.logoAttempts }))));

  const cryptoSamples = await SymbolModel.find(
    { $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }], type: "crypto" },
  ).select("symbol name exchange").limit(10).lean();
  console.log("SAMPLE CRYPTO:", JSON.stringify(cryptoSamples.map((s) => ({ s: s.symbol, n: s.name, e: s.exchange }))));

  const forexSamples = await SymbolModel.find(
    { $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }], type: "forex" },
  ).select("symbol fullSymbol name exchange").limit(20).lean();
  console.log("SAMPLE FOREX:", JSON.stringify(forexSamples));

  const indexSamples = await SymbolModel.find(
    { $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }], type: "index" },
  ).select("symbol fullSymbol name exchange").limit(20).lean();
  console.log("SAMPLE INDEX:", JSON.stringify(indexSamples));

  process.exit(0);
}
main();