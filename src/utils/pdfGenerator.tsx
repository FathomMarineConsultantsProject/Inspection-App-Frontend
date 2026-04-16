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
  imagesPerPage: 2 | 4 | 6;
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
              : `<div style="font-size:18px; font-weight:700; color:#1e3a8a;">FATHOM</div>`
          }
        </div>

        <div style="width:36%; text-align:center;">
          <div style="font-size:12px; color:#4b5563; margin-bottom:2px;">
            Powered by Fathom Marine Consultants
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

function buildPhotoPage(
  chunk: ReportImage[],
  imageDataUris: string[],
  imagesPerPage: 2 | 4 | 6
): string {
  const getGridColumns = (value: number) => {
    if (value === 2) return "1fr";
    if (value === 4) return "1fr 1fr";
    if (value === 6) return "1fr 1fr";
    return "1fr";
  };

  const imageHeight =
    imagesPerPage === 2 ? "420px" : imagesPerPage === 4 ? "240px" : "180px";

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
          box-sizing:border-box;
        ">
          ${
            imageUri !== EMPTY_IMAGE_FALLBACK
              ? `<img src="${imageUri}" style="
                  width:100%;
                  height: ${imageHeight};
                  object-fit:cover;
                  border-radius:6px;
                " alt="Inspection Photo ${index + 1}" />`
              : `<div style="width: 100%; height: ${imageHeight}; border-radius: 6px; background: #f3f4f6;
                  display: flex; align-items: center; justify-content: center; color: #6b7280;">No photo</div>`
          }
          <div style="
            font-size: 11px;
            margin-top: 6px;
          ">
            ${escapeHtml(desc || "-")}
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div style="
      display: grid;
      grid-template-columns: ${getGridColumns(imagesPerPage)};
      gap: 16px;
    ">
      ${cards}
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

  images.forEach((img, index) => {
    const uri = img?.uri || "";
    const isSupported =
      uri.startsWith("file://") ||
      uri.startsWith("data:image/") ||
      uri.startsWith("http://") ||
      uri.startsWith("https://");

    if (!isSupported) {
      console.log(`UNSUPPORTED IMAGE URI FORMAT at index ${index}:`, uri);
    }
  });

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
    .map((page) => {
      return `
        <div style="
          width: 100%;
          height: 100%;
          padding: 16px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        ">
          ${page}
        </div>
      `;
    })
    .join("");

  console.log("FINAL HTML READY");
  return buildHtmlDocument(html);
}

function buildSafeFileName(shipName: unknown, date: unknown): string {
  const safeShip = ((typeof shipName === "string" ? shipName : "") || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "");
  const safeDate = ((typeof date === "string" ? date : "") || "")
    .trim()
    .replace(/[^\dA-Za-z-]/g, "-");
  return `Fathom_Inspection_${safeShip || "Ship"}_${safeDate || "Date"}.pdf`;
}

export async function generatePdfUri(
  options: GeneratePdfOptions
): Promise<string> {
  console.log("GENERATING HTML...");
  const html = await buildPdfHtml(options);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });
  const fileUri = uri;
  console.log("PDF URI:", fileUri);

  const fileName = buildSafeFileName(
    options.shipInfo.shipName,
    options.shipInfo.date
  );

  const destinationUri = `${FileSystem.cacheDirectory}${fileName}`;

  try {
    const info = await FileSystem.getInfoAsync(destinationUri);
    if (info.exists) {
      await FileSystem.deleteAsync(destinationUri, { idempotent: true });
    }
  } catch {}

  console.log("Moving file...");
  await FileSystem.moveAsync({
    from: fileUri,
    to: destinationUri,
  });

  return destinationUri;
}

export async function generateAndSharePdf(
  options: GeneratePdfOptions
): Promise<void> {
  try {
    console.log("START PDF GENERATION");

    const pdfUri = await generatePdfUri(options);

    console.log("PDF URI:", pdfUri);

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

    console.log("SHARE SUCCESS");
  } catch (err) {
    console.log("GENERATION FAILED:", err);
    throw err;
  }
}
