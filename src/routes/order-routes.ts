import { Router } from "express";
import dotenv from "dotenv";
import { Order, type IOrder } from "../schema/order.js";
import { OrderMapping } from "../schema/order-mapping.js";
import { chainExists } from "../utilities/chains.js";
import { authenticateToken } from "../middleware/auth.js";

dotenv.config();

const router = Router();

router.get("/health", (req, res) => {
  res.send("Hello from health check from order routes!");
});

// Get all orders for the authenticated user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: req.user!.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments({ user: req.user!.userId });
    const totalPages = Math.ceil(totalOrders / limit);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalOrders,
          hasMore: page < totalPages,
        },
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error fetching unsigned transaction",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Store 1inch order ID mapping to merchant order UUID
router.post("/mapping", async (req, res) => {
  try {
    const { merchantOrderUuid, quoteId, orderhash, secrets } = req.body;

    if (!merchantOrderUuid || !quoteId) {
      return res.status(400).json({
        success: false,
        message: "Both merchantOrderUuid and quoteId are required",
      });
    }

    // Verify that the merchant order exists and belongs to the user
    const order = await Order.findOne({
      uid: merchantOrderUuid,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Merchant order not found or unauthorized",
      });
    }

    // Check if mapping already exists
    const existingMappingQuote = await OrderMapping.findOne({
      quoteId: quoteId,
    });

    const existingMappingOrderhash = await OrderMapping.findOne({
      orderhash: orderhash,
    });

    if (existingMappingOrderhash || existingMappingQuote) {
      return res.status(409).json({
        success: false,
        message:
          "Mapping already exists for this Quote ID, try refreshing the page and try again.",
      });
    }

    // Create new mapping
    const mapping = new OrderMapping({
      merchantOrderUuid,
      orderhash,
      quoteId,
      secrets,
    });

    await mapping.save();

    res.status(201).json({
      success: true,
      message: "Order mapping created successfully",
      data: {
        merchantOrderUuid: mapping.merchantOrderUuid,
        quoteId: mapping.quoteId,
        createdAt: mapping.createdAt,
        orderhash: mapping.orderhash,
        expiresAt: mapping.expiresAt,
        secrets: mapping.secrets,
      },
    });
  } catch (error) {
    console.error("Error creating order mapping:", error);
    res.status(500).json({
      success: false,
      message: "Error creating order mapping",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  try {
    const orderData: Partial<IOrder> = req.body;

    if (!chainExists(String(orderData.outChain))) {
      return res.status(400).json({
        success: false,
        message: "chainout not supported",
      });
    }

    const newOrder = new Order({
      ...orderData,
      user: req.user!.userId, // Associate order with the authenticated user
      deadline: Math.floor(Date.now() / 1000) + orderData.deadlineSec!,
    });
    const savedOrder = await newOrder.save();

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      uid: savedOrder.uid,
      order: savedOrder,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error creating order",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Public route to get order details by UUID (no authentication required)
router.get("/public/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    const order = await Order.findOne({ uid: uid });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Return only the necessary fields for payment (without sensitive user data)
    const publicOrderData = {
      uid: order.uid,
      outChain: order.outChain,
      outToken: order.outToken,
      usdCents: order.usdCents,
      merchant: order.merchant,
      deadline: order.deadline,
      createdAt: order.createdAt,
      status: "pending", // Default status since orders don't have status field yet
    };

    res.json({
      success: true,
      order: publicOrderData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error fetching order",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/orderId/:uid", authenticateToken, async (req, res) => {
  try {
    const { uid } = req.params;

    // Only allow users to access their own orders
    const order = await Order.findOne({
      uid: uid,
      user: req.user!.userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      order: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error fetching order",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/status/orderId/:uid", authenticateToken, async (req, res) => {
  try {
    const { uid } = req.params;

    // Only allow users to access their own orders
    const order = await Order.findOne({
      uid: uid,
      user: req.user!.userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    
    let status = "UNKNOWN";
    if (
      order.oneinchStatus == "NONE" &&
      order.checkerJobStatus == "NOT-STARTED"
    ) {
      status = "PENDING";
    } else if (
      order.oneinchStatus == "NONE" &&
      order.checkerJobStatus == "INITIATED"
    ) {
      status = "PROCESSING";
    } else if (
      order.oneinchStatus == "EXECUTED" &&
      order.checkerJobStatus == "SUCCESS"
    ) {
      status = "COMPLETED";
    }

    res.json({
      success: true,
      order: order,
      status: status,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error fetching order",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
