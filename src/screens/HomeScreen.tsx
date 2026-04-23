import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import useOffline from "../hooks/useOffline";
import { useAuth } from "../context/AuthContext";
import { syncPendingInspections } from "../services/syncInspection";
import { COLORS } from "../theme/colors";
import type { Inspection } from "../utils/inspectionStorage";
import { parseInspectionsFromStorage } from "../utils/inspectionStorage";
import { loadScopedInspectionsWithMigration } from "../utils/storageScope";

const USER_NAME_KEY = "user_name";

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseKey?: string }
  | undefined;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || extra?.supabaseUrl;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra?.supabaseKey;

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function formatInspectionDate(createdAt: number) {
  return new Date(createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatExportedAt(exportedAt?: string) {
  if (!exportedAt) {
    return "";
  }
  const date = new Date(exportedAt);
  if (Number.isNaN(date.getTime())) {
    return exportedAt;
  }
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [userName, setUserName] = useState("User");
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { isOffline, isBackOnline, resetWasOffline } = useOffline();
  console.log("HOME SCREEN LOADED");
  console.log("IS OFFLINE:", isOffline);

  useEffect(() => {
    if (!isBackOnline) {
      return;
    }
    const id = setTimeout(() => {
      resetWasOffline();
    }, 3000);
    return () => clearTimeout(id);
  }, [isBackOnline, resetWasOffline]);

  useEffect(() => {
    if (!isOffline) {
      console.log("RUNNING REAL SYNC");
      void syncPendingInspections(user?.id);
    } else {
      console.log("SKIPPING SYNC (OFFLINE)");
    }
  }, [isOffline, user?.id]);

  const loadUserName = useCallback(async () => {
    try {
      const storedName = await SecureStore.getItemAsync(USER_NAME_KEY);
      const safeName = storedName?.trim();
      setUserName(safeName || "User");
    } catch {
      // Keep fallback name for offline-safe behavior.
      setUserName("User");
    }
  }, []);

  const loadInspections = useCallback(async () => {
    try {
      console.log("LOADING INSPECTIONS FOR USER:", user?.id);
      const { data } = await loadScopedInspectionsWithMigration(user?.id);
      const list = parseInspectionsFromStorage(data);
      setInspections(list.slice(0, 5));
    } catch {
      setInspections([]);
    }
  }, [user?.id]);

  const deleteInspection = useCallback(async (id: string) => {
    try {
      const { key, data: raw } = await loadScopedInspectionsWithMigration(user?.id);
      const list = parseInspectionsFromStorage(raw);
      const inspection = list.find((item) => item.id === id);
      const images = inspection?.report?.images || [];
      const next = list.filter((item) => item.id !== id);
      await AsyncStorage.setItem(key, JSON.stringify(next));
      setInspections(next.slice(0, 5));

      if (supabase) {
        for (const img of images) {
          const publicUrl = (img as typeof img & { publicUrl?: string }).publicUrl;
          if (publicUrl) {
            const path = publicUrl.split("/inspection-images/")[1];
            if (path) {
              await supabase.storage
                .from("inspection-images")
                .remove([path]);
            }
          }
        }

        try {
          await supabase.from("inspections").delete().eq("id", id);

          await supabase
            .from("inspection_images")
            .delete()
            .eq("inspection_id", id);

          console.log("DELETED FROM SUPABASE");
        } catch (e) {
          console.log("DELETE ERROR:", e);
        }
      }
    } catch {
      // keep list as-is on failure
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      if (!isOffline) {
        console.log("RUNNING REAL SYNC");
        void syncPendingInspections(user?.id);
      } else {
        console.log("SKIPPING SYNC (OFFLINE)");
      }
      setLoading(true);
      (async () => {
        try {
          await loadUserName();
          await loadInspections();
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      })();
      return () => {
        isActive = false;
      };
    }, [isOffline, loadUserName, loadInspections, user?.id])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUserName();
      await loadInspections();
    } finally {
      setRefreshing(false);
    }
  }, [loadUserName, loadInspections]);

  if (loading) {
    return (
      <View style={{ padding: 20 }}>
        <View style={{ height: 20, backgroundColor: "#eee", marginBottom: 10, borderRadius: 6 }} />
        <View style={{ height: 20, backgroundColor: "#eee", marginBottom: 10, borderRadius: 6 }} />
        <View style={{ height: 20, backgroundColor: "#eee", marginBottom: 10, borderRadius: 6 }} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {isOffline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            {"You're offline — changes will sync when back online"}
          </Text>
        </View>
      ) : isBackOnline ? (
        <View style={styles.backOnlineBanner}>
          <Text style={styles.backOnlineBannerText}>Back online</Text>
        </View>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome, {userName}</Text>
          <Text style={styles.subText}>Ready to create a new inspection?</Text>
        </View>

        <Pressable style={styles.createCard} onPress={() => navigation.navigate("ShipInfo")}>
          <Text style={styles.createTitle}>Create Inspection</Text>
          <Text style={styles.createSubText}>Start a new vessel inspection report</Text>
        </Pressable>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Inspections</Text>
          {inspections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No inspections yet</Text>
            </View>
          ) : (
            inspections.map((inspection) => {
              const photoCount = inspection.report?.images?.length ?? 0;
              const shipLabel = inspection.ship?.shipName?.trim() || "Unknown ship";
              const metaLine = `${formatInspectionDate(inspection.createdAt)} • ${photoCount} photos`;
              const exportLabel = inspection.exported_as
                ? `Exported as ${inspection.exported_as.toUpperCase()}`
                : null;
              const exportDate = inspection.exported_at
                ? formatExportedAt(inspection.exported_at)
                : null;
              return (
                <View key={inspection.id} style={styles.inspectionCard}>
                  <Text style={styles.inspectionShipName}>{shipLabel}</Text>
                  <Text style={styles.inspectionMeta}>{metaLine}</Text>
                  {exportLabel ? <Text style={styles.inspectionMeta}>{exportLabel}</Text> : null}
                  {exportDate ? <Text style={styles.inspectionMeta}>{exportDate}</Text> : null}
                  <View style={styles.actionRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.viewBtn,
                        pressed && styles.viewBtnPressed,
                      ]}
                      onPress={() => {
                        const validInspection = {
                          ...inspection,
                          report: {
                            ...inspection.report,
                            images: (inspection.report?.images || []).filter(
                              (img) => img && typeof img.uri === "string",
                            ),
                          },
                        };
                        navigation.navigate("ReportPreview", {
                          inspectionId: inspection.id,
                          inspectionCreatedAt: inspection.createdAt,
                          ship: validInspection.ship,
                          images: validInspection.report.images,
                          report: validInspection.report,
                        });
                      }}
                    >
                      <Text style={styles.viewBtnText}>View</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
                      onPress={() => void deleteInspection(inspection.id)}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  scroll: {
    flex: 1,
  },
  offlineBanner: {
    width: "100%",
    backgroundColor: "#f59e0b",
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  offlineBannerText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 14,
  },
  backOnlineBanner: {
    width: "100%",
    backgroundColor: "#16a34a",
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  backOnlineBannerText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 14,
  },
  container: {
    flexGrow: 1,
    backgroundColor: "#F5F5F5",
    padding: 18,
    gap: 16,
  },
  header: {
    marginTop: 6,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  subText: {
    marginTop: 6,
    fontSize: 14,
    color: "#4b5563",
  },
  createCard: {
    backgroundColor: "#2563eb",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    ...Platform.select({
      ios: {
        shadowColor: "#1d4ed8",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  createTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  createSubText: {
    color: "#dbeafe",
    fontSize: 13,
    marginTop: 4,
  },
  recentSection: {
    marginTop: 10,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  inspectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 0,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.09,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  inspectionShipName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  inspectionMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  viewBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  viewBtnPressed: {
    opacity: 0.88,
  },
  viewBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  deleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  deleteBtnPressed: {
    opacity: 0.65,
  },
  deleteBtnText: {
    color: COLORS.danger,
    fontWeight: "700",
    fontSize: 14,
  },
  emptyState: {
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
    opacity: 0.55,
  },
});
