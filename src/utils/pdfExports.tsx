import type { ExportPdfImage, ExportPdfShipInfo } from "./exportPDF";
import {
    exportPDF,
} from "./exportPDF";

export type ReportImage = ExportPdfImage;
export type ShipInfo = ExportPdfShipInfo;

export type GeneratePdfOptions = {
  shipInfo: ShipInfo;
  images: ReportImage[];
  imagesPerPage: 2 | 4 | 6 | 8;
};

export async function generatePdfUri(options: GeneratePdfOptions): Promise<string> {
  return exportPDF(options.images, options.imagesPerPage, options.shipInfo);
}

export async function generateAndSharePdf(
  options: GeneratePdfOptions,
): Promise<string> {
  return generatePdfUri(options);
}

export async function exportInspectionPDF(
  options: GeneratePdfOptions,
): Promise<void> {
  console.log("PDF OPTIONS:", options);

  try {
    await generateAndSharePdf(options);
    console.log("PDF SUCCESS");
  } catch (err) {
    console.log("PDF ERROR:", err);
    throw err;
  }
}
