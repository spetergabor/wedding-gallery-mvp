import sharp from "sharp";
import { albumDesignOwnedWhere } from "@/lib/admin-scope";
import { ALBUM_SPREAD_BACKGROUND, getAlbumLayoutExportSlotInsetPx } from "@/lib/album-design-templates";
import { prisma } from "@/lib/prisma";
import { getR2KeyFromPublicUrl, loadPhotoObjectBuffer } from "@/lib/storage";

type AdminSession = {
  id: string;
  role: string;
  workspaceAdminId?: string | null;
};

export type AlbumDesignSpreadExportData = {
  id: string;
  title: string | null;
  layoutKey: string;
  sortOrder: number;
  design: {
    title: string;
    customerId: string | null;
  };
  items: Array<{
    id: string;
    slotIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    cropX: number;
    cropY: number;
    photo: {
      filename: string;
      r2Key: string;
      imageUrl: string;
      previewUrl: string;
    };
  }>;
  textItems: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    color: string;
    textAlign: string;
    sortOrder: number;
  }>;
};

export const ALBUM_DESIGN_EXPORT_WIDTH = 7200;
export const ALBUM_DESIGN_EXPORT_HEIGHT = 3600;
const ALBUM_DESIGN_EXPORT_JPEG_QUALITY = 95;

const ALBUM_DESIGN_TEXT_FONTS: Record<string, string> = {
  playfair: "Playfair Display, Georgia, serif",
  cormorant: "Cormorant Garamond, Georgia, serif",
  lora: "Lora, Georgia, serif",
  montserrat: "Montserrat, Arial, sans-serif"
};

export async function loadAlbumDesignSpreadForExport({
  admin,
  spreadId
}: {
  admin: AdminSession;
  spreadId: string;
}) {
  return prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      design: albumDesignOwnedWhere(admin)
    },
    select: {
      id: true,
      title: true,
      layoutKey: true,
      sortOrder: true,
      design: {
        select: {
          title: true,
          customerId: true
        }
      },
      items: {
        orderBy: { slotIndex: "asc" },
        select: {
          id: true,
          slotIndex: true,
          x: true,
          y: true,
          width: true,
          height: true,
          cropX: true,
          cropY: true,
          photo: {
            select: {
              filename: true,
              r2Key: true,
              imageUrl: true,
              previewUrl: true
            }
          }
        }
      },
      textItems: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          text: true,
          x: true,
          y: true,
          width: true,
          height: true,
          fontFamily: true,
          fontSize: true,
          lineHeight: true,
          color: true,
          textAlign: true,
          sortOrder: true
        }
      }
    }
  });
}

export async function loadAlbumDesignForExport({
  admin,
  designId
}: {
  admin: AdminSession;
  designId: string;
}) {
  return prisma.albumDesign.findFirst({
    where: {
      id: designId,
      ...albumDesignOwnedWhere(admin)
    },
    select: {
      id: true,
      title: true,
      spreads: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          layoutKey: true,
          sortOrder: true,
          design: {
            select: {
              title: true,
              customerId: true
            }
          },
          items: {
            orderBy: { slotIndex: "asc" },
            select: {
              id: true,
              slotIndex: true,
              x: true,
              y: true,
              width: true,
              height: true,
              cropX: true,
              cropY: true,
              photo: {
                select: {
                  filename: true,
                  r2Key: true,
                  imageUrl: true,
                  previewUrl: true
                }
              }
            }
          },
          textItems: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              text: true,
              x: true,
              y: true,
              width: true,
              height: true,
              fontFamily: true,
              fontSize: true,
              lineHeight: true,
              color: true,
              textAlign: true,
              sortOrder: true
            }
          }
        }
      }
    }
  });
}

function clampCropPosition(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(100, Math.max(0, value));
}

