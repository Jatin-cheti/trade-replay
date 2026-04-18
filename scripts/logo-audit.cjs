#!/usr/bin/env node
/**
 * Logo Audit Script — Phase 4
 * Queries MongoDB for symbols with missing, broken, or suspect logo URLs.
 * Outputs a JSON report to stdout.
 */
require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";

// Domains known to block/rate-limit or return broken images
const BLOCKED_DOMAINS = [
  "logo.dev", "img.logo.dev", "logo.clearbit.com",
  "s3.polygon.io", "api.polygon.io",
];

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // Count totals
  const totalSymbols = await db.collection("symbols").countDocuments();
  const totalClean = await db.collection("cleanassets").countDocuments();

  // Symbols with no iconUrl at all
  const noIcon = await db.collection("symbols").countDocuments({
    $or: [{ iconUrl: { $exists: false } }, { iconUrl: null }, { iconUrl: "" }],
  });

  // Symbols with s3Icon (successfully uploaded to S3)
  const hasS3 = await db.collection("symbols").countDocuments({
    s3Icon: { $exists: true, $ne: null, $ne: "" },
  });

  // Symbols using blocked domains
  const blockedResults = {};
  for (const domain of BLOCKED_DOMAINS) {
    const count = await db.collection("symbols").countDocuments({
      iconUrl: { $regex: domain, $options: "i" },
    });
    if (count > 0) blockedResults[domain] = count;
  }

  // Sample of symbols with blocked domain logos
  const blockedSamples = await db
    .collection("symbols")
    .find({
      iconUrl: { $regex: BLOCKED_DOMAINS.join("|"), $options: "i" },
    })
    .project({ symbol: 1, iconUrl: 1, s3Icon: 1, _id: 0 })
    .limit(20)
    .toArray();

  // Symbols with no logo at all (no iconUrl AND no s3Icon)
  const totallyMissing = await db.collection("symbols").countDocuments({
    $and: [
      { $or: [{ iconUrl: { $exists: false } }, { iconUrl: null }, { iconUrl: "" }] },
      { $or: [{ s3Icon: { $exists: false } }, { s3Icon: null }, { s3Icon: "" }] },
    ],
  });

  // Top exchanges by missing logos
  const missingByExchange = await db
    .collection("symbols")
    .aggregate([
      {
        $match: {
          $or: [{ iconUrl: { $exists: false } }, { iconUrl: null }, { iconUrl: "" }],
        },
      },
      { $group: { _id: "$exchange", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ])
    .toArray();

  // Top types by missing logos
  const missingByType = await db
    .collection("symbols")
    .aggregate([
      {
        $match: {
          $or: [{ iconUrl: { $exists: false } }, { iconUrl: null }, { iconUrl: "" }],
        },
      },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ])
    .toArray();

  // Coverage by asset type
  const coverageByType = await db
    .collection("symbols")
    .aggregate([
      {
        $group: {
          _id: "$type",
          total: { $sum: 1 },
          hasIcon: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$iconUrl", null] }, { $ne: ["$iconUrl", ""] }] },
                1,
                0,
              ],
            },
          },
          hasS3: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$s3Icon", null] }, { $ne: ["$s3Icon", ""] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ])
    .toArray();

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSymbols,
      totalCleanAssets: totalClean,
      symbolsWithNoIconUrl: noIcon,
      symbolsWithS3Icon: hasS3,
      symbolsCompletelyMissingLogo: totallyMissing,
      logoCoveragePercent: +(((totalSymbols - noIcon) / totalSymbols) * 100).toFixed(1),
      s3CoveragePercent: +((hasS3 / totalSymbols) * 100).toFixed(1),
    },
    blockedDomains: blockedResults,
    blockedSamples,
    missingByExchange: missingByExchange.map((e) => ({ exchange: e._id, count: e.count })),
    missingByType: missingByType.map((e) => ({ type: e._id, count: e.count })),
    coverageByType: coverageByType.map((e) => ({
      type: e._id,
      total: e.total,
      hasIcon: e.hasIcon,
      hasS3: e.hasS3,
      coveragePercent: +((e.hasIcon / e.total) * 100).toFixed(1),
    })),
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Logo audit failed:", err);
  process.exit(1);
});
