// src/utils/pdfExports.ts

export {
  generateAndSharePdf,
  generatePdfUri,
} from "./pdfGenerator";

export type {
  GeneratePdfOptions,
  ShipInfo,
  ReportImage,
} from "./pdfGenerator";

import { generateAndSharePdf } from "./pdfGenerator";
import type { GeneratePdfOptions } from "./pdfGenerator";

export async function exportInspectionPDF(
  options: GeneratePdfOptions
): Promise<void> {
  return generateAndSharePdf(options);
}