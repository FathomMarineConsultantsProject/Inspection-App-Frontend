import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useState } from "react";
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
import { getUserScopedKey } from "../utils/storageScope";

type Profile = {
  full_name: string;
  email: string;
  profile_image: string | null;
  profile?: {
    profile_image?: string | null;
  };
  phone: string;
  location: string;
};

const DEFAULT_AVATAR = require("../../assets/default-avatar.jpg");
const USER_STORAGE_KEY = "user";
const PROFILE_IMAGE_KEY = "profile_image";

const isValidImage = (uri?: string | null): uri is string => {
  if (!uri) return false;

  const trimmed = uri.trim().toLowerCase();

  return trimmed !== "" && trimmed !== "null" && trimmed !== "undefined";
};

export default function ProfileScreen() {
  const { logout, user } = useAuth();

  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    email: "",
    profile_image: null,
    phone: "",
    location: "",
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [editProfile, setEditProfile] = useState(profile);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const persistUser = async (data: Profile) => {
    try {
      const existingUser = await AsyncStorage.getItem(USER_STORAGE_KEY);

      let parsedUser: Record<string, unknown> = {};

      if (existingUser) {
        parsedUser = JSON.parse(existingUser) as Record<string, unknown>;
      }

      const updatedUser = {
        ...parsedUser,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        location: data.location,
        profile_image: data.profile_image ?? null,
      };

      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
      console.log("UPDATED USER (MERGED):", updatedUser);
    } catch {
      // ignore
    }
  };

  const loadUserFromStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Profile>;
      setProfile((prev) => ({
        ...prev,
        ...parsed,
        full_name: parsed.full_name ?? prev.full_name,
        email: parsed.email ?? prev.email,
        phone: parsed.phone ?? prev.phone,
        location: parsed.location ?? prev.location,
        profile_image:
          parsed.profile_image !== undefined
            ? (isValidImage(parsed.profile_image) ? parsed.profile_image : null)
            : prev.profile_image,
      }));
    } catch {
      // ignore
    }
  }, []);

  const saveLocalProfileImage = useCallback(async (uri: string) => {
    setProfileImage(uri);
    const profileImageKey = getUserScopedKey(PROFILE_IMAGE_KEY, user?.id);
    await AsyncStorage.setItem(profileImageKey, uri);
  }, [user?.id]);

  const loadLocalProfileImage = useCallback(async () => {
    try {
      const profileImageKey = getUserScopedKey(PROFILE_IMAGE_KEY, user?.id);
      const savedImage = await AsyncStorage.getItem(profileImageKey);
      if (isValidImage(savedImage)) {
        setProfileImage(savedImage);
      }
    } catch {
      // ignore
    }
  }, [user?.id]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await API.get("/profile");

      console.log("PROFILE API RESPONSE:", res.data);

      const data = res.data;
      const profileImageCandidate = data.profile_image || data.profile?.profile_image || null;
      const safeProfileImage = isValidImage(profileImageCandidate) ? profileImageCandidate : null;

      const next: Profile = {
        full_name: data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
        location: data.location || "",
        profile_image: safeProfileImage,
        profile: data.profile
          ? {
              profile_image: safeProfileImage,
            }
          : undefined,
      };

      setProfile(next);
      await persistUser(next);

      await SecureStore.setItemAsync("user_name", data.full_name || "");
      await SecureStore.setItemAsync("email", data.email || "");
    } catch (err: any) {
      console.log("PROFILE FETCH ERROR:", err?.response?.data || err?.message);
      await loadUserFromStorage();
      const [savedName, savedEmail] = await Promise.all([
        SecureStore.getItemAsync("user_name"),
        SecureStore.getItemAsync("email"),
      ]);
      if (savedName || savedEmail) {
        setProfile((prev) => ({
          ...prev,
          full_name: savedName || prev.full_name,
          email: savedEmail || prev.email,
        }));
      }
    }
  }, [loadUserFromStorage]);

  useFocusEffect(
    useCallback(() => {
      void loadUserFromStorage();
      void loadLocalProfileImage();
      void fetchProfile();
    }, [loadUserFromStorage, loadLocalProfileImage, fetchProfile])
  );

  useEffect(() => {
    void loadLocalProfileImage();
  }, [loadLocalProfileImage]);

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
    setEditProfile({
      ...profile,
      profile_image: profileImage || profile.profile_image || null,
    });
    setVisible(true);
  };

  const openImagePicker = () => {
    setPickerVisible(true);
  };

  const handleImagePick = () => {
    setPickerVisible(true);
  };

  const getProfileImage = (uri?: string | null) => {
    if (!uri) return DEFAULT_AVATAR;

    const cleaned = uri.trim().toLowerCase();

    if (
      cleaned === "" ||
      cleaned === "null" ||
      cleaned === "undefined"
    ) {
      return DEFAULT_AVATAR;
    }

    return { uri };
  };

  const getAvatarSource = () => getProfileImage(profileImage);

  const removeProfileImage = async () => {
    setProfileImage(null);
    setEditProfile((prev) => ({ ...prev, profile_image: null }));

    const key = getUserScopedKey("profile_image", user?.id);
    await AsyncStorage.removeItem(key);
    const rawUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser) as Record<string, unknown>;
      await AsyncStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify({
          ...parsedUser,
          profile_image: null,
        }),
      );
    }

    console.log("PROFILE IMAGE REMOVED");
  };

  const openCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;

      await saveLocalProfileImage(uri);

      setProfile((prev) => ({
        ...prev,
        profile_image: uri,
      }));

      setEditProfile((prev) => ({
        ...prev,
        profile_image: uri,
      }));
    }

    setPickerVisible(false);
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;

      await saveLocalProfileImage(uri);

      setProfile((prev) => ({
        ...prev,
        profile_image: uri,
      }));

      setEditProfile((prev) => ({
        ...prev,
        profile_image: uri,
      }));
    }

    setPickerVisible(false);
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);

      const localImage = editProfile.profile_image;
      if (localImage) {
        await saveLocalProfileImage(localImage);
        setProfile((prev) => ({
          ...prev,
          profile_image: localImage,
        }));
      }

      const payload = {
        full_name: editProfile.full_name,
        phone: editProfile.phone,
        location: editProfile.location,
      };

      console.log("Final payload:", payload);

      await API.put("/profile", payload);

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

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handleImagePick}>
            <Image
              source={getAvatarSource()}
              style={styles.avatar}
              resizeMode="cover"
            />
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>{profile.full_name}</Text>
            <Text style={styles.subText}>{profile.email}</Text>
            <Text style={styles.subText}>{profile.phone || "No phone"}</Text>
            <Text style={styles.subText}>{profile.location || "No location"}</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <PrimaryButton title="Edit Profile" onPress={openModal} />
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
                    source={getProfileImage(editProfile.profile_image)}
                    style={styles.modalAvatar}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={removeProfileImage} style={styles.removeBtn}>
                  <Text style={styles.removeText}>Remove Profile Picture</Text>
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

  profileCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 14,
  },

  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },

  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },

  name: { fontSize: 18, fontWeight: "600" },
  subText: { fontSize: 14, color: "#666", marginTop: 4 },

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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f2f2f2",
    overflow: "hidden",
  },

  removeBtn: {
    marginTop: 12,
    alignSelf: "center",
  },

  removeText: {
    color: "#ff3b30",
    fontSize: 14,
    fontWeight: "500",
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
