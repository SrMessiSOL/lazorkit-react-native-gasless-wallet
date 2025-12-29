# Tutorial 1: Creating a Passkey-Based Wallet with Lazorkit

## Overview

This tutorial demonstrates how to create a Solana smart wallet using passkey authentication (biometrics) instead of traditional seed phrases. Users can authenticate with Face ID, Touch ID, or fingerprint to access their wallet securely.

## What You'll Learn

- Setting up the Lazorkit Provider
- Implementing passkey-based wallet connection
- Handling wallet state and persistence
- Displaying wallet information

## Step 1: Install Dependencies

First, install the required Lazorkit packages:

```bash
npm install @lazorkit/wallet-mobile-adapter @lazorkit/wallet
```

For React Native, also install required polyfills:

```bash
npm install buffer react-native-get-random-values @react-native-async-storage/async-storage
```

## Step 2: Configure the Lazorkit Provider

Wrap your app with `LazorKitProvider` to enable wallet functionality:

```typescript
import { LazorKitProvider } from '@lazorkit/wallet-mobile-adapter';
import { SafeAreaView } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LazorKitProvider
        rpcUrl="https://api.devnet.solana.com"
        portalUrl="https://portal.lazor.sh"
        configPaymaster={{ paymasterUrl: "https://kora.devnet.lazorkit.com" }}
      >
        {/* Your app components */}
      </LazorKitProvider>
    </SafeAreaView>
  );
}
```

### Provider Configuration

- **rpcUrl**: Solana RPC endpoint (use devnet for testing)
- **portalUrl**: Lazorkit's authentication portal
- **configPaymaster**: Paymaster service for gasless transactions

## Step 3: Implement Passkey Connection

Create a component that handles wallet connection:

```typescript
import { useWallet } from '@lazorkit/wallet-mobile-adapter';
import { Button, Alert } from 'react-native';
import { useState } from 'react';

function WalletConnect() {
  const { connect, isConnected, smartWalletPubkey } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // Trigger passkey authentication
      await connect({ 
        redirectUrl: 'exp://YOUR_LOCAL_IP:8081' 
      });
      Alert.alert('Success', 'Wallet connected with passkey!');
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Error', 'Failed to connect: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      title={isLoading ? 'Connecting...' : 'Connect with Biometrics'}
      onPress={handleConnect}
      disabled={isLoading || isConnected}
    />
  );
}
```

### Understanding the Connection Flow

1. User taps "Connect with Biometrics"
2. App calls `connect()` with a redirect URL
3. Lazorkit opens the authentication portal
4. User authenticates with device biometrics
5. Lazorkit creates a smart wallet tied to the passkey
6. App redirects back with wallet connection established

### Important: Redirect URL

The `redirectUrl` must match your Expo development server URL:

```typescript
// Get your URL from Expo CLI output
// Example: exp://192.168.1.100:8081
await connect({ redirectUrl: 'exp://YOUR_IP:8081' });
```

## Step 4: Display Wallet Information

Once connected, display the wallet address and status:

```typescript
import { Text, View, Button } from 'react-native';
import * as Clipboard from 'expo-clipboard';

function WalletInfo() {
  const { smartWalletPubkey, isConnected } = useWallet();

  const handleCopyAddress = async () => {
    if (smartWalletPubkey) {
      await Clipboard.setStringAsync(smartWalletPubkey.toBase58());
      Alert.alert('Copied', 'Wallet address copied!');
    }
  };

  if (!isConnected) {
    return <Text>Not connected</Text>;
  }

  return (
    <View>
      <Text>Connected Wallet</Text>
      <Text>{smartWalletPubkey?.toBase58()}</Text>
      <Button title="Copy Address" onPress={handleCopyAddress} />
    </View>
  );
}
```

## Step 5: Persist Wallet Session

Use AsyncStorage to maintain wallet state across app restarts:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

