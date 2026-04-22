import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getSyncQueue,
  parseInspectionsFromStorage,
  removeFromSyncQueue,
  updateInspectionById,
} from "./inspectionStorage";
import { loadScopedInspectionsWithMigration } from "./storageScope";

let syncInFlight = false;
let autoSyncStarted = false;

export const triggerSync = async (userId?: string | null) => {
  if (syncInFlight) {
    return;
  }
  syncInFlight = true;
  try {
    const { key: inspectionsKey } = await loadScopedInspectionsWithMigration(userId);
    let queue = await getSyncQueue();
    let inspections = parseInspectionsFromStorage(
      await AsyncStorage.getItem(inspectionsKey),
    );

    for (const id of [...queue]) {
      if (!inspections.some((i) => i.id === id)) {
        await removeFromSyncQueue(id);
      }
    }

    queue = await getSyncQueue();
    inspections = parseInspectionsFromStorage(
      await AsyncStorage.getItem(inspectionsKey),
    );

    const idsToProcess = queue.filter((id) => {
      const inv = inspections.find((i) => i.id === id);
      return inv != null && inv.syncStatus !== "synced";
    });

    for (let i = 0; i < idsToProcess.length; i++) {
      if (i > 0) {
        await new Promise<void>((res) => setTimeout(res, 300));
      }

      const id = idsToProcess[i];
      const snap = parseInspectionsFromStorage(
        await AsyncStorage.getItem(inspectionsKey),
      );
      const inv = snap.find((x) => x.id === id);
      if (!inv) {
        await removeFromSyncQueue(id);
        continue;
      }
      if (inv.syncStatus === "synced") {
        await removeFromSyncQueue(id);
        continue;
      }

      try {
        const ok = await updateInspectionById(id, { syncStatus: "syncing" }, userId);
        if (!ok) {
          await removeFromSyncQueue(id);
          continue;
        }

        await new Promise<void>((res) => setTimeout(res, 800));

        await updateInspectionById(id, { syncStatus: "synced" }, userId);
        await removeFromSyncQueue(id);
      } catch {
        await updateInspectionById(id, { syncStatus: "failed" }, userId);
      }
    }
  } finally {
    syncInFlight = false;
  }
};

export function startAutoSync(): void {
  if (autoSyncStarted) {
    return;
  }
  autoSyncStarted = true;
  setInterval(() => {
    void triggerSync();
  }, 15_000);
}
