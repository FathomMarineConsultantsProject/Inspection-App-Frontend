import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { supabase } from "../supabaseClient";
import {
    parseInspectionsFromStorage,
    type Inspection,
} from "../utils/inspectionStorage";
import { loadScopedInspectionsWithMigration } from "../utils/storageScope";

const USER_KEY = "user";

export async function syncInspection(inspection: Inspection): Promise<boolean> {
  try {
    const storedUser = await AsyncStorage.getItem(USER_KEY);
    const token = await AsyncStorage.getItem("token");
    let user: { id?: string } | null = null;
    let userIdFromToken = null;
    try {
      if (storedUser) {
        user = JSON.parse(storedUser) as { id?: string };
      }
    } catch {
      user = null;
    }
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        userIdFromToken = decoded?.sub || null;
      } catch (e) {
        console.log("JWT DECODE ERROR:", e);
      }
    }
    console.log("USER ID FROM TOKEN:", userIdFromToken);

    const inspectionWithUser = inspection as Inspection & {
      userId?: string | null;
    };
    const payload = {
      id: inspection.id,
      user_id: inspectionWithUser.userId || user?.id || userIdFromToken || null,
      vessel_name: inspection.ship?.shipName || null,
      status: inspection.status || "draft",
      exported_as: inspection.exported_as || null,
      exported_at: inspection.exported_at || null,
      created_at: new Date(inspection.createdAt).toISOString(),
    };

    console.log("SYNC USER FROM STORAGE:", user);
    console.log("SYNC USER ID:", inspectionWithUser.userId, user?.id);
    console.log("SENDING:", payload);
    const { error: inspectionError } = await supabase
      .from("inspections")
      .upsert(payload);

    if (inspectionError) {
      console.log("FAILED:", inspection.id, inspectionError);
      return false;
    }

    console.log("SUCCESS:", inspection.id);
    return true;
  } catch (error) {
    console.log("FAILED:", inspection.id, error);
    return false;
  }
}

export async function syncPendingInspections(userId?: string | null): Promise<void> {
  const { key: inspectionsKey, data: rawData } = await loadScopedInspectionsWithMigration(userId);
  const inspections = parseInspectionsFromStorage(rawData);
  console.log("SYNC STARTED");

  if (inspections.length === 0) {
    return;
  }

  const next = [...inspections];

  for (let i = 0; i < next.length; i++) {
    if (
      next[i].syncStatus !== "pending" &&
      next[i].syncStatus !== "failed"
    ) {
      continue;
    }

    next[i] = {
      ...next[i],
      syncStatus: "syncing",
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(inspectionsKey, JSON.stringify(next));

    console.log("SENDING:", next[i].id);
    const ok = await syncInspection(next[i]);

    next[i] = {
      ...next[i],
      syncStatus: ok ? "synced" : "failed",
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(inspectionsKey, JSON.stringify(next));
    if (ok) {
      console.log("SUCCESS:", next[i].id);
    } else {
      console.log("FAILED:", next[i].id);
    }
  }
}
