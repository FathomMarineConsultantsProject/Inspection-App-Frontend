import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import PrimaryButton from "../components/PrimaryButton";
import { COLORS } from "../theme/colors";
import { exportInspectionPDF } from "../utils/pdfExports";
import { persistImage } from "../utils/persistImage";
import { generateAndShareDocx } from "../utils/docxExport";
import { parseInspectionsFromStorage } from "../utils/inspectionStorage";

type PreviewReportImage = {
  id?: string;
  uri: string;
  description: string;
  originalUri?: string;
  croppedUri?: string;
};

export default function ReportPreviewScreen({ navigation, route }: any) {
  const { ship, report } = route.params;
  const { inspectionId } = route.params;
  const existingCreatedAt = route.params?.inspectionCreatedAt as number | undefined;
  const [shipInfo, setShipInfo] = useState(ship);
  const [imagesPerPage, setImagesPerPage] = useState(report?.imagesPerPage ?? 2);
  const [saving, setSaving] = useState(false);

  const [images, setImages] = useState<PreviewReportImage[]>(
    route.params?.images ?? route.params?.report?.images ?? [],
  );

  const safeImages = useMemo(
    () =>
      (images || []).filter(
        (img) => !!img && typeof img.uri === "string" && img.uri,
      ),
    [images],
  );

  useEffect(() => {
    console.log("IMAGES RECEIVED:", route.params?.images ?? route.params?.report?.images ?? []);
  }, [route.params?.images, route.params?.report?.images]);

  useEffect(() => {
    let cancelled = false;

    async function loadExistingInspectionForEdit() {
      if (!inspectionId) return;
      try {
        const existing = await AsyncStorage.getItem("inspections");
        const list = parseInspectionsFromStorage(existing);
        const current = list.find((item) => item.id === inspectionId);
        if (!current || cancelled) return;

        const validInspection = {
          ...current,
          report: {
            ...current.report,
            images: (current.report?.images || []).filter(
              (img) => img && typeof img.uri === "string",
            ),
          },
        };

        setShipInfo(validInspection.ship);
        setImages(validInspection.report.images ?? []);
        setImagesPerPage(current.report?.imagesPerPage ?? 2);
      } catch {
        // Keep initial route payload if storage read fails.
      }
    }

    void loadExistingInspectionForEdit();
    return () => {
      cancelled = true;
    };
  }, [inspectionId]);

  useEffect(() => {
    async function checkImageUrisExist() {
      async function checkImageExists(uri: string): Promise<boolean> {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          return info.exists;
        } catch {
          return false;
        }
      }

      const uris = [
        shipInfo?.shipPhotoUri,
        ...safeImages.map((img) => img.uri),
      ].filter((uri): uri is string => !!uri);

      await Promise.all(
        uris.map(async (uri) => {
          const exists = await checkImageExists(uri);
          if (!exists) {
            console.log("Image file missing:", uri);
          }
        }),
      );
    }

    void checkImageUrisExist();
  }, [safeImages, shipInfo?.shipPhotoUri]);

  function updateDescription(id: string, text: string) {
    setImages((prev) =>
      prev.map((img, i) =>
        String(img.id ?? i) === id ? { ...img, description: text } : img,
      ),
    );
  }

  async function handleReplaceImageAt(index: number) {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow gallery access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newUri = result.assets[0].uri;
        setImages((prev) =>
          prev.map((img, i) =>
            i === index
              ? { ...img, uri: newUri, originalUri: newUri }
              : img,
          ),
        );
      }
    } catch (e) {
      console.log("Crop error", e);
    }
  }

  async function handleAddImages() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow gallery access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });
      if (result.canceled) return;

      const newImages: PreviewReportImage[] = result.assets.map((asset) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        uri: asset.uri,
        originalUri: asset.uri,
        description: "",
      }));
      setImages((prev) => [...prev, ...newImages]);
    } catch (e) {
      console.log("Add image error", e);
    }
  }

  function handleDeleteImageAt(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function prepareImagesForExport(): Promise<PreviewReportImage[]> {
    const prepared = [...safeImages];
    setImages(prepared);
    return prepared;
  }

  function toExportImages(items: PreviewReportImage[]) {
    return items.map((img) => ({
      ...img,
      uri: img.uri,
    }));
  }

  async function exportPDF() {
    try {
      console.log("PDF export started");
      const prepared = await prepareImagesForExport();
      await exportInspectionPDF({
        shipInfo,
        images: toExportImages(prepared),
        imagesPerPage: imagesPerPage,
      });
    } catch (e: any) {
      console.log("PDF export error =>", e);
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    }
  }

  async function exportDOCX() {
    try {
      const prepared = await prepareImagesForExport();
      await generateAndShareDocx({
        shipInfo,
        images: toExportImages(prepared),
        imagesPerPage,
      });
    } catch (err) {
      console.error("DOCX export failed:", err);
      Alert.alert("Error", "Failed to export DOCX");
    }
  }

  async function handleSaveDraft() {
    if (saving) return;
    if (!inspectionId) {
      Alert.alert("Error", "Inspection id missing");
      return;
    }
    setSaving(true);
    try {
      const existing = await AsyncStorage.getItem("inspections");
      const list = parseInspectionsFromStorage(existing);
      const now = Date.now();
      const persistedShipPhotoUri = shipInfo.shipPhotoUri
        ? await persistImage(shipInfo.shipPhotoUri)
        : undefined;
      const persistedCompanyLogoUri = shipInfo.companyLogoUri
        ? await persistImage(shipInfo.companyLogoUri)
        : undefined;

      const updatedInspection = {
        id: inspectionId,
        createdAt: existingCreatedAt || now,
        updatedAt: now,
        status: "draft" as const,
        syncStatus: "pending" as const,
        ship: {
          ...shipInfo,
          shipPhotoUri: persistedShipPhotoUri,
          companyLogoUri: persistedCompanyLogoUri,
        },
        report: {
          images: await Promise.all(
            images.map(async (img) => ({
              ...img,
              uri: await persistImage(img.uri),
              originalUri: img.originalUri
                ? await persistImage(img.originalUri)
                : undefined,
              croppedUri: img.croppedUri
                ? await persistImage(img.croppedUri)
                : undefined,
            })),
          ),
          imagesPerPage,
        },
      };

      const updated = [
        updatedInspection,
        ...list.filter((i) => i.id !== inspectionId),
      ];

      await AsyncStorage.setItem("inspections", JSON.stringify(updated));
      Alert.alert("Saved", "Inspection updated successfully");
      setTimeout(() => {
        navigation.navigate("HomeMain");
      }, 450);
    } catch {
      Alert.alert("Error", "Failed to save inspection");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAwareScrollView
          enableOnAndroid={true}
          extraScrollHeight={120}
          contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
      <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 10 }}>
        Report Preview
      </Text>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: "800" }}>Ship Name:</Text>
        <Text>{shipInfo.shipName}</Text>
      </View>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: "800" }}>Ship Type:</Text>
        <Text>{shipInfo.shipType}</Text>
      </View>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: "800" }}>Inspector:</Text>
        <Text>{shipInfo.inspectorName ?? shipInfo.surveyorName ?? "-"}</Text>
      </View>

      {!!shipInfo.shipPhotoUri && (
        <Image
          source={{ uri: shipInfo.shipPhotoUri }}
          onError={() => console.log("Image failed:", shipInfo.shipPhotoUri)}
          resizeMode="cover"
          style={{
            width: "100%",
            height: 180,
            borderRadius: 12,
            marginBottom: 16,
          }}
        />
      )}

      <Text style={{ fontWeight: "800", marginBottom: 8 }}>
        Report Photos: {safeImages.length} (Images per page: {imagesPerPage})
      </Text>

      <Pressable
        onPress={() => void handleAddImages()}
        style={{
          width: "100%",
          marginVertical: 12,
          minHeight: 52,
          paddingVertical: 15,
          borderRadius: 14,
          backgroundColor: COLORS.primary,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 10,
          elevation: 4,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={{ fontWeight: "800", color: "#FFFFFF" }}>Add Images</Text>
        </View>
      </Pressable>

      {safeImages.map((img: any, index: number) => (
        <View key={img.id ?? img.uri} style={{ marginBottom: 14 }}>
          <Image
            source={{ uri: img.uri }}
            onError={() => console.log("Image failed:", img.uri)}
            resizeMode="cover"
            style={{ width: "100%", height: 180, borderRadius: 12 }}
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 2 }}>
            <Pressable
              onPress={() => void handleReplaceImageAt(index)}
              style={{
                flex: 1,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: "#E5E7EB",
              }}
            >
              <Text style={{ fontWeight: "700", color: "#111827", textAlign: "center" }}>
                Replace Image
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleDeleteImageAt(index)}
              style={{
                flex: 1,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: "#E5E7EB",
              }}
            >
              <Text style={{ fontWeight: "700", color: "#111827", textAlign: "center" }}>
                Delete Image
              </Text>
            </Pressable>
          </View>
          <Text style={{ marginTop: 8, fontWeight: "800" }}>Image description:</Text>
          <TextInput
            value={img.description || ""}
            onChangeText={(text) => updateDescription(String(img.id ?? index), text)}
            placeholder="Enter description"
            placeholderTextColor="#888"
            multiline
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 10,
              marginTop: 8,
              minHeight: 72,
              textAlignVertical: "top",
            }}
          />
        </View>
      ))}

      <View style={{ gap: 10, marginTop: 10 }}>
        <PrimaryButton title="Export as PDF" onPress={exportPDF} />
        <PrimaryButton title="Export as DOCX" onPress={exportDOCX} />
        <PrimaryButton
          title={saving ? "Saving..." : "Save Inspection"}
          onPress={handleSaveDraft}
          loading={saving}
          disabled={saving}
        />
      </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
    </View>
  );
}
