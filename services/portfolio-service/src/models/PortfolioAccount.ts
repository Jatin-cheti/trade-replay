import mongoose, { InferSchemaType, Schema } from "mongoose";

const portfolioAccountSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    currency: { type: String, enum: ["USD", "INR", "EUR", "GBP", "JPY"], default: "USD" },
    cashBalance: { type: Number, required: true, default: 100000 },
    realizedPnl: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export type PortfolioAccountDocument = InferSchemaType<typeof portfolioAccountSchema> & { _id: mongoose.Types.ObjectId };

export const PortfolioAccountModel =
  mongoose.models.PortfolioAccount || mongoose.model("PortfolioAccount", portfolioAccountSchema);
