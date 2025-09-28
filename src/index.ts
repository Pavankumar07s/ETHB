import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import orderRoutes from "./routes/order-routes.js";
import PriceRoutes from "./routes/price-routes.js";
import authRoutes from "./routes/auth-routes.js";
import oneInchRoutes from "./routes/oneinch-routes.js";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/bookgenerator";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err: any) => console.error("MongoDB connection error:", err));

app.get("/health", (req, res) => {
  res.send("Hello from health check from Index routes!");
});

// CORS configuration for authentication - Allow specific origins
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'https://ethf.onrender.com', // Your production frontend URL
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(cookieParser()); // Parse cookies
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Authentication routes (must be before protected routes)
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/order", orderRoutes);
app.use("/api/price", PriceRoutes);
app.use("/api/1inch", oneInchRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log("Environment variables:");
  console.log(
    "- ONEINCH_AUTH_KEY:",
    process.env.ONEINCH_AUTH_KEY ? "Set" : "Not set"
  );
  console.log("- MONGODB_URI:", MONGODB_URI);
});
