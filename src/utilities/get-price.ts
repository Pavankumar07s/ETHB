import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const ONEINCH_API_KEY = process.env.ONEINCH_AUTH_KEY || "";

export async function getUsdPrice(
  chainId: number,
  tokenAddress: string,
  currency: string
) {

  const url = `https://api.1inch.dev/price/v1.1/${chainId}/${tokenAddress}`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${ONEINCH_API_KEY}` },
    params: {
      currency,
    },
    paramsSerializer: {
      indexes: null,
    },
  });
  return data;
}
