import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { syncPendingInspections } from "../services/syncInspection";
import { generateAndShareDocx } from "../utils/docxExport";
import {
    parseInspectionsFromStorage,
    type ExportType,
    type Inspection,
    type ReportImage,
} from "../utils/inspectionStorage";
import { generatePDF } from "../utils/nativePdfGenerator";
import { persistImage } from "../utils/persistImage";
import { loadScopedInspectionsWithMigration } from "../utils/storageScope";

type PreviewReportImage = {
  id?: string;
  uri: string;
  exportUri?: string;
  description: string;
  title?: string;
  originalUri?: string;
  croppedUri?: string;
};

function chunkByPage<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function getColumns(imagesPerPage: number): 1 | 2 {
  return imagesPerPage === 2 ? 1 : 2;
}

function getImageHeight(imagesPerPage: number, columns: 1 | 2): number {
  if (columns === 1) {
    return 170;
  }
  if (imagesPerPage <= 4) {
    return 138;
  }
  if (imagesPerPage <= 6) {
    return 110;
  }
  return 88;
}

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export default function ReportPreviewScreen({ navigation, route }: any) {
  const routeShip = route.params?.ship || {};
  const routeReport = route.params?.report;
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const inspectionId = route.params?.inspectionId as string | undefined;
  const existingCreatedAt = route.params?.inspectionCreatedAt as number | undefined;

  const [shipInfo, setShipInfo] = useState(routeShip);
  const [imagesPerPage, setImagesPerPage] = useState<number>(
    routeReport?.imagesPerPage ?? 2,
  );
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<null | "pdf" | "doc">(null);
  const [exportedAs, setExportedAs] = useState<ExportType | undefined>(undefined);
  const [exportedAt, setExportedAt] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(0);

  const [images, setImages] = useState<PreviewReportImage[]>(
    route.params?.images ?? route.params?.report?.images ?? [],
  );

  const safeImages = useMemo(
    () =>
      (images || []).filter(
        (img): img is PreviewReportImage =>
          !!img && typeof img.uri === "string" && img.uri.length > 0,
      ),
    [images],
  );

  const safeImagesPerPage = useMemo(() => {
    if (imagesPerPage === 2 || imagesPerPage === 4 || imagesPerPage === 6 || imagesPerPage === 8) {
      return imagesPerPage;
    }
    return 2;
  }, [imagesPerPage]);

  const previewPages = useMemo(
    () => chunkByPage(safeImages, safeImagesPerPage),
    [safeImages, safeImagesPerPage],
  );

  const columns = useMemo(() => getColumns(safeImagesPerPage), [safeImagesPerPage]);
  const imageHeight = useMemo(
    () => getImageHeight(safeImagesPerPage, columns),
    [safeImagesPerPage, columns],
  );
  const pageWidth = Math.max(width - 32, 1);
  const rowsPerPage = Math.ceil(safeImagesPerPage / columns);
  const pagerHeight = rowsPerPage * (imageHeight + 56) + (rowsPerPage - 1) * 10 + 12;

  useEffect(() => {
    setCurrentPage((prev) =>
      Math.min(prev, Math.max(previewPages.length - 1, 0)),
    );
  }, [previewPages.length]);

  useEffect(() => {
    let cancelled = false;

    async function loadExistingInspectionForEdit() {
      if (!inspectionId) {
        return;
      }
      try {
        const { data: existing } = await loadScopedInspectionsWithMigration(user?.id);
        const list = parseInspectionsFromStorage(existing);
        const current = list.find((item) => item.id === inspectionId);
        if (!current || cancelled) {
          return;
        }

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

      const uris = [shipInfo?.shipPhotoUri, ...safeImages.map((img) => img.uri)].filter(
        (uri): uri is string => !!uri,
      );

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

  async function prepareImagesForExport(): Promise<PreviewReportImage[]> {
    const prepared = [...safeImages];
    setImages(prepared);
    return prepared;
  }

  function toExportImages(items: PreviewReportImage[]): ReportImage[] {
    return items.map((img, index) => ({
      id: img.id || `img-${index}`,
      uri: img.exportUri || img.uri,
      exportUri: img.exportUri || img.uri,
      description: img.description || "",
      originalUri: img.originalUri,
      croppedUri: img.croppedUri,
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
      // Ignore local export tracking failures.
    }
  }

  async function exportPDF() {
    try {
      setExporting("pdf");
      const prepared = await prepareImagesForExport();
      const pdfPath = await generatePDF({
        images: toExportImages(prepared),
        imagesPerPage: safeImagesPerPage,
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
        imagesPerPage: safeImagesPerPage,
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
    if (saving) {
      return;
    }
    if (!inspectionId) {
      Alert.alert("Error", "Inspection id missing");
      return;
    }

    setSaving(true);
    try {
      const { key, data: existing } = await loadScopedInspectionsWithMigration(user?.id);
      const list = parseInspectionsFromStorage(existing);
      const inspection = list.find((item) => item.id === inspectionId);
      const now = Date.now();

      const persistedShipPhotoUri = shipInfo.shipPhotoUri
        ? await persistImage(shipInfo.shipPhotoUri)
        : undefined;
      const persistedCompanyLogoUri = shipInfo.companyLogoUri
        ? await persistImage(shipInfo.companyLogoUri)
        : undefined;

      const updatedInspection: Inspection = {
        id: inspectionId,
        userId: inspection?.userId || user?.id || null,
        createdAt: existingCreatedAt || now,
        updatedAt: now,
        status: "draft",
        syncStatus: "pending",
        exported_as: inspection?.exported_as,
        exported_at: inspection?.exported_at,
        ship: {
          ...shipInfo,
          shipPhotoUri: persistedShipPhotoUri,
          companyLogoUri: persistedCompanyLogoUri,
        },
        report: {
          images: [],
          imagesPerPage: safeImagesPerPage,
        },
      };

      for (let i = 0; i < safeImages.length; i += 1) {
        const img = safeImages[i];
        const persistedUri = await persistImage(img.uri);

        updatedInspection.report.images.push({
          id: img.id || `${inspectionId}-${i}`,
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
          description: img.description || "",
        });

        if ((i + 1) % 4 === 0) {
          await yieldToUI();
        }
      }

      const updated = [updatedInspection, ...list.filter((item) => item.id !== inspectionId)];
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

  function onPreviewPagerScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pageWidth <= 0) {
      return;
    }
    const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    const bounded = Math.min(Math.max(index, 0), Math.max(previewPages.length - 1, 0));
    setCurrentPage(bounded);
  }

  const renderPreviewPage = ({ item, index }: { item: PreviewReportImage[]; index: number }) => {
    const cardWidth = columns === 1 ? pageWidth : (pageWidth - 10) / 2;
    return (
      <View style={[styles.previewPage, { width: pageWidth }]}>
        <FlatList
          data={item}
          key={`${columns}-${safeImagesPerPage}-${index}`}
          keyExtractor={(img, imgIndex) => `${img.id ?? img.uri}-${imgIndex}`}
          numColumns={columns}
          scrollEnabled={false}
          columnWrapperStyle={columns === 2 ? styles.previewRow : undefined}
          renderItem={({ item: img }) => (
            <View style={[styles.previewCard, { width: cardWidth }]}>
              <Image source={{ uri: img.uri }} resizeMode="cover" style={[styles.previewImage, { height: imageHeight }]} />
              {img.title ? (
                <Text numberOfLines={1} style={styles.imageTitle}>
                  {img.title}
                </Text>
              ) : null}
              <Text numberOfLines={3} style={styles.imageDescription}>
                {img.description?.trim() || "No description"}
              </Text>
            </View>
          )}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Report Preview</Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Ship Name:</Text>
          <Text style={styles.metaValue}>{shipInfo.shipName || "-"}</Text>
        </View>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Ship Type:</Text>
          <Text style={styles.metaValue}>{shipInfo.shipType || "-"}</Text>
        </View>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Inspector:</Text>
          <Text style={styles.metaValue}>{shipInfo.inspectorName ?? shipInfo.surveyorName ?? "-"}</Text>
        </View>

        {exportedAs ? (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Exported as {exportedAs.toUpperCase()}</Text>
            {exportedAt ? (
              <Text style={styles.metaValue}>
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
          <Image source={{ uri: shipInfo.shipPhotoUri }} resizeMode="cover" style={styles.shipPhoto} />
        )}

        <Text style={styles.sectionTitle}>
          Layout preview: {safeImages.length} photos ({safeImagesPerPage} per page)
        </Text>

        {previewPages.length > 0 ? (
          <>
            <FlatList
              horizontal
              data={previewPages}
              pagingEnabled
              keyExtractor={(_, index) => `preview-page-${index}`}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPreviewPagerScroll}
              style={{ height: pagerHeight }}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews
              renderItem={renderPreviewPage}
            />

            <Text style={styles.pageIndicator}>
              Page {currentPage + 1} of {previewPages.length}
            </Text>
          </>
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyPreviewText}>No images to preview yet.</Text>
          </View>
        )}

        <View style={styles.actionGroup}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 140,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  metaBlock: {
    marginBottom: 10,
  },
  metaLabel: {
    fontWeight: "800",
    color: "#111827",
  },
  metaValue: {
    marginTop: 2,
    color: "#374151",
  },
  shipPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 14,
  },
  sectionTitle: {
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  previewPage: {
    paddingBottom: 8,
  },
  previewRow: {
    justifyContent: "space-between",
    marginBottom: 10,
  },
  previewCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  previewImage: {
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  imageTitle: {
    marginTop: 7,
    fontWeight: "800",
    color: "#111827",
  },
  imageDescription: {
    marginTop: 5,
    color: "#4B5563",
    fontSize: 12,
    lineHeight: 17,
  },
  pageIndicator: {
    marginTop: 8,
    textAlign: "center",
    color: "#374151",
    fontWeight: "700",
  },
  emptyPreview: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPreviewText: {
    color: "#6B7280",
    fontWeight: "600",
  },
  actionGroup: {
    marginTop: 14,
    gap: 10,
  },
});
