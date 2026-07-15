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

const VECTOR_GLYPHS: Record<string, string> = {
  E: "M76 8H10V96H76M10 52H64",
  I: "M10 8H76M43 8V96M10 96H76",
  P: "M10 96V8H50C70 8 78 18 78 35C78 52 68 62 50 62H10",
  R: "M10 96V8H50C70 8 78 18 78 35C78 52 68 62 50 62H10M45 62L80 96",
  V: "M8 8L43 96L78 8",
  W: "M6 8L20 96L43 38L66 96L80 8"
};

const VECTOR_GLYPH_WIDTH = 86;
const VECTOR_GLYPH_HEIGHT = 104;
const VECTOR_GLYPH_ADVANCE = 96;

function normalizeVectorWatermarkText(value: string) {
  const supportedText = value
    .trim()
    .toUpperCase()
    .split("")
    .filter((letter) => VECTOR_GLYPHS[letter])
    .join("");

  return supportedText || "PREVIEW";
}

function vectorWordWidth(word: string) {
  return Math.max(VECTOR_GLYPH_WIDTH, (word.length - 1) * VECTOR_GLYPH_ADVANCE + VECTOR_GLYPH_WIDTH);
}

function createVectorWatermarkWord({
  word,
  x,
  y,
  scale,
  rotate,
  opacity,
  strokeOpacity,
  strokeWidth
}: {
  word: string;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
  strokeOpacity: number;
  strokeWidth: number;
}) {
  const glyphs = word
    .split("")
    .map((letter, index) => {
      const path = VECTOR_GLYPHS[letter];

      if (!path) {
        return "";
      }

      return `<path d="${path}" transform="translate(${index * VECTOR_GLYPH_ADVANCE} 0)"/>`;
    })
    .join("\n");
  const wordWidth = vectorWordWidth(word);
  const underlayStroke = Math.round(strokeWidth * 2.8);
  const highlightStroke = Math.round(strokeWidth * 1.35);

  return `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale}) translate(${-wordWidth / 2} ${-VECTOR_GLYPH_HEIGHT / 2})">
    <g fill="none" stroke="#111111" stroke-opacity="${strokeOpacity}" stroke-width="${underlayStroke}" stroke-linecap="round" stroke-linejoin="round">
      ${glyphs}
    </g>
    <g fill="none" stroke="#ffffff" stroke-opacity="${opacity}" stroke-width="${highlightStroke}" stroke-linecap="round" stroke-linejoin="round">
      ${glyphs}
    </g>
  </g>`;
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
  const watermarkText = normalizeVectorWatermarkText(text);
  const shortestSide = Math.max(1, Math.min(width, height));
  const markHeight = Math.round(clamp(shortestSide / 6.6, 82, 150));
  const markScale = markHeight / VECTOR_GLYPH_HEIGHT;
  const normalizedOpacity = clamp(opacity, 58, 86) / 100;
  const strokeWidth = Math.max(5, Math.round(markHeight * 0.08));
  const strokeOpacity = clamp(normalizedOpacity * 0.95, 0.44, 0.76);
  const bandOpacity = clamp(normalizedOpacity * 0.18, 0.12, 0.22);
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
    const renderedWordWidth = vectorWordWidth(watermarkText) * markScale;
    const spacingX = Math.round(clamp(renderedWordWidth * 0.74, 300, 620));
    const spacingY = Math.round(clamp(markHeight * 2.1, 190, 340));
    const tiles: string[] = [];

    for (let y = -Math.round(spacingY / 2); y <= height + spacingY; y += spacingY) {
      for (let x = -Math.round(spacingX / 2); x <= width + spacingX; x += spacingX) {
        tiles.push(createVectorWatermarkWord({
          word: watermarkText,
          x,
          y,
          scale: markScale,
          rotate: -24,
          opacity: normalizedOpacity,
          strokeOpacity,
          strokeWidth
        }));
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${defs}
      ${protectivePattern}
      ${tiles.join("\n")}
    </svg>`;
  }

  const renderedWordWidth = vectorWordWidth(watermarkText) * markScale;
  const padding = Math.round(markHeight * 0.9);
  const x =
    position === "bottom_left"
      ? padding + renderedWordWidth / 2
      : position === "bottom_right"
        ? width - padding - renderedWordWidth / 2
        : width / 2;
  const y = position === "center" ? height / 2 : height - padding;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${defs}
    ${protectivePattern}
    ${createVectorWatermarkWord({
      word: watermarkText,
      x,
      y,
      scale: markScale,
      rotate: -16,
      opacity: normalizedOpacity,
      strokeOpacity,
      strokeWidth
    })}
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
