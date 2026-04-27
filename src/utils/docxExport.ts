import {
    AlignmentType,
    Document,
    ImageRun,
    Packer,
    Paragraph,
    TextRun,
} from "docx";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as Sharing from "expo-sharing";

type ReportImage = {
  uri: string;
  exportUri?: string;
  description: string;
};

type ShipInfo = {
  shipName?: string;
  shipType?: string;
  inspector?: string;
  inspectorName?: string;
  surveyorName?: string;
  port?: string;
  portName?: string;
  location?: string;
  date?: string;
  inspectionDate?: string;
  companyName?: string;
  shipPhotoUri?: string;
  companyLogoUri?: string;
  totalPhotos?: number;
};

type GeneratePdfOptions = {
  shipInfo: ShipInfo;
  images: ReportImage[];
  imagesPerPage: 2 | 4 | 6 | 8;
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function parseDataUri(dataUri: string): { mimeType: string; base64: string } | null {
  const match = dataUri.match(/^data:(.*?);base64,(.*)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function base64ToUint8Array(base64: string): Uint8Array {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i += 4) {
    const c1 = chars.indexOf(cleaned[i]);
    const c2 = chars.indexOf(cleaned[i + 1]);
    const c3 = cleaned[i + 2] === "=" ? -1 : chars.indexOf(cleaned[i + 2]);
    const c4 = cleaned[i + 3] === "=" ? -1 : chars.indexOf(cleaned[i + 3]);

    if (c1 < 0 || c2 < 0) continue;

    const byte1 = (c1 << 2) | (c2 >> 4);
    output.push(byte1 & 255);

    if (c3 >= 0) {
      const byte2 = ((c2 & 15) << 4) | (c3 >> 2);
      output.push(byte2 & 255);
    }

    if (c4 >= 0 && c3 >= 0) {
      const byte3 = ((c3 & 3) << 6) | c4;
      output.push(byte3 & 255);
    }
  }

  return new Uint8Array(output);
}

async function compressUriToJpegBytes(
  localUri: string
): Promise<{ data: Uint8Array; mimeType: string } | null> {
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    try {
      await FileSystem.deleteAsync(compressed.uri, { idempotent: true });
    } catch {
      // ignore
    }
    return {
      data: base64ToUint8Array(base64),
      mimeType: "image/jpeg",
    };
  } catch {
    return null;
  }
}

async function uriToImageBytes(
  uri: string
): Promise<{ data: Uint8Array; mimeType: string } | null> {
  try {
    if (!uri) return null;

    if (uri.startsWith("data:")) {
      const parsed = parseDataUri(uri);
      if (!parsed) return null;
      const tempPath = `${FileSystem.cacheDirectory}docx_data_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.jpg`;
      await FileSystem.writeAsStringAsync(tempPath, parsed.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const out = await compressUriToJpegBytes(tempPath);
      try {
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
      } catch {
        // ignore
      }
      return out;
    }

    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      const tempName = `docx_img_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`;
      const tempPath = `${FileSystem.cacheDirectory}${tempName}`;
      const downloaded = await FileSystem.downloadAsync(uri, tempPath);
      const out = await compressUriToJpegBytes(downloaded.uri);
      try {
        await FileSystem.deleteAsync(downloaded.uri, { idempotent: true });
      } catch {
        // ignore
      }
      return out;
    }

    return await compressUriToJpegBytes(uri);
  } catch {
    return null;
  }
}

export async function generateAndShareDocx(
  options: GeneratePdfOptions
): Promise<void> {
  const { shipInfo, images, imagesPerPage } = options;
  const shipDetails = shipInfo as GeneratePdfOptions["shipInfo"] & {
    inspectorName?: string;
    portName?: string;
    location?: string;
    inspectionDate?: string;
  };
  const shipName = shipDetails.shipName || "-";
  const inspector = shipDetails.inspector || shipDetails.inspectorName || "-";
  const port = shipDetails.port || shipDetails.portName || shipDetails.location || "-";
  const date = shipDetails.inspectionDate
    ? new Date(shipDetails.inspectionDate).toLocaleDateString()
    : "-";
  const totalPhotos = shipDetails.totalPhotos || images.length || 0;
  const children: Paragraph[] = [];
  const logoImage = shipInfo.companyLogoUri
    ? await uriToImageBytes(shipInfo.companyLogoUri)
    : null;
  const shipCoverImage = shipInfo.shipPhotoUri
    ? await uriToImageBytes(shipInfo.shipPhotoUri)
    : null;

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "INSPECTION REPORT",
          bold: true,
          size: 36,
        }),
      ],
      spacing: { after: 200 },
    }),
    ...(logoImage
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: logoImage.data,
                type: logoImage.mimeType === "image/png" ? "png" : "jpg",
                transformation: { width: 120, height: 120 },
              }),
            ],
            spacing: { after: 200 },
          }),
        ]
      : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Powered by Fathom-Nexport",
          size: 20,
        }),
      ],
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Ship: ",
          bold: true,
        }),
        new TextRun({
          text: shipName,
          bold: false,
        }),
      ],
      spacing: { after: 150 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Inspector: ",
          bold: true,
        }),
        new TextRun({
          text: inspector,
          bold: false,
        }),
      ],
      spacing: { after: 150 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Port: ",
          bold: true,
        }),
        new TextRun({
          text: port,
          bold: false,
        }),
      ],
      spacing: { after: 150 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Date: ",
          bold: true,
        }),
        new TextRun({
          text: date,
          bold: false,
        }),
      ],
      spacing: { after: 150 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Total Photos: ",
          bold: true,
        }),
        new TextRun({
          text: String(totalPhotos),
          bold: false,
        }),
      ],
      spacing: { after: 150 },
    }),
    ...(shipCoverImage
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: shipCoverImage.data,
                type: shipCoverImage.mimeType === "image/png" ? "png" : "jpg",
                transformation: { width: 400, height: 225 },
              }),
            ],
            spacing: { after: 300 },
          }),
        ]
      : []),
    new Paragraph({
      children: [],
      pageBreakBefore: true,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Photo Section",
          bold: true,
          size: 28,
        }),
      ],
      spacing: { after: 300 },
    })
  );

  const imagePages = chunkArray(images, imagesPerPage);
  let photoDisplayIndex = 0;

  for (let pageIndex = 0; pageIndex < imagePages.length; pageIndex += 1) {
    const group = imagePages[pageIndex];

    for (let imageIndex = 0; imageIndex < group.length; imageIndex += 1) {
      const img = group[imageIndex];
      const imageBytes = await uriToImageBytes(img.uri);

      if (!imageBytes) {
        continue;
      }

      photoDisplayIndex += 1;

      children.push(
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: `Photo ${photoDisplayIndex}`,
              bold: true,
              size: 22,
            }),
          ],
        })
      );

      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new ImageRun({
              data: imageBytes.data,
              type: imageBytes.mimeType === "image/png" ? "png" : "jpg",
              transformation: {
                width: 500,
                height: 300,
              },
            }),
          ],
        })
      );

      children.push(
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: (img.description || "").trim() || "-",
              size: 20,
            }),
          ],
        })
      );
    }
    if (pageIndex < imagePages.length - 1) {
      children.push(
        new Paragraph({
          pageBreakBefore: true,
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  const base64Doc = await Packer.toBase64String(doc);
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error("Document directory is not available.");
  }

  const fileUri = `${baseDir}inspection.docx`;
  await FileSystem.writeAsStringAsync(fileUri, base64Doc, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error(
      `Sharing is not available on this device. DOCX saved at: ${fileUri}`
    );
  }

  await Sharing.shareAsync(fileUri, {
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    dialogTitle: "Share Inspection Report",
    UTI: "org.openxmlformats.wordprocessingml.document",
  });
}
