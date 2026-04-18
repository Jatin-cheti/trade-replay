import mongoose, { Schema } from "mongoose";

const cleanAssetSchema = new Schema(
  {
    symbol: { type: String, required: true, trim: true, uppercase: true },
    fullSymbol: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    exchange: { type: String, required: true, trim: true, uppercase: true },
    country: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, required: true },
    currency: { type: String, required: true, trim: true, uppercase: true },
    sector: { type: String, trim: true, default: "" },
    iconUrl: { type: String, trim: true, default: "" },
    s3Icon: { type: String, trim: true, default: "" },
    source: { type: String, required: true, trim: true },
    priorityScore: { type: Number, default: 0 },
    marketCap: { type: Number, default: 0 },
    volume: { type: Number, default: 0 },
    popularity: { type: Number, default: 0 },
    logoStatus: { type: String, default: "pending" },
    isActive: { type: Boolean, default: true },
    isPrimaryListing: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

cleanAssetSchema.index({ fullSymbol: 1 }, { unique: true });
cleanAssetSchema.index({ type: 1, priorityScore: -1 });
cleanAssetSchema.index({ country: 1, type: 1 });
cleanAssetSchema.index({ symbol: 1, name: 1, priorityScore: -1 });

export const CleanAssetModel =
  mongoose.models.CleanAsset || mongoose.model("CleanAsset", cleanAssetSchema);
