import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PrimaryButton from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { syncPendingInspections } from "../services/syncInspection";
import type { Inspection } from "../utils/inspectionStorage";
import { addToSyncQueue, parseInspectionsFromStorage } from "../utils/inspectionStorage";
import { persistImage } from "../utils/persistImage";
import { processImage, processImages } from "../utils/processImage";
import { loadScopedInspectionsWithMigration } from "../utils/storageScope";

type Props = {
  navigation: any;
  route: any;
};

type ReportImage = {
  id: string;
  uri: string;
  exportUri?: string;
  description: string;
  originalUri?: string;
  croppedUri?: string;
};

const IMAGES_PER_PAGE_OPTIONS = [2, 4, 6, 8] as const;

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export default function CreateReportScreen({ navigation, route }: Props) {
  const { ship } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<ReportImage[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);

  // ✅ images per page dropdown
  const [imagesPerPage, setImagesPerPage] =
    useState<(typeof IMAGES_PER_PAGE_OPTIONS)[number]>(2);
  const [menuOpen, setMenuOpen] = useState(false);

  // ✅ New Camera permissions API
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [hasGalleryPerm, setHasGalleryPerm] = useState<boolean | null>(null);

  const cameraRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const gal = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasGalleryPerm(gal.status === "granted");
    })();
  }, []);

  const canUseGallery = useMemo(
    () => hasGalleryPerm === true,
    [hasGalleryPerm],
  );

  async function pickImages() {
    if (!canUseGallery) {
      Alert.alert(
        "Permission needed",
        "Please allow gallery access to pick images.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 25,
    });

    if (result.canceled) return;
    const originalUris = result.assets.map((asset) => asset.uri);
    const processedUris = await processImages(originalUris);

    const newItems: ReportImage[] = result.assets.map((asset, index) => ({
      id: makeId(),
      uri: processedUris[index] || asset.uri,
      exportUri: processedUris[index] || asset.uri,
      originalUri: asset.uri,
      description: "",
    }));

    // avoid duplicates by uri
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.uri));
      const filtered = newItems.filter((n) => !seen.has(n.uri));
      return [...prev, ...filtered];
    });
  }

  async function openCamera() {
    if (!cameraPermission || cameraPermission.granted === false) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert("Permission needed", "Please allow camera access.");
        return;
      }
    }
    setCameraOpen(true);
  }

  async function takePhoto() {
    try {
      const cam = cameraRef.current;
      if (!cam) return;

      const photo = await cam.takePictureAsync({ quality: 0.8 });

      if (photo?.uri) {
        const processedUri = await processImage(photo.uri);
        const newItem: ReportImage = {
          id: makeId(),
          uri: processedUri,
          exportUri: processedUri,
          originalUri: photo.uri,
          description: "",
        };
        setItems((prev) => [newItem, ...prev]);
      }
    } catch (e: any) {
      Alert.alert("Camera error", e?.message || "Could not take photo");
    }
  }

  function removeImage(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  function setDescription(id: string, text: string) {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, description: text } : x)),
    );
  }

  async function handleReplaceImage(item: ReportImage) {
    try {
      if (!canUseGallery) {
        Alert.alert(
          "Permission needed",
          "Please allow gallery access to pick images.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newUri = result.assets[0].uri;
        const processedUri = await processImage(newUri);
        setItems((prev) =>
          prev.map((img) =>
            img.id === item.id
              ? {
                  ...img,
                  uri: processedUri,
                  exportUri: processedUri,
                  originalUri: newUri,
                }
              : img,
          ),
        );
      }
    } catch (e) {
      console.log("Crop error", e);
    }
  }

  async function goNext() {
    if (items.length === 0) {
      Alert.alert("Add photos", "Please add at least 1 photo for the report.");
      return;
    }

    const safeImages: ReportImage[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const persistedUri = await persistImage(item.uri);
      const persistedExportUri = item.exportUri
        ? await persistImage(item.exportUri)
        : persistedUri;
      const persistedOriginalUri = item.originalUri
        ? await persistImage(item.originalUri)
        : undefined;
      const persistedCroppedUri = item.croppedUri
        ? await persistImage(item.croppedUri)
        : undefined;

      safeImages.push({
        ...item,
        uri: persistedUri,
        exportUri: persistedExportUri,
        originalUri: persistedOriginalUri,
        croppedUri: persistedCroppedUri,
      });

      if ((i + 1) % 4 === 0) {
        await yieldToUI();
      }
    }
    const cleanedImages = safeImages.filter(
      (img) => !!img && typeof img.uri === "string",
    );

    const persistedShipPhotoUri = ship.shipPhotoUri
      ? await persistImage(ship.shipPhotoUri)
      : null;
    const persistedCompanyLogoUri = ship.companyLogoUri
      ? await persistImage(ship.companyLogoUri)
      : null;
    const persistedShip = {
      ...ship,
      shipPhotoUri: persistedShipPhotoUri,
      companyLogoUri: persistedCompanyLogoUri,
    };

    const inspectionId = Date.now().toString();

    try {
      const { key, data: existing } = await loadScopedInspectionsWithMigration(user?.id);
      const list = parseInspectionsFromStorage(existing);

      const now = Date.now();
      const newInspection: Inspection = {
        id: inspectionId,
        userId: user?.id || null,
        createdAt: now,
        updatedAt: now,
        ship: persistedShip,
        report: {
          imagesPerPage,
          images: safeImages,
        },
        status: "completed",
        syncStatus: "pending",
        exported_as: null,
        exported_at: null,
        export: undefined,
      };

      const updated = [newInspection, ...list];
      const limited = updated.slice(0, 20);
      await AsyncStorage.setItem(key, JSON.stringify(limited));
      await addToSyncQueue(newInspection.id);
      await syncPendingInspections(user?.id);
    } catch {
      // Storage failure should not block preview / export flow.
    }

    console.log("IMAGES SENT:", cleanedImages);

    navigation.navigate("ReportPreview", {
      inspectionId,
      inspectionCreatedAt: Number(inspectionId),
      ship: persistedShip,
      images: cleanedImages,
      report: {
        imagesPerPage,
        images: cleanedImages, // ✅ includes description
      },
    });
  }

  // ✅ Camera screen
  if (cameraOpen) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />

        <View style={styles.cameraControls}>
          <Pressable style={styles.camBtn} onPress={() => setCameraOpen(false)}>
            <Text style={styles.camBtnText}>Close</Text>
          </Pressable>

          <Pressable style={styles.captureBtn} onPress={takePhoto} />

          <Pressable style={styles.camBtn} onPress={pickImages}>
            <Text style={styles.camBtnText}>Gallery</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 60}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={[styles.container, { flexGrow: 1, paddingBottom: 140 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
      <Text style={styles.title}>Upload Images</Text>

      {/* ✅ Images per page (same section like screenshot, keep your style) */}
      <Text style={styles.subHeading}>Images per page</Text>

      <View style={styles.dropdownWrap}>
        <Pressable
          style={styles.dropdown}
          onPress={() => setMenuOpen((s) => !s)}
        >
          <Text style={styles.dropdownText}>{imagesPerPage} images</Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </Pressable>

        {menuOpen ? (
          <View style={styles.menu}>
            {IMAGES_PER_PAGE_OPTIONS.map((n) => (
              <Pressable
                key={n}
                style={styles.menuItem}
                onPress={() => {
                  setImagesPerPage(n);
                  setMenuOpen(false);
                }}
              >
                <Text style={styles.menuText}>{n} images</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* ✅ Buttons: keep your existing style */}
      <View style={styles.actionsRow}>
        <Pressable style={styles.actionBtn} onPress={openCamera}>
          <Text style={styles.actionBtnText}>Camera</Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={pickImages}>
          <Text style={styles.actionBtnText}>Gallery</Text>
        </Pressable>
      </View>

      <View style={{ marginVertical: 10 }}>
        <Text style={{ fontSize: 14, color: "#666" }}>
          Images: {items.length}
        </Text>
      </View>

      {/* ✅ Grid: same as your grid + add description input below each image */}
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.id} style={styles.gridCard}>
            <View style={styles.gridItem}>
              <Image
                source={{ uri: item.uri }}
                resizeMode="cover"
                style={styles.thumb}
              />
              <Pressable
                style={styles.removeBadge}
                onPress={() => removeImage(item.id)}
              >
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            </View>

            <TextInput
              value={item.description}
              onChangeText={(t) => setDescription(item.id, t)}
              placeholder="Image description"
              placeholderTextColor="#888"
              style={styles.descInput}
            />

            <View style={styles.imageActionRow}>
              <Pressable
                style={styles.editCropBtn}
                onPress={() => void handleReplaceImage(item)}
              >
                <Text style={styles.editCropBtnText}>Replace Image</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 18 }}>
        <PrimaryButton title="PREVIEW & SUBMIT" onPress={goNext} />
      </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 14,
  },

  subHeading: {
    fontWeight: "800",
    marginBottom: 8,
    color: "#111",
  },

  dropdownWrap: {
    position: "relative",
    marginBottom: 14,
  },
  dropdown: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownText: {
    fontWeight: "700",
    color: "#111",
  },
  dropdownArrow: {
    color: "#333",
    fontSize: 12,
  },
  menu: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    overflow: "hidden",
    zIndex: 10,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuText: {
    fontWeight: "700",
    color: "#111",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#111",
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  // one card = image + input
  gridCard: {
    width: "48%",
  },

  gridItem: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#eee",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },

  descInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "600",
    color: "#111",
  },

  editCropBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
  },
  editCropBtnText: {
    fontWeight: "700",
    color: "#111827",
    fontSize: 13,
  },
  imageActionRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },

  removeBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 20,
    fontWeight: "800",
    marginTop: -2,
  },

  // camera
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  camBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  camBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 6,
    borderColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
});
