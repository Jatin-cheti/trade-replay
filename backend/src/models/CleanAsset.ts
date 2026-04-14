import mongoose, { InferSchemaType, Schema } from "mongoose";

/**
 * Clean, verified symbols — the queryable "gold layer".
 * Only symbols with valid exchange, name, active trading, and a logo make it here.
 * Search queries should hit this collection for fast, noise-free results.
 */
const cleanAssetSchema = new Schema(
  {
    symbol: { type: String, required: true, trim: true, uppercase: true },
    fullSymbol: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    exchange: { type: String, required: true, trim: true, uppercase: true },
    country: { type: String, required: true, trim: true, uppercase: true },
    type: {
      type: String,
      required: true,
      enum: ["stock", "etf", "crypto", "forex", "index", "derivative", "bond", "economy"],
    },
    currency: { type: String, required: true, trim: true, uppercase: true },
    sector: { type: String, trim: true, default: "" },
    iconUrl: { type: String, trim: true, default: "" },
    s3Icon: { type: String, trim: true, default: "" },
    companyDomain: { type: String, trim: true, default: "" },
    source: { type: String, required: true, trim: true },
    priorityScore: { type: Number, required: true, default: 0 },
    marketCap: { type: Number, default: 0 },
    volume: { type: Number, default: 0 },
    liquidityScore: { type: Number, default: 0 },
    popularity: { type: Number, default: 0 },
    isActive: { type: Boolean, required: true, default: true },
    verifiedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

// Primary uniqueness
cleanAssetSchema.index({ fullSymbol: 1 }, { unique: true });
// symbol+exchange uniqueness
cleanAssetSchema.index({ symbol: 1, exchange: 1 }, { unique: true });
// Category browsing
cleanAssetSchema.index({ type: 1, priorityScore: -1 });
// Country filter
cleanAssetSchema.index({ country: 1, type: 1 });
// Search by name/symbol
cleanAssetSchema.index({ symbol: 1, name: 1 });
// Priority ordering
cleanAssetSchema.index({ priorityScore: -1 });

export type CleanAssetDocument = InferSchemaType<typeof cleanAssetSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CleanAssetModel =
  mongoose.models.CleanAsset || mongoose.model("CleanAsset", cleanAssetSchema);
