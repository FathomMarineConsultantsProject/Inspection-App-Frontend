import React from "react";
import { Image, StyleSheet, View } from "react-native";

type Props = {
  children: React.ReactNode;
  opacity?: number; // 0.10 - 0.25
  size?: number;    // fixed size in px
};

export default function BrandWatermark({
  children,
  opacity = 0.10,
  size = 340,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Watermark */}
      <View style={styles.layer} pointerEvents="none">
        <Image
          source={require("../../assets/images/logo.png")}
          resizeMode="contain"
          style={{ width: size, height: size, opacity }}
        />
      </View>

      {/* Foreground */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  layer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
});
