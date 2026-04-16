import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { generateAndSharePdf, GeneratePdfOptions } from "../utils/pdfGenerator";

type ExportRouteParams = {
  Export: GeneratePdfOptions;
};

export default function ExportScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ExportRouteParams, "Export">>();
  const { shipInfo, images, imagesPerPage } = route.params;

  const [loading, setLoading] = useState(false);

  const estimatedPages = useMemo(() => {
    return 1 + Math.ceil(images.length / imagesPerPage);
  }, [images.length, imagesPerPage]);

  async function handleExportPdf() {
    setLoading(true);

    try {
      console.log("PDF export started");

      await generateAndSharePdf({
        shipInfo: {
          ...shipInfo,
          totalPhotos: images.length,
        },
        images,
        imagesPerPage,
      });

      console.log("PDF export finished");
    } catch (error: any) {
      console.log("PDF export error =>", error);
      Alert.alert(
        "Export Failed",
        error?.message ?? "Something went wrong while generating the PDF."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Export Report</Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>PDF FORMAT</Text>
          <Text style={styles.heroTitle}>SeaTec-style inspection report</Text>
          <Text style={styles.heroSubtitle}>
            Cover page with logo, inspection details, vessel photo, and clean
            photo-grid pages.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Report Summary</Text>

          <SummaryRow label="Ship" value={shipInfo.shipName} />
          <SummaryRow label="Inspector" value={shipInfo.inspector} />
          <SummaryRow label="Port" value={shipInfo.port} />
          <SummaryRow label="Date" value={shipInfo.date} />
          <SummaryRow label="Total Photos" value={String(images.length)} />
          <SummaryRow label="Images per Page" value={String(imagesPerPage)} />
          <SummaryRow
            label="Estimated Pages"
            value={String(estimatedPages)}
            isLast
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cover Page Preview</Text>

          <View style={styles.coverMock}>
            <View style={styles.coverHeaderRow}>
              <View style={styles.logoMock}>
                {shipInfo.companyLogoUri ? (
                  <Image
                    source={{ uri: shipInfo.companyLogoUri }}
                    style={styles.logoPreview}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.logoFallbackText}>LOGO</Text>
                )}
              </View>

              <View style={styles.coverTitleBlock}>
                <Text style={styles.poweredText}>
                  Powered by Fathom Marine consultants
                </Text>
                <Text style={styles.coverTitle}>INSPECTION REPORT</Text>
              </View>

              <Text style={styles.dateText}>{shipInfo.date}</Text>
            </View>

            <View style={styles.coverDivider} />

            <View style={styles.infoPreviewBox}>
              <View style={styles.infoPreviewCol}>
                <Text style={styles.infoPreviewText}>
                  <Text style={styles.infoPreviewLabel}>Ship:</Text>{" "}
                  {shipInfo.shipName}
                </Text>
                <Text style={styles.infoPreviewText}>
                  <Text style={styles.infoPreviewLabel}>Inspector:</Text>{" "}
                  {shipInfo.inspector}
                </Text>
              </View>

              <View style={styles.infoPreviewCol}>
                <Text style={styles.infoPreviewText}>
                  <Text style={styles.infoPreviewLabel}>Port:</Text>{" "}
                  {shipInfo.port}
                </Text>
                <Text style={styles.infoPreviewText}>
                  <Text style={styles.infoPreviewLabel}>Total Photos:</Text>{" "}
                  {images.length}
                </Text>
              </View>
            </View>

            {shipInfo.shipPhotoUri ? (
              <Image
                source={{ uri: shipInfo.shipPhotoUri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewPlaceholderText}>
                  No ship photo selected
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.card, styles.infoCard]}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Export will generate one cover page and{" "}
            {Math.ceil(images.length / imagesPerPage)} image page
            {Math.ceil(images.length / imagesPerPage) > 1 ? "s" : ""} using a
            2-column layout.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.exportBtn, loading && styles.exportBtnDisabled]}
          onPress={handleExportPdf}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.exportBtnText}>Export PDF</Text>
          )}
        </TouchableOpacity>

        {loading ? (
          <Text style={styles.loadingHint}>
            Generating your report. Please wait a few seconds…
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, isLast && styles.summaryRowLast]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const COLORS = {
  primary: "#3BA4F7",
  secondary: "#E6F4FF",
  accent: "#14B8A6",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  text: "#1A1A2E",
  muted: "#6B7A99",
  border: "#DDE3F0",
  navy: "#233A6B",
  lightGray: "#F1F3F5",
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  scroll: {
    padding: 16,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  backBtn: {
    paddingVertical: 4,
  },

  backBtnText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "600",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },

  headerSpacer: {
    width: 56,
  },

  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E8EEF8",
  },

  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: 6,
  },

  heroTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },

  heroSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
    letterSpacing: 0.3,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  summaryRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },

  summaryLabel: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: "500",
  },

  summaryValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "600",
  },

  coverMock: {
    borderWidth: 1,
    borderColor: "#E4E8F0",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#FFFFFF",
  },

  coverHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  logoMock: {
    width: 70,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#F1F3F5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  logoPreview: {
    width: "100%",
    height: "100%",
  },

  logoFallbackText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.muted,
  },

  coverTitleBlock: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },

  poweredText: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 2,
  },

  coverTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.navy,
  },

  dateText: {
    width: 86,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.navy,
  },

  coverDivider: {
    height: 2,
    backgroundColor: COLORS.navy,
    marginBottom: 12,
  },

  infoPreviewBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    backgroundColor: COLORS.lightGray,
    padding: 12,
    marginBottom: 14,
  },

  infoPreviewCol: {
    flex: 1,
    gap: 8,
  },

  infoPreviewText: {
    fontSize: 11,
    color: "#2A2F36",
    lineHeight: 16,
  },

  infoPreviewLabel: {
    fontWeight: "700",
    color: COLORS.navy,
  },

  previewImage: {
    width: "100%",
    height: 190,
    borderRadius: 6,
  },

  previewPlaceholder: {
    width: "100%",
    height: 190,
    borderRadius: 6,
    backgroundColor: "#EEF2F7",
    alignItems: "center",
    justifyContent: "center",
  },

  previewPlaceholderText: {
    color: COLORS.muted,
    fontSize: 13,
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: "#B6DCFF",
  },

  infoIcon: {
    fontSize: 18,
    marginTop: 1,
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#2A5A8A",
    lineHeight: 19,
  },

  exportBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },

  exportBtnDisabled: {
    opacity: 0.65,
  },

  exportBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  loadingHint: {
    textAlign: "center",
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 13,
  },
});