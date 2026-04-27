import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export type ExportPdfImage = {
  uri: string;
  exportUri?: string;
  description?: string;
};

export type ExportPdfShipInfo = {
  companyName?: string;
  shipName?: string;
  inspector?: string;
  inspectorName?: string;
  surveyorName?: string;
  port?: string;
  portName?: string;
  location?: string;
  date?: string;
  inspectionDate?: string;
};

function escapeHtml(value?: string): string {
  const text = (value || "").trim();
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safePerPage(imagesPerPage: number): 2 | 4 | 6 | 8 {
  if (imagesPerPage === 2 || imagesPerPage === 4 || imagesPerPage === 6 || imagesPerPage === 8) {
    return imagesPerPage;
  }
  return 2;
}

async function getBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

function buildHeader(shipInfo?: ExportPdfShipInfo): string {
  if (!shipInfo) {
    return "";
  }

  const title = escapeHtml(shipInfo.companyName || shipInfo.shipName || "Inspection Report");
  const inspector = escapeHtml(shipInfo.inspector || shipInfo.inspectorName || shipInfo.surveyorName || "");
  const port = escapeHtml(shipInfo.port || shipInfo.portName || shipInfo.location || "");
  const date = escapeHtml(shipInfo.date || shipInfo.inspectionDate || "");

  if (!inspector && !port && !date) {
    return `<h2 style=\"margin:0 0 10px 0;\">${title}</h2>`;
  }

  return `
    <div style=\"margin-bottom:10px;\">
      <h2 style=\"margin:0 0 4px 0;\">${title}</h2>
      <p style=\"margin:0;font-size:11px;color:#4b5563;\">${inspector}${inspector && port ? " | " : ""}${port}${(inspector || port) && date ? " | " : ""}${date}</p>
    </div>
  `;
}

function buildPageHtml(
  imagesHtml: string,
  pageIndex: number,
  perPage: 2 | 4 | 6 | 8,
  shipInfo?: ExportPdfShipInfo,
): string {
  const columns = perPage === 2 ? 1 : 2;

  return `
    <div style=\"page-break-after: always; padding: 14px;\">
      ${buildHeader(shipInfo)}
      <div style=\"display:grid; grid-template-columns: repeat(${columns}, 1fr); gap: 10px;\">
        ${imagesHtml}
      </div>
      <p style=\"font-size:10px;color:#6b7280;margin-top:10px;\">Page ${pageIndex + 1}</p>
    </div>
  `;
}

export async function exportPDF(
  images: ExportPdfImage[],
  imagesPerPage: number,
  shipInfo?: ExportPdfShipInfo,
): Promise<string> {
  const safeImages = images || [];
  const perPage = safePerPage(imagesPerPage);

  let html = `
    <html>
      <body style="font-family: Arial; padding: 10px;">
  `;

  for (let i = 0; i < safeImages.length; i += perPage) {
    const batch = safeImages.slice(i, i + perPage);
    const pageIndex = Math.floor(i / perPage);

    let imagesHtml = "";
    for (const img of batch) {
      const sourceUri = img.exportUri || img.uri;
      let imageTag = "";
      try {
        const base64 = await getBase64(sourceUri);
        imageTag = `<img src="data:image/jpeg;base64,${base64}" style="width:100%; height:auto; border-radius:8px;" />`;
      } catch {
        // Keep export resilient when a single image cannot be read.
        imageTag = `<div style="width:100%; height:120px; border-radius:8px; background:#e5e7eb;"></div>`;
      }

      const description = escapeHtml(img.description || "");
      imagesHtml += `
        <div style="break-inside: avoid; margin-bottom:10px;">
          ${imageTag}
          <p style="font-size:12px; margin:6px 0 0 0;">${description}</p>
        </div>
      `;
    }

    html += buildPageHtml(imagesHtml, pageIndex, perPage, shipInfo);

    // Yield periodically so large sets do not block JS for too long.
    if (i % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  if (safeImages.length === 0) {
    html += `<div style="padding:16px;"><p>No images available for export.</p></div>`;
  }

  html += `
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error(`Sharing is not available on this device. PDF saved at: ${uri}`);
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Share Inspection Report",
    UTI: "com.adobe.pdf",
  });

  return uri;
}