function useWalletSession() {
  const { isConnected, smartWalletPubkey } = useWallet();

  // Save session when connected
  useEffect(() => {
    if (isConnected && smartWalletPubkey) {
      AsyncStorage.setItem('wallet_connected', 'true');
    }
  }, [isConnected, smartWalletPubkey]);

  // Check for existing session on mount
  useEffect(() => {
    AsyncStorage.getItem('wallet_connected').then((value) => {
      if (value === 'true' && !isConnected) {
        // Session exists but not connected - may need to reconnect
        console.log('Previous session found');
      }
    });
  }, []);
}
```

## Step 6: Implement Disconnect

Allow users to disconnect their wallet:

```typescript
import { useWallet } from '@lazorkit/wallet-mobile-adapter';

function DisconnectButton() {
  const { disconnect } = useWallet();

  const handleDisconnect = async () => {
    try {
      await disconnect();
      await AsyncStorage.removeItem('wallet_connected');
      Alert.alert('Success', 'Wallet disconnected');
    } catch (error) {
      Alert.alert('Error', 'Failed to disconnect');
    }
  };

  return <Button title="Disconnect" onPress={handleDisconnect} />;
}
```

## Complete Example

Here's a complete wallet connection component:

```typescript
import { useWallet } from '@lazorkit/wallet-mobile-adapter';
import { View, Button, Text, Alert, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

export function PasskeyWallet() {
  const { connect, disconnect, isConnected, smartWalletPubkey } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await connect({ redirectUrl: 'exp://YOUR_LOCAL_IP:8081' });
      await AsyncStorage.setItem('wallet_connected', 'true');
      Alert.alert('Success', 'Wallet connected!');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    await AsyncStorage.removeItem('wallet_connected');
  };

  const copyAddress = async () => {
    if (smartWalletPubkey) {
      await Clipboard.setStringAsync(smartWalletPubkey.toBase58());
      Alert.alert('Copied!');
    }
  };

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Connect Your Wallet</Text>
        <Button
          title={isLoading ? 'Connecting...' : 'Connect with Biometrics'}
          onPress={handleConnect}
          disabled={isLoading}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wallet Connected</Text>
      <Text style={styles.address}>
        {smartWalletPubkey?.toBase58()}
      </Text>
      <Button title="Copy Address" onPress={copyAddress} />
      <Button title="Disconnect" onPress={handleDisconnect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  address: {
    fontSize: 12,
    marginVertical: 10,
  },
});
```

## Key Takeaways

- **No Seed Phrases**: Users never see or manage seed phrases
- **Device-Specific**: Wallets are tied to device biometrics via passkeys
- **Smart Wallets**: Lazorkit creates smart contract wallets, not standard keypairs
- **Persistent Sessions**: Use AsyncStorage to maintain connection state
- **Redirect Handling**: Always provide correct redirect URL for your environment

## Testing

1. Run the app on a **physical device** (biometrics don't work in emulators)
2. Tap "Connect with Biometrics"
3. Authenticate with Face ID/Touch ID/fingerprint
4. Verify wallet address is displayed
5. Copy the address and check it on Solana Explorer (Devnet)

## Next Steps

- **Tutorial 2**: Learn how to implement gasless token swaps
- Add balance fetching to display SOL and token balances
- Implement transaction history
- Add support for multiple tokens

## Troubleshooting

### "Redirect failed" error
- Verify your redirect URL matches your Expo dev server
- Check Expo CLI output for the correct URL

### Biometrics not prompting
- Ensure you're testing on a physical device
- Check device settings for biometric authentication

### Connection timeout
- Verify your RPC endpoint is accessible
- Check network connectivity

## Resources

- [Lazorkit Wallet Adapter Docs](https://docs.lazorkit.com/wallet-adapter)
- [Solana Web3.js Guide](https://solana.com/docs/clients/javascript)
- [Expo Linking API](https://docs.expo.dev/guides/linking/)
