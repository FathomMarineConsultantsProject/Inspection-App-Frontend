// src/utils/pdfExports.ts

export {
    generateAndSharePdf,
    generatePdfUri
} from "./pdfGenerator";

export type {
    GeneratePdfOptions, ReportImage, ShipInfo
} from "./pdfGenerator";

import type { GeneratePdfOptions } from "./pdfGenerator";
import { generateAndSharePdf } from "./pdfGenerator";

export async function exportInspectionPDF(
  options: GeneratePdfOptions
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