async function renderCroppedPhotoBuffer({
  photoBuffer,
  width,
  height,
  cropX,
  cropY
}: {
  photoBuffer: Buffer;
  width: number;
  height: number;
  cropX: number;
  cropY: number;
}) {
  const orientedBuffer = await sharp(photoBuffer, { failOn: "none" }).rotate().toBuffer();
  const metadata = await sharp(orientedBuffer, { failOn: "none" }).metadata();

  if (!metadata.width || !metadata.height) {
    return sharp(orientedBuffer, { failOn: "none" })
      .resize(width, height, { fit: "cover", position: "centre" })
      .jpeg({ quality: ALBUM_DESIGN_EXPORT_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  }

  const scale = Math.max(width / metadata.width, height / metadata.height);
  const resizedWidth = Math.max(width, Math.ceil(metadata.width * scale));
  const resizedHeight = Math.max(height, Math.ceil(metadata.height * scale));
  const maxLeft = Math.max(0, resizedWidth - width);
  const maxTop = Math.max(0, resizedHeight - height);
  const left = Math.min(maxLeft, Math.max(0, Math.round(maxLeft * (clampCropPosition(cropX) / 100))));
  const top = Math.min(maxTop, Math.max(0, Math.round(maxTop * (clampCropPosition(cropY) / 100))));

  return sharp(orientedBuffer, { failOn: "none" })
    .resize(resizedWidth, resizedHeight, { fit: "fill" })
    .extract({ left, top, width, height })
    .jpeg({ quality: ALBUM_DESIGN_EXPORT_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeTextColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#191919";
}

function normalizeTextAlign(value: string) {
  return value === "left" || value === "right" ? value : "center";
}

function textAnchorForAlign(value: string) {
  if (value === "left") {
    return "start";
  }

  if (value === "right") {
    return "end";
  }

  return "middle";
}

function textXForAlign(align: string, width: number) {
  if (align === "left") {
    return 0;
  }

  if (align === "right") {
    return width;
  }

  return width / 2;
}

function wrapTextLines(text: string, fontSize: number, width: number) {
  const manualLines = text.replace(/\r\n/g, "\n").split("\n");
  const maxChars = Math.max(1, Math.floor(width / Math.max(1, fontSize * 0.58)));
  const lines: string[] = [];

  for (const manualLine of manualLines) {
    const words = manualLine.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = "";

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;

      if (nextLine.length > maxChars && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = nextLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function renderTextItemSvg(item: AlbumDesignSpreadExportData["textItems"][number]) {
  const width = Math.max(1, Math.round((item.width / 100) * ALBUM_DESIGN_EXPORT_WIDTH));
  const height = Math.max(1, Math.round((item.height / 100) * ALBUM_DESIGN_EXPORT_HEIGHT));
  const fontSize = Math.max(16, Math.round((item.fontSize / 100) * ALBUM_DESIGN_EXPORT_HEIGHT));
  const fontFamily = ALBUM_DESIGN_TEXT_FONTS[item.fontFamily] ?? ALBUM_DESIGN_TEXT_FONTS.playfair;
  const align = normalizeTextAlign(item.textAlign);
  const anchor = textAnchorForAlign(align);
  const x = textXForAlign(align, width);
  const lineHeight = Math.round(fontSize * Math.min(2.5, Math.max(0.8, item.lineHeight)));
  const lines = wrapTextLines(item.text, fontSize, width);
  const startY = Math.max(fontSize, Math.round((height - Math.max(fontSize, lines.length * lineHeight)) / 2) + fontSize);
  const textNodes = lines
    .slice(0, Math.max(1, Math.floor(height / lineHeight)))
    .map((line, index) => `<text x="${x}" y="${startY + index * lineHeight}" text-anchor="${anchor}">${escapeSvgText(line)}</text>`)
    .join("");

  return {
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <style>
          text {
            fill: ${normalizeTextColor(item.color)};
            font-family: ${fontFamily};
            font-size: ${fontSize}px;
            font-weight: 600;
          }
        </style>
        ${textNodes}
      </svg>`
    ),
    left: Math.round((item.x / 100) * ALBUM_DESIGN_EXPORT_WIDTH),
    top: Math.round((item.y / 100) * ALBUM_DESIGN_EXPORT_HEIGHT)
  };
}

export async function renderAlbumDesignSpreadJpeg(spread: AlbumDesignSpreadExportData) {
  const slotInset = getAlbumLayoutExportSlotInsetPx(spread.layoutKey);
  const photoComposites = await Promise.all(
    spread.items.map(async (item) => {
      const photoR2Key = item.photo.r2Key || getR2KeyFromPublicUrl(item.photo.imageUrl) || getR2KeyFromPublicUrl(item.photo.previewUrl);
      const photoBuffer = await loadPhotoObjectBuffer({
        r2Key: photoR2Key,
        publicUrl: item.photo.imageUrl || item.photo.previewUrl
      });
      const slotWidth = Math.round((item.width / 100) * ALBUM_DESIGN_EXPORT_WIDTH);
      const slotHeight = Math.round((item.height / 100) * ALBUM_DESIGN_EXPORT_HEIGHT);
      const width = Math.max(1, slotWidth - slotInset * 2);
      const height = Math.max(1, slotHeight - slotInset * 2);
      const input = await renderCroppedPhotoBuffer({
        photoBuffer,
        width,
        height,
        cropX: item.cropX,
        cropY: item.cropY
      });

      return {
        input,
        left: Math.round((item.x / 100) * ALBUM_DESIGN_EXPORT_WIDTH) + slotInset,
        top: Math.round((item.y / 100) * ALBUM_DESIGN_EXPORT_HEIGHT) + slotInset
      };
    })
  );
  const textComposites = spread.textItems.map(renderTextItemSvg);

  return sharp({
    create: {
      width: ALBUM_DESIGN_EXPORT_WIDTH,
      height: ALBUM_DESIGN_EXPORT_HEIGHT,
      channels: 3,
      background: ALBUM_SPREAD_BACKGROUND
    }
  })
    .composite([...photoComposites, ...textComposites])
    .jpeg({ quality: ALBUM_DESIGN_EXPORT_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

export function albumDesignSpreadExportFilename(spread: AlbumDesignSpreadExportData) {
  const paddedSortOrder = String(spread.sortOrder).padStart(2, "0");

  return `album-oldalpar-${paddedSortOrder}.jpg`;
}

export function albumDesignExportFilename(title: string) {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return `${slug || "albumterv"}-oldalparok.zip`;
}
