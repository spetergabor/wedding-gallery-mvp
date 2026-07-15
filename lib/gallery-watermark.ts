import sharp from "sharp";

export type GalleryWatermarkPosition = "center" | "bottom_left" | "bottom_right" | "tile";

export type BakedGalleryWatermarkOptions = {
  text: string;
  position?: string | null;
  opacity?: number | null;
};

const WATERMARK_PREVIEW_MAX_SIZE = 1200;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWatermarkPosition(value: string | null | undefined): GalleryWatermarkPosition {
  return value === "bottom_left" || value === "bottom_right" || value === "tile" ? value : "center";
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createWatermarkSvg({
  width,
  height,
  text,
  position,
  opacity
}: {
  width: number;
  height: number;
  text: string;
  position: GalleryWatermarkPosition;
  opacity: number;
}) {
  const escapedText = escapeSvgText(text);
  const shortestSide = Math.max(1, Math.min(width, height));
  const fontSize = Math.round(clamp(shortestSide / 8, 42, 138));
  const letterSpacing = Math.round(clamp(fontSize * 0.08, 2, 10));
  const normalizedOpacity = clamp(opacity, 58, 86) / 100;
  const strokeWidth = Math.max(2, Math.round(fontSize * 0.06));
  const strokeOpacity = clamp(normalizedOpacity * 0.95, 0.44, 0.76);
  const bandOpacity = clamp(normalizedOpacity * 0.18, 0.12, 0.22);
  const textAttributes = [
    `font-family="DejaVu Sans, Liberation Sans, Helvetica, sans-serif"`,
    `font-size="${fontSize}"`,
    `font-weight="800"`,
    `letter-spacing="${letterSpacing}"`,
    `fill="#ffffff"`,
    `fill-opacity="${normalizedOpacity}"`,
    `stroke="#111111"`,
    `stroke-opacity="${strokeOpacity}"`,
    `stroke-width="${strokeWidth}"`,
    `paint-order="stroke fill"`,
    `text-anchor="middle"`,
    `dominant-baseline="middle"`,
    `filter="url(#shadow)"`
  ].join(" ");
  const protectivePattern = `
    <rect width="${width}" height="${height}" fill="url(#diagonalBands)" opacity="${bandOpacity}"/>
    <path d="M ${Math.round(width * 0.08)} ${Math.round(height * 0.12)} L ${Math.round(width * 0.92)} ${Math.round(height * 0.88)} M ${Math.round(width * 0.92)} ${Math.round(height * 0.12)} L ${Math.round(width * 0.08)} ${Math.round(height * 0.88)}"
      stroke="#ffffff"
      stroke-opacity="${clamp(normalizedOpacity * 0.28, 0.18, 0.34)}"
      stroke-width="${Math.max(10, Math.round(shortestSide * 0.018))}"
      stroke-linecap="round"
    />`;
  const defs = `
    <defs>
      <pattern id="diagonalBands" patternUnits="userSpaceOnUse" width="180" height="180" patternTransform="rotate(-26)">
        <rect x="0" y="0" width="180" height="180" fill="transparent"/>
        <rect x="-20" y="68" width="220" height="18" fill="#ffffff"/>
        <rect x="-20" y="94" width="220" height="4" fill="#111111"/>
      </pattern>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.5"/>
      </filter>
    </defs>`;

  if (position === "tile") {
    const spacingX = Math.round(clamp(width / 2.15, 240, 460));
    const spacingY = Math.round(clamp(height / 2.65, 150, 320));
    const tiles: string[] = [];

    for (let y = -Math.round(spacingY / 2); y <= height + spacingY; y += spacingY) {
      for (let x = -Math.round(spacingX / 2); x <= width + spacingX; x += spacingX) {
        tiles.push(
          `<text x="${x}" y="${y}" transform="rotate(-24 ${x} ${y})" ${textAttributes}>${escapedText}</text>`
        );
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${defs}
      ${protectivePattern}
      ${tiles.join("\n")}
    </svg>`;
  }

  const padding = Math.round(fontSize * 0.9);
  const x =
    position === "bottom_left"
      ? padding + Math.round(text.length * fontSize * 0.34)
      : position === "bottom_right"
        ? width - padding - Math.round(text.length * fontSize * 0.34)
        : width / 2;
  const y = position === "center" ? height / 2 : height - padding;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${defs}
    ${protectivePattern}
    <text x="${x}" y="${y}" ${textAttributes}>${escapedText}</text>
  </svg>`;
}

export async function createWatermarkedGalleryPreview(
  sourceBuffer: Buffer,
  options: BakedGalleryWatermarkOptions
) {
  const basePreview = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: WATERMARK_PREVIEW_MAX_SIZE,
      height: WATERMARK_PREVIEW_MAX_SIZE,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({ quality: 66, mozjpeg: true })
    .toBuffer();
  const metadata = await sharp(basePreview).metadata();
  const width = metadata.width ?? 1200;
  const height = metadata.height ?? 900;
  const watermarkSvg = createWatermarkSvg({
    width,
    height,
    text: options.text.trim() || "PREVIEW",
    position: normalizeWatermarkPosition(options.position),
    opacity: options.opacity ?? 72
  });

  return sharp(basePreview)
    .composite([{ input: Buffer.from(watermarkSvg), left: 0, top: 0 }])
    .jpeg({ quality: 66, mozjpeg: true })
    .toBuffer();
}
