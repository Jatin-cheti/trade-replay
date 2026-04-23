import mongoose, { InferSchemaType, Schema } from "mongoose";

const positionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, index: true },
    quantity: { type: Number, required: true, default: 0 },
    avgPrice: { type: Number, required: true, default: 0 },
    currentPrice: { type: Number, required: true, default: 0 },
    marketValue: { type: Number, required: true, default: 0 },
    unrealizedPnl: { type: Number, required: true, default: 0 },
    realizedPnl: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN", index: true },
    closedAt: { type: Date },
  },
  { timestamps: true },
);

positionSchema.index({ userId: 1, symbol: 1 }, { unique: true });
positionSchema.index({ userId: 1, updatedAt: -1 });

export type PositionDocument = InferSchemaType<typeof positionSchema> & { _id: mongoose.Types.ObjectId };

export const PositionModel = mongoose.models.Position || mongoose.model("Position", positionSchema);
