import mongoose, { InferSchemaType, Schema } from "mongoose";

const holdingSchema = new Schema({ symbol: { type: String, required: true }, quantity: { type: Number, required: true, min: 0 }, avgPrice: { type: Number, required: true, min: 0 } }, { _id: false });

const savedPortfolioSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  baseCurrency: { type: String, required: true, default: "USD" },
  holdings: { type: [holdingSchema], default: [] },
}, { timestamps: true });

savedPortfolioSchema.index({ userId: 1, createdAt: -1 });

export type SavedPortfolioDocument = InferSchemaType<typeof savedPortfolioSchema> & { _id: mongoose.Types.ObjectId };
export const SavedPortfolioModel = mongoose.models.SavedPortfolio || mongoose.model("SavedPortfolio", savedPortfolioSchema);
