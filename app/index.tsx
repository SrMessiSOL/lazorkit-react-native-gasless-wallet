"use client"

import { LazorKitProvider, useWallet } from "@lazorkit/wallet-mobile-adapter"
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from "react-native"
import { useState } from "react"
import { Connection, Transaction, ComputeBudgetProgram, VersionedTransaction } from "@solana/web3.js"
import * as Clipboard from "expo-clipboard"
import { PublicKey, type AddressLookupTableAccount, TransactionMessage } from "@solana/web3.js"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token"
import { Image } from "react-native"
import { useEffect } from "react"
import { ScrollView } from "react-native"
import { Buffer } from "buffer"
import { Linking } from "react-native"
import { DEV_API_URLS } from "@raydium-io/raydium-sdk-v2"
import { Ionicons } from "@expo/vector-icons"

// Root App Wrapper
export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LazorKitProvider
        rpcUrl="https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY"
        portalUrl="https://portal.lazor.sh"
        configPaymaster={{ paymasterUrl: "https://kora.devnet.lazorkit.com" }}
      >
        <WalletScreen />
      </LazorKitProvider>
    </SafeAreaView>
  )
}

// Wallet Screen with Connect and Swap
function WalletScreen() {
  const { connect, signAndSendTransaction, isConnected, smartWalletPubkey, disconnect } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [solBalance, setSolBalance] = useState(0)
  const [usdcBalance, setUsdcBalance] = useState(0)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [swapDirection, setSwapDirection] = useState<"usdc-to-sol" | "sol-to-usdc">("usdc-to-sol")
  const [swapAmount, setSwapAmount] = useState("")
  const [solPrice, setSolPrice] = useState(0)
  const [activityHistory, setActivityHistory] = useState<any[]>([])

  const TOKENS = {
    SOL: { symbol: "SOL", mint: "So11111111111111111111111111111111111111112", decimals: 9 },
    USDC: { symbol: "USDC", mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6 }, // Devnet USDC
  }

  const fetchSolPrice = async () => {
    try {
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd")
      const data = await response.json()
      setSolPrice(data.solana.usd)
    } catch (error) {
      console.error("Failed to fetch SOL price:", error)
      setSolPrice(0)
    }
  }

  const fetchBalances = async () => {
    if (!smartWalletPubkey) return
    const connection = new Connection("https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY")
    const sol = (await connection.getBalance(smartWalletPubkey)) / LAMPORTS_PER_SOL
    setSolBalance(sol)

    try {
      const usdcMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU") // Devnet USDC
      const usdcAta = await getAssociatedTokenAddress(usdcMint, smartWalletPubkey, true)
      const usdcAcc = await getAccount(connection, usdcAta)
      const usdc = Number(usdcAcc.amount) / 10 ** 6
      setUsdcBalance(usdc)
    } catch (error) {
      setUsdcBalance(0)
    }
  }

  const fetchActivityHistory = async () => {
    if (!smartWalletPubkey) return
    try {
      const connection = new Connection("https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY")
      const signatures = await connection.getSignaturesForAddress(smartWalletPubkey, { limit: 20 })

      const history = signatures.map((sig) => ({
        signature: sig.signature,
        timestamp: sig.blockTime ? new Date(sig.blockTime * 1000).toLocaleString() : "Unknown",
        status: sig.err ? "Failed" : "Success",
        slot: sig.slot,
      }))

      setActivityHistory(history)
    } catch (error) {
      console.error("Failed to fetch activity history:", error)
      setActivityHistory([])
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchBalances(), fetchSolPrice(), fetchActivityHistory()])
    setRefreshing(false)
  }

  useEffect(() => {
    if (isConnected) {
      fetchBalances()
      fetchSolPrice()
      fetchActivityHistory()
      const interval = setInterval(() => {
        fetchBalances()
        fetchSolPrice()
        fetchActivityHistory()
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [isConnected])

  const handleConnect = async () => {
    setIsLoading(true)
    try {
      await connect({ redirectUrl: "exp://myapp" })
    } catch (error) {
      console.error("Connect error:", error)
      Alert.alert("Error", "Connection failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    Alert.alert("Disconnect Wallet", "Are you sure you want to disconnect?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          await disconnect()
          setSolBalance(0)
          setUsdcBalance(0)
          setActivityHistory([])
        },
      },
    ])
  }

  const handleUSDCFaucet = async () => {
    if (!smartWalletPubkey) return
    try {
      await Clipboard.setStringAsync(smartWalletPubkey.toBase58())
      Alert.alert("Address Copied", "Paste your address in Circle faucet")
      Linking.openURL("https://faucet.circle.com/")
    } catch (error) {
      Alert.alert("Error", "Failed to open faucet")
    }
  }

  const handleSwap = async () => {
    if (!isConnected || !smartWalletPubkey) {
      Alert.alert("Error", "Connect wallet first")
      return
    }

    const amt = Number.parseFloat(swapAmount)
    if (isNaN(amt) || !amt || amt <= 0) {
      Alert.alert("Error", "Enter valid amount")
      return
    }

    setIsLoading(true)
    try {
      const isUsdcToSol = swapDirection === "usdc-to-sol"
      const inputMint = isUsdcToSol ? TOKENS.USDC.mint : TOKENS.SOL.mint
      const outputMint = isUsdcToSol ? TOKENS.SOL.mint : TOKENS.USDC.mint
      const inputDecimals = isUsdcToSol ? TOKENS.USDC.decimals : TOKENS.SOL.decimals
      const amountRaw = Math.floor(amt * Math.pow(10, inputDecimals))
      const txVersion = isUsdcToSol ? "LEGACY" : "V0"

      console.log(`[v0] Swap ${isUsdcToSol ? "USDC→SOL" : "SOL→USDC"}:`, { amountRaw, inputMint, outputMint })

      // Get quote
      const quoteUrl = `${DEV_API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountRaw}&slippageBps=50&txVersion=${txVersion}`
      const quoteResp = await fetch(quoteUrl)
      if (!quoteResp.ok) throw new Error("Quote failed")
      const quoteJson = await quoteResp.json()
      if (!quoteJson.success) throw new Error(quoteJson.msg || "Quote error")

      // Prepare swap request
      const connection = new Connection("https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY")

      const swapRequestBody: any = {
        computeUnitPriceMicroLamports: "100000",
        swapResponse: quoteJson,
        txVersion,
        wallet: smartWalletPubkey.toBase58(),
      }

      if (isUsdcToSol) {
        const usdcAta = await getAssociatedTokenAddress(new PublicKey(TOKENS.USDC.mint), smartWalletPubkey, true)
        const solAta = await getAssociatedTokenAddress(new PublicKey(TOKENS.SOL.mint), smartWalletPubkey, true)
        swapRequestBody.inputAccount = usdcAta.toBase58()
        swapRequestBody.outputAccount = solAta.toBase58()
        swapRequestBody.wrapSol = false
        swapRequestBody.unwrapSol = true
      } else {
        const usdcAta = await getAssociatedTokenAddress(new PublicKey(TOKENS.USDC.mint), smartWalletPubkey, true)
        swapRequestBody.outputAccount = usdcAta.toBase58()
        swapRequestBody.wrapSol = true
        swapRequestBody.unwrapSol = false
      }

      // Get swap transaction
      const swapUrl = `${DEV_API_URLS.SWAP_HOST}/transaction/swap-base-in`
      const swapResp = await fetch(swapUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(swapRequestBody),
      })
      if (!swapResp.ok) throw new Error("Swap transaction failed")
      const swapJson = await swapResp.json()
      if (!swapJson.success) throw new Error(swapJson.msg || "Swap error")

      const transactionBase64 = swapJson.data[0].transaction
      const txBuffer = Buffer.from(transactionBase64, "base64")

      let filteredInstructions: any[]
      let addressLookupTableAccounts: AddressLookupTableAccount[] = []

      if (txVersion === "V0") {
        const tx = VersionedTransaction.deserialize(txBuffer)
        const lookupTableAddresses = tx.message.addressTableLookups?.map((lookup) => lookup.accountKey) ?? []

        if (lookupTableAddresses.length > 0) {
          addressLookupTableAccounts = await Promise.all(
            lookupTableAddresses.map(async (addr) => {
              const account = await connection.getAddressLookupTable(addr)
              if (!account.value) throw new Error(`Failed to fetch LUT: ${addr.toBase58()}`)
              return account.value
            }),
          )
        }

        const decompiled = TransactionMessage.decompile(tx.message, { addressLookupTableAccounts })
        filteredInstructions = decompiled.instructions.filter(
          (ix) => !ix.programId.equals(ComputeBudgetProgram.programId),
        )
      } else {
        const legacyTx = Transaction.from(txBuffer)
        filteredInstructions = legacyTx.instructions.filter(
          (ix) => !ix.programId.equals(ComputeBudgetProgram.programId),
        )
      }

      const signature = await signAndSendTransaction(
        {
          instructions: filteredInstructions,
          transactionOptions: {
            computeUnitLimit: 600_000,
            clusterSimulation: "devnet",
            ...(addressLookupTableAccounts.length > 0 && { addressLookupTableAccounts }),
          },
        },
        { redirectUrl: "exp://myapp" },
      )

      await fetchBalances()
      await fetchActivityHistory()
      setShowSwapModal(false)
      setSwapAmount("")
      Alert.alert("Success", `Swap completed!`)
    } catch (error: any) {
      console.error("Swap error:", error)
      Alert.alert("Error", error?.message || "Swap failed")
    } finally {
      setIsLoading(false)
    }
  }

  const totalValue = (solBalance * solPrice + usdcBalance).toFixed(2)

  if (!isConnected) {
    return (
      <View style={styles.darkContainer}>
        <View style={styles.welcomeContainer}>
          <Image source={{ uri: "https://cryptologos.cc/logos/solana-sol-logo.png" }} style={styles.welcomeLogo} />
          <Text style={styles.welcomeTitle}>Lazorkit Wallet</Text>
          <Text style={styles.welcomeSubtitle}>Gasless Solana swaps with passkey security</Text>

          <TouchableOpacity style={styles.connectButton} onPress={handleConnect} disabled={isLoading}>
            <Ionicons name="finger-print" size={24} color="#000" />
            <Text style={styles.connectButtonText}>{isLoading ? "Connecting..." : "Connect with Biometrics"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.darkContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#14F195" colors={["#14F195"]} />
        }
      >
        <View style={styles.balanceHeader}>
          <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
            <Ionicons name="log-out-outline" size={20} color="#ff4444" />
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
          <Text style={styles.totalValue}>${totalValue}</Text>
        </View>

        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowReceiveModal(true)}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="qr-code-outline" size={28} color="#9945FF" />
            </View>
            <Text style={styles.actionLabel}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleUSDCFaucet}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="gift-outline" size={28} color="#9945FF" />
            </View>
            <Text style={styles.actionLabel}>SOL/USDC Airdrop</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => setShowSwapModal(true)}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="swap-horizontal-outline" size={28} color="#9945FF" />
            </View>
            <Text style={styles.actionLabel}>Swap</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tokens</Text>
        </View>

        <View style={styles.tokenList}>
          <TouchableOpacity style={styles.tokenCard}>
            <View style={styles.tokenLeft}>
              <Image source={{ uri: "https://cryptologos.cc/logos/solana-sol-logo.png" }} style={styles.tokenIcon} />
              <View>
                <Text style={styles.tokenName}>Solana</Text>
                <Text style={styles.tokenAmount}>{solBalance.toFixed(4)} SOL</Text>
              </View>
            </View>
            <View style={styles.tokenRight}>
              <Text style={styles.tokenValue}>${(solBalance * solPrice).toFixed(2)}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tokenCard}>
            <View style={styles.tokenLeft}>
              <View style={styles.usdcIconContainer}>
                <Text style={styles.usdcIcon}>$</Text>
              </View>
              <View>
                <Text style={styles.tokenName}>USD Coin</Text>
                <Text style={styles.tokenAmount}>{usdcBalance.toFixed(2)} USDC</Text>
              </View>
            </View>
            <View style={styles.tokenRight}>
              <Text style={styles.tokenValue}>${usdcBalance.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showReceiveModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receive</Text>
              <TouchableOpacity onPress={() => setShowReceiveModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.receiveContent}>
              <Ionicons name="qr-code" size={120} color="#9945FF" />
              <Text style={styles.receiveLabel}>Your Wallet Address</Text>
              <Text style={styles.receiveAddress}>{smartWalletPubkey?.toBase58()}</Text>
              <TouchableOpacity
                style={styles.copyAddressButton}
                onPress={async () => {
                  await Clipboard.setStringAsync(smartWalletPubkey!.toBase58())
                  Alert.alert("Copied", "Address copied to clipboard")
                }}
              >
                <Ionicons name="copy-outline" size={20} color="#fff" />
                <Text style={styles.copyAddressText}>Copy Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSwapModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.swapModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gasless Swap</Text>
              <TouchableOpacity onPress={() => setShowSwapModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.swapScrollView}>
              <View style={styles.swapDirectionSelector}>
                <TouchableOpacity
                  style={[styles.directionButton, swapDirection === "usdc-to-sol" && styles.directionButtonActive]}
                  onPress={() => setSwapDirection("usdc-to-sol")}
                >
                  <Text style={[styles.directionText, swapDirection === "usdc-to-sol" && styles.directionTextActive]}>
                    USDC → SOL
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.directionButton, swapDirection === "sol-to-usdc" && styles.directionButtonActive]}
                  onPress={() => setSwapDirection("sol-to-usdc")}
                >
                  <Text style={[styles.directionText, swapDirection === "sol-to-usdc" && styles.directionTextActive]}>
                    SOL → USDC
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.swapInput}
                placeholder={`Amount of ${swapDirection === "usdc-to-sol" ? "USDC" : "SOL"}`}
                placeholderTextColor="#666"
                value={swapAmount}
                onChangeText={setSwapAmount}
                keyboardType="numeric"
              />

              <Text style={styles.swapHelper}>Powered by Raydium DEX • No gas fees required</Text>

              <TouchableOpacity
                style={[styles.swapButton, isLoading && styles.swapButtonDisabled]}
                onPress={handleSwap}
                disabled={isLoading}
              >
                <Text style={styles.swapButtonText}>{isLoading ? "Swapping..." : "Swap Now"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showActivityModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Wallet Activity</Text>
              <TouchableOpacity onPress={() => setShowActivityModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.activityScrollView}>
              {activityHistory.length === 0 ? (
                <>
                  <Text style={styles.activityPlaceholder}>No recent activity</Text>
                  <Text style={styles.activitySubtext}>Your transaction history will appear here</Text>
                </>
              ) : (
                activityHistory.map((activity, index) => (
                  <View key={index} style={styles.activityItem}>
                    <View style={styles.activityItemHeader}>
                      <Ionicons
                        name={activity.status === "Success" ? "checkmark-circle" : "close-circle"}
                        size={24}
                        color={activity.status === "Success" ? "#14F195" : "#ff4444"}
                      />
                      <View style={styles.activityItemContent}>
                        <Text style={styles.activityItemTitle}>{activity.status}</Text>
                        <Text style={styles.activityItemTime}>{activity.timestamp}</Text>
                        <Text style={styles.activityItemSignature} numberOfLines={1}>
                          {activity.signature}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setShowActivityModal(true)}>
          <Ionicons name="time-outline" size={28} color="#9945FF" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000",
  },
  darkContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  welcomeLogo: {
    width: 100,
    height: 100,
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginBottom: 48,
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#14F195",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
  },
  connectButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  disconnectButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
    marginRight: 16,
  },
  disconnectText: {
    fontSize: 13,
    color: "#ff4444",
    fontWeight: "600",
  },
  balanceHeader: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 32,
  },
  totalValue: {
    fontSize: 56,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  changeIndicator: {
    fontSize: 18,
    color: "#14F195",
    fontWeight: "600",
  },
  actionsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  actionButton: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  actionIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "500",
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 24,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  tokenList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  tokenCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 16,
  },
  tokenLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tokenIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  usdcIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2775CA",
    justifyContent: "center",
    alignItems: "center",
  },
  usdcIcon: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  tokenName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  tokenAmount: {
    fontSize: 14,
    color: "#888",
  },
  tokenRight: {
    alignItems: "flex-end",
  },
  tokenValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  tokenChange: {
    fontSize: 14,
    color: "#14F195",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: "80%",
  },
  swapModalContainer: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  receiveContent: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  receiveLabel: {
    fontSize: 16,
    color: "#888",
    marginTop: 24,
    marginBottom: 12,
  },
  receiveAddress: {
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  copyAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9945FF",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  copyAddressText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  swapScrollView: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  swapDirectionSelector: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  directionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
  },
  directionButtonActive: {
    backgroundColor: "#9945FF",
  },
  directionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#888",
  },
  directionTextActive: {
    color: "#fff",
  },
  swapInput: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#fff",
    marginBottom: 16,
  },
  swapHelper: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    marginBottom: 24,
  },
  swapButton: {
    backgroundColor: "#14F195",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  swapButtonDisabled: {
    opacity: 0.5,
  },
  swapButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  activityScrollView: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  activityPlaceholder: {
    fontSize: 18,
    color: "#888",
    textAlign: "center",
    marginBottom: 8,
  },
  activitySubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  activityItem: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  activityItemHeader: {
    flexDirection: "row",
    gap: 12,
  },
  activityItemContent: {
    flex: 1,
  },
  activityItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  activityItemTime: {
    fontSize: 13,
    color: "#888",
    marginBottom: 4,
  },
  activityItemSignature: {
    fontSize: 11,
    color: "#666",
    fontFamily: "monospace",
  },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  navItem: {
    padding: 8,
  },
})
