import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");
const logoPath = path.join(projectRoot, "assets", "logo.png");
const outPath = path.join(projectRoot, "assets", "splash.png");

const CANVAS_SIZE = 2048;
const LOGO_SIZE = 190; // px (within the 160–200 spec)

// Spacing scaled for a 2048x2048 splash canvas.
const GAP_LOGO_TITLE = 80; // ~20px visual on phone
const GAP_TITLE_SUBTITLE = 32; // ~8px visual on phone

const TITLE = "Fathom Marine";
const SUBTITLE = "Inspection Report";

const COLOR_NAVY = "#0B1F3A";
const COLOR_SUBTITLE = "#6B7280";

const TITLE_FONT_SIZE = 96;
const SUBTITLE_FONT_SIZE = 48;
const TITLE_LINE_HEIGHT = 1.1;
const SUBTITLE_LINE_HEIGHT = 1.1;

function makeTextSvg({ titleY, subtitleY }) {
  // Use a safe system-font stack. This is rendered into the PNG at build time.
  const fontFamily =
    "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Inter, Roboto, Helvetica, Arial, sans-serif";

  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">
  <style>
    .title {
      font-family: ${fontFamily};
      font-size: ${TITLE_FONT_SIZE}px;
      font-weight: 800;
      fill: ${COLOR_NAVY};
      letter-spacing: 1px;
    }
    .subtitle {
      font-family: ${fontFamily};
      font-size: ${SUBTITLE_FONT_SIZE}px;
      font-weight: 500;
      fill: ${COLOR_SUBTITLE};
      letter-spacing: 1.5px;
    }
  </style>
  <text x="${CANVAS_SIZE / 2}" y="${titleY}" text-anchor="middle" dominant-baseline="middle" class="title">${TITLE}</text>
  <text x="${CANVAS_SIZE / 2}" y="${subtitleY}" text-anchor="middle" dominant-baseline="middle" class="subtitle">${SUBTITLE}</text>
</svg>`,
  );
}

async function main() {
  const titleHeight = Math.round(TITLE_FONT_SIZE * TITLE_LINE_HEIGHT);
  const subtitleHeight = Math.round(SUBTITLE_FONT_SIZE * SUBTITLE_LINE_HEIGHT);
  const groupHeight =
    LOGO_SIZE +
    GAP_LOGO_TITLE +
    titleHeight +
    GAP_TITLE_SUBTITLE +
    subtitleHeight;

  const groupTop = Math.round((CANVAS_SIZE - groupHeight) / 2);

  const logoTop = groupTop;
  const titleCenterY = Math.round(
    groupTop + LOGO_SIZE + GAP_LOGO_TITLE + titleHeight / 2,
  );
  const subtitleCenterY = Math.round(
    groupTop +
      LOGO_SIZE +
      GAP_LOGO_TITLE +
      titleHeight +
      GAP_TITLE_SUBTITLE +
      subtitleHeight / 2,
  );

  const logoLeft = Math.round((CANVAS_SIZE - LOGO_SIZE) / 2);

  const logo = await sharp(logoPath)
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: "contain" })
    .png()
    .toBuffer();

  const textSvg = makeTextSvg({ titleY: titleCenterY, subtitleY: subtitleCenterY });

  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: "#FFFFFF",
    },
  })
    .composite([
      { input: logo, left: logoLeft, top: logoTop },
      { input: textSvg, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  // eslint-disable-next-line no-console
  console.log(`Generated splash: ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

