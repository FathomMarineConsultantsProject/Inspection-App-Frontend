import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";
import { useAuth } from "../context/AuthContext";
import SplashScreen from "../screens/SplashScreen";

export default function RootNavigator() {
  const { token, bootstrapping } = useAuth();

  if (bootstrapping) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {token ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
