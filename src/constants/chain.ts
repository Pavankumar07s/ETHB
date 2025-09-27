import { NetworkEnum } from "@1inch/fusion-sdk";

const CHAINS = {
  "1": {
    chainid: "1",
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    fusionEnum: NetworkEnum.ETHEREUM,
  },
    "137": {
    chainid: "137",
    symbol: "POL",
    name: "Polygon",
    decimals: 18,
    fusionEnum: NetworkEnum.POLYGON,
  },
  "43114": {
    chainid: "43114",
    name: "Avalanche",
    symbol: "AVAX",
    decimals: 18,
    fusionEnum: NetworkEnum.AVALANCHE,
  },
  "8453": {
    chainid: "8453",
    name: "base",
    symbol: "ETH",
    decimals: 18,
    fusionEnum: NetworkEnum.COINBASE,
  },
  "56": {
    chainid: "56",
    name: "Binance Smart Chain",
    symbol: "BNB",
    decimals: 18,
    fusionEnum: NetworkEnum.BINANCE,
  },
  "324": {
    chainid: "324",
    name: "Zk Sync",
    symbol: "ETH",
    decimals: 18,
    fusionEnum: NetworkEnum.ZKSYNC,
  },
};

export default CHAINS;
