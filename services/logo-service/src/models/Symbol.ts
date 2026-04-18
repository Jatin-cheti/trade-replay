import mongoose, { InferSchemaType, Schema } from "mongoose";

const symbolSchema = new Schema(
  {
    symbol: { type: String, required: true, trim: true, uppercase: true },
    fullSymbol: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    exchange: { type: String, required: true, trim: true, uppercase: true },
    country: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, required: true, trim: true, lowercase: true },
    companyDomain: { type: String, trim: true, default: "" },
    iconUrl: { type: String, trim: true, default: "" },
    s3Icon: { type: String, trim: true, default: "" },
    logoAttempts: { type: Number, required: true, default: 0 },
    lastLogoAttemptAt: { type: Number },
    logoValidatedAt: { type: Date },
    popularity: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

symbolSchema.index({ fullSymbol: 1 }, { unique: true });

export type SymbolDocument = InferSchemaType<typeof symbolSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SymbolModel = mongoose.models.Symbol || mongoose.model("Symbol", symbolSchema);
