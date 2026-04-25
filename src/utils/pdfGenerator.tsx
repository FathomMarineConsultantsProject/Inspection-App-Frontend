import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
export interface ReportImage {
  uri: string;
  description: string;
}

export interface ShipInfo {
  shipName: string;
  shipType?: string;
  inspector: string;
  port: string;
  date: string;
  shipPhotoUri?: string;
  companyLogoUri?: string;
  totalPhotos?: number;
}

export interface GeneratePdfOptions {
  shipInfo: ShipInfo;
  images: ReportImage[];
  imagesPerPage: 2 | 4 | 6 | 8;
}

const EMPTY_IMAGE_FALLBACK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function uriToBase64DataUri(uri: string): Promise<string> {
  try {
    if (!uri) return EMPTY_IMAGE_FALLBACK;
    if (uri.startsWith("data:")) return uri;
    if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const ext = uri.split(".").pop()?.toLowerCase() ?? "jpeg";

    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };

    const mime = mimeMap[ext] ?? "image/jpeg";
    return `data:${mime};base64,${base64}`;
  } catch {
    return EMPTY_IMAGE_FALLBACK;
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function escapeHtml(value?: unknown): string {
  const safeValue = typeof value === "string" ? value : "";
  if (!safeValue) return "";
  return safeValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPhotoPage(
  chunk: ReportImage[],
  imageDataUris: string[],
  imagesPerPage: 2 | 4 | 6 | 8
): string {
  const getGridColumns = (value: number) => {
    if (value === 2) return "1fr";
    return "1fr 1fr";
  };

  const getGridRows = (value: number) => {
    if (value === 2) return "1fr 1fr";
    if (value === 4) return "1fr 1fr";
    if (value === 6) return "1fr 1fr 1fr";
    if (value === 8) return "1fr 1fr 1fr 1fr";
    return "1fr";
  };

  // 🔥 BETTER IMAGE SIZES
  const getImageHeight = (value: number) => {
    if (value === 2) return "420px";
    if (value === 4) return "260px";
    if (value === 6) return "210px"; // increased
    if (value === 8) return "160px"; // increased
    return "140px";
  };

  const imageHeight = getImageHeight(imagesPerPage);
  const getVerticalPadding = (value: number) => {
    if (value === 4) return "80px";
    if (value === 6) return "60px";
    if (value === 8) return "40px";
    return "60px";
  };

  const cards = (chunk || [])
    .map((img, index) => {
      const imageUri = imageDataUris[index] || EMPTY_IMAGE_FALLBACK;
      const description = typeof img?.description === "string" ? img.description : "";
      const desc = (description || "").trim();

      return `
        <div style="
          background: #fff;
          border: 1px solid #e5e7eb;
          padding: 8px;
          display: flex;
          flex-direction: column;
          border-radius:8px;
        ">
          <img src="${imageUri}" style="
            width:100%;
            height:${imageHeight};
            object-fit:cover;
            border-radius:6px;
          "/>
          <div style="
            font-size:10px;
            margin-top:8px;
            padding:0 4px;
            line-height:1.4;
            overflow:hidden;
            display:-webkit-box;
            -webkit-line-clamp:2;
            -webkit-box-orient:vertical;
          ">
            ${escapeHtml(desc || "-")}
          </div>
        </div>
      `;
    })
    .join("");

  const placeholders = Math.max(0, imagesPerPage - chunk.length);
  const placeholdersHtml = Array(placeholders).fill("<div></div>").join("");

  // ✅ KEEP 2 IMAGE PERFECT
  if (imagesPerPage === 2) {
    return `
      <div style="
        display:flex;
        flex-direction:column;
        justify-content:center;
        height:100%;
      ">
        <div style="
          display:grid;
          grid-template-columns:${getGridColumns(imagesPerPage)};
          grid-template-rows:${getGridRows(imagesPerPage)};
          gap:12px;
        ">
          ${cards}
          ${placeholdersHtml}
        </div>
      </div>
    `;
  }

  return `
    <div style="
      width:100%;
      padding-top:${getVerticalPadding(imagesPerPage)};
      padding-bottom:${getVerticalPadding(imagesPerPage)};
      display:flex;
      justify-content:center;
    ">
      <div style="
        width:100%;
        max-width:720px;
      ">
        <div style="
          display:grid;
          grid-template-columns:${getGridColumns(imagesPerPage)};
          gap:16px;
        ">
          ${cards}
          ${placeholdersHtml}
        </div>
      </div>
    </div>
  `;
}

function buildCoverPage(
  shipInfo: ShipInfo,
  logoDataUri: string,
  shipPhotoDataUri: string,
  firstImageDataUri: string
): string {
  const ship = shipInfo as ShipInfo & {
    name?: string;
    inspectorName?: string;
    location?: string;
    portName?: string;
  };
  const totalPhotos = shipInfo.totalPhotos ?? 0;
  const safeDate = typeof shipInfo?.date === "string" ? shipInfo.date : "";
  const displayDate = (safeDate || "").trim() || new Date().toLocaleDateString();
  const heroImageUri =
    shipPhotoDataUri !== EMPTY_IMAGE_FALLBACK
      ? shipPhotoDataUri
      : firstImageDataUri !== EMPTY_IMAGE_FALLBACK
        ? firstImageDataUri
        : "";

  return `
    <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#1f2937;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div style="width:32%; min-height:1px; display:flex; align-items:center;">
          ${
            logoDataUri !== EMPTY_IMAGE_FALLBACK
              ? `<img src="${logoDataUri}" style="height:52px; max-width:100%; object-fit:contain;" alt="Company Logo" />`
<<<<<<< ours
              : `<div style="font-size:18px; font-weight:700; color:#1e3a8a;">FATHOM</div>`
=======
              : `<div style="font-size:18px; font-weight:700; color:#1e3a8a;">SHIP INSPECTION</div>`
>>>>>>> theirs
          }
        </div>

        <div style="width:36%; text-align:center;">
          <div style="font-size:12px; color:#4b5563; margin-bottom:2px;">
<<<<<<< ours
            Powered by Fathom Marine Consultants
=======
            Powered by Fathom-Nexport
>>>>>>> theirs
          </div>
          <div style="font-size:24px; font-weight:800; letter-spacing:0.6px; color:#1e3a8a;">
            INSPECTION REPORT
          </div>
        </div>

        <div style="width:32%; text-align:right; font-size:14px; font-weight:700; color:#111827;">
          ${escapeHtml(displayDate)}
        </div>
      </div>

      <div style="height:2px; background:#1e3a8a; margin:14px 0 16px;"></div>

      <div style="background:#f3f4f6; border:1px solid #e5e7eb; border-radius:8px; padding:14px 16px; display:flex; justify-content:space-between; gap:24px; margin-bottom:16px; font-size:13px; line-height:1.6;">
        <div>
          <div><span style="font-weight:700; color:#374151;">Ship:</span> ${escapeHtml(ship?.name || ship?.shipName || "-")}</div>
          <div><span style="font-weight:700; color:#374151;">Inspector:</span> ${escapeHtml(ship?.inspector || ship?.inspectorName || "-")}</div>
        </div>
        <div>
          <div><span style="font-weight:700; color:#374151;">Port:</span> ${escapeHtml(ship?.port || ship?.portName || ship?.location || "-")}</div>
          <div><span style="font-weight:700; color:#374151;">Total Photos:</span> ${String(totalPhotos)}</div>
        </div>
      </div>

      ${
        heroImageUri
          ? `<img src="${heroImageUri}" style="width:100%; aspect-ratio:16 / 9; object-fit:cover; border-radius:10px; border:1px solid #e5e7eb;" alt="Cover Image" />`
          : `<div style="width:100%; aspect-ratio:16 / 9; border-radius:10px; border:1px solid #e5e7eb; background:#f9fafb; display:flex; align-items:center; justify-content:center; color:#6b7280; font-size:13px;">No cover image provided</div>`
      }
    </div>
  `;
}

function buildStyles(): string {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
      background: #ffffff;
    }

    body {
      font-size: 12px;
    }

    img {
      display: block;
    }
  `;
}

function buildHtmlDocument(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${buildStyles()}</style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;
}

async function buildPdfHtml(options: GeneratePdfOptions): Promise<string> {
  const { shipInfo, images, imagesPerPage } = options;

  const [logoDataUri, shipPhotoDataUri, ...photoDataUris] = await Promise.all([
    uriToBase64DataUri(shipInfo.companyLogoUri ?? ""),
    uriToBase64DataUri(shipInfo.shipPhotoUri ?? ""),
    ...images.map((img) => uriToBase64DataUri(img.uri)),
  ]);

  const totalPhotos = images.length;
  const coverHtml = buildCoverPage(
    {
      ...shipInfo,
      totalPhotos,
    },
    logoDataUri,
    shipPhotoDataUri,
    photoDataUris[0] || EMPTY_IMAGE_FALLBACK
  );

  const imagePages = chunkArray(images, imagesPerPage);
  const photoPages = imagePages.map((pageImages, pageIndex) => {
    const pageUris = photoDataUris.slice(
      pageIndex * imagesPerPage,
      pageIndex * imagesPerPage + pageImages.length
    );
    return buildPhotoPage(pageImages, pageUris, imagesPerPage);
  });

  const pages = [coverHtml, ...photoPages];
  const html = pages
    .map(
      (page) => `
        <div style="
          width: 100%;
          height: 100%;
          padding: 16px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          break-inside: avoid;
          page-break-inside: avoid;
          overflow: hidden;
        ">
          ${page}
        </div>
      `
    )
    .join("");

  return buildHtmlDocument(html);
}

function buildSafeFileName(shipName: unknown, shipInfo: unknown): string {
  const safeShip = ((typeof shipName === "string" ? shipName : "") || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "");
  const info = (shipInfo || {}) as {
    date?: string;
    inspectionDate?: string;
    inspection_date?: string;
  };
  const rawDate =
    info.date ||
    info.inspectionDate ||
    info?.inspection_date ||
    null;

  let formattedDate = "Date";

  if (rawDate) {
    try {
      const d = new Date(rawDate);
      formattedDate = d.toISOString().split("T")[0];
    } catch {
      formattedDate = "Date";
    }
  }
<<<<<<< ours
  return `Fathom_Inspection_${safeShip || "Ship"}_${formattedDate}.pdf`;
=======
  return `Ship_Inspection_${safeShip || "Ship"}_${formattedDate}.pdf`;
>>>>>>> theirs
}

export async function generatePdfUri(
  options: GeneratePdfOptions
): Promise<string> {
  const html = await buildPdfHtml(options);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });
  const fileUri = uri;

  const fileName = buildSafeFileName(
    options.shipInfo.shipName,
    options.shipInfo
  );
  const destinationUri = `${FileSystem.cacheDirectory}${fileName}`;

  try {
    const info = await FileSystem.getInfoAsync(destinationUri);
    if (info.exists) {
      await FileSystem.deleteAsync(destinationUri, { idempotent: true });
    }
  } catch {}

  await FileSystem.moveAsync({
    from: fileUri,
    to: destinationUri,
  });

  return destinationUri;
}

export async function generateAndSharePdf(
  options: GeneratePdfOptions
): Promise<void> {
  const pdfUri = await generatePdfUri(options);
  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    throw new Error(
      `Sharing is not available on this device. PDF saved at: ${pdfUri}`
    );
  }

  await Sharing.shareAsync(pdfUri, {
    mimeType: "application/pdf",
    dialogTitle: "Share Inspection Report",
    UTI: "com.adobe.pdf",
  });
}
