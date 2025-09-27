import { Schema, model, Document } from "mongoose";

export interface IOrderMapping extends Document {
  merchantOrderUuid: string;
  quoteId: string;
  orderhash: string;
  createdAt: Date;
  expiresAt: Date;
  secrets?: string[];  // optional in case of cross chain orders only
}

const orderMappingSchema = new Schema<IOrderMapping>({
  merchantOrderUuid: {
    type: String,
    required: true,
  },

  quoteId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  orderhash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  secrets: {   // optional in case of cross chain orders only
    type: [String],
    required: false,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    index: { expireAfterSeconds: 0 }, // MongoDB TTL index for automatic deletion
  },
});

// Create TTL index for automatic deletion
orderMappingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OrderMapping = model<IOrderMapping>(
  "OrderMapping",
  orderMappingSchema
);
