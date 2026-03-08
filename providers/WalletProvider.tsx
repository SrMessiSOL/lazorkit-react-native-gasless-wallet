import { LazorKitProvider } from "@lazorkit/wallet-mobile-adapter"
import { FC, PropsWithChildren, useMemo } from "react"
import { PAYMASTER_URL, PORTAL_URL, RPC_URL } from "../config/solana"

export const WalletProvider: FC<PropsWithChildren> = ({ children }) => {
  const config = useMemo(
    () => ({
      rpcUrl: RPC_URL,
      portalUrl: PORTAL_URL,
      configPaymaster: { paymasterUrl: PAYMASTER_URL },
    }),
    [],
  )

  return <LazorKitProvider {...config}>{children}</LazorKitProvider>
}
