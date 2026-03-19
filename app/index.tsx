import React, { useCallback, useMemo, useState } from 'react';
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
    <View style={styles.walletCard}>
      <View style={styles.walletHeader}>
        <Text style={styles.walletTitle}>Professional Seedless Wallet</Text>
        <Text style={styles.walletSubtitle}>Secure, gasless Solana transfers on Devnet.</Text>
      </View>

      <View style={styles.infoPill}>
        <Text style={styles.infoLabel}>Smart Wallet</Text>
        <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
          {walletAddress}
        </Text>
      </View>

      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>{balanceSol} SOL</Text>
      </View>

      <View style={styles.row}>
        <AppButton
          title={isConnected ? 'Refresh Balance' : 'Connect Wallet'}
          busy={isConnecting}
          onPress={isConnected ? refreshBalance : onConnect}
        />
        <AppButton title="Disconnect" disabled={!isConnected} variant="secondary" onPress={onDisconnect} />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Recipient Address</Text>
        <TextInput
          style={styles.input}
          value={recipient}
          onChangeText={setRecipient}
          placeholder="Paste destination wallet"
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor="#71717a"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Amount (SOL)</Text>
        <TextInput
          style={styles.input}
          value={amountSol}
          onChangeText={setAmountSol}
          placeholder="0.01"
          keyboardType="decimal-pad"
          placeholderTextColor="#71717a"
        />
      </View>

      <AppButton
        title={isSigning ? 'Sending Transaction…' : 'Send Gasless Transfer'}
        disabled={!isConnected || isSigning}
        onPress={onSend}
      />

      {lastSignature ? (
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabel}>Last Signature</Text>
          <Text style={styles.signatureValue} numberOfLines={2} ellipsizeMode="middle">
            {lastSignature}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function LoginScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <View style={styles.loginCard}>
      <View style={styles.logoWrap}>
        <Image source={require('../assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
      </View>

      <Text style={styles.brandName}>LazorKit Pro Wallet</Text>
      <Text style={styles.brandTagline}>
        Seedless onboarding, gasless execution, and a premium mobile wallet experience.
      </Text>

      <Pressable style={styles.ctaButton} onPress={onContinue}>
        <Text style={styles.ctaLabel}>Log In & Continue</Text>
      </Pressable>

      <Text style={styles.hintText}>By continuing, you will be redirected to your secure wallet workspace.</Text>
    </View>
  );
}

function AppButton({
  title,
  onPress,
  disabled,
  busy,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const handlePress = useCallback(async () => {
    try {
      await onPress();
    } catch (error) {
      Alert.alert('Action failed', error instanceof Error ? error.message : String(error));
    }
  }, [onPress]);

  return (
    <Pressable
      style={[
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        (disabled || busy) && styles.buttonDisabled,
      ]}
      disabled={disabled || busy}
      onPress={handlePress}
    >
      <Text style={[styles.buttonLabel, variant === 'secondary' && styles.secondaryButtonLabel]}>{title}</Text>
    </Pressable>
  );
}

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleContinue = useCallback(() => {
    setIsLoggedIn(true);
  }, []);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />
      <View style={styles.content}>{isLoggedIn ? <WalletPanel /> : <LoginScreen onContinue={handleContinue} />}</View>
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
    backgroundColor: '#05060a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  backgroundGlowTop: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 140,
    backgroundColor: '#1d4ed8',
    opacity: 0.2,
    top: -80,
    left: -70,
  },
  backgroundGlowBottom: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 120,
    backgroundColor: '#14b8a6',
    opacity: 0.16,
    bottom: -70,
    right: -60,
  },
  loginCard: {
    borderRadius: 24,
    backgroundColor: '#10111a',
    borderWidth: 1,
    borderColor: '#222538',
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 12,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#171b2d',
    borderWidth: 1,
    borderColor: '#2c3358',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 56,
    height: 56,
  },
  brandName: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  brandTagline: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  ctaLabel: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 15,
  },
  hintText: {
    color: '#71717a',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  walletCard: {
    borderRadius: 22,
    backgroundColor: '#10111a',
    borderWidth: 1,
    borderColor: '#222538',
    padding: 18,
    gap: 14,
  },
  walletHeader: {
    gap: 4,
  },
  walletTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
  },
  walletSubtitle: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  infoPill: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#16182a',
    borderWidth: 1,
    borderColor: '#2b3257',
    gap: 4,
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  balanceValue: {
    color: '#22c55e',
    fontWeight: '700',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30344f',
    color: '#f8fafc',
    backgroundColor: '#121527',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  button: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryButton: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#334155',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 13,
  },
  secondaryButtonLabel: {
    color: '#e2e8f0',
  },
  signatureBox: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#0f1f14',
    borderWidth: 1,
    borderColor: '#1f7a3f',
    gap: 4,
  },
  signatureLabel: {
    color: '#86efac',
    fontWeight: '600',
    fontSize: 12,
  },
  signatureValue: {
    color: '#dcfce7',
    fontSize: 12,
  },
});
