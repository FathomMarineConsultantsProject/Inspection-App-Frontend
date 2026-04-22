import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { jwtDecode } from "jwt-decode";
import {
    parseInspectionsFromStorage,
    type Inspection,
} from "../utils/inspectionStorage";

const INSPECTIONS_KEY = "inspections";
const USER_KEY = "user";

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseKey?: string }
  | undefined;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || extra?.supabaseUrl;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra?.supabaseKey;

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function syncInspection(inspection: Inspection): Promise<boolean> {
  if (!supabase) {
    console.log("FAILED:", inspection.id);
    return false;
  }

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

export async function syncPendingInspections(): Promise<void> {
  const rawData = await AsyncStorage.getItem(INSPECTIONS_KEY);
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
    await AsyncStorage.setItem(INSPECTIONS_KEY, JSON.stringify(next));

    console.log("SENDING:", next[i].id);
    const ok = await syncInspection(next[i]);

    next[i] = {
      ...next[i],
      syncStatus: ok ? "synced" : "failed",
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(INSPECTIONS_KEY, JSON.stringify(next));
    if (ok) {
      console.log("SUCCESS:", next[i].id);
    } else {
      console.log("FAILED:", next[i].id);
    }
  }
}
