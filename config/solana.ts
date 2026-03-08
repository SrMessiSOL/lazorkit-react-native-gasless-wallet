import { Connection, clusterApiUrl } from "@solana/web3.js"

const heliusRpc = process.env.EXPO_PUBLIC_RPC_URL?.trim()

export const CLUSTER = "devnet"
export const RPC_URL = heliusRpc && heliusRpc.length > 0 ? heliusRpc : clusterApiUrl(CLUSTER)
export const PORTAL_URL = "https://portal.lazor.sh"
export const PAYMASTER_URL = "https://kora.devnet.lazorkit.com"

export const connection = new Connection(RPC_URL, "confirmed")
