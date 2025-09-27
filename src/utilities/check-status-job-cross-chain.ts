import { SDK, OrderStatus } from "@1inch/cross-chain-sdk";
import dotenv from "dotenv";
import { Order } from "../schema/order.js";

dotenv.config();

const ONEINCH_AUTH_KEY = process.env.ONEINCH_AUTH_KEY as string;

export const checkorderStatusJobCrossChain = async (
  orderhash: string,
  quoteId: string,
  secrets: string[],
  merchantId: string,
  merchantOrderUuid: string
) => {
  if (!ONEINCH_AUTH_KEY) {
    console.error("ONEINCH_AUTH_KEY is not set in environment variables.");
    return;
  }
  console.log(
    `Starting order status check job for orderhash: ${orderhash}, quoteId: ${quoteId}, merchantOrderUuid: ${merchantOrderUuid}`
  );

  const merchantOrder = await Order.findOne({
    uid: merchantOrderUuid,
  });

  if (!merchantOrder) {
    console.error(`order with UID ${merchantOrderUuid} not found.`);
    return;
  }

  if (merchantOrder) {
    merchantOrder.checkerJobStatus = "INITIATED";
    await merchantOrder.save();
  }

  const client = new SDK({
    url: "https://api.1inch.dev/fusion-plus",
    authKey: ONEINCH_AUTH_KEY,
  });
  const { status } = await client.getOrderStatus(orderhash);
  if (status != OrderStatus.Pending) {
    console.log(
      "------------- ALERT !!Mallacius Request, Submitted a order hash which is already done, or executing or cancelled --------------"
    );
    return;
  }

  while (true) {
    const merchantOrder = await Order.findOne({
      uid: merchantOrderUuid,
    });
    const { fills } = await client.getReadyToAcceptSecretFills(orderhash);
    console.log("fills ready to accept secrets:", fills);

    if (fills.length) {
      for (const { idx } of fills) {
        // (Optional) Verify escrow addresses here before sharing the secret
        if (secrets[idx] !== undefined) {
          await client.submitSecret(orderhash, secrets[idx]);
          console.log("shared secret idx", idx);
        } else {
          console.warn(
            `Secret for idx ${idx} is undefined and was not submitted.`
          );
        }
      }
    }

    // Check terminal status
    const { status } = await client.getOrderStatus(orderhash);
    if (
      status === OrderStatus.Executed ||
      status === OrderStatus.Expired ||
      status === OrderStatus.Refunded
    ) {
      let statusStr: "EXECUTED" | "EXPIRED" | "REFUNDED" | "NONE" = "NONE";

      if (status === OrderStatus.Executed) {
        statusStr = "EXECUTED";
      } else if (status === OrderStatus.Expired) {
        statusStr = "EXPIRED";
      } else if (status === OrderStatus.Refunded) {
        statusStr = "REFUNDED";
      }

      if (merchantOrder) {
        merchantOrder.checkerJobStatus = "SUCCESS";
        merchantOrder.oneinchStatus = statusStr;
        await merchantOrder.save();
        console.log(
          `Order ${merchantOrder.uid} updated with oneinchStatus: ${statusStr}`
        );
      } else {
        console.warn("Merchant order not found, unable to update status.");
      }
      break;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
};
