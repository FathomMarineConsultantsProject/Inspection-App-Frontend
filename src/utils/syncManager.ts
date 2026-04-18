import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getSyncQueue,
  parseInspectionsFromStorage,
  removeFromSyncQueue,
  updateInspectionById,
} from "./inspectionStorage";

const INSPECTIONS_KEY = "inspections";

let syncInFlight = false;
let autoSyncStarted = false;

export const triggerSync = async () => {
  if (syncInFlight) {
    return;
  }
  syncInFlight = true;
  try {
    let queue = await getSyncQueue();
    let inspections = parseInspectionsFromStorage(
      await AsyncStorage.getItem(INSPECTIONS_KEY),
    );

    for (const id of [...queue]) {
      if (!inspections.some((i) => i.id === id)) {
        await removeFromSyncQueue(id);
      }
    }

    queue = await getSyncQueue();
    inspections = parseInspectionsFromStorage(
      await AsyncStorage.getItem(INSPECTIONS_KEY),
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
        await AsyncStorage.getItem(INSPECTIONS_KEY),
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
        const ok = await updateInspectionById(id, { syncStatus: "syncing" });
        if (!ok) {
          await removeFromSyncQueue(id);
          continue;
        }

        await new Promise<void>((res) => setTimeout(res, 800));

        await updateInspectionById(id, { syncStatus: "synced" });
        await removeFromSyncQueue(id);
      } catch {
        await updateInspectionById(id, { syncStatus: "failed" });
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
