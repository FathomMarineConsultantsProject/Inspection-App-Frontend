import AsyncStorage from "@react-native-async-storage/async-storage";

const INSPECTIONS_KEY = "inspections";
const SYNC_QUEUE_KEY = "syncQueue";

export type ReportImage = {
  id: string;
  uri: string;
  description: string;
  originalUri?: string;
  croppedUri?: string;
};

export type InspectionShip = {
  shipName: string;
  shipType: string;
  inspectorName: string;
  portName: string;
  shipPhotoUri?: string;
  companyLogoUri?: string;
  inspectionDate: string;
};

export type InspectionReport = {
  imagesPerPage: number;
  images: ReportImage[];
};

export type InspectionExport = {
  pdfUri?: string;
  docxUri?: string;
  lastExportedAt?: number;
};

export type ExportType = "pdf" | "doc";

export type Inspection = {
  id: string;
  userId?: string | null;
  createdAt: number;
  updatedAt: number;
  ship: InspectionShip;
  report: InspectionReport;
  status: "draft" | "completed";
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  export?: InspectionExport;
  exported_as?: ExportType;
  exported_at?: string;
};

function normalizeShip(raw: unknown): InspectionShip {
  if (!raw || typeof raw !== "object") {
    return {
      shipName: "",
      shipType: "",
      inspectorName: "",
      portName: "",
      inspectionDate: "",
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    shipName: String(o.shipName ?? ""),
    shipType: String(o.shipType ?? ""),
    inspectorName: String(
      o.inspectorName ?? o.surveyorName ?? "",
    ),
    portName: String(o.portName ?? ""),
    shipPhotoUri: typeof o.shipPhotoUri === "string" ? o.shipPhotoUri : undefined,
    companyLogoUri: typeof o.companyLogoUri === "string" ? o.companyLogoUri : undefined,
    inspectionDate: String(o.inspectionDate ?? ""),
  };
}

function normalizeReportImage(raw: unknown, index: number): ReportImage | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const uri = typeof o.uri === "string" ? o.uri : "";
  if (!uri) {
    return null;
  }
  const id =
    typeof o.id === "string" && o.id.length > 0 ? o.id : `legacy-${index}`;
  return {
    id,
    uri,
    description: typeof o.description === "string" ? o.description : "",
    originalUri: typeof o.originalUri === "string" ? o.originalUri : undefined,
    croppedUri: typeof o.croppedUri === "string" ? o.croppedUri : undefined,
  };
}

function normalizeReport(raw: unknown): InspectionReport {
  if (!raw || typeof raw !== "object") {
    return { imagesPerPage: 2, images: [] };
  }
  const o = raw as Record<string, unknown>;
  const imagesPerPage =
    typeof o.imagesPerPage === "number" && Number.isFinite(o.imagesPerPage)
      ? o.imagesPerPage
      : 2;
  const imgs = Array.isArray(o.images) ? o.images : [];
  const images: ReportImage[] = [];
  imgs.forEach((entry, index) => {
    const img = normalizeReportImage(entry, index);
    if (img) {
      images.push(img);
    }
  });
  return { imagesPerPage, images };
}

function normalizeExport(raw: unknown): InspectionExport | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const pdfUri = typeof o.pdfUri === "string" ? o.pdfUri : undefined;
  const docxUri = typeof o.docxUri === "string" ? o.docxUri : undefined;
  const lastExportedAt =
    typeof o.lastExportedAt === "number" && Number.isFinite(o.lastExportedAt)
      ? o.lastExportedAt
      : undefined;
  if (pdfUri == null && docxUri == null && lastExportedAt == undefined) {
    return undefined;
  }
  return { pdfUri, docxUri, lastExportedAt };
}

export function normalizeInspection(raw: unknown): Inspection | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = r.id;
  const createdAt = r.createdAt;
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }
  const created =
    typeof createdAt === "number"
      ? createdAt
      : typeof createdAt === "string"
        ? Number(createdAt)
        : NaN;
  if (!Number.isFinite(created)) {
    return null;
  }

  const updatedRaw = r.updatedAt;
  const updated =
    typeof updatedRaw === "number" && Number.isFinite(updatedRaw)
      ? updatedRaw
      : typeof updatedRaw === "string" && Number.isFinite(Number(updatedRaw))
        ? Number(updatedRaw)
        : created;

  const status: Inspection["status"] =
    r.status === "draft" || r.status === "completed" ? r.status : "completed";

  const syncStatus: Inspection["syncStatus"] =
    r.syncStatus === "pending" ||
    r.syncStatus === "syncing" ||
    r.syncStatus === "synced" ||
    r.syncStatus === "failed"
      ? r.syncStatus
      : "pending";

  const exportBlock = normalizeExport(r.export);
  const exportedAs: ExportType | undefined =
    r.exported_as === "pdf" || r.exported_as === "doc"
      ? r.exported_as
      : undefined;
  const exportedAt =
    typeof r.exported_at === "string" ? r.exported_at : undefined;

  return {
    id,
    userId: typeof r.userId === "string" ? r.userId : undefined,
    createdAt: created,
    updatedAt: updated,
    ship: normalizeShip(r.ship),
    report: normalizeReport(r.report),
    status,
    syncStatus,
    export: exportBlock,
    exported_as: exportedAs,
    exported_at: exportedAt,
  };
}

/**
 * Parses AsyncStorage JSON for the "inspections" key.
 * Backfills missing fields for legacy rows; returns [] on corrupt / invalid input.
 */
export function parseInspectionsFromStorage(raw: string | null): Inspection[] {
  if (raw == null || raw === "") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeInspection(item))
      .filter((x): x is Inspection => x != null);
  } catch {
    return [];
  }
}

function parseSyncQueueRaw(raw: string | null): string[] {
  if (raw == null || raw === "") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const ids = parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

export async function getSyncQueue(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return parseSyncQueueRaw(raw);
  } catch {
    return [];
  }
}

export async function addToSyncQueue(id: string): Promise<void> {
  if (!id) {
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue = parseSyncQueueRaw(raw);
    if (!queue.includes(id)) {
      queue.push(id);
    }
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue = parseSyncQueueRaw(raw).filter((x) => x !== id);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export async function updateInspectionById(
  id: string,
  updates: Partial<Inspection>,
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(INSPECTIONS_KEY);
    const list = parseInspectionsFromStorage(raw);
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) {
      return false;
    }
    const merged: Inspection = {
      ...list[idx],
      ...updates,
      updatedAt: Date.now(),
    };
    const next = [...list.slice(0, idx), merged, ...list.slice(idx + 1)];
    await AsyncStorage.setItem(INSPECTIONS_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
