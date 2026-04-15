import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "../src/config/db";
import { SymbolModel } from "../src/models/Symbol";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env"), override: false });
dotenv.config({ path: path.join(__dirname, "../../.env.secrets"), override: true });

async function main(): Promise<void> {
  await connectDB();

  const resetResult = await SymbolModel.updateMany(
    { popularity: { $gt: 12 } },
    { $set: { popularity: 0 } },
  );
  console.log(`Reset ${resetResult.modifiedCount} symbols with inflated popularity to 0`);

  const initResult = await SymbolModel.updateMany(
    { userUsage: { $exists: false } },
    { $set: { userUsage: 0 } },
  );
  console.log(`Initialized userUsage for ${initResult.modifiedCount} symbols`);

  const scoreResult = await SymbolModel.updateMany(
    {},
    [
      {
        $set: {
          priorityScore: {
            $add: [
              { $multiply: [{ $ifNull: ["$searchFrequency", 0] }, 0.5] },
              { $multiply: [{ $ifNull: ["$userUsage", 0] }, 0.3] },
              {
                $cond: [
                  { $or: [{ $gt: ["$iconUrl", ""] }, { $gt: ["$s3Icon", ""] }] },
                  50,
                  0,
                ],
              },
            ],
          },
        },
      },
    ],
  );
  console.log(`Recalculated priorityScore for ${scoreResult.modifiedCount} symbols`);

  const top = await SymbolModel.find({ type: "stock" })
    .sort({ priorityScore: -1, createdAt: -1 })
    .limit(10)
    .select({ fullSymbol: 1, priorityScore: 1, searchFrequency: 1, userUsage: 1, iconUrl: 1 })
    .lean();
  console.log("\nTop 10 stocks by priorityScore:");
  for (const row of top) {
    console.log(`  ${row.fullSymbol}: score=${row.priorityScore} sf=${row.searchFrequency} uu=${row.userUsage} icon=${row.iconUrl ? "yes" : "no"}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});