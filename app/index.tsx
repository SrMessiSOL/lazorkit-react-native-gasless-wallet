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
  amount: number;
  usdPrice: number;
  usdValue: number;
  change24h: number;
};

function LoginScreen({ onConnect, busy }: { onConnect: () => void | Promise<void>; busy?: boolean }) {
  return (
    <View style={styles.loginCard}>
      <LinearGradient colors={['#320909', '#0b0b0b']} style={styles.loginGlow}>
        <View style={styles.logoRing}>
          <Image source={require('../assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
        </View>
      </LinearGradient>

      <Text style={styles.brandName}>LazorKit Wallet Pro</Text>
      <Text style={styles.brandSubtitle}>The premium seedless wallet with instant gasless transactions.</Text>

      <Pressable style={[styles.ctaButton, busy && styles.buttonDisabled]} onPress={onConnect} disabled={busy}>
        <LinearGradient colors={['#ef4444', '#fca5a5', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGradient}>
          <Text style={styles.ctaLabel}>{busy ? 'Opening Lazor Login…' : 'Connect Wallet'}</Text>
        </LinearGradient>
      </Pressable>

      <Text style={styles.helperText}>You’ll be redirected to Lazor login to choose and authorize your wallet.</Text>
    </View>
  );
}

function QuickAction({ label }: { label: string }) {
  return (
    <View style={styles.quickAction}>
      <View style={styles.quickActionIcon}>
        <Text style={styles.quickActionIconText}>{label[0]}</Text>
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </View>
  );
}

function TokenRow({ token }: { token: TokenHolding }) {
  const isNegative = token.change24h < 0;

  return (
    <View style={styles.tokenRow}>
      <View style={styles.tokenLeft}>
        <View style={styles.tokenIconCircle}>
          <Text style={styles.tokenIconLabel}>{token.symbol}</Text>
        </View>
        <View>
          <Text style={styles.tokenSymbol}>{token.symbol}</Text>
          <Text style={styles.tokenMeta}>{token.amount.toFixed(4)} tokens</Text>
        </View>
      </View>

      <View style={styles.tokenRight}>
        <Text style={styles.tokenValue}>${token.usdValue.toFixed(2)}</Text>
        <Text style={styles.tokenMeta}>${token.usdPrice.toFixed(2)}</Text>
        <Text style={[styles.tokenChange, isNegative ? styles.tokenNegative : styles.tokenPositive]}>
          {token.change24h.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

function WalletPanel({ onDisconnected }: { onDisconnected: () => void }) {
  const { disconnect, signAndSendTransaction, smartWalletPubkey, connection, isConnected, isSigning } = useWallet();

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
      { symbol: 'SOL', amount: solBalance, usdPrice: solPrice, usdValue: solBalance * solPrice, change24h: solChange },
      { symbol: 'USDC', amount: usdcBalance, usdPrice: usdcPrice, usdValue: usdcBalance * usdcPrice, change24h: usdcChange },
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
        <LinearGradient colors={['#2b0b0b', '#0f0f10']} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.profileDot} />
            <Text style={styles.heroWalletLabel}>Lazor Wallet</Text>
            <Pressable style={styles.secondaryAction} onPress={handleDisconnect}>
              <Text style={styles.secondaryActionLabel}>Disconnect</Text>
            </Pressable>
          </View>

          <Text style={styles.heroValue}>${totalValue.toFixed(2)}</Text>
          <Text style={styles.heroSubValue}>24h: {solChange.toFixed(2)}%</Text>

          <View style={styles.quickActionRow}>
            <QuickAction label="Receive" />
            <QuickAction label="Buy" />
            <QuickAction label="Swap" />
            <QuickAction label="Send" />
          </View>
        </LinearGradient>

        <View style={styles.tabRow}>
          <Text style={styles.tabActive}>Tokens</Text>
          <Text style={styles.tabInactive}>Activity</Text>
          <Text style={styles.tabInactive}>NFTs</Text>
          <Text style={styles.tabInactive}>Settings</Text>
        </View>

        <View style={styles.pill}>
          <Text style={styles.pillLabel}>SMART WALLET</Text>
          <Text style={styles.pillValue} numberOfLines={1} ellipsizeMode="middle">
            {walletAddress}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryPillButton} onPress={refreshPortfolio}>
            <Text style={styles.secondaryPillLabel}>{isRefreshing ? 'Refreshing…' : 'Refresh'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryPillButton} onPress={() => setRecipient(walletAddress)}>
            <Text style={styles.secondaryPillLabel}>My Address</Text>
          </Pressable>
        </View>

        <View style={styles.tokensPanel}>
          <Text style={styles.panelTitle}>Token Holdings</Text>
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
      <LinearGradient colors={['#080808', '#290909', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.background}>
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
    backgroundColor: 'rgba(0,0,0,0.42)',
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
    padding: 14,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  loginCard: {
    borderRadius: 28,
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: '#282828',
    paddingHorizontal: 22,
    paddingVertical: 28,
    gap: 14,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  loginGlow: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 56,
    height: 56,
  },
  brandName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  brandSubtitle: {
    color: '#d4d4d4',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
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
    fontWeight: '900',
    fontSize: 15,
  },
  helperText: {
    color: '#a3a3a3',
    fontSize: 12,
    textAlign: 'center',
  },
  walletCard: {
    borderRadius: 24,
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: '#242424',
    padding: 12,
    gap: 12,
  },
  heroCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3a1a1a',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  heroWalletLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  heroValue: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    marginTop: 10,
  },
  heroSubValue: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 12,
  },
  secondaryAction: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#555',
    backgroundColor: '#111',
  },
  secondaryActionLabel: {
    color: '#fafafa',
    fontSize: 12,
    fontWeight: '700',
  },
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    gap: 6,
    width: '24%',
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconText: {
    color: '#fff',
    fontWeight: '900',
  },
  quickActionLabel: {
    color: '#f5f5f5',
    fontSize: 12,
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  tabActive: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    borderBottomWidth: 2,
    borderBottomColor: '#ef4444',
    paddingBottom: 4,
  },
  tabInactive: {
    color: '#888',
    fontSize: 15,
    fontWeight: '700',
  },
  pill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3c3c3c',
    backgroundColor: '#121212',
    padding: 12,
    gap: 4,
  },
  pillLabel: {
    color: '#a3a3a3',
    fontSize: 11,
    letterSpacing: 0.4,
    fontWeight: '700',
  },
  pillValue: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '600',
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
    fontSize: 17,
    fontWeight: '900',
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    paddingBottom: 10,
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tokenRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  tokenIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1b1b1b',
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenIconLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  tokenSymbol: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
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
    borderColor: '#3a3a3a',
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
    fontWeight: '900',
  },
  signatureBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#220d0d',
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
