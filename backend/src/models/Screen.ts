import mongoose, { Schema, InferSchemaType } from "mongoose";

const screenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, default: "Unnamed screen" },
    screenerType: { type: String, required: true, default: "stocks" },
    tab: { type: String, default: "overview" },
    columns: { type: [String], default: [] },
    filters: { type: Schema.Types.Mixed, default: {} },
    sort: { type: String, default: "marketCap" },
    order: { type: String, enum: ["asc", "desc"], default: "desc" },
    query: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

screenSchema.index({ userId: 1, name: 1 });

export type ScreenDocument = InferSchemaType<typeof screenSchema> & { _id: mongoose.Types.ObjectId };
export const ScreenModel = mongoose.models.Screen || mongoose.model("Screen", screenSchema);
