import express from "express";
import { Order, type IOrder } from "../schema/order.js";
import { OrderMapping, type IOrderMapping } from "../schema/order-mapping.js";
import { getUsdPrice } from "../utilities/get-price.js";

import dotenv from "dotenv";
import { checkorderStatusJobSameChain } from "../utilities/check-status-job-same-chain.js";

dotenv.config();

const router = express.Router();

router.use("/", async (req, res) => {
  try {
    const upstream =
      "https://api.1inch.dev/fusion" +
      req.originalUrl.replace(/^\/api\/1inch\/same-chain-x/, "");

    // Prepare headers
    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.ONEINCH_AUTH_KEY!}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "1inch-fusion-sdk/1.0.0",
    };

    // Copy safe headers from original request (but don't override our core headers)
    const safeHeaders = ["accept"];
    for (const header of safeHeaders) {
      const value = req.get(header);
      if (value && !headers[header.toLowerCase()]) {
        headers[header.toLowerCase()] = value;
      }
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    let merchantOrder: IOrder | undefined | null;
    let orderhash: string | undefined;
    let oneInchOrder: any;
    let mapping: IOrderMapping | null | undefined;
    let merchantorderMongoDocument: IOrder | undefined | null;


    console.log("----------------reached here 1x")
   
    if (req.originalUrl.includes("submit")) {
        console.log("---------------reached here 2x")
      oneInchOrder = req.body.order;

      // Extract quoteId and find corresponding merchant order
      try {
        const quoteId = req.body?.quoteId;
        if (quoteId) {
          console.log("Looking for quoteId in mappings:", quoteId);

          // Search for mapping using the quoteId
          mapping = await OrderMapping.findOne({ quoteId: quoteId });

          if (mapping) {
            console.log("Found mapping:", {
              merchantOrderUuid: mapping.merchantOrderUuid,
              quoteId: mapping.quoteId,
            });

            // Find the corresponding merchant order
            merchantorderMongoDocument = await Order.findOne({
              uid: mapping.merchantOrderUuid,
            });
            orderhash = mapping.orderhash;

            console.log("Found orderhash in mapping:", orderhash);

            merchantOrder = merchantorderMongoDocument
              ? merchantorderMongoDocument.toObject()
              : undefined;

            if (merchantOrder) {
              // console.log("Found merchant order:", merchantOrder);
            } else {
              console.error(
                "Merchant order not found for UUID:",
                mapping.merchantOrderUuid
              );
            }
          } else {
            console.error("No mapping found for quoteId:", quoteId);
          }
        } else {
          console.error("No quoteId found in request body");
        }
      } catch (error) {
        console.error("Error looking up order mapping:", error);
      }
console.log("---------------reached here 3x")
      const merchantorderinChain = merchantOrder?.outChain;
      const merchantOrderInToken = merchantOrder?.outToken;
      const merchantOrderUsdCents = merchantOrder?.usdCents;
      const merchantOrderOutChain = merchantOrder?.outChain;
      const merchantOrderOutToken = merchantOrder?.outToken;
      const merchantOrderusdCents = merchantOrder?.usdCents;
      const merchantOrderDeadlineSec = merchantOrder?.deadlineSec;
      const merchantOrderUid = merchantOrder?.uid;

      const oneinchOrderBuyerChain = req.body.srcChainId;

      const oneInchOrderBuyerAddress = oneInchOrder.maker;
      const oneinchOrderBuyerAsset = oneInchOrder.makerAsset;
      const oneIchOrderBuyerAmount = Number(oneInchOrder.makingAmount);

      const oneInchorderMerchantAddress = oneInchOrder.receiver;
      const oneInchOrderMerchantAsset = oneInchOrder.takerAsset;
      const oneInchOrderMerchantAmount = Number(oneInchOrder.takingAmount);

      console.log("starting to fetch price for same-chain order");
    //   const [oneInchOrderBuyerAssetUsdprice] = Object.values(
    //     await getUsdPrice(
    //       Number(oneinchOrderBuyerChain),
    //       oneinchOrderBuyerAsset,
    //       "USD"
    //     )
    //   );
    //   const buyerAssetusdtotalvalueUsdValue =
    //     Number(oneInchOrderBuyerAssetUsdprice) * Number(oneIchOrderBuyerAmount);

      // Same-chain specific validation logic can be added here
      // For example, verify that source and destination chains are the same

      // For same-chain orders, we can calculate merchant asset price on the same chain
    //   const [oneInchOrderMerchantUsdprice] = Object.values(
    //     await getUsdPrice(
    //       Number(oneinchOrderBuyerChain), // Use buyer chain since it's same-chain
    //       oneInchOrderMerchantAsset,
    //       "USD"
    //     )
    //   );
    //   const merchantAssetusdtotalvalueUsdValue =
    //     Number(oneInchOrderMerchantUsdprice) *
    //     Number(oneInchOrderMerchantAmount);


    }

    // Add body for non-GET requests
    if (!/^(GET|HEAD)$/i.test(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(upstream, fetchOptions);
    const responseText = await response.text();
    
    if (req.originalUrl.includes("submit") && response.status === 201) {
      console.log("1inch same-chain order submission successful");
      console.log(mapping, merchantOrder, merchantorderMongoDocument)
      if (mapping && merchantOrder && merchantorderMongoDocument) {
        merchantorderMongoDocument.checkerJobStatus = "INITIATED";
        console.log("startinc check job for same chain...")
        checkorderStatusJobSameChain(
          orderhash!,
          mapping.quoteId,
          merchantOrder.user.toString(),
          mapping.merchantOrderUuid,
          Number(merchantOrder.outChain)
        );
        await merchantorderMongoDocument.save();
      }
    }

    res.status(response.status);
    console.log("Same-chain response status from 1inch:", response.status);

    const unsafeHeaders = [
      "transfer-encoding",
      "content-encoding",
      "connection",
      "keep-alive",
      "access-control-allow-origin",
      "access-control-allow-headers",
      "access-control-allow-methods",
    ];

    for (const [key, value] of response.headers) {
      if (!unsafeHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    // Add CORS headers - Allow all origins
    const origin = req.get("Origin");
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "authorization, content-type, accept"
    );
    res.setHeader("Vary", "Origin");

    // Try to parse as JSON for better error reporting
    if (response.status >= 400) {
      try {
        const errorData = JSON.parse(responseText);
        console.error("1inch Same-chain API Error:", errorData);
      } catch (e) {
        console.error("1inch Same-chain API Error (non-JSON):", responseText);
      }
    }

    res.send(responseText);
  } catch (error: any) {
    console.error("Same-chain proxy error:", error);
    res.status(500).json({
      error: "Same-chain proxy error",
      message: error.message,
      stack: error.stack,
    });
  }
});

// Handle preflight requests for same-chain - Allow all origins
router.options(/^\/api\/1inch\/.*/, (req, res) => {
  const origin = req.get("Origin");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, content-type, accept"
  );
  res.setHeader("Vary", "Origin");
  res.sendStatus(204);
});

export default router;
