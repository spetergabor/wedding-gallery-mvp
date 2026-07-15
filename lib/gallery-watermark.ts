import sharp from "sharp";

export type GalleryWatermarkPosition = "center" | "bottom_left" | "bottom_right" | "tile";

export type BakedGalleryWatermarkOptions = {
  text: string;
  position?: string | null;
  opacity?: number | null;
};

const WATERMARK_PREVIEW_MAX_SIZE = 2000;

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
  const fontSize = Math.round(clamp(shortestSide / 14, 24, 86));
  const letterSpacing = Math.round(clamp(fontSize * 0.18, 4, 14));
  const normalizedOpacity = clamp(opacity, 8, 70) / 100;
  const textAttributes = [
    `font-family="Arial, Helvetica, sans-serif"`,
    `font-size="${fontSize}"`,
    `font-weight="700"`,
    `letter-spacing="${letterSpacing}"`,
    `fill="#ffffff"`,
    `fill-opacity="${normalizedOpacity}"`,
    `text-anchor="middle"`,
    `dominant-baseline="middle"`,
    `filter="url(#shadow)"`
  ].join(" ");

  if (position === "tile") {
    const spacingX = Math.round(clamp(width / 3, 260, 520));
    const spacingY = Math.round(clamp(height / 4, 160, 340));
    const tiles: string[] = [];

    for (let y = -spacingY; y <= height + spacingY; y += spacingY) {
      for (let x = -spacingX; x <= width + spacingX; x += spacingX) {
        tiles.push(
          `<text x="${x}" y="${y}" transform="rotate(-24 ${x} ${y})" ${textAttributes}>${escapedText}</text>`
        );
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.28"/>
        </filter>
      </defs>
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
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.34"/>
      </filter>
    </defs>
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
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  const metadata = await sharp(basePreview).metadata();
  const width = metadata.width ?? 1200;
  const height = metadata.height ?? 900;
  const watermarkSvg = createWatermarkSvg({
    width,
    height,
    text: options.text.trim() || "Preview",
    position: normalizeWatermarkPosition(options.position),
    opacity: options.opacity ?? 38
  });

  return sharp(basePreview)
    .composite([{ input: Buffer.from(watermarkSvg), left: 0, top: 0 }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}
