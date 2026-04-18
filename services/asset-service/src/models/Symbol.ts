import mongoose, { Schema } from "mongoose";

const symbolSchema = new Schema(
  {
    symbol: { type: String, required: true, trim: true, uppercase: true },
    fullSymbol: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    exchange: { type: String, required: true, trim: true, uppercase: true },
    country: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, required: true },
    currency: { type: String, required: true, trim: true, uppercase: true },
    iconUrl: { type: String, trim: true, default: "" },
    s3Icon: { type: String, trim: true, default: "" },
    companyDomain: { type: String, trim: true, default: "" },
    logoStatus: { type: String, default: "pending" },
    logoSource: { type: String, trim: true, default: "" },
    validated: { type: Boolean, default: false },
    priorityScore: { type: Number, default: 0 },
    marketCap: { type: Number, default: 0 },
    volume: { type: Number, default: 0 },
    popularity: { type: Number, default: 0 },
    sector: { type: String, trim: true, default: "" },
    source: { type: String, required: true, trim: true },
    isCleanAsset: { type: Boolean, default: false },
    isPrimaryListing: { type: Boolean, default: false },
    searchPrefixes: { type: [String], default: [] },
  },
  { timestamps: true },
);

symbolSchema.index({ fullSymbol: 1 }, { unique: true });
symbolSchema.index({ symbol: 1, type: 1, country: 1, createdAt: -1 });
symbolSchema.index({ isCleanAsset: 1, priorityScore: -1 });
symbolSchema.index({ searchPrefixes: 1, priorityScore: -1 });

export const SymbolModel =
  mongoose.models.Symbol || mongoose.model("Symbol", symbolSchema);
