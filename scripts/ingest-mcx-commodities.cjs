// IN-10: MCX commodity futures ingestion (current month + next 2).
const {MongoClient} = require("mongodb");
const URI = process.env.MONGO_URI || "mongodb://10.122.0.2:27017/tradereplay";

const MCX_COMMODITIES = [
  "GOLD","GOLDM","GOLDPETAL","GOLDGUINEA",
  "SILVER","SILVERM","SILVERMIC","SILVER1000",
  "CRUDEOIL","CRUDEOILM","NATURALGAS","NATGASMINI",
  "COPPER","ZINC","ZINCMINI","ALUMINIUM","ALUMINI","LEAD","LEADMINI","NICKEL",
  "MENTHAOIL","COTTON","COTTONCNDY","CASTORSEED","KAPAS","CARDAMOM","PEPPER","RUBBER","CPO"
];

const PALETTE = ["F59E0B","EAB308","CA8A04","A16207","854D0E"];

(async () => {
  const c = await MongoClient.connect(URI);
  const col = c.db().collection("cleanassets");

  const now = new Date();
  const months = [0, 1, 2].map(off => {
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
    return { year: d.getFullYear(), month: String(d.getMonth() + 1).padStart(2, "0"), label: d.toLocaleString("en-US",{month:"short",year:"2-digit"}).toUpperCase().replace(/\s+/g," ") };
  });

  const docs = [];
  for (const commodity of MCX_COMMODITIES) {
    for (const { year, month, label } of months) {
      const ticker = `${commodity}-FUT-${year}-${month}`;
      const fullSymbol = `MCX:${ticker}`;
      docs.push({
        fullSymbol,
        symbol: ticker,
        tickerSymbol: ticker,
        name: `${commodity} Futures ${label}`,
        exchange: "MCX",
        country: "IN",
        type: "future",
        assetClass: "commodity_future",
        underlyingCommodity: commodity,
        currency: "INR",
        isActive: true,
        sourceName: "mcx_official",
        sourceConfidence: 1.0,
        iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(commodity.slice(0,3))}&background=${PALETTE[commodity.charCodeAt(0) % PALETTE.length]}&color=fff&size=64&bold=true&format=svg`,
        logoSource: "ui-avatars-mcx",
        ingestedAt: new Date(),
        expiryYear: year,
        expiryMonth: month
      });
    }
  }

  let inserted = 0, updated = 0;
  for (const d of docs) {
    const { isActive, ...rest } = d;
    const r = await col.updateOne(
      { fullSymbol: d.fullSymbol },
      { $setOnInsert: rest, $set: { isActive: true } },
      { upsert: true }
    );
    if (r.upsertedCount) inserted++;
    else if (r.modifiedCount) updated++;
  }
  console.log(`MCX ingest: ${docs.length} contracts | inserted=${inserted} already-existed=${docs.length-inserted}`);
  await c.close();
})().catch(e => { console.error(e); process.exit(1); });
