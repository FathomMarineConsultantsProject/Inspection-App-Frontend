import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { COLORS } from "../theme/colors";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
};

export default function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  icon,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        paddingVertical: 16,
        borderRadius: 14,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor:
          disabled || loading ? "#A0AEC0" : COLORS.primary,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={16}
              color="#fff"
              style={{ marginBottom: -1, marginRight: 8 }}
            />
          ) : null}
          <Text
            style={{
              color: "#fff",
              fontWeight: "800",
              fontSize: 15,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}