const m = require("/opt/tradereplay/backend/node_modules/mongoose");
m.connect("mongodb://127.0.0.1:27017/tradereplay").then(async () => {
  const db = m.connection.db;
  const symbols = db.collection("symbols");
  const cleanassets = db.collection("cleanassets");
  
  // Check how many symbols have sectors
  const symWithSector = await symbols.countDocuments({ sector: { $ne: "" } });
  const symTotal = await symbols.countDocuments();
  console.log("Symbols with sector:", symWithSector, "/", symTotal);
  
  // Check globalsymbolmasters
  const gsm = db.collection("globalsymbolmasters");
  const gsmWithSector = await gsm.countDocuments({ sector: { $ne: "" } });
  const gsmTotal = await gsm.countDocuments();
  console.log("GlobalSymbolMasters with sector:", gsmWithSector, "/", gsmTotal);
  
  // Sample a symbol with sector
  const sample = await symbols.findOne({ sector: { $ne: "" } });
  if (sample) console.log("Sample:", sample.symbol, sample.exchange, sample.sector);
  
  // Backfill: copy sector from symbols to cleanassets where matching
  console.log("\n--- BACKFILLING SECTORS ---");
  const cursor = symbols.find({ sector: { $ne: "" } }).project({ fullSymbol: 1, sector: 1 });
  let updated = 0, notFound = 0;
  for await (const doc of cursor) {
    const result = await cleanassets.updateOne(
      { fullSymbol: doc.fullSymbol, $or: [{ sector: "" }, { sector: { $exists: false } }] },
      { $set: { sector: doc.sector } }
    );
    if (result.modifiedCount > 0) updated++;
    else notFound++;
  }
  console.log("Backfilled from symbols:", updated, "skipped:", notFound);
  
  // Also try from globalsymbolmasters
  const cursor2 = gsm.find({ sector: { $ne: "" } }).project({ fullSymbol: 1, sector: 1 });
  let updated2 = 0, notFound2 = 0;
  for await (const doc of cursor2) {
    const result = await cleanassets.updateOne(
      { fullSymbol: doc.fullSymbol, $or: [{ sector: "" }, { sector: { $exists: false } }] },
      { $set: { sector: doc.sector } }
    );
    if (result.modifiedCount > 0) updated2++;
    else notFound2++;
  }
  console.log("Backfilled from GSM:", updated2, "skipped:", notFound2);
  
  // Final count
  const finalCount = await cleanassets.countDocuments({ sector: { $ne: "" } });
  console.log("\nFinal cleanassets with sector:", finalCount, "/", 116611);
  
  process.exit(0);
});
