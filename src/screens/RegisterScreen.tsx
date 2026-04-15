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

import BrandWatermark from "../components/BrandWatermark";
import Input from "../components/Input";
import PrimaryButton from "../components/PrimaryButton";
import { registerUser } from "../services/auth.service";
import { COLORS } from "../theme/colors";
import { isEmailValid, minLen } from "../utils/validators";

export default function RegisterScreen({ navigation }: any) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [errors, setErrors] = React.useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const scale = useRef(new Animated.Value(1)).current;

  const canSubmit = useMemo(() => {
    return !!(email.trim() && password && confirmPassword);
  }, [email, password, confirmPassword]);

  function validate() {
    const e: typeof errors = {};
    if (!fullName.trim()) e.name = "Enter your full name";
    if (!email.trim() || !isEmailValid(email)) e.email = "Enter a valid email";
    if (!minLen(password, 6)) e.password = "Password must be at least 6 chars";
    if (confirmPassword !== password) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function pressIn() {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }

  async function onSubmit() {
    if (!email.trim() || !password || password !== confirmPassword) return;
    if (!validate()) return;

    try {
      setIsLoading(true);
      await registerUser(email.trim(), password, fullName.trim());
      await SecureStore.setItemAsync("name", fullName.trim() || "User");
      await SecureStore.setItemAsync("email", email.trim());
      navigation.navigate("Login");
    } catch (err: any) {
      console.log("Auth error:", err?.response?.data || err?.message);
    } finally {
      setIsLoading(false);
    }
  }

  const cardStyle = {
    backgroundColor: "rgba(255,255,255,0.65)",
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
      <BrandWatermark opacity={0.18} size={380}>
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
                    <Ionicons name="person-add-outline" size={22} color="#fff" />
                  </View>

                  <View>
                    <Text style={{ fontSize: 26, fontWeight: "900", color: COLORS.text }}>
                      Create account
                    </Text>
                    <Text style={{ marginTop: 2, color: "#555", fontWeight: "600" }}>
                      Start inspections faster
                    </Text>
                  </View>
                </View>

                <Text style={{ marginTop: 14, color: COLORS.textSecondary }}>
                  Create your account to start building reports.
                </Text>
              </View>

              {/* Card */}
              <View style={cardStyle}>
                <Input
                  label="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your name"
                  autoCapitalize="words"
                  leftIcon="person-outline"
                  error={errors.name}
                />

                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  leftIcon="mail-outline"
                  error={errors.email}
                />

                <Input
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  leftIcon="lock-closed-outline"
                  error={errors.password}
                />

                <Input
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  leftIcon="shield-checkmark-outline"
                  error={errors.confirmPassword}
                />

                <Animated.View style={{ transform: [{ scale }] }}>
                  <Pressable
                    onPress={onSubmit}
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                  >
                    <PrimaryButton
                      title="Create Account"
                      onPress={onSubmit}
                      loading={isLoading}
                      disabled={!canSubmit}
                    />
                  </Pressable>
                </Animated.View>
              </View>

              {/* Footer */}
              <Pressable
                onPress={() => navigation.navigate("Login")}
                style={{ marginTop: 14, alignItems: "center" }}
              >
                <Text style={{ fontWeight: "800", color: COLORS.text }}>
                  Already have an account?{" "}
                  <Text style={{ textDecorationLine: "underline" }}>Login</Text>
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </BrandWatermark>
    </LinearGradient>
  );
}
