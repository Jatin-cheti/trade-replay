import mongoose, { InferSchemaType, Schema } from "mongoose";

const symbolSchema = new Schema(
  {
    symbol: { type: String, required: true, trim: true, uppercase: true },
    fullSymbol: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    exchange: { type: String, required: true, trim: true, uppercase: true },
    country: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, required: true, enum: ["stock", "etf", "crypto", "forex", "index", "derivative", "bond", "economy", "option", "future"] },
    currency: { type: String, required: true, trim: true, uppercase: true },
    iconUrl: { type: String, trim: true, default: "" },
    companyDomain: { type: String, trim: true, default: "" },
    logoValidatedAt: { type: Date },
    logoAttempts: { type: Number, required: true, default: 0 },
    lastLogoAttemptAt: { type: Number },
    s3Icon: { type: String, trim: true, default: "" },
    logoSource: { type: String, trim: true, default: "" },
    logoVerificationStatus: { type: String, trim: true, enum: ["unknown", "validated", "fallback", "suspect", "repaired"], default: "unknown" },
    logoQualityScore: { type: Number, required: true, default: 0 },
    logoValidationNotes: { type: String, trim: true, default: "" },
    popularity: { type: Number, required: true, default: 0 },
    userUsage: { type: Number, required: true, default: 0 },
    priorityScore: { type: Number, required: true, default: 0 },
    marketCap: { type: Number, required: true, default: 0 },
    volume: { type: Number, required: true, default: 0 },
    liquidityScore: { type: Number, required: true, default: 0 },
    isSynthetic: { type: Boolean, required: true, default: false },
    baseSymbol: { type: String, trim: true, uppercase: true, default: "" },
    searchPrefixes: { type: [String], default: [] },
    source: { type: String, required: true, trim: true },
    isCleanAsset: { type: Boolean, default: false },
    isPrimaryListing: { type: Boolean, default: false },
    sector: { type: String, trim: true, default: "" },
    searchFrequency: { type: Number, default: 0 },
  },
  { timestamps: true },
);

symbolSchema.index({ fullSymbol: 1 }, { unique: true });
symbolSchema.index({ exchange: 1, type: 1, country: 1 });
symbolSchema.index({ logoAttempts: 1, lastLogoAttemptAt: 1 });
symbolSchema.index({ createdAt: -1, _id: -1 });
symbolSchema.index({ type: 1, country: 1, createdAt: -1, _id: -1 });
symbolSchema.index({ symbol: 1, type: 1, country: 1, createdAt: -1 });
symbolSchema.index(
  { priorityScore: -1, createdAt: -1 },
  { name: "symbol_priority_score_idx" },
);
symbolSchema.index({ searchFrequency: -1, createdAt: -1 }, { name: "symbol_search_frequency_idx" });
symbolSchema.index({ baseSymbol: 1, priorityScore: -1 }, { name: "symbol_base_cluster_idx" });
symbolSchema.index({ searchPrefixes: 1, priorityScore: -1 }, { name: "symbol_search_prefixes_idx" });
symbolSchema.index({ isCleanAsset: 1, searchPrefixes: 1, priorityScore: -1 }, { name: "clean_asset_prefixes_idx", sparse: true });
symbolSchema.index({ isCleanAsset: 1, priorityScore: -1 }, { name: "clean_asset_priority_idx", sparse: true });
symbolSchema.index({ isPrimaryListing: 1, type: 1, priorityScore: -1 }, { name: "primary_listing_idx", sparse: true });
symbolSchema.index({ isCleanAsset: 1, type: 1, country: 1, priorityScore: -1 }, { name: "clean_type_country_idx" });

export type SymbolDocument = InferSchemaType<typeof symbolSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SymbolModel = mongoose.models.Symbol || mongoose.model("Symbol", symbolSchema);
