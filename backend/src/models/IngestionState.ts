import mongoose, { InferSchemaType, Schema } from "mongoose";

/**
 * Tracks per-provider ingestion progress for crash recovery.
 * After each batch, checkpoint is updated so re-runs skip completed work.
 */
const ingestionStateSchema = new Schema(
  {
    provider: { type: String, required: true, unique: true, trim: true },
    lastCursor: { type: String, default: "" },
    lastOffset: { type: Number, default: 0 },
    totalIngested: { type: Number, default: 0 },
    totalSkipped: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: null },
    lastBatchSize: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["idle", "running", "completed", "failed"],
      default: "idle",
    },
    error: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

ingestionStateSchema.index({ provider: 1 }, { unique: true });
ingestionStateSchema.index({ status: 1, lastSyncedAt: -1 });

export type IngestionStateDocument = InferSchemaType<typeof ingestionStateSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const IngestionStateModel =
  mongoose.models.IngestionState || mongoose.model("IngestionState", ingestionStateSchema);
