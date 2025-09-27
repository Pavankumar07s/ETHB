import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IOrder extends Document {
  uid: string;
  user: mongoose.Types.ObjectId; // Reference to the user who created the order
  merchant: string;
  outToken: string;
  outChain: string;
  usdCents: number;
  deadlineSec: number;
  deadline: number; // Computed deadline timestamp
  createdAt?: Date;
  updatedAt?: Date;
  checkinitiated: boolean;
  checkerJobStatus: "INITIATED" | "SUCCESS" | "FAILED" | "NOT-STARTED";
  oneinchStatus: "EXECUTED" | "EXPIRED" | "REFUNDED" | "NONE";
}

const OrderSchema: Schema = new Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    merchant: {
      type: String,
      required: true,
      trim: true,
    },
    outToken: {
      type: String,
      required: true,
      trim: true,
    },
    checkinitiated: {
      type: Boolean,
      default: false,
      required: true,
    },
    outChain: {
      type: String,
      required: true,
      trim: true,
    },
    usdCents: {
      type: Number,
      required: true,
      min: 0,
    },
    deadlineSec: {
      type: Number,
      required: true,
      min: 0,
    },
    deadline: {
      type: Number,
      required: false, // Will be computed in the route
    },
    checkerJobStatus: {
      type: String,
      enum: ["INITIATED", "SUCCESS", "FAILED", "NOT-STARTED"],
      default: "NOT-STARTED",
      required: false,
    },
    oneinchStatus: {
      type: String,
      enum: ["EXECUTED", "EXPIRED", "REFUNDED", "NONE"],
      default: "NONE",
      required: false,
    },
  },
  {
    timestamps: true, // This will automatically add createdAt and updatedAt fields
  }
);

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
