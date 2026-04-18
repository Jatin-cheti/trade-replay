import mongoose, { Schema } from "mongoose";

const holdingSchema = new Schema({ symbol: { type: String, required: true }, quantity: { type: Number, required: true, min: 0 }, avgPrice: { type: Number, required: true, min: 0 } }, { _id: false });

const portfolioSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  balance: { type: Number, required: true, default: 100000 },
  currency: { type: String, enum: ["USD", "INR", "EUR", "GBP", "JPY"], default: "USD" },
  holdings: { type: [holdingSchema], default: [] },
}, { timestamps: true });

export const PortfolioModel = mongoose.models.Portfolio || mongoose.model("Portfolio", portfolioSchema);
