import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import React, { useMemo, useRef } from "react";
import {
    Animated,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { COLORS } from "../theme/colors";

import Input from "../components/Input";
import PrimaryButton from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ navigation }: any) {
  const { login, isLoading } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const scale = useRef(new Animated.Value(1)).current;

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0,
    [email, password]
  );

  function pressIn() {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }

  async function onSubmit() {
    if (!email.trim() || !password) return;

    try {
      await login(email.trim(), password);
      await SecureStore.setItemAsync("email", email.trim());
    } catch (err: any) {
      console.log("Auth error:", err?.response?.data || err?.message);
    }
  }

  const cardStyle = {
    backgroundColor: "rgba(255,255,255,0.70)",
    borderRadius: 18,
    padding: 16,

    // ✅ subtle border (not white) — prevents grey frame
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",

    // ✅ platform shadow (prevents Android halo)
    ...(Platform.OS === "android"
      ? { elevation: 2 }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }),
  } as const;

  return (
    <LinearGradient colors={["#F7F9FC", "#E6F4FF"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: 18,
            justifyContent: "center",
            alignItems: "center",
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: 520 }}>
            {/* Header */}
            <View style={{ marginBottom: 16 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    backgroundColor: COLORS.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="camera-outline" size={22} color="#fff" />
                </View>

                <View>
                  <Text style={{ fontSize: 26, fontWeight: "900", color: COLORS.text }}>
                    Photo Report
                  </Text>
                  <Text style={{ marginTop: 2, color: "#555", fontWeight: "600" }}>
                    Ship Inspection App
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  marginTop: 14,
                  fontSize: 20,
                  fontWeight: "900",
                  color: COLORS.text,
                }}
              >
                Welcome back
              </Text>
              <Text style={{ marginTop: 6, color: "#666" }}>
                Login to continue your inspection work.
              </Text>
            </View>

            {/* Card */}
            <View style={cardStyle}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                leftIcon="mail-outline"
              />

              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                leftIcon="lock-closed-outline"
              />

              <Animated.View style={{ transform: [{ scale }] }}>
               <Pressable
                  disabled={!canSubmit}
                  onPress={onSubmit}
                  onPressIn={pressIn}
                  onPressOut={pressOut}
                  style={!canSubmit ? { opacity: 0.5 } : undefined}
                >
                  <PrimaryButton
                    title="Login"
                    onPress={onSubmit}
                    loading={isLoading}
                    disabled={!canSubmit}
                  />
                </Pressable>
              </Animated.View>

              <Pressable
                onPress={() =>
                  Alert.alert("Forgot password", "Backend will handle this later.")
                }
                style={{ marginTop: 12, alignItems: "center" }}
              >
                <Text
                  style={{
                    fontWeight: "800",
                    color: COLORS.text,
                    textDecorationLine: "none",
                  }}
                >
                  Forgot password?
                </Text>
              </Pressable>
            </View>

            {/* Footer */}
            <Pressable
              onPress={() => navigation.navigate("Register")}
              style={{ marginTop: 14, alignItems: "center" }}
            >
              <Text style={{ fontWeight: "800", color: COLORS.text }}>
                Don’t have an account?{" "}
                <Text style={{ textDecorationLine: "underline" }}>Register</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
