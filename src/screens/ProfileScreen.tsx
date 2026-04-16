import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";

import Input from "../components/Input";
import PrimaryButton from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";

type Profile = {
  full_name: string;
  email: string;
  profile_image: string;
  phone: string;
  location: string;
};

const placeholderImage = require("../../assets/images/logo.png");

export default function ProfileScreen() {
  const { logout } = useAuth();

  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    email: "",
    profile_image: "",
    phone: "",
    location: "",
  });

  const [editProfile, setEditProfile] = useState(profile);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const getToken = async () =>
    (await SecureStore.getItemAsync("token")) ||
    (await SecureStore.getItemAsync("access_token"));

  const fetchProfile = async () => {
    try {
      const token = await getToken();

      if (!token) {
        console.log("No token found");
        return;
      }

      const res = await API.get("/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("PROFILE API RESPONSE:", res.data);

      const data = res.data;

      setProfile({
        full_name: data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
        location: data.location || "",
        profile_image: data.profile_image || "",
      });
    } catch (err: any) {
      console.log("PROFILE FETCH ERROR:", err?.response?.data || err?.message);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    (async () => {
      const camera = await ImagePicker.requestCameraPermissionsAsync();
      const gallery = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (camera.status !== "granted" || gallery.status !== "granted") {
        Alert.alert("Permissions required for camera and gallery");
      }
    })();
  }, []);

  const openModal = () => {
    setEditProfile(profile);
    setVisible(true);
  };

  const openImagePicker = () => {
    setPickerVisible(true);
  };

  const openCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      const base64Image = result.assets[0].base64
        ? `data:image/jpeg;base64,${result.assets[0].base64}`
        : result.assets[0].uri;

      setEditProfile((prev) => ({
        ...prev,
        profile_image: base64Image,
      }));
    }

    setPickerVisible(false);
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      const base64Image = result.assets[0].base64
        ? `data:image/jpeg;base64,${result.assets[0].base64}`
        : result.assets[0].uri;

      setEditProfile((prev) => ({
        ...prev,
        profile_image: base64Image,
      }));
    }

    setPickerVisible(false);
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const token = await getToken();

      if (!token) {
        Alert.alert("User not authenticated");
        return;
      }

      const payload = {
        full_name: editProfile.full_name,
        phone: editProfile.phone,
        location: editProfile.location,
        profile_image: editProfile.profile_image,
      };

      console.log("SENDING PAYLOAD:", payload);

      await API.put(
        "/profile",
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await fetchProfile();
      setVisible(false);
      Alert.alert("Profile updated successfully");
    } catch (err: any) {
      console.log("SAVE ERROR:", err?.response?.data || err?.message);
      Alert.alert("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your Profile</Text>

      <View style={styles.card}>
        <Image
          source={
            profile.profile_image
              ? { uri: profile.profile_image }
              : placeholderImage
          }
          style={styles.avatar}
        />

        <View style={styles.info}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.meta}>{profile.email}</Text>
          <Text style={styles.meta}>{profile.phone || "No phone"}</Text>
          <Text style={styles.meta}>{profile.location || "No location"}</Text>
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <PrimaryButton title="Edit Profile" onPress={openModal} />
      </View>

      <Text style={styles.section}>Recent Inspections</Text>

      <View style={styles.cardSmall}>
        <Text>Inspection Placeholder</Text>
      </View>

      <View style={{ marginTop: 16 }}>
        <PrimaryButton title="Logout" onPress={logout} />
      </View>

      <Modal visible={visible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalCard}>
              <View style={styles.avatarContainer}>
                <TouchableOpacity onPress={openImagePicker}>
                  <Image
                    source={
                      editProfile.profile_image
                        ? { uri: editProfile.profile_image }
                        : placeholderImage
                    }
                    style={styles.modalAvatar}
                  />
                </TouchableOpacity>
              </View>

              <Input
                label="Name"
                value={editProfile.full_name}
                onChangeText={(t) =>
                  setEditProfile((p) => ({ ...p, full_name: t }))
                }
              />

              <Input
                label="Phone"
                value={editProfile.phone}
                onChangeText={(t) =>
                  setEditProfile((p) => ({ ...p, phone: t }))
                }
              />

              <Text style={styles.locationLabel}>Location</Text>
              <GooglePlacesAutocomplete
                placeholder="Enter location"
                fetchDetails={true}
                onPress={(data, details = null) => {
                  if (details) {
                    setEditProfile((prev) => ({
                      ...prev,
                      location: details.formatted_address,
                    }));
                  }
                }}
                query={{
                  key: "YOUR_GOOGLE_API_KEY",
                  language: "en",
                }}
                styles={{
                  textInput: styles.input,
                  listView: {
                    backgroundColor: "white",
                    position: "absolute",
                    top: 60,
                    zIndex: 1000,
                    elevation: 5,
                  },
                }}
                textInputProps={{
                  value: editProfile.location,
                  onChangeText: (text) =>
                    setEditProfile((prev) => ({ ...prev, location: text })),
                }}
              />

              <View style={styles.modalActions}>
                <PrimaryButton
                  title="Save"
                  onPress={handleSaveProfile}
                  loading={loading}
                />

                <View style={styles.buttonSpacing} />

                <PrimaryButton
                  title="Cancel"
                  onPress={() => setVisible(false)}
                />
              </View>
              </View>
            </View>
          </ScrollView>

          {pickerVisible && (
            <View style={styles.sheetWrapper}>
              <View style={styles.sheet}>
                <Pressable style={styles.sheetItem} onPress={openCamera}>
                  <Text style={styles.sheetText}>Camera</Text>
                </Pressable>

                <Pressable style={styles.sheetItem} onPress={openGallery}>
                  <Text style={styles.sheetText}>Gallery</Text>
                </Pressable>

                <Pressable
                  style={styles.sheetCancelBtn}
                  onPress={() => setPickerVisible(false)}
                >
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },

  card: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#eee",
    marginBottom: 14,
  },

  avatar: { width: 80, height: 80, borderRadius: 40 },

  info: { marginLeft: 14, justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "600" },
  meta: { fontSize: 14, color: "#666", marginTop: 2 },

  section: { marginTop: 20, fontWeight: "600", fontSize: 15 },

  cardSmall: {
    padding: 12,
    backgroundColor: "#eee",
    borderRadius: 10,
    marginTop: 10,
  },

  modal: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#00000088",
  },

  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    maxHeight: "85%",
  },

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  modalActions: {
    marginTop: 16,
  },

  buttonSpacing: {
    height: 12,
  },

  avatarContainer: {
    alignItems: "center",
    marginBottom: 16,
  },

  modalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  locationLabel: {
    marginBottom: 2,
    fontWeight: "700",
    fontSize: 13,
    color: "#111827",
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },

  sheetWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#00000055",
    justifyContent: "flex-end",
  },

  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },

  sheetItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  sheetText: {
    fontSize: 16,
  },

  sheetCancelBtn: {
    padding: 14,
    alignItems: "center",
  },

  sheetCancelText: {
    color: "red",
    fontWeight: "600",
  },
});