import sharp from "sharp";
import { albumDesignOwnedWhere } from "@/lib/admin-scope";
import { ALBUM_SPREAD_BACKGROUND, getAlbumLayoutExportSlotInsetPx, getAlbumLayoutTemplate } from "@/lib/album-design-templates";
import { prisma } from "@/lib/prisma";
import { getR2KeyFromPublicUrl, loadPhotoObjectBuffer } from "@/lib/storage";

type AdminSession = {
  id: string;
  role: string;
  workspaceAdminId?: string | null;
};

type AlbumDesignPhotoSource = {
  favoriteListId: string | null;
  sourceGalleryId: string | null;
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

function formNumber(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getOrderedFormStrings(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

function getDraftFormStrings(formData: FormData, spreadId: string, prefixedKey: string, fallbackKey: string) {
  const prefixedValues = getOrderedFormStrings(formData, `spread-${spreadId}-${prefixedKey}`);

  if (prefixedValues.length > 0) {
    return prefixedValues;
  }

  return getOrderedFormStrings(formData, fallbackKey);
}

function clampPercent(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, value));
}

function clampSizePercent(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(0.5, value));
}

function normalizeAlbumTextFont(value: string) {
  return ALBUM_DESIGN_TEXT_FONTS[value] ? value : "playfair";
}

function normalizeAlbumTextLineHeight(value: number) {
  if (!Number.isFinite(value)) {
    return 1.05;
  }

  return Math.min(2.5, Math.max(0.8, value));
}

async function loadValidDesignPhotos(design: AlbumDesignPhotoSource, photoIds: string[]) {
  const uniquePhotoIds = [...new Set(photoIds.filter(Boolean))];

  if (uniquePhotoIds.length === 0) {
    return new Map<string, { id: string; filename: string; r2Key: string; imageUrl: string; previewUrl: string }>();
  }

  const photos = await prisma.photo.findMany({
    where: design.favoriteListId
      ? {
          id: { in: uniquePhotoIds },
          favoriteItems: {
            some: {
              listId: design.favoriteListId
            }
          }
        }
      : design.sourceGalleryId
        ? {
            id: { in: uniquePhotoIds },
            galleryId: design.sourceGalleryId,
            mediaType: "image"
          }
        : {
            id: "__missing_album_design_source__"
          },
    select: {
      id: true,
      filename: true,
      r2Key: true,
      imageUrl: true,
      previewUrl: true
    }
  });

  return new Map(photos.map((photo) => [photo.id, photo]));
}

function parseDraftTextItems(formData: FormData, spreadId: string): AlbumDesignSpreadExportData["textItems"] {
  const ids = getDraftFormStrings(formData, spreadId, "textIds", "textIds");
  const texts = getDraftFormStrings(formData, spreadId, "textValues", "textValues").map((value) => value.trim().slice(0, 500));
  const xValues = getDraftFormStrings(formData, spreadId, "textX", "textX");
  const yValues = getDraftFormStrings(formData, spreadId, "textY", "textY");
  const widthValues = getDraftFormStrings(formData, spreadId, "textWidth", "textWidth");
  const heightValues = getDraftFormStrings(formData, spreadId, "textHeight", "textHeight");
  const fontValues = getDraftFormStrings(formData, spreadId, "textFont", "textFont");
  const sizeValues = getDraftFormStrings(formData, spreadId, "textSize", "textSize");
  const lineHeightValues = getDraftFormStrings(formData, spreadId, "textLineHeight", "textLineHeight");
  const colorValues = getDraftFormStrings(formData, spreadId, "textColor", "textColor");
  const alignValues = getDraftFormStrings(formData, spreadId, "textAlign", "textAlign");

  return ids
    .map((id, index) => {
      const text = texts[index] ?? "";

      if (!text) {
        return null;
      }

      return {
        id: id || `draft-text-${index}`,
        text,
        x: clampPercent(formNumber(xValues[index], 12), 12),
        y: clampPercent(formNumber(yValues[index], 42), 42),
        width: clampSizePercent(formNumber(widthValues[index], 76), 76),
        height: clampSizePercent(formNumber(heightValues[index], 12), 12),
        fontFamily: normalizeAlbumTextFont(fontValues[index] ?? "playfair"),
        fontSize: Math.min(18, Math.max(1.5, formNumber(sizeValues[index], 7))),
        lineHeight: normalizeAlbumTextLineHeight(formNumber(lineHeightValues[index], 1.05)),
        color: normalizeTextColor(colorValues[index] ?? "#191919"),
        textAlign: normalizeTextAlign(alignValues[index] ?? "center"),
        sortOrder: index
      };
    })
    .filter((item): item is AlbumDesignSpreadExportData["textItems"][number] => Boolean(item));
}

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

