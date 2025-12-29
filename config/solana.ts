import { Connection } from "@solana/web3.js";

export const RPC_URL =
  "https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY";

export const connection = new Connection(RPC_URL, "confirmed");
