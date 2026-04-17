import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { startAutoSync } from "./src/utils/syncManager";

export default function App() {
  useEffect(() => {
    startAutoSync();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" translucent={false} />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