export async function loadAlbumDesignSpreadDraftForExport({
  admin,
  spreadId,
  formData
}: {
  admin: AdminSession;
  spreadId: string;
  formData: FormData;
}) {
  const spread = await prisma.albumDesignSpread.findFirst({
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
          customerId: true,
          favoriteListId: true,
          sourceGalleryId: true
        }
      }
    }
  });

  if (!spread) {
    return null;
  }

  const layout = getAlbumLayoutTemplate(spread.layoutKey);
  const photoIds = getDraftFormStrings(formData, spread.id, "slotPhotoIds", "slotPhotoIds");
  const slotIndexes = getDraftFormStrings(formData, spread.id, "slotIndexes", "slotIndexes").map((value, index) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : index;
  });
  const xValues = getDraftFormStrings(formData, spread.id, "slotX", "slotX");
  const yValues = getDraftFormStrings(formData, spread.id, "slotY", "slotY");
  const widthValues = getDraftFormStrings(formData, spread.id, "slotWidth", "slotWidth");
  const heightValues = getDraftFormStrings(formData, spread.id, "slotHeight", "slotHeight");
  const cropXValues = getDraftFormStrings(formData, spread.id, "slotCropX", "slotCropX");
  const cropYValues = getDraftFormStrings(formData, spread.id, "slotCropY", "slotCropY");
  const photoById = await loadValidDesignPhotos(spread.design, photoIds);

  if (photoIds.some((photoId) => photoId && !photoById.has(photoId))) {
    return null;
  }

  const items = photoIds
    .map((photoId, index) => {
      const slotIndex = slotIndexes[index] ?? index;
      const fallback = layout.slots[slotIndex] ?? layout.slots[index];
      const photo = photoById.get(photoId);

      if (!photo || !fallback) {
        return null;
      }

      return {
        id: `draft-${slotIndex}-${photo.id}`,
        slotIndex,
        x: clampPercent(formNumber(xValues[index], fallback.x), fallback.x),
        y: clampPercent(formNumber(yValues[index], fallback.y), fallback.y),
        width: clampSizePercent(formNumber(widthValues[index], fallback.width), fallback.width),
        height: clampSizePercent(formNumber(heightValues[index], fallback.height), fallback.height),
        cropX: clampCropPosition(formNumber(cropXValues[index], 50)),
        cropY: clampCropPosition(formNumber(cropYValues[index], 50)),
        photo: {
          filename: photo.filename,
          r2Key: photo.r2Key,
          imageUrl: photo.imageUrl,
          previewUrl: photo.previewUrl
        }
      };
    })
    .filter((item): item is AlbumDesignSpreadExportData["items"][number] => Boolean(item));
  const textItems = parseDraftTextItems(formData, spread.id);

  return {
    id: spread.id,
    title: spread.title,
    layoutKey: spread.layoutKey,
    sortOrder: spread.sortOrder,
    design: {
      title: spread.design.title,
      customerId: spread.design.customerId
    },
    items,
    textItems
  } satisfies AlbumDesignSpreadExportData;
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

export async function albumDesignSpreadJpegResponse(spread: AlbumDesignSpreadExportData) {
  const jpegBuffer = await renderAlbumDesignSpreadJpeg(spread);
  const filename = albumDesignSpreadExportFilename(spread);

  return new Response(new Uint8Array(jpegBuffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(jpegBuffer.length),
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
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
