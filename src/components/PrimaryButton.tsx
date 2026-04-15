import React from "react";
import { Pressable, Text, ActivityIndicator } from "react-native";
import { COLORS } from "../theme/colors";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export default function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: "center",
        backgroundColor:
          disabled || loading ? "#A0AEC0" : COLORS.primary,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 15,
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}