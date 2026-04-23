import mongoose, { InferSchemaType, Schema } from "mongoose";

const allocationSchema = new Schema(
  {
    symbol: { type: String, required: true },
    weight: { type: Number, required: true },
    marketValue: { type: Number, required: true },
  },
  { _id: false },
);

const portfolioSnapshotSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    totalValue: { type: Number, required: true },
    cashBalance: { type: Number, required: true },
    investedValue: { type: Number, required: true },
    dailyPnl: { type: Number, required: true, default: 0 },
    unrealizedPnl: { type: Number, required: true, default: 0 },
    realizedPnl: { type: Number, required: true, default: 0 },
    allocations: { type: [allocationSchema], default: [] },
    generatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

portfolioSnapshotSchema.index({ userId: 1, generatedAt: -1 });
portfolioSnapshotSchema.index({ userId: 1, updatedAt: -1 });

export type PortfolioSnapshotDocument = InferSchemaType<typeof portfolioSnapshotSchema> & { _id: mongoose.Types.ObjectId };

export const PortfolioSnapshotModel =
  mongoose.models.PortfolioSnapshot || mongoose.model("PortfolioSnapshot", portfolioSnapshotSchema);
