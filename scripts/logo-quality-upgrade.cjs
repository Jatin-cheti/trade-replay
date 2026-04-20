/**
 * LOGO QUALITY UPGRADE
 *   - Upgrade all Google Favicon sz=128 (and lower) URLs to sz=256 so the
 *     avatar component no longer has to upscale a low-res asset.
 *   - Emit audit report at /tmp/logo_quality_audit.json AND write:
 *       /tmp/low_quality_or_cropped_logos.txt
 *       /tmp/fallback_or_missing_logos.txt
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function loadEnv() {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = l.trim(); if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("="); if (i === -1) continue;
    const k = t.slice(0, i).trim(); if (process.env[k]) continue;
    let v = t.slice(i + 1).trim();
    if ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'")) v = v.slice(1, -1);
    process.env[k] = v;
  }
}
loadEnv();
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const DRY = process.argv.includes("--dry-run");

(async () => {
  const c = new MongoClient(MONGO_URI); await c.connect();
  const ca = c.db().collection("cleanassets");

  const before = {
    sz32: await ca.countDocuments({ iconUrl: /sz=32/ }),
    sz64: await ca.countDocuments({ iconUrl: /sz=64/ }),
    sz128: await ca.countDocuments({ iconUrl: /sz=128/ }),
    sz256: await ca.countDocuments({ iconUrl: /sz=256/ }),
    noLogo: await ca.countDocuments({ isActive: true, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }),
    clearbit: await ca.countDocuments({ iconUrl: /logo\.clearbit\.com/ }),
    logodev: await ca.countDocuments({ iconUrl: /img\.logo\.dev|logo\.dev/ }),
    total_active: await ca.countDocuments({ isActive: true }),
  };

  console.log("BEFORE:", before);

  // Emit low-quality report (anything sz<256 or non-google without https upgrade path)
  const lowQ = await ca.aggregate([
    { $match: { isActive: true, iconUrl: { $regex: /sz=(32|64|128)(?![0-9])/ } } },
    { $project: { _id: 0, symbol: 1, fullSymbol: 1, exchange: 1, type: 1, country: 1, iconUrl: 1, logoTier: 1, logoQualityScore: 1 } },
    { $limit: 50000 }
  ]).toArray();

  fs.writeFileSync("/tmp/low_quality_or_cropped_logos.txt",
    "symbol|exchange|assetType|issue_type|width|height|source|current_url\n" +
    lowQ.map(d => {
      const m = /sz=(\d+)/.exec(d.iconUrl || ""); const sz = m ? m[1] : "?";
      return `${d.symbol || ""}|${d.exchange || ""}|${d.type || ""}|low_res_sz${sz}|${sz}|${sz}|google-favicon|${d.iconUrl || ""}`;
    }).join("\n"));

  const missing = await ca.find(
    { isActive: true, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] },
    { projection: { _id: 0, symbol: 1, fullSymbol: 1, exchange: 1, type: 1 } }
  ).limit(50000).toArray();
  fs.writeFileSync("/tmp/fallback_or_missing_logos.txt",
    "symbol|exchange|assetType|issue_type|width|height|source|current_url\n" +
    missing.map(d => `${d.symbol || ""}|${d.exchange || ""}|${d.type || ""}|missing|0|0|none|`).join("\n"));

  if (DRY) { console.log(`DRY RUN: would upgrade ${before.sz32 + before.sz64 + before.sz128} URLs`); await c.close(); return; }

  // Upgrade sz=32/64/128 -> sz=256 using MongoDB $set with $replaceAll (mongo 4.4+)
  const pipeline = [
    { $set: {
        iconUrl: {
          $replaceAll: { input: { $replaceAll: { input: { $replaceAll: { input: "$iconUrl", find: "sz=128", replacement: "sz=256" } }, find: "sz=64", replacement: "sz=256" } }, find: "sz=32", replacement: "sz=256" }
        },
        logoUpgradedAt: new Date(),
        logoTier: 3,
    }}
  ];
  const r1 = await ca.updateMany(
    { iconUrl: { $regex: /sz=(32|64|128)(?![0-9])/ } },
    pipeline
  );
  console.log(`Upgraded: ${r1.modifiedCount}`);

  // Repeat for previous_icon_url for auditability
  await ca.updateMany({ previous_icon_url: { $regex: /sz=(32|64|128)(?![0-9])/ } }, [
    { $set: { previous_icon_url: { $replaceAll: { input: { $replaceAll: { input: { $replaceAll: { input: "$previous_icon_url", find: "sz=128", replacement: "sz=256" } }, find: "sz=64", replacement: "sz=256" } }, find: "sz=32", replacement: "sz=256" } } } }
  ]);

  const after = {
    sz128: await ca.countDocuments({ iconUrl: /sz=128/ }),
    sz256: await ca.countDocuments({ iconUrl: /sz=256/ }),
    noLogo: await ca.countDocuments({ isActive: true, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }),
    upgraded: r1.modifiedCount,
  };

  fs.writeFileSync("/tmp/logo_quality_audit.json", JSON.stringify({ before, after }, null, 2));
  console.log("AFTER:", after);
  console.log("Reports: /tmp/low_quality_or_cropped_logos.txt, /tmp/fallback_or_missing_logos.txt, /tmp/logo_quality_audit.json");
  await c.close();
})().catch(e => { console.error("FATAL", e); process.exit(1); });
