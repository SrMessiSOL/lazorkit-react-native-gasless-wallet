import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as anchor from '@coral-xyz/anchor';
import { LinearGradient } from 'expo-linear-gradient';
import { LazorKitProvider, useWallet } from '@lazorkit/wallet-mobile-adapter';

const DEVNET_RPC_URL = 'https://api.devnet.solana.com';
const PORTAL_URL = 'https://portal.lazor.sh';
const PAYMASTER_URL = 'https://lazorkit-paymaster.onrender.com';
const REDIRECT_HOME = 'exp://192.168.0.106:8081';
const REDIRECT_SIGN = 'prowallet://callback';

const SOL_LAMPORTS = 1_000_000_000;

function LoginScreen({ onConnect, busy }: { onConnect: () => void | Promise<void>; busy?: boolean }) {
  return (
    <View style={styles.loginCard}>
      <View style={styles.logoRing}>
        <Image source={require('../assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
      </View>

      <Text style={styles.brandName}>LazorKit Wallet Pro</Text>
      <Text style={styles.brandSubtitle}>Seedless access. Gasless execution. Institutional-grade mobile UX.</Text>

      <Pressable style={[styles.ctaButton, busy && styles.buttonDisabled]} onPress={onConnect} disabled={busy}>
        <LinearGradient colors={['#ef4444', '#fca5a5', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGradient}>
          <Text style={styles.ctaLabel}>{busy ? 'Opening Lazor Login…' : 'Connect with LazorKit'}</Text>
        </LinearGradient>
      </Pressable>

      <Text style={styles.helperText}>You will be redirected to Lazor login to choose your wallet provider.</Text>
    </View>
  );
}

function WalletPanel({ onDisconnected }: { onDisconnected: () => void }) {
  const {
    disconnect,
    signAndSendTransaction,
    smartWalletPubkey,
    connection,
    isConnected,
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

  useEffect(() => {
    if (isConnected && smartWalletPubkey) {
      refreshBalance();
    }
  }, [isConnected, refreshBalance, smartWalletPubkey]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setRecipient('');
    setAmountSol('0.01');
    setBalanceSol('0.0000');
    setLastSignature('');
    onDisconnected();
  }, [disconnect, onDisconnected]);

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
    <View style={styles.walletCard}>
      <View style={styles.walletTopRow}>
        <View>
          <Text style={styles.walletTitle}>Wallet Dashboard</Text>
          <Text style={styles.walletSubtitle}>Gasless transfers on Solana Devnet</Text>
        </View>

        <Pressable style={styles.secondaryAction} onPress={handleDisconnect}>
          <Text style={styles.secondaryActionLabel}>Disconnect</Text>
        </Pressable>
      </View>

      <View style={styles.pill}>
        <Text style={styles.pillLabel}>SMART WALLET</Text>
        <Text style={styles.pillValue} numberOfLines={1} ellipsizeMode="middle">
          {walletAddress}
        </Text>
      </View>

      <LinearGradient colors={['#450a0a', '#991b1b', '#fee2e2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.balancePanel}>
        <Text style={styles.balancePanelLabel}>Available Balance</Text>
        <Text style={styles.balancePanelValue}>{balanceSol} SOL</Text>
      </LinearGradient>

      <Pressable style={styles.secondaryFull} onPress={refreshBalance}>
        <Text style={styles.secondaryFullLabel}>Refresh Balance</Text>
      </Pressable>

      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Recipient Address</Text>
        <TextInput
          style={styles.input}
          value={recipient}
          onChangeText={setRecipient}
          placeholder="Paste recipient wallet"
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor="#737373"
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Amount (SOL)</Text>
        <TextInput
          style={styles.input}
          value={amountSol}
          onChangeText={setAmountSol}
          placeholder="0.01"
          keyboardType="decimal-pad"
          placeholderTextColor="#737373"
        />
      </View>

      <AppButton title={isSigning ? 'Sending…' : 'Send Gasless Transfer'} disabled={!isConnected || isSigning} onPress={onSend} />

      {lastSignature ? (
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabel}>LAST SIGNATURE</Text>
          <Text style={styles.signatureValue} numberOfLines={2} ellipsizeMode="middle">
            {lastSignature}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function AppButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const handlePress = useCallback(async () => {
    try {
      await onPress();
    } catch (error) {
      Alert.alert('Action failed', error instanceof Error ? error.message : String(error));
    }
  }, [onPress]);

  return (
    <Pressable style={[styles.primaryAction, disabled && styles.buttonDisabled]} onPress={handlePress} disabled={disabled}>
      <LinearGradient
        colors={['#b91c1c', '#ef4444', '#ffffff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primaryActionGradient}
      >
        <Text style={styles.primaryActionLabel}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function AppContent() {
  const { connect, isConnected, isConnecting } = useWallet();

  const [isLandingVisible, setIsLandingVisible] = useState(true);

  const handleConnectFromLanding = useCallback(async () => {
    await connect({ redirectUrl: REDIRECT_HOME });
    setIsLandingVisible(false);
  }, [connect]);

  const handleDisconnected = useCallback(() => {
    setIsLandingVisible(true);
  }, []);

  useEffect(() => {
    if (isConnected) {
      setIsLandingVisible(false);
    }
  }, [isConnected]);

  return (
    <SafeAreaView style={styles.page}>
      <LinearGradient colors={['#0a0a0a', '#230b0b', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.background}>
        <View style={styles.overlay} />
        <View style={styles.contentWrap}>
          {isLandingVisible || !isConnected ? (
            <LoginScreen onConnect={handleConnectFromLanding} busy={isConnecting} />
          ) : (
            <WalletPanel onDisconnected={handleDisconnected} />
          )}
        </View>
      </LinearGradient>
    </SafeAreaView>
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
      <AppContent />
    </LazorKitProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loginCard: {
    borderRadius: 24,
    backgroundColor: '#0b0b0b',
    borderWidth: 1,
    borderColor: '#262626',
    paddingHorizontal: 22,
    paddingVertical: 30,
    gap: 14,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 60,
    height: 60,
  },
  brandName: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    color: '#d4d4d4',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
  },
  ctaButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 6,
  },
  ctaGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaLabel: {
    color: '#09090b',
    fontWeight: '800',
    fontSize: 15,
  },
  helperText: {
    color: '#a3a3a3',
    fontSize: 12,
    textAlign: 'center',
  },
  walletCard: {
    borderRadius: 24,
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 18,
    gap: 13,
  },
  walletTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  walletTitle: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '800',
  },
  walletSubtitle: {
    color: '#d4d4d4',
    fontSize: 12,
    marginTop: 2,
  },
  secondaryAction: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#525252',
    backgroundColor: '#111',
  },
  secondaryActionLabel: {
    color: '#fafafa',
    fontSize: 12,
    fontWeight: '700',
  },
  pill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
    backgroundColor: '#141414',
    padding: 12,
    gap: 4,
  },
  pillLabel: {
    color: '#a3a3a3',
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  pillValue: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '600',
  },
  balancePanel: {
    borderRadius: 14,
    padding: 14,
  },
  balancePanelLabel: {
    color: '#1f2937',
    fontSize: 12,
    fontWeight: '700',
  },
  balancePanelValue: {
    color: '#030712',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  secondaryFull: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#404040',
    backgroundColor: '#111',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryFullLabel: {
    color: '#e5e5e5',
    fontWeight: '700',
    fontSize: 13,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: '#e5e5e5',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
    backgroundColor: '#121212',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  primaryAction: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryActionGradient: {
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryActionLabel: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  signatureBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#200b0b',
    padding: 12,
    gap: 4,
  },
  signatureLabel: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  signatureValue: {
    color: '#fff',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
