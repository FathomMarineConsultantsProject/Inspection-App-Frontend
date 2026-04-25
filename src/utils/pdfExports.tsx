import {
  generatePDF,
  generateAndSharePDF,
  type GeneratePdfOptions,
  type ReportImage,
  type ShipInfo,
} from "./nativePdfGenerator";

export type {
  GeneratePdfOptions,
  ReportImage,
  ShipInfo,
} from "./nativePdfGenerator";

export async function generatePdfUri(options: GeneratePdfOptions): Promise<string> {
  return generatePDF({
    images: options.images,
    imagesPerPage: options.imagesPerPage,
    reportDetails: options.shipInfo,
  });
}

export async function generateAndSharePdf(
  options: GeneratePdfOptions,
): Promise<string> {
  return generateAndSharePDF({
    images: options.images,
    imagesPerPage: options.imagesPerPage,
    reportDetails: options.shipInfo,
  });
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
