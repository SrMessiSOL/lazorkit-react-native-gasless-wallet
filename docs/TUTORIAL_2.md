# Tutorial 2: Implementing Gasless Token Swaps with Lazorkit

## Overview

This tutorial demonstrates how to implement gasless token swaps on Solana using Lazorkit's paymaster service and Raydium DEX integration. Users can swap tokens without needing SOL for gas fees.

## What You'll Learn

- Fetching swap quotes from Raydium API
- Constructing swap transactions
- Executing gasless swaps with Lazorkit paymaster
- Handling versioned and legacy transactions
- Error handling and user feedback

## Prerequisites

Complete Tutorial 1 first - you'll need a connected passkey wallet.

## Step 1: Understanding Gasless Swaps

### How It Works

1. **User initiates swap**: Enters amount to swap (e.g., 1 USDC → SOL)
2. **App fetches quote**: Queries Raydium API for swap route and expected output
3. **Transaction construction**: Raydium API returns swap transaction instructions
4. **Lazorkit execution**: Paymaster covers gas fees, transaction executes
5. **User receives tokens**: Swap completes without user paying SOL for gas

### Key Concepts

- **Paymaster**: Service that pays transaction fees on behalf of users
- **DEX Integration**: Using Raydium for actual token swaps
- **Transaction Filtering**: Removing compute budget instructions for Lazorkit compatibility

## Step 2: Configure Token Constants

Define the tokens you'll support:

```typescript
// utils/constants.ts
export const TOKENS = {
  SOL: {
    symbol: 'SOL',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
  },
  USDC: {
    symbol: 'USDC',
    mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Devnet USDC
    decimals: 6,
  },
};
```

## Step 3: Fetch Swap Quote from Raydium

```typescript
import { DEV_API_URLS } from '@raydium-io/raydium-sdk-v2';

async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  decimals: number
) {
  // Convert to raw amount (e.g., 1 USDC = 1,000,000 raw)
  const amountRaw = Math.floor(amount * Math.pow(10, decimals));

  // Construct quote URL
  const quoteUrl = `${DEV_API_URLS.SWAP_HOST}/compute/swap-base-in?` +
    `inputMint=${inputMint}&` +
    `outputMint=${outputMint}&` +
    `amount=${amountRaw}&` +
    `slippageBps=50&` + // 0.5% slippage
    `txVersion=LEGACY`; // or V0 for versioned transactions

  const response = await fetch(quoteUrl);
  if (!response.ok) {
    throw new Error(`Quote API failed: ${response.status}`);
  }

  const quoteData = await response.json();
  if (!quoteData.success) {
    throw new Error(quoteData.msg || 'Quote failed');
  }

  return quoteData;
}
```

### Understanding the Quote Response

The quote contains:
- Expected output amount
- Price impact
- Route information
- Minimum output amount (accounting for slippage)

## Step 4: Request Swap Transaction

```typescript
async function getSwapTransaction(
  quoteResponse: any,
  walletAddress: string,
  inputMint: string,
  outputMint: string
) {
  const { Connection, PublicKey } = require('@solana/web3.js');
  const { getAssociatedTokenAddress } = require('@solana/spl-token');

  const connection = new Connection('https://api.devnet.solana.com');
  const wallet = new PublicKey(walletAddress);

  // Get token account addresses
  const inputMintPubkey = new PublicKey(inputMint);
  const outputMintPubkey = new PublicKey(outputMint);
  
  const inputAccount = await getAssociatedTokenAddress(
    inputMintPubkey,
    wallet,
    true // allowOwnerOffCurve for smart wallets
  );
  
  const outputAccount = await getAssociatedTokenAddress(
    outputMintPubkey,
    wallet,
    true
  );

  // Request swap transaction from Raydium
  const swapUrl = `${DEV_API_URLS.SWAP_HOST}/transaction/swap-base-in`;
  const response = await fetch(swapUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      computeUnitPriceMicroLamports: '100000',
      swapResponse: quoteResponse,
      txVersion: 'LEGACY',
      wallet: walletAddress,
      inputAccount: inputAccount.toBase58(),
      outputAccount: outputAccount.toBase58(),
      wrapSol: inputMint === TOKENS.SOL.mint, // Wrap SOL if swapping from SOL
      unwrapSol: outputMint === TOKENS.SOL.mint, // Unwrap to SOL if swapping to SOL
    }),
  });

  if (!response.ok) {
    throw new Error(`Swap transaction API failed: ${response.status}`);
  }

  const swapData = await response.json();
  if (!swapData.success) {
    throw new Error(swapData.msg || 'Transaction creation failed');
  }

  return swapData.data[0].transaction; // Base64-encoded transaction
}
```

