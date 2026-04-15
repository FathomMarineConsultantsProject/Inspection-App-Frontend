import "react-native-get-random-values";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type ReportImage = {
  id: string;
  uri: string;
  description: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function readUriAsBase64(uri: string) {
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    const download = await FileSystem.downloadAsync(
      uri,
      `${FileSystem.cacheDirectory}temp_${Date.now()}`
    );

    return await FileSystem.readAsStringAsync(download.uri, {
      encoding: "base64",
    });
  }

  return await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });
}

async function embedAnyImage(pdfDoc: PDFDocument, uri: string) {
  const base64 = await readUriAsBase64(uri);
  const bytes = base64ToBytes(base64);

  try {
    return await pdfDoc.embedJpg(bytes);
  } catch {
    return await pdfDoc.embedPng(bytes);
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function getGrid(imagesPerPage: 2 | 4 | 6) {
  if (imagesPerPage === 2) return { cols: 1, rows: 2 };
  if (imagesPerPage === 4) return { cols: 2, rows: 2 };
  return { cols: 2, rows: 3 };
}

function fitInside(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  const ratio = Math.min(maxW / srcW, maxH / srcH);
  return {
    width: srcW * ratio,
    height: srcH * ratio,
  };
}

function drawHeader({
  page,
  pageWidth,
  pageHeight,
  margin,
  headerHeight,
  fontBold,
  logoImage,
}: any) {
  page.drawLine({
    start: { x: margin.left, y: pageHeight - margin.top - headerHeight },
    end: { x: pageWidth - margin.right, y: pageHeight - margin.top - headerHeight },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });

  if (logoImage) {
    const targetHeight = 24;
    const scale = targetHeight / logoImage.height;
    const targetWidth = logoImage.width * scale;

    page.drawImage(logoImage, {
      x: margin.left,
      y: pageHeight - margin.top - 28,
      width: targetWidth,
      height: targetHeight,
    });
  }

  const title = "Powered by Fathom Marine";
  const fontSize = 12;
  const textWidth = fontBold.widthOfTextAtSize(title, fontSize);

  page.drawText(title, {
    x: pageWidth / 2 - textWidth / 2,
    y: pageHeight - margin.top - 22,
    size: fontSize,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });
}

function drawFooter({
  page,
  pageWidth,
  margin,
  font,
  pageNumber,
  totalPages,
}: any) {
  page.drawLine({
    start: { x: margin.left, y: margin.bottom + 18 },
    end: { x: pageWidth - margin.right, y: margin.bottom + 18 },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });

  const text = `Page ${pageNumber} of ${totalPages}`;
  const fontSize = 10;
  const textWidth = font.widthOfTextAtSize(text, fontSize);

  page.drawText(text, {
    x: pageWidth / 2 - textWidth / 2,
    y: margin.bottom - 10,
    size: fontSize,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
}

function drawMultilineText({
  page,
  text,
  x,
  y,
  maxWidth,
  font,
  fontSize,
  maxLines = 3,
}: any) {
  const safeText = (text || "-").trim() || "-";
  const words = safeText.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, fontSize);

    if (width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  let yy = y;
  for (const line of lines) {
    page.drawText(line, {
      x,
      y: yy,
      size: fontSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    yy -= fontSize + 2;
  }
}

export async function exportInspectionPDF({
  ship,
  report,
}: {
  ship: any;
  report: {
    imagesPerPage: 2 | 4 | 6;
    images: ReportImage[];
  };
}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;

  const margin = {
    top: 56,
    right: 48,
    bottom: 56,
    left: 48,
  };

  const headerHeight = 34;
  const footerHeight = 28;

  const logoUri = ship?.logoUri ?? ship?.logo ?? ship?.shipLogoUri ?? null;
  const shipPhotoUri = ship?.shipPhotoUri ?? ship?.shipPhoto ?? null;

  const logoImage = logoUri ? await embedAnyImage(pdfDoc, logoUri) : null;
  const shipImage = shipPhotoUri ? await embedAnyImage(pdfDoc, shipPhotoUri) : null;

  const pages: any[] = [];

  // Cover page
  {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);

    drawHeader({
      page,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      margin,
      headerHeight,
      fontBold,
      logoImage,
    });

    const top = PAGE_HEIGHT - margin.top - headerHeight - 14;
    const bottom = margin.bottom + footerHeight + 14;
    const left = margin.left;
    const right = PAGE_WIDTH - margin.right;

    let y = top;

    if (shipImage) {
      const maxW = right - left;
      const maxH = 220;
      const fitted = fitInside(shipImage.width, shipImage.height, maxW, maxH);
      const x = left + (maxW - fitted.width) / 2;
      y -= fitted.height;

      page.drawImage(shipImage, {
        x,
        y,
        width: fitted.width,
        height: fitted.height,
      });

      y -= 18;
    }

    const cardHeight = 280;
    const cardY = Math.max(bottom, y - cardHeight);
    const cardWidth = right - left;

    page.drawRectangle({
      x: left,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      borderWidth: 1,
      borderColor: rgb(0.85, 0.85, 0.85),
    });

    let textY = cardY + cardHeight - 24;

    page.drawText("Inspection Report", {
      x: left + 14,
      y: textY,
      size: 16,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    textY -= 24;

    const rows: [string, string][] = [
      ["Ship Name", ship?.shipName ?? "-"],
      ["Ship Type", ship?.shipType ?? "-"],
      ["Inspector", ship?.inspectorName ?? ship?.surveyorName ?? "-"],
      ["Images / Page", String(report?.imagesPerPage ?? "-")],
      ["Total Images", String(report?.images?.length ?? 0)],
    ];

    const labelX = left + 14;
    const valueX = left + 165;

    for (const [label, value] of rows) {
      page.drawText(`${label}:`, {
        x: labelX,
        y: textY,
        size: 11,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });

      page.drawText(value, {
        x: valueX,
        y: textY,
        size: 11,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });

      textY -= 18;
    }
  }

  // Image pages
  const imagesPerPage = report?.imagesPerPage ?? 2;
  const imageItems = report?.images ?? [];
  const grouped = chunkArray(imageItems, imagesPerPage);
  const { cols, rows } = getGrid(imagesPerPage);

  const embeddedImages = [];
  for (const item of imageItems) {
    embeddedImages.push(await embedAnyImage(pdfDoc, item.uri));
  }

  let imageIndex = 0;

  for (const group of grouped) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);

    drawHeader({
      page,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      margin,
      headerHeight,
      fontBold,
      logoImage,
    });

    const top = PAGE_HEIGHT - margin.top - headerHeight - 12;
    const bottom = margin.bottom + footerHeight + 12;
    const left = margin.left;
    const right = PAGE_WIDTH - margin.right;

    const gridWidth = right - left;
    const gridHeight = top - bottom;
    const gap = 10;
    const descHeight = 34;

    const cellWidth = (gridWidth - gap * (cols - 1)) / cols;
    const cellHeight = (gridHeight - gap * (rows - 1)) / rows;

    for (let i = 0; i < group.length; i++) {
      const item = group[i];
      const row = Math.floor(i / cols);
      const col = i % cols;

      const cellX = left + col * (cellWidth + gap);
      const cellTopY = top - row * (cellHeight + gap);
      const cellY = cellTopY - cellHeight;

      page.drawRectangle({
        x: cellX,
        y: cellY,
        width: cellWidth,
        height: cellHeight,
        borderWidth: 1,
        borderColor: rgb(0.9, 0.9, 0.9),
      });

      const img = embeddedImages[imageIndex++];
      const imageBoxX = cellX + 8;
      const imageBoxY = cellY + descHeight + 8;
      const imageBoxW = cellWidth - 16;
      const imageBoxH = cellHeight - descHeight - 16;

      const fitted = fitInside(img.width, img.height, imageBoxW, imageBoxH);

      page.drawImage(img, {
        x: imageBoxX + (imageBoxW - fitted.width) / 2,
        y: imageBoxY + (imageBoxH - fitted.height) / 2,
        width: fitted.width,
        height: fitted.height,
      });

      drawMultilineText({
        page,
        text: item.description || "-",
        x: cellX + 10,
        y: cellY + 22,
        maxWidth: cellWidth - 20,
        font,
        fontSize: 9,
        maxLines: 3,
      });
    }
  }

  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    drawFooter({
      page: pages[i],
      pageWidth: PAGE_WIDTH,
      margin,
      font,
      pageNumber: i + 1,
      totalPages,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBase64 = bytesToBase64(pdfBytes);

  const fileUri = `${FileSystem.documentDirectory}inspection_report_${Date.now()}.pdf`;

  await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
    encoding: "base64",
  });

  await Sharing.shareAsync(fileUri);
}