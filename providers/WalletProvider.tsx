import { LazorKitProvider } from '@lazorkit/wallet-mobile-adapter';
import { FC, PropsWithChildren, useMemo } from 'react';

export const WalletProvider: FC<PropsWithChildren> = ({ children }) => {
  const config = useMemo(() => ({
    rpcUrl: 'https://api.devnet.solana.com',  // Reliable Devnet RPC
    portalUrl: 'https://portal.lazor.sh',
    configPaymaster: { paymasterUrl: 'https://lazorkit-paymaster.onrender.com' },  // Switch back to original
  }), []);

  return (
    <LazorKitProvider {...config}>
      {children}
    </LazorKitProvider>
  );
};