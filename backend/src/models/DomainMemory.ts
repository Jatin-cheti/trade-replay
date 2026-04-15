import mongoose, { InferSchemaType, Schema } from "mongoose";

const domainMemorySchema = new Schema(
  {
    symbol: { type: String, required: true, trim: true, uppercase: true, unique: true },
    baseSymbol: { type: String, required: true, trim: true, uppercase: true },
    domain: { type: String, required: true, trim: true, lowercase: true },
    confidence: { type: Number, required: true, default: 0.5 },
    source: { type: String, required: true, trim: true, lowercase: true },
    companyName: { type: String, required: true, trim: true },
    verified: { type: Boolean, required: true, default: false },
    verifiedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

domainMemorySchema.index({ baseSymbol: 1, confidence: -1 });

export type DomainMemoryDocument = InferSchemaType<typeof domainMemorySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DomainMemoryModel = mongoose.models.DomainMemory || mongoose.model("DomainMemory", domainMemorySchema);
