# Lazorkit Mobile Wallet Example

A professional React Native (Expo) example demonstrating **Lazorkit SDK** integration for gasless Solana transactions with passkey authentication. This starter template showcases real-world usage of Lazorkit's key features: biometric wallet creation, gasless swaps, and token transfers.

## Features

- **Passkey Authentication**: Create and access Solana smart wallets using device biometrics (Face ID, Touch ID, or fingerprint)
- **Gasless Transactions**: Swap SOL ↔ USDC without paying gas fees using Lazorkit's paymaster
- **Native Mobile Wallet UI**: Professional wallet interface with balance display, transaction history, and swap interface
- **Raydium Integration**: Real DEX swaps using Raydium's liquidity pools on Solana Devnet
- **No Seed Phrases**: Eliminates traditional seed phrase complexity - users authenticate with their device biometrics

## Live Demo

Deployed on Devnet: [Coming Soon]

## Tech Stack

- **Lazorkit SDK** (`@lazorkit/wallet-mobile-adapter`) - Passkey wallet & gasless transactions
- **React Native** (Expo) - Cross-platform mobile framework
- **Solana Web3.js** - Solana blockchain interactions
- **Raydium SDK** - DEX swap integration
- **TypeScript** - Type-safe development

## Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator
- Physical device recommended for biometric testing

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/lazorkit-mobile-wallet.git
cd lazorkit-mobile-wallet
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
# Optional: Custom RPC endpoint (defaults to Helius Devnet)
EXPO_PUBLIC_RPC_URL=https://api.devnet.solana.com
```

### 3. Run the App

```bash
# Start Expo dev server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### 4. Update Redirect URL

In `app/index.tsx`, replace the hardcoded redirect URL with your development URL:

```typescript
// Find this line
await connect({ redirectUrl: 'exp://myapp' });

// Replace with your local IP from Expo CLI output
await connect({ redirectUrl: 'exp://myapp' });
```

## Project Structure

```
├── app/
│   ├── index.tsx             # Main wallet screen
│   └── _layout.tsx           # Root layout with providers
├── assets/
│   ├── fonts/                # Fonts 
│   └── images/               # Images
├── config/
│   ├── solana.ts             # Solana RPC Connection
├── constants/
│   ├── Colors.ts             # Colors
│   └── tokens.ts             # Token addresses & config
├── docs/
│     ├── TUTORIAL_1.md       # Tutorial 1
│     └── TUTORIAL_2.md       # Tutorial 2
├── providers/
│   └── WalletProvider.tsx    # Walle configuration
```

## Tutorials

### Tutorial 1: Creating a Passkey-Based Wallet

Learn how to integrate Lazorkit's passkey authentication to create a smart wallet without seed phrases.

[Read Tutorial 1 →](./docs/TUTORIAL_1.md)

### Tutorial 2: Implementing Gasless Swaps

Step-by-step guide to enabling gasless token swaps using Lazorkit's paymaster and Raydium DEX.

[Read Tutorial 2 →](./docs/TUTORIAL_2.md)

## Key SDK Integration Points

### 1. Wallet Provider Setup

```typescript
import { LazorKitProvider } from '@lazorkit/wallet-mobile-adapter';

<LazorKitProvider
  rpcUrl="https://api.devnet.solana.com"
  portalUrl="https://portal.lazor.sh"
  configPaymaster={{ paymasterUrl: "https://kora.devnet.lazorkit.com" }}
>
  {children}
</LazorKitProvider>
```

### 2. Passkey Authentication

```typescript
import { useWallet } from '@lazorkit/wallet-mobile-adapter';

const { connect, isConnected, smartWalletPubkey } = useWallet();

// Connect with biometrics
await connect({ redirectUrl: 'exp://myapp' });
```

### 3. Gasless Transaction

```typescript
const signature = await signAndSendTransaction(
  {
    instructions: [/* your instructions */],
    transactionOptions: {
      feeToken: 'So1111111111111111111111111111111111111112', // SOL
      computeUnitLimit: 600_000,
      clusterSimulation: 'devnet',
    },
  },
  { redirectUrl: 'exp://myapp' }
);
```

## How It Works

1. **Passkey Creation**: User taps "Connect with Biometrics" → Device prompts for biometric auth → Lazorkit creates a smart wallet tied to the device's secure enclave
2. **Gasless Swaps**: User enters swap amount → App fetches Raydium quote → Lazorkit pays gas fees via paymaster → Transaction succeeds without user holding SOL for gas
3. **Persistent Session**: Wallet session persists across app restarts using AsyncStorage

## Testing on Devnet

### Get Test Tokens

1. **SOL Airdrop**: Tap "Claim Airdrop" in the app
2. **USDC Tokens**: Tap "Claim USDC Faucet" → Opens Circle's faucet → Paste your wallet address

### Try Gasless Swaps

1. Ensure you have USDC or SOL balance
2. Enter swap amount in the "Gasless Swaps" section
3. Tap "Swap USDC → SOL" or "Swap SOL → USDC"
4. Confirm with biometrics → Transaction executes without gas fees

## Configuration

### Custom RPC Endpoint

Update the `rpcUrl` in `app/index.tsx`:

```typescript
<LazorKitProvider
  rpcUrl="https://your-custom-rpc.com"
  // ...
>
```

### Custom Paymaster

To use your own paymaster service:

```typescript
<LazorKitProvider
  configPaymaster={{ paymasterUrl: "https://your-paymaster.com" }}
  // ...
>
```

## Deployment

### Build for Production

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

### Deploy to App Stores

See [Expo's deployment guide](https://docs.expo.dev/distribution/introduction/)

## Common Issues

### Biometric Auth Not Working

- **Solution**: Test on a physical device, not an emulator
- Emulators don't have real biometric hardware

### Redirect URL Errors

- **Solution**: Update all `redirectUrl` values to match your Expo dev server URL
- Check Expo CLI output for the correct URL

### Transaction Timeouts

- **Solution**: Increase `computeUnitLimit` in transaction options
- Raydium swaps may need 600,000+ compute units

## Resources

- **Lazorkit Docs**: [https://docs.lazorkit.com/](https://docs.lazorkit.com/)
- **Lazorkit GitHub**: [https://github.com/lazor-kit/lazor-kit](https://github.com/lazor-kit/lazor-kit)
- **Telegram Community**: [https://t.me/lazorkit](https://t.me/lazorkit)
- **Raydium SDK**: [https://github.com/raydium-io/raydium-sdk-V2](https://github.com/raydium-io/raydium-sdk-V2)

## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT License - feel free to use this starter template for your projects.

## Support

- GitHub Issues: [Report bugs or request features]
- Telegram: [@lazorkit](https://t.me/lazorkit)

---

**Built for the Lazorkit Bounty Program**  
Demonstrating professional SDK integration for gasless Solana transactions with passkey authentication.
