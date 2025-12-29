import { Tabs } from 'expo-router';
import { WalletProvider } from '../providers/WalletProvider';
import '../global.css';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Buffer } from 'buffer';

global.Buffer = Buffer;

export default function TabLayout() {
  return (
    <WalletProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#000',  // Sets tab bar background to black
            paddingBottom: 20,
            borderTopColor: '#333',   // Optional: subtle border to separate from content
          },
          tabBarActiveTintColor: '#9945FF',  // Optional: active icon/text color (matches your app's purple accent)
          tabBarInactiveTintColor: '#666',   // Optional: inactive icon/text color (dim gray)
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            href: null,  // Hides the tab from the bar
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="wallet"
          options={{
            title: 'Wallet',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="wallet" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="modal" options={{ href: null }} />
      </Tabs>
    </WalletProvider>
  );
}