## Step 5: Process Transaction for Lazorkit

Lazorkit requires transactions as instruction arrays, not serialized transactions. We need to deserialize and filter:

```typescript
import { Transaction, ComputeBudgetProgram } from '@solana/web3.js';

function processTransactionForLazorkit(transactionBase64: string) {
  // Deserialize transaction
  const txBuffer = Buffer.from(transactionBase64, 'base64');
  const legacyTx = Transaction.from(txBuffer);

  // Remove Compute Budget instructions (Lazorkit handles these)
  const filteredInstructions = legacyTx.instructions.filter(
    (ix) => !ix.programId.equals(ComputeBudgetProgram.programId)
  );

  return filteredInstructions;
}
```

### Why Filter Compute Budget Instructions?

- Raydium includes compute budget instructions to set priority fees
- Lazorkit's paymaster manages compute budget automatically
- Including them can cause conflicts or tx failures

## Step 6: Execute Gasless Swap

```typescript
import { useWallet } from '@lazorkit/wallet-mobile-adapter';

async function executeGaslessSwap(
  inputMint: string,
  outputMint: string,
  amount: number,
  decimals: number
) {
  const { signAndSendTransaction, smartWalletPubkey } = useWallet();

  if (!smartWalletPubkey) {
    throw new Error('Wallet not connected');
  }

  // Step 1: Get quote
  console.log('Fetching swap quote...');
  const quote = await getSwapQuote(inputMint, outputMint, amount, decimals);

  // Step 2: Get swap transaction
  console.log('Constructing swap transaction...');
  const transactionBase64 = await getSwapTransaction(
    quote,
    smartWalletPubkey.toBase58(),
    inputMint,
    outputMint
  );

  // Step 3: Process for Lazorkit
  const instructions = processTransactionForLazorkit(transactionBase64);

  // Step 4: Execute with paymaster
  console.log('Sending gasless transaction...');
  const signature = await signAndSendTransaction(
    {
      instructions,
      transactionOptions: {
        feeToken: 'So1111111111111111111111111111111111111112', // SOL pays gas (via paymaster)
        computeUnitLimit: 600_000, // High limit for complex swaps
        clusterSimulation: 'devnet',
      },
    },
    { redirectUrl: 'exp://YOUR_IP:8081' }
  );

  console.log('Swap successful:', signature);
  return signature;
}
```

### Transaction Options Explained

- **feeToken**: Token used to pay gas (paymaster covers this)
- **computeUnitLimit**: Maximum compute units for the transaction
- **clusterSimulation**: Network to simulate transaction on

## Step 7: Build User Interface

```typescript
import { useState } from 'react';
import { View, TextInput, Button, Alert, Text } from 'react-native';

export function SwapInterface() {
  const [inputAmount, setInputAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);

  const handleSwapUSDCToSOL = async () => {
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }

    setIsSwapping(true);
    try {
      const signature = await executeGaslessSwap(
        TOKENS.USDC.mint,
        TOKENS.SOL.mint,
        amount,
        TOKENS.USDC.decimals
      );
      Alert.alert('Success', `Swap completed! Signature: ${signature}`);
      setInputAmount('');
    } catch (error) {
      console.error('Swap error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
        Gasless Swap: USDC → SOL
      </Text>
      
      <TextInput
        placeholder="Amount of USDC"
        value={inputAmount}
        onChangeText={setInputAmount}
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
      />
      
      <Button
        title={isSwapping ? 'Swapping...' : 'Swap USDC → SOL'}
        onPress={handleSwapUSDCToSOL}
        disabled={isSwapping}
      />
    </View>
  );
}
```

## Step 8: Handle Versioned Transactions (V0)

For more efficient transactions, Raydium supports versioned transactions with address lookup tables:

