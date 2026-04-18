import mongoose, { Schema } from "mongoose";

const globalSymbolMasterSchema = new Schema(
  {
    symbol: { type: String, required: true, trim: true, uppercase: true },
    fullSymbol: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    exchange: { type: String, required: true, trim: true, uppercase: true },
    country: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, required: true, trim: true, lowercase: true },
    currency: { type: String, required: true, trim: true, uppercase: true },
    status: { type: String, required: true, default: "unknown" },
    source: { type: String, required: true, trim: true },
    domain: { type: String, trim: true, default: "" },
    logoUrl: { type: String, trim: true, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    firstSeenAt: { type: Date, default: () => new Date() },
    lastSeenAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

globalSymbolMasterSchema.index({ fullSymbol: 1 }, { unique: true });
globalSymbolMasterSchema.index({ exchange: 1, type: 1, country: 1 });
globalSymbolMasterSchema.index({ symbol: 1, exchange: 1 });

export const GlobalSymbolMaster =
  mongoose.models.GlobalSymbolMaster ||
  mongoose.model("GlobalSymbolMaster", globalSymbolMasterSchema);
