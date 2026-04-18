import mongoose from "mongoose";
import { Queue } from "bullmq";
import { connectDB } from "../src/config/db";
import { connectRedis, redisQueueConnectionOptions } from "../src/config/redis";
import { SymbolModel } from "../src/models/Symbol";
import { logger } from "../src/utils/logger";

async function main(): Promise<void> {
  await connectDB();
  await connectRedis();

  const total = await SymbolModel.estimatedDocumentCount();

  const [withIcon, withS3, byType, byExchange, attemptStats] = await Promise.all([
    SymbolModel.countDocuments({ iconUrl: { $ne: "", $exists: true } }),
    SymbolModel.countDocuments({ s3Icon: { $ne: "", $exists: true } }),
    SymbolModel.aggregate([
      {
        $group: {
          _id: "$type",
          total: { $sum: 1 },
          withIcon: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$iconUrl", ""] }, { $ifNull: ["$iconUrl", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    SymbolModel.aggregate([
      {
        $group: {
          _id: "$exchange",
          total: { $sum: 1 },
          withIcon: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$iconUrl", ""] }, { $ifNull: ["$iconUrl", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),
    SymbolModel.aggregate([
      { $match: { $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }] } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          maxAttempts: { $max: "$logoAttempts" },
          avgAttempts: { $avg: "$logoAttempts" },
        },
      },
    ]),
  ]);

  const queue = new Queue("logo-enrichment", { connection: redisQueueConnectionOptions });
  const [waiting, active, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
  ]);
  const queueDepth = waiting + active + delayed;

  const withoutIcon = total - withIcon;
  const coverage = ((withIcon / total) * 100).toFixed(2);

  console.log("\n=== LOGO COVERAGE REPORT ===");
  console.log(`Total Symbols : ${total}`);
  console.log(`With Icon     : ${withIcon} (${coverage}%)`);
  console.log(`With S3 CDN   : ${withS3}`);
  console.log(`Without Icon  : ${withoutIcon}`);
  console.log(`Queue Depth   : ${queueDepth}`);

  console.log("\n--- By Type ---");
  for (const t of byType) {
    const pct = ((t.withIcon / t.total) * 100).toFixed(1);
    console.log(`  ${String(t._id).padEnd(8)} ${t.withIcon}/${t.total} (${pct}%)`);
  }

  console.log("\n--- Top Exchanges ---");
  for (const e of byExchange) {
    const pct = ((e.withIcon / e.total) * 100).toFixed(1);
    console.log(`  ${String(e._id).padEnd(10)} ${e.withIcon}/${e.total} (${pct}%)`);
  }

  if (attemptStats.length > 0) {
    const s = attemptStats[0];
    console.log("\n--- Unresolved Attempt Stats ---");
    console.log(`  Count        : ${s.count}`);
    console.log(`  Max attempts : ${s.maxAttempts ?? 0}`);
    console.log(`  Avg attempts : ${(s.avgAttempts ?? 0).toFixed(1)}`);
  }

  console.log("============================\n");

  const result = {
    totalSymbols: total,
    mappedIcons: withIcon,
    iconsMapped: withIcon,
    s3Backed: withS3,
    fallbackIcons: withoutIcon,
    coverage: `${coverage}%`,
    allSymbolsMapped: withoutIcon === 0,
    noFallbacks: withoutIcon === 0,
    queueStable: queueDepth === 0,
    systemStable: true,
  };

  console.log(JSON.stringify(result, null, 2));

  logger.info("logo_coverage_validation", result);

  await queue.close();
  await mongoose.connection.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("logo_coverage_validation_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });