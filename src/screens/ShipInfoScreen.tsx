import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import Input from "../components/Input";
import PrimaryButton from "../components/PrimaryButton";

export default function ShipInfoScreen({ navigation }: any) {
  const [shipName, setShipName] = useState("");
  const [shipType, setShipType] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [portName,setPortName]=useState("")

  const [shipPhotoUri, setShipPhotoUri] = useState<string | null>(null);
  const [companyLogoUri, setCompanyLogoUri] = useState<string | null>(null);

  // ✅ Date
  const [inspectionDate, setInspectionDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const dateLabel = useMemo(() => {
    return inspectionDate.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  }, [inspectionDate]);

  // ✅ Reset on focus (dev-friendly)
  useFocusEffect(
    useCallback(() => {
      setShipName("");
      setShipType("");
      setInspectorName("");
      setPortName("");
      setShipPhotoUri(null);
      setCompanyLogoUri(null);
      setInspectionDate(new Date());
      setShowPicker(false);
    }, [])
  );

  async function ensureGalleryPermission() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow photo access to pick images.");
      return false;
    }
    return true;
  }

  async function pickShipPhoto() {
    const ok = await ensureGalleryPermission();
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled) setShipPhotoUri(result.assets[0].uri);
  }

  async function pickCompanyLogo() {
    const ok = await ensureGalleryPermission();
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) setCompanyLogoUri(result.assets[0].uri);
  }

  function onChangeDate(_: any, selected?: Date) {
    // Android closes after selection/dismiss
    setShowPicker(false);
    if (selected) setInspectionDate(selected);
  }

  function validate() {
    if (!shipName.trim()) return "Ship name is required";
    if (!shipType.trim()) return "Ship type is required";
    if (!inspectorName.trim()) return "Inspector name is required";
    if (!portName.trim()) return "Port name is required";

    return null;
  }

  function onNext() {
    const err = validate();
    if (err) {
      Alert.alert("Missing info", err);
      return;
    }

    navigation.navigate("CreateReport", {
      ship: {
        shipName: shipName.trim(),
        shipType: shipType.trim(),
        inspectorName: inspectorName.trim(),
        portName:portName.trim(),
        shipPhotoUri,
        companyLogoUri,
        inspectionDate: inspectionDate.toISOString(), // backend friendly
      },
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Title row + small date chip */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Ship Details</Text>

        <Pressable
          onPress={() => setShowPicker(true)}
          style={styles.dateChip}
          hitSlop={10}
        >
          <Ionicons name="calendar-outline" size={14} color="#111" />
          <Text style={styles.dateChipText}>{dateLabel}</Text>
        </Pressable>
      </View>

      {/* Android Date dialog (shows only when tapped) */}
      {showPicker && (
        <DateTimePicker
          value={inspectionDate}
          mode="date"
          display="default"
          onChange={onChangeDate}
        />
      )}

      {/* Two boxes side-by-side */}
      <View style={styles.photoRow}>
        <Pressable onPress={pickShipPhoto} style={styles.photoBox}>
          {shipPhotoUri ? (
            <Image source={{ uri: shipPhotoUri }} resizeMode="cover" style={styles.photoImg} />
          ) : (
            <Text style={styles.photoText}>+ Ship Photo</Text>
          )}
        </Pressable>

        <View style={{ width: 12 }} />

        <Pressable onPress={pickCompanyLogo} style={styles.photoBox}>
          {companyLogoUri ? (
            <Image source={{ uri: companyLogoUri }} resizeMode="cover" style={styles.photoImg} />
          ) : (
            <Text style={styles.photoText}>+ Company Logo</Text>
          )}
        </Pressable>
      </View>

      <Input
        label="Ship Name"
        value={shipName}
        onChangeText={setShipName}
        placeholder="e.g., MV Ocean Star"
        autoCapitalize="words"
      />

      <Input
        label="Ship Type"
        value={shipType}
        onChangeText={setShipType}
        placeholder="e.g., Cargo, Tanker, Passenger"
        autoCapitalize="words"
      />

      <Input
        label="Inspector Name"
        value={inspectorName}
        onChangeText={setInspectorName}
        placeholder="e.g., John Doe"
        autoCapitalize="words"
      />

      <Input
        label="Port Name"
        value={portName}
        onChangeText={setPortName}
        placeholder="e.g., Port name"
        autoCapitalize="words"
      />

      <PrimaryButton title="Next: Create Report" onPress={onNext} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 30 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "800" },

  // ✅ Small classy chip
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  dateChipText: {
    fontWeight: "800",
    color: "#111",
    fontSize: 12,
  },

  photoRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 16,
  },
  photoBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
  },
  photoImg: { width: "100%", height: 140, borderRadius: 12 },
  photoText: { fontWeight: "700" },
});
