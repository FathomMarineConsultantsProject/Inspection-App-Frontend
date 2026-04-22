import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function SplashScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [fade, scale]);

  return (
    <LinearGradient colors={["#F6F7FB", "#EEF2FF"]} style={styles.container}>
      <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Fathom Marine</Text>
        <Text style={styles.sub}>Inspection Report</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },

  logo: { 
    width: 220, 
    height: 220, 
    marginBottom: 14 
  },

  title: { 
    fontSize: 22, 
    fontWeight: "900", 
    color: "#111",
    textAlign: "center",   // ✅ ADD THIS
  },

  sub: { 
    marginTop: 6, 
    color: "#555", 
    fontWeight: "700",
    textAlign: "center",   // ✅ ADD THIS
  },
});
