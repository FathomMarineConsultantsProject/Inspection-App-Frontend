import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
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
import { useAuth } from "../context/AuthContext";
import { syncPendingInspections } from "../services/syncInspection";
import { COLORS } from "../theme/colors";
import { generateAndShareDocx } from "../utils/docxExport";
import {
    parseInspectionsFromStorage,
    type ExportType,
} from "../utils/inspectionStorage";
import { generatePDF } from "../utils/nativePdfGenerator";
import { persistImage } from "../utils/persistImage";
import { processImage, processImages } from "../utils/processImage";
import { loadScopedInspectionsWithMigration } from "../utils/storageScope";

type PreviewReportImage = {
  id?: string;
  uri: string;
  exportUri?: string;
  description: string;
  originalUri?: string;
  croppedUri?: string;
};

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export default function ReportPreviewScreen({ navigation, route }: any) {
  const { ship, report } = route.params;
  const { user } = useAuth();
  const { inspectionId } = route.params;
  const existingCreatedAt = route.params?.inspectionCreatedAt as number | undefined;
  const [shipInfo, setShipInfo] = useState(ship);
  const [imagesPerPage, setImagesPerPage] = useState(report?.imagesPerPage ?? 2);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<null | "pdf" | "doc">(null);
  const [exportedAs, setExportedAs] = useState<ExportType | undefined>(undefined);
  const [exportedAt, setExportedAt] = useState<string | undefined>(undefined);

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
        const { data: existing } = await loadScopedInspectionsWithMigration(user?.id);
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
        setExportedAs(current.exported_as);
        setExportedAt(current.exported_at);
      } catch {
        // Keep initial route payload if storage read fails.
      }
    }

    void loadExistingInspectionForEdit();
    return () => {
      cancelled = true;
    };
  }, [inspectionId, user?.id]);

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
        const processedUri = await processImage(newUri);
        setImages((prev) =>
          prev.map((img, i) =>
            i === index
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
      const originalUris = result.assets.map((asset) => asset.uri);
      const processedUris = await processImages(originalUris);

      const newImages: PreviewReportImage[] = result.assets.map((asset, index) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        uri: processedUris[index] || asset.uri,
        exportUri: processedUris[index] || asset.uri,
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
      uri: img.exportUri || img.uri,
    }));
  }

  async function applyLocalExportTracking(exportType: ExportType, timestamp: string) {
    if (!inspectionId) {
      return;
    }
    try {
      const { key, data: existing } = await loadScopedInspectionsWithMigration(user?.id);
      const list = parseInspectionsFromStorage(existing);
      const updated = list.map((item) =>
        item.id === inspectionId
          ? {
              ...item,
              exported_as: exportType,
              exported_at: timestamp,
              syncStatus: "pending" as const,
              updatedAt: Date.now(),
            }
          : item,
      );
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      setExportedAs(exportType);
      setExportedAt(timestamp);
    } catch {
      // ignore
    }
  }

  async function exportPDF() {
    try {
      setExporting("pdf");
      console.log("PDF export started");
      const prepared = await prepareImagesForExport();
      const pdfPath = await generatePDF({
        images: toExportImages(prepared),
        imagesPerPage: imagesPerPage,
        reportDetails: {
          companyName: shipInfo?.companyName || shipInfo?.shipName || "Inspection Report",
          shipName: shipInfo?.shipName,
          inspector: shipInfo?.inspectorName || shipInfo?.surveyorName,
          port: shipInfo?.portName || shipInfo?.location,
          date: shipInfo?.inspectionDate || shipInfo?.date,
        },
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        throw new Error(`Sharing is not available on this device. PDF saved at: ${pdfPath}`);
      }

      await Sharing.shareAsync(pdfPath, {
        mimeType: "application/pdf",
        dialogTitle: "Share Inspection Report",
        UTI: "com.adobe.pdf",
      });

      if (inspectionId) {
        const timestamp = new Date().toISOString();
        await applyLocalExportTracking("pdf", timestamp);
      }

      await syncPendingInspections(user?.id);
    } catch (e: any) {
      console.log("PDF export error =>", e);
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setExporting(null);
    }
  }

  async function exportDOCX() {
    try {
      setExporting("doc");
      const prepared = await prepareImagesForExport();
      await generateAndShareDocx({
        shipInfo,
        images: toExportImages(prepared),
        imagesPerPage,
      });

      if (inspectionId) {
        const timestamp = new Date().toISOString();
        await applyLocalExportTracking("doc", timestamp);
      }

      await syncPendingInspections(user?.id);
    } catch (err) {
      console.error("DOCX export failed:", err);
      Alert.alert("Error", "Failed to export DOCX");
    } finally {
      setExporting(null);
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
      const { key, data: existing } = await loadScopedInspectionsWithMigration(user?.id);
      const list = parseInspectionsFromStorage(existing);
      const inspection = list.find((i) => i.id === inspectionId);
      const now = Date.now();
      const persistedShipPhotoUri = shipInfo.shipPhotoUri
        ? await persistImage(shipInfo.shipPhotoUri)
        : undefined;
      const persistedCompanyLogoUri = shipInfo.companyLogoUri
        ? await persistImage(shipInfo.companyLogoUri)
        : undefined;

      const updatedInspection = {
        id: inspectionId,
        userId: inspection?.userId || user?.id || null,
        createdAt: existingCreatedAt || now,
        updatedAt: now,
        status: "draft" as const,
        syncStatus: "pending" as const,
        exported_as: inspection?.exported_as ?? null,
        exported_at: inspection?.exported_at ?? null,
        ship: {
          ...shipInfo,
          shipPhotoUri: persistedShipPhotoUri,
          companyLogoUri: persistedCompanyLogoUri,
        },
        report: {
          images: [] as PreviewReportImage[],
          imagesPerPage,
        },
      };

      for (let i = 0; i < images.length; i += 1) {
        const img = images[i];
        const persistedUri = await persistImage(img.uri);
        updatedInspection.report.images.push({
          ...img,
          uri: persistedUri,
          exportUri: img.exportUri
            ? await persistImage(img.exportUri)
            : persistedUri,
          originalUri: img.originalUri
            ? await persistImage(img.originalUri)
            : undefined,
          croppedUri: img.croppedUri
            ? await persistImage(img.croppedUri)
            : undefined,
        });

        if ((i + 1) % 4 === 0) {
          await yieldToUI();
        }
      }

      const updated = [
        updatedInspection,
        ...list.filter((i) => i.id !== inspectionId),
      ];

      await AsyncStorage.setItem(key, JSON.stringify(updated));
      await syncPendingInspections(user?.id);
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

      {exportedAs ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: "800" }}>
            Exported as {exportedAs.toUpperCase()}
          </Text>
          {exportedAt ? (
            <Text>
              {new Date(exportedAt).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
          ) : null}
        </View>
      ) : null}

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
        <PrimaryButton
          title={exporting === "pdf" ? "Exporting..." : "Export as PDF"}
          onPress={exportPDF}
          disabled={exporting !== null}
        />
        <PrimaryButton
          title={exporting === "doc" ? "Exporting..." : "Export as DOC"}
          onPress={exportDOCX}
          disabled={exporting !== null}
        />
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