```typescript
import {
  VersionedTransaction,
  TransactionMessage,
  AddressLookupTableAccount,
} from '@solana/web3.js';

async function processVersionedTransaction(
  transactionBase64: string,
  connection: Connection
) {
  // Deserialize V0 transaction
  const txBuffer = Buffer.from(transactionBase64, 'base64');
  const versionedTx = VersionedTransaction.deserialize(txBuffer);

  // Fetch address lookup tables
  const lutAddresses = versionedTx.message.addressTableLookups?.map(
    (lookup) => lookup.accountKey
  ) ?? [];

  const lookupTableAccounts: AddressLookupTableAccount[] = [];
  
  for (const address of lutAddresses) {
    const lutAccount = await connection.getAddressLookupTable(address);
    if (lutAccount.value) {
      lookupTableAccounts.push(lutAccount.value);
    }
  }

  // Decompile to instructions
  const decompiledMessage = TransactionMessage.decompile(
    versionedTx.message,
    { addressLookupTableAccounts: lookupTableAccounts }
  );

  // Filter out compute budget instructions
  const filteredInstructions = decompiledMessage.instructions.filter(
    (ix) => !ix.programId.equals(ComputeBudgetProgram.programId)
  );

  return {
    instructions: filteredInstructions,
    lookupTableAccounts,
  };
}
```

Then pass lookup tables to Lazorkit:

```typescript
const { instructions, lookupTableAccounts } = await processVersionedTransaction(
  transactionBase64,
  connection
);

const signature = await signAndSendTransaction(
  {
    instructions,
    transactionOptions: {
      computeUnitLimit: 600_000,
      clusterSimulation: 'devnet',
      addressLookupTableAccounts: lookupTableAccounts, // Include LUTs
    },
  },
  { redirectUrl: 'exp://YOUR_IP:8081' }
);
```

## Step 9: Add Loading States & Error Handling

```typescript
export function RobustSwapInterface() {
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwap = async () => {
    setIsSwapping(true);
    setError(null);

    try {
      const signature = await executeGaslessSwap(/* ... */);
      Alert.alert('Success', `Swap completed: ${signature}`);
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error occurred';
      setError(errorMessage);
      Alert.alert('Swap Failed', errorMessage);
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <View>
      {error && (
        <Text style={{ color: 'red', marginBottom: 10 }}>
          Error: {error}
        </Text>
      )}
      
      <Button
        title={isSwapping ? 'Swapping...' : 'Execute Swap'}
        onPress={handleSwap}
        disabled={isSwapping}
      />
    </View>
  );
}
```

## Key Takeaways

- **Paymaster Magic**: Users never need SOL for gas fees
- **DEX Integration**: Real swaps using Raydium's liquidity
- **Transaction Processing**: Filter compute budget instructions for compatibility
- **Error Handling**: Always handle API failures and user feedback
- **Versioned Transactions**: Support both Legacy and V0 for efficiency

## Testing Checklist

- [ ] Get USDC from faucet (https://faucet.circle.com/)
- [ ] Get SOL from devnet airdrop
- [ ] Test USDC → SOL swap
- [ ] Test SOL → USDC swap
- [ ] Verify balances update after swap
- [ ] Test with different amounts (0.1, 1, 10)
- [ ] Test error handling (insufficient balance)
- [ ] Verify transaction on Solana Explorer

## Common Issues

### "Insufficient balance" error
- Ensure you have enough tokens for the swap
- Remember: swaps are gasless but you still need input tokens

### "Slippage tolerance exceeded"
- Increase `slippageBps` in the quote request (50 = 0.5%)
- Market moved between quote and execution

### "Transaction timeout"
- Increase `computeUnitLimit` (try 800,000)
- Check network congestion on Devnet

### "Invalid instruction" error
- Verify you're filtering compute budget instructions
- Ensure all instruction accounts are valid

## Next Steps

- Add slippage configuration UI
- Show expected output amount before swap
- Implement swap history
- Add support for more token pairs
- Display real-time token prices

## Resources

- [Raydium SDK V2 Docs](https://github.com/raydium-io/raydium-sdk-V2)
- [Lazorkit Paymaster Guide](https://docs.lazorkit.com/paymaster)
- [Solana Versioned Transactions](https://solana.com/docs/core/transactions/versions)
