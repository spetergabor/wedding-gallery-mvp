import sharp from "sharp";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { ALBUM_SPREAD_BACKGROUND, getAlbumLayoutExportSlotInsetPx } from "@/lib/album-design-templates";
import { prisma } from "@/lib/prisma";
import { getR2KeyFromPublicUrl, loadPhotoObjectBuffer } from "@/lib/storage";

type AdminSession = {
  id: string;
  role: string;
};

export type AlbumDesignSpreadExportData = {
  id: string;
  title: string | null;
  layoutKey: string;
  sortOrder: number;
  design: {
    title: string;
    customerId: string;
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
};

export const ALBUM_DESIGN_EXPORT_WIDTH = 7200;
export const ALBUM_DESIGN_EXPORT_HEIGHT = 3600;
const ALBUM_DESIGN_EXPORT_JPEG_QUALITY = 95;

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
      design: {
        customer: adminOwnedWhere(admin)
      }
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

export async function renderAlbumDesignSpreadJpeg(spread: AlbumDesignSpreadExportData) {
  const slotInset = getAlbumLayoutExportSlotInsetPx(spread.layoutKey);
  const composites = await Promise.all(
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

  return sharp({
    create: {
      width: ALBUM_DESIGN_EXPORT_WIDTH,
      height: ALBUM_DESIGN_EXPORT_HEIGHT,
      channels: 3,
      background: ALBUM_SPREAD_BACKGROUND
    }
  })
    .composite(composites)
    .jpeg({ quality: ALBUM_DESIGN_EXPORT_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

export function albumDesignSpreadExportFilename(spread: AlbumDesignSpreadExportData) {
  const paddedSortOrder = String(spread.sortOrder).padStart(2, "0");

  return `album-oldalpar-${paddedSortOrder}.jpg`;
}
