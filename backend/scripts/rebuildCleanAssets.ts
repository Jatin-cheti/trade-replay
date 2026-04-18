import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { buildCleanAssets } from "../src/services/cleanAsset.service";

async function main() {
  await connectDB();
  console.log("Connected. Rebuilding clean assets with OPT support...");
  const result = await buildCleanAssets();
  console.log("Processed:", result.processed);
  console.log("Promoted:", result.promoted);
  console.log("Skipped:", result.skipped);
  console.log("Duration:", (result.duration / 1000).toFixed(1) + "s");

  const count = await mongoose.connection.db!.collection("cleanassets").estimatedDocumentCount();
  console.log("Total clean assets now:", count);

  await mongoose.connection.close();
}
main();
