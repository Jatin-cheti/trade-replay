import mongoose, { Schema, InferSchemaType } from "mongoose";

const tradeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  symbol: { type: String, required: true },
  type: { type: String, enum: ["BUY", "SELL"], required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  total: { type: Number, required: true },
  date: { type: String, required: true },
  realizedPnl: { type: Number, required: true, default: 0 },
}, { timestamps: true });

export type TradeDocument = InferSchemaType<typeof tradeSchema> & { _id: mongoose.Types.ObjectId };
export const TradeModel = mongoose.models.Trade || mongoose.model("Trade", tradeSchema);
