import { Tabs } from "expo-router"
import { WalletProvider } from "../providers/WalletProvider"
import "../global.css"
import { Ionicons } from "@expo/vector-icons"
import { Buffer } from "buffer"

global.Buffer = Buffer

export default function TabLayout() {
  return (
    <WalletProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#000",
            paddingBottom: 20,
            borderTopColor: "#333",
          },
          tabBarActiveTintColor: "#9945FF",
          tabBarInactiveTintColor: "#666",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Wallet",
            tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
    </WalletProvider>
  )
}
