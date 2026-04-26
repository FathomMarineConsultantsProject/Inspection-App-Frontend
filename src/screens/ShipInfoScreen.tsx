import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Input from "../components/Input";
import PrimaryButton from "../components/PrimaryButton";

export default function ShipInfoScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();

  const shipTypeRef = useRef<TextInput>(null);
  const inspectorRef = useRef<TextInput>(null);
  const portRef = useRef<TextInput>(null);

  const [shipName, setShipName] = useState("");
  const [shipType, setShipType] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [portName, setPortName] = useState("");

  const [shipPhotoUri, setShipPhotoUri] = useState<string | null>(null);
  const [companyLogoUri, setCompanyLogoUri] = useState<string | null>(null);

  const [inspectionDate, setInspectionDate] = useState<Date>(new Date());
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [showModal, setShowModal] = useState(false);

  const dateLabel = useMemo(() => {
    return inspectionDate.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  }, [inspectionDate]);

  useEffect(() => {
    if (route.params?.ship) {
      const ship = route.params.ship;

      setShipName(ship.shipName || "");
      setShipType(ship.shipType || "");
      setInspectorName(ship.inspectorName || "");
      setPortName(ship.portName || "");
      setCompanyLogoUri(ship.companyLogoUri || null);
      setShipPhotoUri(ship.shipPhotoUri || null);
    }
  }, [route.params]);

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

    if (!result.canceled) {
      setShipPhotoUri(result.assets[0].uri);
    }
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

    if (!result.canceled) {
      setCompanyLogoUri(result.assets[0].uri);
    }
  }

  function openDateModal() {
    if (Platform.OS === "ios") {
      setTempDate(inspectionDate);
      setShowModal(true);
    } else {
      setShowModal(true);
    }
  }

  function closeDateModal() {
    setShowModal(false);
  }

  function confirmDateSelection() {
    setInspectionDate(tempDate);
    setShowModal(false);
  }

  function validate() {
    if (!shipName.trim()) {
      Alert.alert("Missing info", "Ship name is required");
      return false;
    }
    if (!shipType.trim()) {
      Alert.alert("Missing info", "Ship type is required");
      return false;
    }
    if (!inspectorName.trim()) {
      Alert.alert("Missing info", "Inspector name is required");
      return false;
    }
    if (!portName.trim()) {
      Alert.alert("Missing info", "Port name is required");
      return false;
    }
    if (!companyLogoUri) {
      Alert.alert("Validation Error", "Company logo is required");
      return false;
    }
    if (!shipPhotoUri) {
      Alert.alert("Validation Error", "Ship photo is required");
      return false;
    }
    return true;
  }

  function onNext() {
    const isValid = validate();
    if (!isValid) {
      return;
    }

    navigation.navigate("ImageProcessing", {
      ship: {
        shipName: shipName.trim(),
        shipType: shipType.trim(),
        inspectorName: inspectorName.trim(),
        portName: portName.trim(),
        shipPhotoUri,
        companyLogoUri,
        inspectionDate: inspectionDate.toISOString(),
      },
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 60}
    >
      <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
          >
            <View style={styles.headerRow}>
              <Text style={styles.title}>Ship Details</Text>

              <Pressable onPress={openDateModal} style={styles.dateChip} hitSlop={10}>
                <Ionicons name="calendar-outline" size={14} color="#111" />
                <Text style={styles.dateChipText}>{dateLabel}</Text>
              </Pressable>
            </View>

            {Platform.OS === "ios" ? (
              <Modal
                visible={showModal}
                transparent
                animationType="fade"
                onRequestClose={closeDateModal}
              >
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalContainer}>
                    <DateTimePicker
                      value={tempDate}
                      mode="date"
                      display="inline"
                      themeVariant="light"
                      onChange={(_, selectedDate) => {
                        if (selectedDate) {
                          setTempDate(selectedDate);
                        }
                      }}
                    />

                    <View style={styles.modalActions}>
                      <Pressable onPress={closeDateModal} style={styles.cancelButton}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={confirmDateSelection} style={styles.confirmButton}>
                        <Text style={styles.confirmButtonText}>Confirm</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Modal>
            ) : (
              showModal && (
                <DateTimePicker
                  value={inspectionDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowModal(false);

                    if (event.type === "set" && selectedDate) {
                      setInspectionDate(selectedDate);
                    }
                  }}
                />
              )
            )}

            <View style={styles.photoRow}>
              <Pressable onPress={pickShipPhoto} style={styles.photoBox}>
                {shipPhotoUri ? (
                  <Image source={{ uri: shipPhotoUri }} resizeMode="cover" style={styles.photoImg} />
                ) : (
                  <Text style={styles.photoText}>+ Ship Photo</Text>
                )}
              </Pressable>

              <View style={styles.photoSpacer} />

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
              returnKeyType="next"
              onSubmitEditing={() => shipTypeRef.current?.focus()}
            />

            <Input
              inputRef={shipTypeRef}
              label="Ship Type"
              value={shipType}
              onChangeText={setShipType}
              placeholder="e.g., Cargo, Tanker, Passenger"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => inspectorRef.current?.focus()}
            />

            <Input
              inputRef={inspectorRef}
              label="Inspector Name"
              value={inspectorName}
              onChangeText={setInspectorName}
              placeholder="e.g., John Doe"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => portRef.current?.focus()}
            />

            <Input
              inputRef={portRef}
              label="Port Name"
              value={portName}
              onChangeText={setPortName}
              placeholder="e.g., Port name"
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={onNext}
            />

            <View style={styles.buttonWrap}>
              <PrimaryButton title="Next: Process Images" onPress={onNext} />
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 140,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  dateChipText: {
    fontWeight: "800",
    color: "#111",
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  cancelButtonText: {
    color: "#374151",
    fontWeight: "700",
  },
  confirmButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#2563eb",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  photoRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 18,
  },
  photoSpacer: {
    width: 12,
  },
  photoBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
    backgroundColor: "#fff",
  },
  photoImg: {
    width: "100%",
    height: 140,
    borderRadius: 12,
  },
  photoText: {
    fontWeight: "700",
    color: "#111827",
  },
  buttonWrap: {
    marginTop: 8,
  },
});
