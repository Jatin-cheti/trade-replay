// Top-5000 by market cap logo coverage check + UI-avatars backfill for any still missing.
const {MongoClient} = require("mongodb");
const URI = process.env.MONGO_URI || "mongodb://10.122.0.2:27017/tradereplay";

const PALETTE = ["3B82F6","8B5CF6","10B981","F59E0B","EF4444","6366F1","EC4899","14B8A6","F97316","84CC16","06B6D4","A855F7"];

function hashColor(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function initials(label) {
  const words = String(label || "").replace(/[^A-Za-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (!words.length) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
function uiAvatarUrl(label) {
  const ini = initials(label);
  const color = hashColor(label);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(ini)}&background=${color}&color=fff&size=64&bold=true&format=svg`;
}

(async () => {
  const c = await MongoClient.connect(URI);
  const col = c.db().collection("cleanassets");

  // Top 5000 by market cap, active
  const top = await col.find(
    { isActive: true, marketCap: { $gt: 0 } },
    { projection: { symbol: 1, fullSymbol: 1, name: 1, iconUrl: 1 } }
  ).sort({ marketCap: -1 }).limit(5000).toArray();

  const missing = top.filter(s => !s.iconUrl || s.iconUrl === "");
  console.log(`Top 5000 by mcap: ${top.length - missing.length}/${top.length} have icons (${((top.length - missing.length)/top.length*100).toFixed(1)}%)`);
  console.log(`Missing: ${missing.length}`);

  if (missing.length === 0) {
    console.log("No backfill needed.");
    await c.close();
    return;
  }

  // Backfill with ui-avatars
  const ops = missing.map(s => ({
    updateOne: {
      filter: { _id: s._id },
      update: { $set: {
        iconUrl: uiAvatarUrl(s.name || s.symbol || s.fullSymbol || "?"),
        logoSource: "ui-avatars-fallback",
        logoEnrichedAt: new Date()
      }}
    }
  }));
  for (let i = 0; i < ops.length; i += 500) {
    const r = await col.bulkWrite(ops.slice(i, i + 500));
    process.stdout.write(`  batch ${i}-${i+500}: modified=${r.modifiedCount}\n`);
  }
  console.log(`Backfilled ${missing.length} top-5000 symbols with ui-avatars fallback.`);

  // Re-verify
  const topAfter = await col.find(
    { isActive: true, marketCap: { $gt: 0 } },
    { projection: { iconUrl: 1 } }
  ).sort({ marketCap: -1 }).limit(5000).toArray();
  const okAfter = topAfter.filter(s => s.iconUrl && s.iconUrl !== "").length;
  console.log(`After: ${okAfter}/${topAfter.length} (${(okAfter/topAfter.length*100).toFixed(1)}%)`);

  await c.close();
})().catch(e => { console.error(e); process.exit(1); });
