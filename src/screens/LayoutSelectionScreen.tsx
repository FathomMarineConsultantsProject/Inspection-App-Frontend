import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { syncPendingInspections } from "../services/syncInspection";
import { addToSyncQueue, parseInspectionsFromStorage, type Inspection, type InspectionShip, type ReportImage } from "../utils/inspectionStorage";
import { persistImage } from "../utils/persistImage";
import { loadScopedInspectionsWithMigration } from "../utils/storageScope";

type Props = {
  navigation: any;
  route: any;
};

type ProcessingImage = ReportImage & {
  title?: string;
};

const IMAGE_LAYOUT_OPTIONS = [2, 4, 6, 8] as const;

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function LayoutSelectionScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const ship = route.params?.ship as InspectionShip | undefined;
  const images = (route.params?.images || []) as ProcessingImage[];

  const [imagesPerPage, setImagesPerPage] =
    useState<(typeof IMAGE_LAYOUT_OPTIONS)[number]>(2);
  const [submitting, setSubmitting] = useState(false);

  async function goToPreview() {
    if (submitting) {
      return;
    }

    if (!ship) {
      Alert.alert("Missing details", "Inspection details are missing. Please restart the flow.");
      return;
    }

    if (images.length === 0) {
      Alert.alert("Add photos", "Please add at least 1 photo for the report.");
      return;
    }

    setSubmitting(true);

    const inspectionId = Date.now().toString();

    try {
      const persistedImages: ReportImage[] = [];
      for (let i = 0; i < images.length; i += 1) {
        const image = images[i];

        if (!image?.uri) {
          continue;
        }

        const persistedUri = await persistImage(image.uri);
        const exportSourceUri = image.exportUri || image.uri;
        const persistedExportUri = await persistImage(exportSourceUri);
        const persistedOriginalUri = image.originalUri
          ? await persistImage(image.originalUri)
          : undefined;
        const persistedCroppedUri = image.croppedUri
          ? await persistImage(image.croppedUri)
          : undefined;

        persistedImages.push({
          id: image.id || makeId(),
          uri: persistedUri,
          exportUri: persistedExportUri,
          description: image.description || "",
          originalUri: persistedOriginalUri,
          croppedUri: persistedCroppedUri,
        });

        if ((i + 1) % 4 === 0) {
          await yieldToUI();
        }
      }

      const cleanedImages = persistedImages.filter(
        (img) => typeof img.uri === "string" && img.uri.length > 0,
      );

      const persistedShipPhotoUri = ship.shipPhotoUri
        ? await persistImage(ship.shipPhotoUri)
        : undefined;
      const persistedCompanyLogoUri = ship.companyLogoUri
        ? await persistImage(ship.companyLogoUri)
        : undefined;

      const persistedShip: InspectionShip = {
        ...ship,
        shipPhotoUri: persistedShipPhotoUri,
        companyLogoUri: persistedCompanyLogoUri,
      };

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
            images: cleanedImages,
          },
          status: "completed",
          syncStatus: "pending",
          exported_as: undefined,
          exported_at: undefined,
          export: undefined,
        };

        const updated = [newInspection, ...list];
        const limited = updated.slice(0, 20);
        await AsyncStorage.setItem(key, JSON.stringify(limited));
        await addToSyncQueue(newInspection.id);
        await syncPendingInspections(user?.id);
      } catch {
        // Storage failure should not block preview or export.
      }

      navigation.navigate("ReportPreview", {
        inspectionId,
        inspectionCreatedAt: Number(inspectionId),
        ship: persistedShip,
        images: cleanedImages,
        report: {
          imagesPerPage,
          images: cleanedImages,
        },
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Layout Selection</Text>
        <Text style={styles.subtitle}>
          Choose how many images should appear on each report page.
        </Text>

        <View style={styles.metaBox}>
          <Text style={styles.metaText}>Selected images: {images.length}</Text>
          <Text style={styles.metaText}>Current choice: {imagesPerPage} per page</Text>
        </View>

        <View style={styles.optionsWrap}>
          {IMAGE_LAYOUT_OPTIONS.map((option) => {
            const active = option === imagesPerPage;
            return (
              <Pressable
                key={option}
                onPress={() => setImagesPerPage(option)}
                style={[styles.optionCard, active && styles.optionCardActive]}
              >
                <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                  {option}
                </Text>
                <Text style={[styles.optionSubtitle, active && styles.optionSubtitleActive]}>
                  images/page
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footerButton}>
          <PrimaryButton
            title={submitting ? "Preparing Preview..." : "Next: Preview"}
            onPress={() => void goToPreview()}
            disabled={submitting}
            loading={submitting}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: 6,
    color: "#4B5563",
    fontSize: 13,
    lineHeight: 18,
  },
  metaBox: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  metaText: {
    color: "#374151",
    fontWeight: "600",
  },
  optionsWrap: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionCard: {
    width: "48%",
    minHeight: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  optionCardActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  optionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  optionTitleActive: {
    color: "#1D4ED8",
  },
  optionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
  },
  optionSubtitleActive: {
    color: "#2563EB",
  },
  footerButton: {
    marginTop: "auto",
  },
});
