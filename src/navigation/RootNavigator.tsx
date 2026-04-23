import React from "react";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";
import { useAuth } from "../context/AuthContext";

export default function RootNavigator() {
  const { token } = useAuth();
  return token ? <AppNavigator /> : <AuthNavigator />;
}
