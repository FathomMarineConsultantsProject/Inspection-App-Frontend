import * as FileSystem from "expo-file-system";
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

function escapeHtml(value?: string): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildCoverPage(
  shipInfo: ShipInfo,
  logoDataUri: string,
  shipPhotoDataUri: string
): string {
  const totalPhotos = shipInfo.totalPhotos ?? 0;

  const logoHtml =
    logoDataUri !== EMPTY_IMAGE_FALLBACK
      ? `<img src="${logoDataUri}" class="logo" alt="Company Logo" />`
      : `<div class="logo-fallback">FATHOM</div>`;

  const shipPhotoHtml =
    shipPhotoDataUri !== EMPTY_IMAGE_FALLBACK
      ? `<img src="${shipPhotoDataUri}" class="cover-ship-photo" alt="Ship Photo" />`
      : `<div class="cover-ship-photo placeholder">No ship photo provided</div>`;

  return `
    <section class="page cover-page">
      <div class="cover-shell">
        <div class="cover-header">
          <div class="cover-logo-wrap">
            ${logoHtml}
          </div>

          <div class="cover-title-wrap">
            <div class="cover-powered">Powered by Fathom Marine consultants</div>
            <div class="cover-title">INSPECTION REPORT</div>
          </div>

          <div class="cover-date">${escapeHtml(shipInfo.date)}</div>
        </div>

        <div class="cover-divider"></div>

        <div class="cover-info-box">
          <div class="info-column">
            <div class="info-item">
              <span class="info-label">Ship:</span>
              <span class="info-value">${escapeHtml(shipInfo.shipName)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Inspector:</span>
              <span class="info-value">${escapeHtml(shipInfo.inspector)}</span>
            </div>
          </div>

          <div class="info-column">
            <div class="info-item">
              <span class="info-label">Port:</span>
              <span class="info-value">${escapeHtml(shipInfo.port)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Total Photos:</span>
              <span class="info-value">${String(totalPhotos)}</span>
            </div>
          </div>
        </div>

        <div class="cover-photo-section">
          ${shipPhotoHtml}
        </div>
      </div>
    </section>
  `;
}

function buildPhotoPage(
  chunk: ReportImage[],
  imageDataUris: string[],
  imagesPerPage: 2 | 4 | 6
): string {
  const imageHeightMap: Record<2 | 4 | 6, string> = {
    2: "320px",
    4: "220px",
    6: "155px",
  };

  const imageHeight = imageHeightMap[imagesPerPage];

  const cards = chunk
    .map((item, index) => {
      const imageUri = imageDataUris[index] || EMPTY_IMAGE_FALLBACK;

      return `
        <div class="photo-card">
          ${
            imageUri !== EMPTY_IMAGE_FALLBACK
              ? `<img src="${imageUri}" class="photo-image" style="height:${imageHeight};" alt="Inspection Photo ${index + 1}" />`
              : `<div class="photo-image placeholder" style="height:${imageHeight};">No photo</div>`
          }
          <div class="photo-description">
            <span class="desc-label">Description:</span>
            <span class="desc-value">${escapeHtml(item.description || "-")}</span>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <section class="page photo-page">
      <div class="photo-grid">
        ${cards}
      </div>
    </section>
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

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 18mm 16mm 14mm 16mm;
      background: #ffffff;
      page-break-after: always;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    .cover-shell {
      width: 100%;
    }

    .cover-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      gap: 12px;
    }

    .cover-logo-wrap {
      width: 120px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    .logo {
      max-width: 110px;
      max-height: 54px;
      object-fit: contain;
      display: block;
    }

    .logo-fallback {
      width: 100px;
      height: 50px;
      background: #0f766e;
      color: #ffffff;
      font-weight: 700;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .cover-title-wrap {
      flex: 1;
      text-align: center;
    }

    .cover-powered {
      font-size: 10px;
      color: #5b6472;
      margin-bottom: 4px;
    }

    .cover-title {
      font-size: 18px;
      font-weight: 800;
      color: #233a6b;
      letter-spacing: 0.5px;
    }

    .cover-date {
      width: 120px;
      text-align: right;
      font-size: 12px;
      font-weight: 700;
      color: #233a6b;
    }

    .cover-divider {
      height: 2px;
      background: #2e4c84;
      margin-bottom: 18px;
    }

    .cover-info-box {
      display: flex;
      justify-content: space-between;
      gap: 30px;
      background: #f1f3f5;
      padding: 14px 14px;
      margin-bottom: 18px;
    }

    .info-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .info-item {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 4px;
      line-height: 1.35;
    }

    .info-label {
      font-size: 11px;
      font-weight: 700;
      color: #233a6b;
    }

    .info-value {
      font-size: 11px;
      color: #2a2f36;
    }

    .cover-photo-section {
      width: 100%;
    }

    .cover-ship-photo {
      width: 100%;
      height: 300px;
      object-fit: cover;
      display: block;
      border-radius: 3px;
    }

    .placeholder {
      background: #e9edf3;
      color: #7b8794;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    }

    .photo-page {
      padding-top: 14mm;
      padding-bottom: 12mm;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }

    .photo-card {
      border: 1px solid #d9d9d9;
      background: #ffffff;
      padding: 8px;
    }

    .photo-image {
      width: 100%;
      object-fit: cover;
      display: block;
      background: #f5f5f5;
    }

    .photo-description {
      padding-top: 10px;
      font-size: 11px;
      line-height: 1.35;
    }

    .desc-label {
      font-weight: 700;
      color: #222;
    }

    .desc-value {
      color: #333;
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
    shipPhotoDataUri
  );

  const imageChunks = chunkArray(images, imagesPerPage);

  const photoPagesHtml = imageChunks
    .map((chunk, chunkIndex) => {
      const chunkUris = photoDataUris.slice(
        chunkIndex * imagesPerPage,
        chunkIndex * imagesPerPage + chunk.length
      );

      return buildPhotoPage(chunk, chunkUris, imagesPerPage);
    })
    .join("");

  return buildHtmlDocument(`${coverHtml}${photoPagesHtml}`);
}

function buildSafeFileName(shipName: string, date: string): string {
  const safeShip = shipName.trim().replace(/\s+/g, "_").replace(/[^\w-]/g, "");
  const safeDate = date.trim().replace(/[^\dA-Za-z-]/g, "-");
  return `Fathom_Inspection_${safeShip || "Ship"}_${safeDate || "Date"}.pdf`;
}

export async function generatePdfUri(
  options: GeneratePdfOptions
): Promise<string> {
  const html = await buildPdfHtml(options);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

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

  await FileSystem.moveAsync({
    from: uri,
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
    throw new Error(`Sharing is not available on this device. PDF saved at: ${pdfUri}`);
  }

  await Sharing.shareAsync(pdfUri, {
    mimeType: "application/pdf",
    dialogTitle: "Share Inspection Report",
    UTI: "com.adobe.pdf",
  });
}