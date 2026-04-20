import React, { useMemo, useState } from "react";
import {
  Text,
  TextInput,
  View,
  Pressable,
  StyleSheet,
  Platform,
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../theme/colors";

type Props = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  multiline?: boolean;
  leftIcon?: React.ComponentProps<typeof Ionicons>["name"];
  secureTextEntry?: boolean;
  returnKeyType?: "done" | "next" | "go" | "search" | "send";
  onFocus?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onBlur?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
};

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  autoCapitalize = "none",
  keyboardType = "default",
  multiline = false,
  leftIcon,
  secureTextEntry = false,
  returnKeyType = "done",
  onFocus,
  onBlur,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = useMemo(() => !!secureTextEntry, [secureTextEntry]);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          !!error && styles.inputWrapError,
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={18}
            style={styles.leftIcon}
            color={focused ? COLORS.primary : COLORS.textSecondary}
          />
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={isPassword ? !showPassword : false}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.multiline]}
          underlineColorAndroid="transparent"
          selectionColor={COLORS.primary}
          cursorColor={COLORS.primary}
          returnKeyType={returnKeyType}
          blurOnSubmit={!multiline}
        />

        {isPassword ? (
          <Pressable
            onPress={() => setShowPassword((s) => !s)}
            hitSlop={10}
            style={styles.eyeButton}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={COLORS.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },

  label: {
    marginBottom: 8,
    fontWeight: "700",
    fontSize: 13,
    color: COLORS.text,
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 58,
    paddingVertical: Platform.OS === "android" ? 0 : 0,
  },

  inputWrapFocused: {
    borderColor: COLORS.primary,
  },

  inputWrapError: {
    borderColor: COLORS.danger,
  },

  leftIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    height: 56,
    paddingVertical: 0,
  },

  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
    paddingVertical: 12,
  },

  eyeButton: {
    paddingLeft: 10,
  },

  error: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: "600",
  },
});