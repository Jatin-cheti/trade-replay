import mongoose, { Schema } from "mongoose";

const symbolSchema = new Schema({
  symbol: { type: String, required: true, trim: true, uppercase: true },
  fullSymbol: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  exchange: { type: String, required: true, trim: true, uppercase: true },
  type: { type: String, required: true },
  currency: { type: String, required: true, trim: true, uppercase: true },
  iconUrl: { type: String, trim: true, default: "" },
  s3Icon: { type: String, trim: true, default: "" },
  priorityScore: { type: Number, default: 0 },
}, { timestamps: true });

symbolSchema.index({ fullSymbol: 1 }, { unique: true });
symbolSchema.index({ symbol: 1, priorityScore: -1 });

export const SymbolModel = mongoose.models.Symbol || mongoose.model("Symbol", symbolSchema);
