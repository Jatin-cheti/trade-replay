const m = require("/opt/tradereplay/backend/node_modules/mongoose");
m.connect("mongodb://127.0.0.1:27017/tradereplay").then(async () => {
  const db = m.connection.db;
  const col = db.collection("cleanassets");
  const sectors = await col.distinct("sector");
  console.log("SECTORS:", JSON.stringify(sectors));
  const withSector = await col.countDocuments({ sector: { $ne: "" } });
  const total = await col.countDocuments();
  console.log("WITH_SECTOR:", withSector, "TOTAL:", total);
  process.exit(0);
});
