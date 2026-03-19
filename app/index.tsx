import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { LinearGradient } from 'expo-linear-gradient';
import { LazorKitProvider, useWallet } from '@lazorkit/wallet-mobile-adapter';
import { TOKENS } from '../constants/tokens';

const DEVNET_RPC_URL = 'https://api.devnet.solana.com';
const PORTAL_URL = 'https://portal.lazor.sh';
const PAYMASTER_URL = 'https://lazorkit-paymaster.onrender.com';
const REDIRECT_HOME = 'exp://192.168.0.106:8081';
const REDIRECT_SIGN = 'prowallet://callback';

const SOL_LAMPORTS = 1_000_000_000;

type TokenHolding = {
  symbol: string;
  name: string;
  amount: number;
  usdPrice: number;
  usdValue: number;
  change24h: number;
};

function LoginScreen({ onConnect, busy }: { onConnect: () => void | Promise<void>; busy?: boolean }) {
  return (
    <View style={styles.loginCard}>
      <View style={styles.logoRing}>
        <Image source={require('../assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
      </View>

      <Text style={styles.brandName}>LazorKit Wallet Pro</Text>
      <Text style={styles.brandSubtitle}>Choose any wallet from Lazor login and continue with seedless, gasless transfers.</Text>

      <Pressable style={[styles.ctaButton, busy && styles.buttonDisabled]} onPress={onConnect} disabled={busy}>
        <LinearGradient colors={['#ef4444', '#fca5a5', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGradient}>
          <Text style={styles.ctaLabel}>{busy ? 'Opening Lazor Login…' : 'Connect with LazorKit'}</Text>
        </LinearGradient>
      </Pressable>

      <Text style={styles.helperText}>You will be redirected to Lazor login to pick the wallet you want to connect.</Text>
    </View>
  );
}

function TokenRow({ token }: { token: TokenHolding }) {
  const isNegative = token.change24h < 0;

  return (
    <View style={styles.tokenRow}>
      <View style={styles.tokenLeft}>
        <View style={styles.tokenIconCircle}>
          <Text style={styles.tokenIconLabel}>{token.symbol.slice(0, 1)}</Text>
        </View>

        <View>
          <Text style={styles.tokenSymbol}>{token.symbol}</Text>
          <Text style={styles.tokenMeta}>
            {token.amount.toFixed(4)} · ${token.usdPrice.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.tokenRight}>
        <Text style={styles.tokenValue}>${token.usdValue.toFixed(2)}</Text>
        <Text style={[styles.tokenChange, isNegative ? styles.tokenNegative : styles.tokenPositive]}>
          {token.change24h.toFixed(2)}%
        </Text>
      </View>
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
  const [solBalance, setSolBalance] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [solPrice, setSolPrice] = useState(0);
  const [usdcPrice, setUsdcPrice] = useState(1);
  const [solChange, setSolChange] = useState(0);
  const [usdcChange, setUsdcChange] = useState(0);
  const [lastSignature, setLastSignature] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const walletAddress = useMemo(() => smartWalletPubkey?.toBase58() ?? '-', [smartWalletPubkey]);

  const tokenHoldings = useMemo<TokenHolding[]>(() => {
    const holdings: TokenHolding[] = [
      {
        symbol: 'SOL',
        name: 'Solana',
        amount: solBalance,
        usdPrice: solPrice,
        usdValue: solBalance * solPrice,
        change24h: solChange,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        amount: usdcBalance,
        usdPrice: usdcPrice,
        usdValue: usdcBalance * usdcPrice,
        change24h: usdcChange,
      },
    ];

    return holdings.sort((a, b) => b.usdValue - a.usdValue);
  }, [solBalance, solChange, solPrice, usdcBalance, usdcChange, usdcPrice]);

  const totalValue = useMemo(() => tokenHoldings.reduce((sum, token) => sum + token.usdValue, 0), [tokenHoldings]);

  const fetchPrices = useCallback(async () => {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd&include_24hr_change=true',
      );
      const data = await response.json();

      setSolPrice(Number(data?.solana?.usd ?? 0));
      setUsdcPrice(Number(data?.['usd-coin']?.usd ?? 1));
      setSolChange(Number(data?.solana?.usd_24h_change ?? 0));
      setUsdcChange(Number(data?.['usd-coin']?.usd_24h_change ?? 0));
    } catch {
      setSolPrice(0);
      setUsdcPrice(1);
      setSolChange(0);
      setUsdcChange(0);
    }
  }, []);

  const fetchBalances = useCallback(async () => {
    if (!smartWalletPubkey) return;

    const lamports = await connection.getBalance(smartWalletPubkey, 'confirmed');
    setSolBalance(lamports / SOL_LAMPORTS);

    try {
      const usdcAta = await getAssociatedTokenAddress(new PublicKey(TOKENS.USDC.mint), smartWalletPubkey, true);
      const usdcAcc = await getAccount(connection, usdcAta);
      setUsdcBalance(Number(usdcAcc.amount) / 10 ** TOKENS.USDC.decimals);
    } catch {
      setUsdcBalance(0);
    }
  }, [connection, smartWalletPubkey]);

  const refreshPortfolio = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchBalances(), fetchPrices()]);
    setIsRefreshing(false);
  }, [fetchBalances, fetchPrices]);

  useEffect(() => {
    if (isConnected && smartWalletPubkey) {
      refreshPortfolio();
    }
  }, [isConnected, refreshPortfolio, smartWalletPubkey]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setRecipient('');
    setAmountSol('0.01');
    setSolBalance(0);
    setUsdcBalance(0);
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
    await refreshPortfolio();
  }, [amountSol, recipient, refreshPortfolio, signAndSendTransaction, smartWalletPubkey]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.walletCard}>
        <View style={styles.walletTopRow}>
          <View>
            <Text style={styles.walletTitle}>Portfolio</Text>
            <Text style={styles.walletSubtitle}>Gasless mobile wallet</Text>
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
          <Text style={styles.balancePanelLabel}>Total Portfolio Value</Text>
          <Text style={styles.balancePanelValue}>${totalValue.toFixed(2)}</Text>
        </LinearGradient>

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryPillButton} onPress={refreshPortfolio}>
            <Text style={styles.secondaryPillLabel}>{isRefreshing ? 'Refreshing…' : 'Refresh'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryPillButton} onPress={() => setRecipient(walletAddress)}>
            <Text style={styles.secondaryPillLabel}>My Address</Text>
          </Pressable>
        </View>

        <View style={styles.tokensPanel}>
          <Text style={styles.panelTitle}>Tokens</Text>
          {tokenHoldings.map((token) => (
            <TokenRow key={token.symbol} token={token} />
          ))}
        </View>

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
    </ScrollView>
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
  const { connect, disconnect, isConnected, isConnecting } = useWallet();

  const [showLogin, setShowLogin] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const didResetSession = useRef(false);

  useEffect(() => {
    if (didResetSession.current) return;
    didResetSession.current = true;

    const resetSession = async () => {
      try {
        await disconnect();
      } finally {
        setShowLogin(true);
        setInitializing(false);
      }
    };

    resetSession();
  }, [disconnect]);

  const handleConnectFromLanding = useCallback(async () => {
    await connect({ redirectUrl: REDIRECT_HOME });
    setShowLogin(false);
  }, [connect]);

  const handleDisconnected = useCallback(() => {
    setShowLogin(true);
  }, []);

  useEffect(() => {
    if (isConnected) {
      setShowLogin(false);
    }
  }, [isConnected]);

  if (initializing) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <LinearGradient colors={['#0a0a0a', '#230b0b', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.background}>
        <View style={styles.overlay} />
        <View style={styles.contentWrap}>
          {showLogin || !isConnected ? (
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
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  scrollContent: {
    paddingVertical: 10,
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
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
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
    padding: 16,
    gap: 12,
  },
  walletTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  walletTitle: {
    color: '#fff',
    fontSize: 24,
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
    fontSize: 30,
    fontWeight: '900',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryPillButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3f3f46',
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  secondaryPillLabel: {
    color: '#fafafa',
    fontWeight: '700',
    fontSize: 12,
  },
  tokensPanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    backgroundColor: '#0f0f0f',
    padding: 12,
    gap: 10,
  },
  panelTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
    paddingBottom: 8,
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tokenRight: {
    alignItems: 'flex-end',
  },
  tokenIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenIconLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  tokenSymbol: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  tokenMeta: {
    color: '#a3a3a3',
    fontSize: 12,
  },
  tokenValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  tokenChange: {
    fontSize: 12,
    fontWeight: '700',
  },
  tokenPositive: {
    color: '#4ade80',
  },
  tokenNegative: {
    color: '#f87171',
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
