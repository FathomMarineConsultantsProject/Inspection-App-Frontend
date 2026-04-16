import React from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import { exportInspectionPDF } from "../utils/pdfGenerator"; // ✅ adjust path

export default function ReportPreviewScreen({ navigation, route }: any) {
  const { ship, report } = route.params;

  const images = report?.images ?? [];
  const imagesPerPage = report?.imagesPerPage ?? 2;

async function exportPDF() {
  try {
    console.log("PDF export started");
    await exportInspectionPDF({
      ship,
      report: {
        imagesPerPage,
        images,
      },
    });
  } catch (e: any) {
    console.log("PDF export error =>", e);
    Alert.alert("Export failed", e?.message ?? "Unknown error");
  }
}

  function exportDOCX() {
    Alert.alert("Export DOCX", "Next step: I’ll add Word export with same layout.");
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
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

      {images.map((img: any) => (
        <View key={img.id ?? img.uri} style={{ marginBottom: 14 }}>
          <Image
            source={{ uri: img.uri }}
            resizeMode="cover"
            style={{ width: "100%", height: 180, borderRadius: 12 }}
          />
          <Text style={{ marginTop: 8, fontWeight: "800" }}>Image description:</Text>
          <Text>{img.description?.trim() ? img.description : "-"}</Text>
        </View>
      ))}

      <View style={{ gap: 10, marginTop: 10 }}>
        <PrimaryButton title="Export as PDF" onPress={exportPDF} />
        <PrimaryButton title="Export as DOCX" onPress={exportDOCX} />
      </View>
    </ScrollView>
  );
}