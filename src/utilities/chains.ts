import CHAINS from "../constants/chain.js";

type ChainId = keyof typeof CHAINS;

export function chainExists(chainId: string | number): chainId is ChainId {
  return Object.prototype.hasOwnProperty.call(CHAINS, String(chainId));
}
