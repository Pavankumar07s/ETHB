import {
  FusionSDK,
  NetworkEnum,
  OrderStatus,
  PrivateKeyProviderConnector,
} from "@1inch/fusion-sdk";
import { computeAddress, formatUnits, JsonRpcProvider } from "ethers";
import dotenv from "dotenv";
import { Order } from "../schema/order.js";

dotenv.config();

const ONEINCH_AUTH_KEY = process.env.ONEINCH_AUTH_KEY as string;

export const checkorderStatusJobSameChain = async (
  orderhash: string,
  quoteId: string,
  merchantId: string,
  merchantOrderUuid: string,
  chain : number
) => {
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

  const client = new FusionSDK({
    url: "https://api.1inch.dev/fusion",
    network: chain,
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
    console.log("checking....")
    const merchantOrder = await Order.findOne({
      uid: merchantOrderUuid,
    });
    const data = await client.getOrderStatus(orderhash);
console.log(data.status)
    if (
      data.status === OrderStatus.Filled ||
      data.status === OrderStatus.Expired ||
      data.status === OrderStatus.Cancelled
    ) {
      let statusStr: "EXECUTED" | "EXPIRED" | "REFUNDED" | "NONE" = "NONE";

      if (data.status === OrderStatus.Filled) {
        statusStr = "EXECUTED";
      } else if (data.status === OrderStatus.Expired) {
        statusStr = "EXPIRED";
      } else if (data.status === OrderStatus.Cancelled) {
        statusStr = "REFUNDED";
      }

      if (merchantOrder ) {
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
