import * as ImagePicker from "expo-image-picker";
import React, { useRef, useState } from "react";
import {
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "../components/PrimaryButton";
import type { InspectionShip, ReportImage } from "../utils/inspectionStorage";
import { processImages } from "../utils/processImage";

type Props = {
  navigation: any;
  route: any;
};

type ProcessingImage = ReportImage & {
  exportUri: string;
  title: string;
};

const MAX_SELECTION = 25;
const SIDE_PADDING = 16;

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ImageProcessingScreen({ navigation, route }: Props) {
  const ship = route.params?.ship as InspectionShip | undefined;
  const { width } = useWindowDimensions();
  const carouselWidth = Math.max(width - SIDE_PADDING * 2, 1);

  const [items, setItems] = useState<ProcessingImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);

  const listRef = useRef<FlatList<ProcessingImage>>(null);

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < items.length - 1;

  async function pickImages() {
    if (processing) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permission needed", "Please allow gallery access to pick images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: MAX_SELECTION,
    });

    if (result.canceled) {
      return;
    }

    setProcessing(true);
    try {
      const originalUris = result.assets.map((asset) => asset.uri);
      const processedUris = await processImages(originalUris);

      const pickedItems: ProcessingImage[] = result.assets.map((asset, index) => {
        const processedUri = processedUris[index] || asset.uri;
        return {
          id: makeId(),
          uri: processedUri,
          exportUri: processedUri,
          description: "",
          title: "",
        };
      });

      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.exportUri || item.uri));
        const deduped = pickedItems.filter(
          (item) => !seen.has(item.exportUri || item.uri),
        );
        const next = [...prev, ...deduped];
        if (prev.length === 0 && next.length > 0) {
          setCurrentIndex(0);
        }
        return next;
      });
    } finally {
      setProcessing(false);
    }
  }

  function updateItemField(id: string, patch: Partial<ProcessingImage>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function scrollToIndex(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= items.length) {
      return;
    }
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setCurrentIndex(nextIndex);
  }

  function removeCurrentImage() {
    if (items.length === 0) {
      return;
    }

    setItems((prev) => {
      const updated = prev.filter((_, idx) => idx !== currentIndex);
      const nextIndex = Math.min(currentIndex, Math.max(updated.length - 1, 0));
      setCurrentIndex(nextIndex);
      return updated;
    });
  }

  function handleCarouselScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (carouselWidth <= 0) {
      return;
    }
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / carouselWidth);
    const bounded = Math.min(Math.max(nextIndex, 0), Math.max(items.length - 1, 0));
    setCurrentIndex(bounded);
  }

  function goToLayoutSelection() {
    if (!ship) {
      Alert.alert("Missing details", "Inspection details are missing. Please restart the flow.");
      return;
    }

    if (items.length === 0) {
      Alert.alert("Add photos", "Please add at least 1 photo for the report.");
      return;
    }

    navigation.navigate("LayoutSelection", {
      ship,
      images: items,
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Image Processing</Text>
          <Text style={styles.subtitle}>
            Select photos once, auto-optimize them for export, then add annotations.
          </Text>

          <PrimaryButton
            title={processing ? "Processing images..." : "Pick Images from Gallery"}
            onPress={() => void pickImages()}
            disabled={processing}
          />

          <Text style={styles.countText}>Images: {items.length}</Text>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No images selected yet.</Text>
            </View>
          ) : (
            <>
              <FlatList
                ref={listRef}
                data={items}
                horizontal
                pagingEnabled
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleCarouselScroll}
                keyboardShouldPersistTaps="handled"
                getItemLayout={(_, index) => ({
                  length: carouselWidth,
                  offset: carouselWidth * index,
                  index,
                })}
                onScrollToIndexFailed={() => {
                  // FlatList can fail before measurements settle; keeping index state is enough.
                }}
                initialNumToRender={1}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews
                renderItem={({ item }) => (
                  <View style={[styles.slide, { width: carouselWidth }]}>
                    <Image source={{ uri: item.uri }} style={styles.previewImage} resizeMode="cover" />

                    <Text style={styles.inputLabel}>Title</Text>
                    <TextInput
                      value={item.title}
                      onChangeText={(text) => updateItemField(item.id, { title: text })}
                      placeholder="Image title"
                      placeholderTextColor="#888"
                      style={styles.input}
                    />

                    <Text style={styles.inputLabel}>Description</Text>
                    <TextInput
                      value={item.description}
                      onChangeText={(text) =>
                        updateItemField(item.id, { description: text })
                      }
                      placeholder="Image description"
                      placeholderTextColor="#888"
                      multiline
                      style={[styles.input, styles.multilineInput]}
                    />
                  </View>
                )}
              />

              <View style={styles.carouselControls}>
                <Pressable
                  style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
                  onPress={() => scrollToIndex(currentIndex - 1)}
                  disabled={!canGoBack}
                >
                  <Text style={styles.navBtnText}>Previous</Text>
                </Pressable>

                <Text style={styles.progressText}>
                  {currentIndex + 1} / {items.length}
                </Text>

                <Pressable
                  style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
                  onPress={() => scrollToIndex(currentIndex + 1)}
                  disabled={!canGoForward}
                >
                  <Text style={styles.navBtnText}>Next</Text>
                </Pressable>
              </View>

              <Pressable style={styles.removeBtn} onPress={removeCurrentImage}>
                <Text style={styles.removeBtnText}>Remove Current Image</Text>
              </Pressable>
            </>
          )}

          <View style={styles.footerButton}>
            <PrimaryButton
              title="Next: Select Layout"
              onPress={goToLayoutSelection}
              disabled={items.length === 0 || !ship}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    flex: 1,
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 12,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 18,
    color: "#4B5563",
  },
  countText: {
    marginTop: 12,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  emptyState: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  emptyText: {
    color: "#6B7280",
    fontWeight: "600",
  },
  slide: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#E5E7EB",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: "#111827",
    fontWeight: "600",
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  carouselControls: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111827",
  },
  navBtnDisabled: {
    backgroundColor: "#9CA3AF",
  },
  navBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  progressText: {
    fontWeight: "800",
    color: "#111827",
  },
  removeBtn: {
    marginTop: 10,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
  },
  removeBtnText: {
    color: "#991B1B",
    fontWeight: "700",
  },
  footerButton: {
    marginTop: 14,
  },
});
