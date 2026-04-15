import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";

export default function ProfileScreen() {
  const { logout } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const fetchProfile = async () => {
    try {
      const token =
        (await SecureStore.getItemAsync("token")) ||
        (await SecureStore.getItemAsync("access_token"));

      const res = await API.get("/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const profileName = res?.data?.profile?.full_name;
      const metaName = res?.data?.user?.user_metadata?.full_name;

      setName(profileName || metaName || "User");
      setEmail(res?.data?.user?.email || "");
    } catch (err: any) {
      console.log("Profile error:", err?.response?.data || err?.message);
      try {
        const storedName = await SecureStore.getItemAsync("name");
        const storedEmail = await SecureStore.getItemAsync("email");
        setName(storedName || "User");
        setEmail(storedEmail || "");
      } catch {
        setName("User");
        setEmail("");
      }
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "900", marginBottom: 12 }}>
        Your Profile
      </Text>

      <View style={styles.card}>
        <Text style={styles.name}>
          {name || "User"}
        </Text>

        <Text style={styles.email}>{email}</Text>
      </View>

      <View style={{ marginTop: 14 }}>
        <PrimaryButton title="Logout" onPress={logout} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    elevation: 3,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
  },
  email: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
});
