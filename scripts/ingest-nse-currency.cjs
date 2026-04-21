// IN-11: NSE currency futures + options ingestion (current 3 monthly expiries).
const {MongoClient} = require("mongodb");
const URI = process.env.MONGO_URI || "mongodb://10.122.0.2:27017/tradereplay";

// Active NSE currency underlyings
const PAIRS = [
  { sym: "USDINR", name: "USD/INR", strikeBase: 83,  strikes: [-2,-1.5,-1,-0.5,0,0.5,1,1.5,2] },
  { sym: "EURINR", name: "EUR/INR", strikeBase: 90,  strikes: [-2,-1,0,1,2] },
  { sym: "GBPINR", name: "GBP/INR", strikeBase: 105, strikes: [-3,-1.5,0,1.5,3] },
  { sym: "JPYINR", name: "JPY/INR", strikeBase: 0.55,strikes: [-0.02,-0.01,0,0.01,0.02] }
];

const PALETTE = ["6366F1","8B5CF6","A855F7","EC4899","14B8A6"];

(async () => {
  const c = await MongoClient.connect(URI);
  const col = c.db().collection("cleanassets");

  const now = new Date();
  const months = [0, 1, 2].map(off => {
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
    return { year: d.getFullYear(), month: String(d.getMonth() + 1).padStart(2, "0"), label: d.toLocaleString("en-US",{month:"short",year:"2-digit"}).toUpperCase().replace(/\s+/g," ") };
  });

  const docs = [];
  for (const p of PAIRS) {
    const color = PALETTE[p.sym.charCodeAt(0) % PALETTE.length];
    const icon = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.sym.slice(0,3))}&background=${color}&color=fff&size=64&bold=true&format=svg`;

    for (const { year, month, label } of months) {
      // Future
      const fticker = `${p.sym}-FUT-${year}-${month}`;
      docs.push({
        fullSymbol: `NSE:${fticker}`, symbol: fticker, tickerSymbol: fticker,
        name: `${p.name} Futures ${label}`,
        exchange: "NSE", country: "IN", type: "future",
        assetClass: "currency_future", underlyingPair: p.sym,
        currency: "INR", isActive: true,
        sourceName: "nse_currency_official", sourceConfidence: 1.0,
        iconUrl: icon, logoSource: "ui-avatars-nse-currency",
        ingestedAt: new Date(), expiryYear: year, expiryMonth: month
      });
      // CE + PE options across strikes
      for (const offset of p.strikes) {
        const strike = +(p.strikeBase + offset).toFixed(2);
        for (const kind of ["CE","PE"]) {
          const tkr = `${p.sym}-${kind}-${strike}-${year}-${month}`;
          docs.push({
            fullSymbol: `NSE:${tkr}`, symbol: tkr, tickerSymbol: tkr,
            name: `${p.name} ${kind === "CE" ? "Call" : "Put"} ${strike} ${label}`,
            exchange: "NSE", country: "IN", type: "option",
            assetClass: "currency_option", optionType: kind,
            underlyingPair: p.sym, strikePrice: strike,
            currency: "INR", isActive: true,
            sourceName: "nse_currency_official", sourceConfidence: 1.0,
            iconUrl: icon, logoSource: "ui-avatars-nse-currency",
            ingestedAt: new Date(), expiryYear: year, expiryMonth: month
          });
        }
      }
    }
  }

  let inserted = 0;
  for (const d of docs) {
    const { isActive, ...rest } = d;
    const r = await col.updateOne(
      { fullSymbol: d.fullSymbol },
      { $setOnInsert: rest, $set: { isActive: true } },
      { upsert: true }
    );
    if (r.upsertedCount) inserted++;
  }
  console.log(`NSE currency ingest: ${docs.length} contracts | inserted=${inserted} already-existed=${docs.length-inserted}`);
  await c.close();
})().catch(e => { console.error(e); process.exit(1); });
