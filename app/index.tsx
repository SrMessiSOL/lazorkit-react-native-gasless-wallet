import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as anchor from '@coral-xyz/anchor';
import { LazorKitProvider, useWallet } from '@lazorkit/wallet-mobile-adapter';

const DEVNET_RPC_URL = 'https://api.devnet.solana.com';
const PORTAL_URL = 'https://portal.lazor.sh';
const PAYMASTER_URL = 'https://lazorkit-paymaster.onrender.com';
const REDIRECT_HOME = 'exp://192.168.0.106:8081';
const REDIRECT_SIGN = 'prowallet://callback';

const SOL_LAMPORTS = 1_000_000_000;

function WalletPanel() {
  const {
    connect,
    disconnect,
    signAndSendTransaction,
    smartWalletPubkey,
    connection,
    isConnected,
    isConnecting,
    isSigning,
  } = useWallet();

  const [recipient, setRecipient] = useState('');
  const [amountSol, setAmountSol] = useState('0.01');
  const [balanceSol, setBalanceSol] = useState('0.0000');
  const [lastSignature, setLastSignature] = useState('');

  const walletAddress = useMemo(() => smartWalletPubkey?.toBase58() ?? '-', [smartWalletPubkey]);

  const refreshBalance = useCallback(async () => {
    if (!smartWalletPubkey) return;
    const lamports = await connection.getBalance(smartWalletPubkey, 'confirmed');
    setBalanceSol((lamports / SOL_LAMPORTS).toFixed(4));
  }, [connection, smartWalletPubkey]);

  const onConnect = useCallback(async () => {
    await connect({ redirectUrl: REDIRECT_HOME });
    await refreshBalance();
  }, [connect, refreshBalance]);

  const onDisconnect = useCallback(async () => {
    await disconnect();
    setLastSignature('');
    setBalanceSol('0.0000');
  }, [disconnect]);

  const onSend = useCallback(async () => {
    if (!smartWalletPubkey) {
      Alert.alert('Connect first', 'Please connect your wallet before sending.');
      return;
    }

    const to = new anchor.web3.PublicKey(recipient.trim());
    const lamports = Math.round(Number(amountSol) * SOL_LAMPORTS);

    if (!Number.isFinite(lamports) || lamports <= 0) {
      throw new Error('Invalid transfer amount');
    }

    const transferIx = anchor.web3.SystemProgram.transfer({
      fromPubkey: smartWalletPubkey,
      toPubkey: to,
      lamports,
    });

    const signature = await signAndSendTransaction(
      {
        instructions: [transferIx],
        transactionOptions: {
          clusterSimulation: 'devnet',
          computeUnitLimit: 300_000,
          feeToken: 'So11111111111111111111111111111111111111112',
        },
      },
      { redirectUrl: REDIRECT_SIGN },
    );

    setLastSignature(signature);
    await refreshBalance();
  }, [amountSol, recipient, refreshBalance, signAndSendTransaction, smartWalletPubkey]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Seedless + Gasless Solana Wallet</Text>
      <Text style={styles.caption}>Address: {walletAddress}</Text>
      <Text style={styles.caption}>Balance: {balanceSol} SOL</Text>

      <View style={styles.row}>
        <AppButton
          title={isConnected ? 'Refresh' : 'Connect'}
          busy={isConnecting}
          onPress={isConnected ? refreshBalance : onConnect}
        />
        <AppButton title="Disconnect" disabled={!isConnected} onPress={onDisconnect} />
      </View>

      <TextInput
        style={styles.input}
        value={recipient}
        onChangeText={setRecipient}
        placeholder="Recipient wallet"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        value={amountSol}
        onChangeText={setAmountSol}
        placeholder="Amount (SOL)"
        keyboardType="decimal-pad"
      />

      <AppButton
        title={isSigning ? 'Sending…' : 'Send Gasless'}
        disabled={!isConnected || isSigning}
        onPress={onSend}
      />

      {lastSignature ? <Text style={styles.signature}>Last signature: {lastSignature}</Text> : null}
    </View>
  );
}

function AppButton({
  title,
  onPress,
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
}) {
  const handlePress = useCallback(async () => {
    try {
      await onPress();
    } catch (error) {
      Alert.alert('Action failed', error instanceof Error ? error.message : String(error));
    }
  }, [onPress]);

  return (
    <Pressable style={[styles.button, disabled && styles.buttonDisabled]} disabled={disabled || busy} onPress={handlePress}>
      <Text style={styles.buttonLabel}>{title}</Text>
    </Pressable>
  );
}

export default function ProfessionalSeedlessGaslessWallet() {
  return (
    <LazorKitProvider
      rpcUrl={DEVNET_RPC_URL}
      portalUrl={PORTAL_URL}
      configPaymaster={{ paymasterUrl: PAYMASTER_URL }}
      isDebug
    >
      <View style={styles.page}>
        <WalletPanel />
      </View>
    </LazorKitProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fafafa',
  },
  caption: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3f3f46',
    color: '#fafafa',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  signature: {
    color: '#86efac',
    fontSize: 12,
  },
});
