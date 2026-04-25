import * as Sharing from "expo-sharing";
import PDFLib, { PDFDocument, PDFPage } from "react-native-pdf-lib";

export interface ReportImage {
  uri: string;
  exportUri?: string;
  description: string;
}

export interface ShipInfo {
  shipName?: string;
  shipType?: string;
  inspector?: string;
  inspectorName?: string;
  surveyorName?: string;
  port?: string;
  portName?: string;
  location?: string;
  date?: string;
  inspectionDate?: string;
  companyName?: string;
  shipPhotoUri?: string;
  companyLogoUri?: string;
  totalPhotos?: number;
}

export interface GeneratePdfOptions {
  shipInfo: ShipInfo;
  images: ReportImage[];
  imagesPerPage: 2 | 4 | 6 | 8;
}

export interface GenerateNativePdfOptions {
  images: ReportImage[];
  imagesPerPage: number;
  reportDetails?: ShipInfo;
  outputPath?: string;
}

type ImageType = "jpg" | "png";

type Slot = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 28;
const PAGE_MARGIN_BOTTOM = 28;
const PAGE_HEADER_TOP = 56;
const GRID_GAP_X = 12;
const GRID_GAP_Y = 12;
const YIELD_EVERY_IMAGES = 6;
const YIELD_EVERY_PAGES = 2;

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sanitizePath(path: string): string {
  if (!path) return "";
  const withoutQuery = path.split("?")[0] || path;
  if (withoutQuery.startsWith("file://")) {
    return withoutQuery.replace("file://", "");
  }
  return withoutQuery;
}

function toFileUri(path: string): string {
  if (!path) return path;
  if (path.startsWith("file://")) return path;
  return `file://${path}`;
}

function inferImageType(path: string): ImageType {
  const lower = path.toLowerCase();
  return lower.endsWith(".png") ? "png" : "jpg";
}

function safePerPage(value: number): 2 | 4 | 6 | 8 {
  if (value === 2 || value === 4 || value === 6 || value === 8) {
    return value;
  }
  return 2;
}

function getGridDefinition(
  imagesPerPage: 2 | 4 | 6 | 8,
): { rows: number; cols: number } {
  if (imagesPerPage === 2) return { rows: 2, cols: 1 };
  if (imagesPerPage === 4) return { rows: 2, cols: 2 };
  if (imagesPerPage === 6) return { rows: 3, cols: 2 };
  return { rows: 4, cols: 2 };
}

function buildSlots(imagesPerPage: 2 | 4 | 6 | 8): Slot[] {
  const { rows, cols } = getGridDefinition(imagesPerPage);
  const contentWidth = PAGE_WIDTH - PAGE_MARGIN_X * 2;
  const contentHeight = PAGE_HEIGHT - PAGE_HEADER_TOP - PAGE_MARGIN_BOTTOM;
  const slotWidth = Math.floor((contentWidth - (cols - 1) * GRID_GAP_X) / cols);
  const slotHeight = Math.floor(
    (contentHeight - (rows - 1) * GRID_GAP_Y) / rows,
  );

  const slots: Slot[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = Math.floor(PAGE_MARGIN_X + col * (slotWidth + GRID_GAP_X));
      const top = Math.floor(PAGE_HEADER_TOP + row * (slotHeight + GRID_GAP_Y));
      const y = Math.floor(PAGE_HEIGHT - top - slotHeight);
      slots.push({
        x,
        y,
        width: slotWidth,
        height: slotHeight,
      });
    }
  }
  return slots;
}

function sanitizeFileToken(value: string | undefined, fallback: string): string {
  const raw = (value || "").trim();
  if (!raw) return fallback;
  return raw.replace(/\s+/g, "_").replace(/[^\w-]/g, "") || fallback;
}

async function buildOutputPath(
  reportDetails?: ShipInfo,
  explicitOutputPath?: string,
): Promise<string> {
  if (explicitOutputPath) {
    return sanitizePath(explicitOutputPath);
  }
  const docsDir = await PDFLib.getDocumentsDirectory();
  const ship = sanitizeFileToken(reportDetails?.shipName, "Ship");
  const dateRaw =
    reportDetails?.date || reportDetails?.inspectionDate || new Date().toISOString();
  const date = sanitizeFileToken(String(dateRaw).slice(0, 10), "Date");
  return `${docsDir}/Ship_Inspection_${ship}_${date}_${Date.now()}.pdf`;
}

function buildHeaderText(reportDetails?: ShipInfo): {
  title: string;
  subtitle?: string;
} {
  const title =
    reportDetails?.companyName ||
    reportDetails?.shipName ||
    "Inspection Report";

  const inspector =
    reportDetails?.inspector ||
    reportDetails?.inspectorName ||
    reportDetails?.surveyorName;
  const port = reportDetails?.port || reportDetails?.portName || reportDetails?.location;
  const pieces = [inspector, port].filter((x): x is string => !!x && x.trim().length > 0);
  return {
    title,
    subtitle: pieces.length > 0 ? pieces.join(" | ") : undefined,
  };
}

export async function generatePDF(
  options: GenerateNativePdfOptions,
): Promise<string> {
  const perPage = safePerPage(options.imagesPerPage);
  const images = options.images || [];
  const pages = chunkArray(images, perPage);
  const slots = buildSlots(perPage);
  const outputPath = await buildOutputPath(options.reportDetails, options.outputPath);
  const header = buildHeaderText(options.reportDetails);

  let pdfDoc = PDFDocument.create(outputPath);
  let globalImageCount = 0;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const batch = pages[pageIndex];
    let page = PDFPage.create()
      .setMediaBox(PAGE_WIDTH, PAGE_HEIGHT)
      .drawText(header.title, {
        x: PAGE_MARGIN_X,
        y: PAGE_HEIGHT - 30,
        fontSize: 13,
        color: "#111111",
      })
      .drawText(`Page ${pageIndex + 1}`, {
        x: PAGE_WIDTH - 92,
        y: PAGE_HEIGHT - 30,
        fontSize: 11,
        color: "#444444",
      });

    if (header.subtitle) {
      page = page.drawText(header.subtitle, {
        x: PAGE_MARGIN_X,
        y: PAGE_HEIGHT - 46,
        fontSize: 10,
        color: "#666666",
      });
    }

    for (let imageIndex = 0; imageIndex < batch.length; imageIndex += 1) {
      const slot = slots[imageIndex];
      const image = batch[imageIndex];
      const rawUri = image.exportUri || image.uri;
      const imagePath = sanitizePath(rawUri);
      if (!imagePath || !slot) {
        continue;
      }

      const imageType = inferImageType(imagePath);
      page = page.drawImage(imagePath, imageType, {
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
      });

      globalImageCount += 1;
      if (globalImageCount % YIELD_EVERY_IMAGES === 0) {
        await pause();
      }
    }

    pdfDoc = pdfDoc.addPage(page);

    if ((pageIndex + 1) % YIELD_EVERY_PAGES === 0) {
      await pause();
    }
  }

  const writtenPath = await pdfDoc.write();
  return toFileUri(String(writtenPath || outputPath));
}

export async function generateAndSharePDF(
  options: GenerateNativePdfOptions,
): Promise<string> {
  const pdfPath = await generatePDF(options);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error(`Sharing is not available on this device. PDF saved at: ${pdfPath}`);
  }

  await Sharing.shareAsync(pdfPath, {
    mimeType: "application/pdf",
    dialogTitle: "Share Inspection Report",
    UTI: "com.adobe.pdf",
  });

  return pdfPath;
}
