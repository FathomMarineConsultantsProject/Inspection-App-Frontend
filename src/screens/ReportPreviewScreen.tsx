import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import { exportInspectionPDF } from "../utils/pdfExports";
import { generateAndShareDocx } from "../utils/docxExport";
import { autoCenterCropToAspect } from "../utils/imageCrop";

type PreviewReportImage = {
  id?: string;
  uri: string;
  description: string;
  originalUri?: string;
  croppedUri?: string;
};

export default function ReportPreviewScreen({ navigation, route }: any) {
  const { ship, report } = route.params;
  const shipInfo = ship;

  const [images, setImages] = useState<PreviewReportImage[]>(
    route.params?.report?.images ?? [],
  );
  const imagesPerPage = report?.imagesPerPage ?? 2;

  function updateDescription(id: string, text: string) {
    setImages((prev) =>
      prev.map((img, i) =>
        String(img.id ?? i) === id ? { ...img, description: text } : img,
      ),
    );
  }

  async function handleEditCropAt(index: number) {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow gallery access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const newUri = result.assets[0].uri;
        setImages((prev) =>
          prev.map((img, i) =>
            i === index ? { ...img, croppedUri: newUri } : img,
          ),
        );
      }
    } catch (e) {
      console.log("Crop error", e);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function autoCropMissingImages() {
      const needsCrop = images.some((img) => !img.croppedUri && !!img.uri);
      if (!needsCrop) return;

      const processed = await Promise.all(
        images.map(async (img) => {
          if (img.croppedUri || !img.uri) return img;
          try {
            const sourceUri = img.originalUri || img.uri;
            const croppedUri = await autoCenterCropToAspect(sourceUri, 16 / 9);
            return {
              ...img,
              originalUri: img.originalUri || img.uri,
              croppedUri,
            };
          } catch {
            return {
              ...img,
              originalUri: img.originalUri || img.uri,
            };
          }
        })
      );

      if (!cancelled) {
        setImages(processed);
      }
    }

    autoCropMissingImages();
    return () => {
      cancelled = true;
    };
  }, [images]);

  async function prepareImagesForExport(): Promise<PreviewReportImage[]> {
    const prepared = await Promise.all(
      images.map(async (img) => {
        if (img.croppedUri) return img;
        try {
          const sourceUri = img.originalUri || img.uri;
          const croppedUri = await autoCenterCropToAspect(sourceUri, 16 / 9);
          return {
            ...img,
            originalUri: img.originalUri || img.uri,
            croppedUri,
          };
        } catch {
          return {
            ...img,
            originalUri: img.originalUri || img.uri,
          };
        }
      })
    );
    setImages(prepared);
    return prepared;
  }

  function toExportImages(items: PreviewReportImage[]) {
    return items.map((img) => ({
      ...img,
      uri: img.croppedUri || img.uri,
    }));
  }

  async function exportPDF() {
    try {
      console.log("PDF export started");
      const prepared = await prepareImagesForExport();
      await exportInspectionPDF({
        shipInfo: ship,
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
      <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 10 }}>
        Report Preview
      </Text>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: "800" }}>Ship Name:</Text>
        <Text>{ship.shipName}</Text>
      </View>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: "800" }}>Ship Type:</Text>
        <Text>{ship.shipType}</Text>
      </View>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: "800" }}>Inspector:</Text>
        <Text>{ship.inspectorName ?? ship.surveyorName ?? "-"}</Text>
      </View>

      {!!ship.shipPhotoUri && (
        <Image
          source={{ uri: ship.shipPhotoUri }}
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
        Report Photos: {images.length} (Images per page: {imagesPerPage})
      </Text>

      {images.map((img: any, index: number) => (
        <View key={img.id ?? img.uri} style={{ marginBottom: 14 }}>
          <Image
            source={{ uri: img.croppedUri || img.uri }}
            resizeMode="cover"
            style={{ width: "100%", height: 180, borderRadius: 12 }}
          />
          <Pressable
            onPress={() => void handleEditCropAt(index)}
            style={{
              alignSelf: "flex-start",
              marginTop: 8,
              marginBottom: 2,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: "#E5E7EB",
            }}
          >
            <Text style={{ fontWeight: "700", color: "#111827" }}>Edit / Crop</Text>
          </Pressable>
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
      </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}