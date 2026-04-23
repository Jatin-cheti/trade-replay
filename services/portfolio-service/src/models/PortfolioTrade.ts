import mongoose, { InferSchemaType, Schema } from "mongoose";

const portfolioTradeSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, index: true },
    type: { type: String, enum: ["BUY", "SELL"], required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    total: { type: Number, required: true },
    realizedPnl: { type: Number, required: true, default: 0 },
    source: { type: String, required: true, default: "api" },
    eventId: { type: String, required: false },
    occurredAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

portfolioTradeSchema.index({ userId: 1, occurredAt: -1 });
portfolioTradeSchema.index({ userId: 1, updatedAt: -1 });
portfolioTradeSchema.index({ eventId: 1 }, { unique: true, sparse: true });

export type PortfolioTradeDocument = InferSchemaType<typeof portfolioTradeSchema> & { _id: mongoose.Types.ObjectId };

export const PortfolioTradeModel =
  mongoose.models.PortfolioTrade || mongoose.model("PortfolioTrade", portfolioTradeSchema);
