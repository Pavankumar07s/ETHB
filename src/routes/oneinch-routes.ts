import express from "express";
import crossChainRoutes from "./oneinch-cross-chain-routes.js";
import sameChainRoutes from "./oneinch-same-chain-routes.js";

const router = express.Router();

// Mount the separate route modules
router.use("/cross-chain-x", crossChainRoutes);
router.use("/same-chain-x", sameChainRoutes);

export default router;