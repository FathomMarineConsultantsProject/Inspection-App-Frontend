declare module "react-native-pdf-lib" {
  export type DrawTextOptions = {
    x?: number;
    y?: number;
    color?: string;
    fontSize?: number;
    fontName?: string;
  };

  export type DrawImageOptions = {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    imageSource?: "assets" | "path";
  };

  export class PDFPage {
    static create(): PDFPage;
    static modify(pageIndex: number): PDFPage;
    setMediaBox(width: number, height: number, options?: { x?: number; y?: number }): PDFPage;
    drawText(value: string, options?: DrawTextOptions): PDFPage;
    drawImage(imagePath: string, imageType: "jpg" | "png", options?: DrawImageOptions): PDFPage;
  }

  export class PDFDocument {
    static create(path: string): PDFDocument;
    static modify(path: string): PDFDocument;
    addPage(page: PDFPage): PDFDocument;
    addPages(...pages: PDFPage[]): PDFDocument;
    modifyPage(page: PDFPage): PDFDocument;
    modifyPages(...pages: PDFPage[]): PDFDocument;
    write(): Promise<string>;
  }

  const PDFLib: {
    createPDF(document: unknown): Promise<string>;
    modifyPDF(document: unknown): Promise<string>;
    getDocumentsDirectory(): Promise<string>;
    getAssetPath(assetName: string): Promise<string>;
    unloadAsset(assetName: string, destPath: string): Promise<string>;
    measureText(value: string, fontName: string, fontSize: number): Promise<{
      width: number;
      height: number;
    }>;
  };

  export default PDFLib;
}
