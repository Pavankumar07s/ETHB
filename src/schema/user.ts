import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  email: string;
  password: string;
  isVerified: boolean;
  verificationToken?: string | null;
  verificationTokenExpires?: Date | null;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false, // Don't include password in queries by default
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
      default: null,
    },
    verificationTokenExpires: {
      type: Date,
      select: false,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      select: false,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password as string, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

// Create indexes for better performance
UserSchema.index({ email: 1 });
UserSchema.index({ verificationToken: 1 });
UserSchema.index({ resetPasswordToken: 1 });

export const User = mongoose.model<IUser>("User", UserSchema);