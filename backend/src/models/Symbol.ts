import mongoose, { InferSchemaType, Schema } from "mongoose";

const symbolSchema = new Schema(
  {
    symbol: { type: String, required: true, trim: true, uppercase: true },
    fullSymbol: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    exchange: { type: String, required: true, trim: true, uppercase: true },
    country: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, required: true, enum: ["stock", "crypto", "forex", "index"] },
    currency: { type: String, required: true, trim: true, uppercase: true },
    iconUrl: { type: String, trim: true, default: "" },
    companyDomain: { type: String, trim: true, default: "" },
    logoValidatedAt: { type: Date },
    logoAttempts: { type: Number, required: true, default: 0 },
    lastLogoAttemptAt: { type: Number },
    s3Icon: { type: String, trim: true, default: "" },
    popularity: { type: Number, required: true, default: 0 },
    searchFrequency: { type: Number, required: true, default: 0 },
    userUsage: { type: Number, required: true, default: 0 },
    priorityScore: { type: Number, required: true, default: 0 },
    baseSymbol: { type: String, trim: true, uppercase: true, default: "" },
    source: { type: String, required: true, trim: true },
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

export type SymbolDocument = InferSchemaType<typeof symbolSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SymbolModel = mongoose.models.Symbol || mongoose.model("Symbol", symbolSchema);
