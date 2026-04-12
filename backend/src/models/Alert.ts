import mongoose, { Schema, InferSchemaType } from "mongoose";

const alertSchema = new Schema({
  userId: { type: String, required: true, index: true },
  symbol: { type: String, required: true, uppercase: true },
  condition: {
    type: String,
    required: true,
    enum: ["price_above","price_below","price_cross_above","price_cross_below","percent_change_above","percent_change_below"],
  },
  threshold: { type: Number, required: true },
  message: { type: String, default: "" },
  cooldownSec: { type: Number, default: 300 },
  fireOnce: { type: Boolean, default: false },
  active: { type: Boolean, default: true, index: true },
  lastTriggeredAt: { type: Date, default: null },
}, { timestamps: true });

alertSchema.index({ userId: 1, active: 1 });
alertSchema.index({ symbol: 1, active: 1 });

export type AlertDocument = InferSchemaType<typeof alertSchema> & { _id: mongoose.Types.ObjectId };

export const AlertModel = mongoose.models.Alert || mongoose.model("Alert", alertSchema);
