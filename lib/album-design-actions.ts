"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { customerAccessWhere } from "@/lib/admin-scope";
import {
  ALBUM_DESIGN_EXPORT_HEIGHT,
  ALBUM_DESIGN_EXPORT_WIDTH,
  albumDesignSpreadExportFilename,
  renderAlbumDesignSpreadJpeg,
  type AlbumDesignSpreadExportData
} from "@/lib/album-design-export";
import { requireAdmin } from "@/lib/auth";
import { getAlbumLayoutTemplate, pickRandomAlbumLayoutTemplate, type AlbumLayoutTemplate } from "@/lib/album-design-templates";
import { prisma } from "@/lib/prisma";
import { createAlbumReviewSpreadObjectKey, deletePhotoObject, getPhotoPublicUrl, savePhotoObject } from "@/lib/storage";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formInteger(formData: FormData, key: string) {
  const value = formString(formData, key);
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function clampCropPosition(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(100, Math.max(0, value));
}

function getSelectedPhotoIds(formData: FormData) {
  return [
    ...new Set(
      formData
        .getAll("photoIds")
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    )
  ];
}

function getOrderedFormStrings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function getOrderedCropPositions(formData: FormData, count: number, keys = { cropX: "slotCropX", cropY: "slotCropY" }) {
  const cropXValues = getOrderedFormStrings(formData, keys.cropX);
  const cropYValues = getOrderedFormStrings(formData, keys.cropY);

  return Array.from({ length: count }, (_, index) => ({
    cropX: clampCropPosition(Number.parseFloat(cropXValues[index] ?? "50")),
    cropY: clampCropPosition(Number.parseFloat(cropYValues[index] ?? "50"))
  }));
}

function shufflePhotoIds(photoIds: string[]) {
  const shuffledPhotoIds = [...photoIds];

  for (let index = shuffledPhotoIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledPhotoIds[index], shuffledPhotoIds[swapIndex]] = [shuffledPhotoIds[swapIndex], shuffledPhotoIds[index]];
  }

  return shuffledPhotoIds;
}

function createSpreadItems(layout: AlbumLayoutTemplate, photoIds: string[], cropPositions?: Array<{ cropX: number; cropY: number }>) {
  return layout.slots.map((slot, index) => ({
    photoId: photoIds[index],
    slotIndex: index,
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    cropX: cropPositions?.[index]?.cropX ?? 50,
    cropY: cropPositions?.[index]?.cropY ?? 50
  }));
}

function createAlbumAccessToken() {
  return randomBytes(32).toString("base64url");
}

async function requireCustomerAccess(customerId: string) {
  const admin = await requireAdmin();
  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  return { admin, customer };
}

async function requireAlbumDesignAccess(customerId: string, designId: string) {
  const { admin } = await requireCustomerAccess(customerId);
  const design = await prisma.albumDesign.findFirst({
    where: {
      id: designId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: {
      id: true,
      customerId: true,
      favoriteListId: true
    }
  });

  if (!design) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  return { admin, design };
}

async function getVerifiedDesignPhotoIds({
  customerId,
  favoriteListId,
  formData,
  photoCount
}: {
  customerId: string;
  favoriteListId: string;
  formData: FormData;
  photoCount: number;
}) {
  const selectedPhotoIds = getSelectedPhotoIds(formData);

  if (selectedPhotoIds.length !== photoCount) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=photo-count`);
  }

  const photos = await prisma.photo.findMany({
    where: {
      id: { in: selectedPhotoIds },
      favoriteItems: {
        some: {
          listId: favoriteListId
        }
      }
    },
    select: { id: true }
  });
  const validPhotoIds = new Set(photos.map((photo) => photo.id));
  const photoIds = selectedPhotoIds.filter((photoId) => validPhotoIds.has(photoId));

  if (photoIds.length !== photoCount) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=invalid-photos`);
  }

  return photoIds;
}

async function requireFavoritePhoto({
  customerId,
  favoriteListId,
  photoId
}: {
  customerId: string;
  favoriteListId: string;
  photoId: string;
}) {
  const photo = await prisma.photo.findFirst({
    where: {
      id: photoId,
      favoriteItems: {
        some: {
          listId: favoriteListId
        }
      }
    },
    select: { id: true }
  });

  if (!photo) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=invalid-photos`);
  }

  return photo;
}

export async function createAlbumDesignAction(customerId: string, formData: FormData) {
  const { admin, customer } = await requireCustomerAccess(customerId);
  const title = formString(formData, "title") || "Albumterv";
  const favoriteListId = formString(formData, "favoriteListId");
  const favoriteList = await prisma.galleryFavoriteList.findFirst({
    where: {
      id: favoriteListId,
      gallery: {
        customer: customerAccessWhere(admin, customer.id)
      }
    },
    select: { id: true }
  });

  if (!favoriteList) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=favorite-list`);
  }

  await prisma.albumDesign.create({
    data: {
      customerId: customer.id,
      favoriteListId: favoriteList.id,
      title
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumDesignCreated=1`);
}

export async function createAlbumDesignSpreadAction(customerId: string, designId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=favorite-list`);
  }

  const layout = getAlbumLayoutTemplate(formString(formData, "layoutKey"));
  const photoIds = await getVerifiedDesignPhotoIds({
    customerId,
    favoriteListId: design.favoriteListId,
    formData,
    photoCount: layout.photoCount
  });

  const latestSpread = await prisma.albumDesignSpread.findFirst({
    where: { designId: design.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  const sortOrder = (latestSpread?.sortOrder ?? 0) + 1;

  await prisma.albumDesignSpread.create({
    data: {
      designId: design.id,
      title: `Oldalpár ${sortOrder}`,
      layoutKey: layout.key,
      sortOrder,
      items: {
        create: createSpreadItems(layout, photoIds)
      }
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadCreated=1`);
}

export async function createAutoAlbumDesignSpreadAction(customerId: string, designId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=favorite-list`);
  }

  const selectedPhotoIds = getSelectedPhotoIds(formData);

  if (selectedPhotoIds.length === 0) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=photo-count`);
  }

  const layout = pickRandomAlbumLayoutTemplate(selectedPhotoIds.length);

  if (!layout) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=layout-count`);
  }

  const photoIds = await getVerifiedDesignPhotoIds({
    customerId,
    favoriteListId: design.favoriteListId,
    formData,
    photoCount: selectedPhotoIds.length
  });

  const latestSpread = await prisma.albumDesignSpread.findFirst({
    where: { designId: design.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  const sortOrder = (latestSpread?.sortOrder ?? 0) + 1;

  await prisma.albumDesignSpread.create({
    data: {
      designId: design.id,
      title: `Oldalpár ${sortOrder}`,
      layoutKey: layout.key,
      sortOrder,
      items: {
        create: createSpreadItems(layout, shufflePhotoIds(photoIds))
      }
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadAutoCreated=1`);
}

export async function updateAlbumDesignSpreadAction(customerId: string, designId: string, spreadId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=favorite-list`);
  }

  const spread = await prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      designId: design.id
    },
    select: { id: true }
  });

  if (!spread) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  const layout = getAlbumLayoutTemplate(formString(formData, "layoutKey"));
  const photoIds = await getVerifiedDesignPhotoIds({
    customerId,
    favoriteListId: design.favoriteListId,
    formData,
    photoCount: layout.photoCount
  });

  await prisma.albumDesignSpread.update({
    where: { id: spread.id },
    data: {
      layoutKey: layout.key,
      items: {
        deleteMany: {},
        create: createSpreadItems(layout, photoIds)
      }
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadUpdated=1`);
}

export async function regenerateAlbumDesignSpreadLayoutAction(customerId: string, designId: string, spreadId: string) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);
  const spread = await prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      designId: design.id
    },
    select: {
      id: true,
      layoutKey: true,
      items: {
        orderBy: { slotIndex: "asc" },
        select: { photoId: true }
      }
    }
  });

  if (!spread) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  const photoIds = spread.items.map((item) => item.photoId);

  if (photoIds.length === 0) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=photo-count`);
  }

  const layout = pickRandomAlbumLayoutTemplate(photoIds.length, spread.layoutKey);

  if (!layout) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=layout-count`);
  }

  await prisma.albumDesignSpread.update({
    where: { id: spread.id },
    data: {
      layoutKey: layout.key,
      items: {
        deleteMany: {},
        create: createSpreadItems(layout, shufflePhotoIds(photoIds))
      }
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadRegenerated=1`);
}

export async function exportAlbumDesignToReviewAction(customerId: string, designId: string) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);
  const albumDesign = await prisma.albumDesign.findUnique({
    where: { id: design.id },
    select: {
      id: true,
      title: true,
      customerId: true,
      customer: {
        select: {
          primaryEmail: true
        }
      },
      spreads: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
      }
    }
  });

  if (!albumDesign) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  const spreads = albumDesign.spreads.filter((spread) => spread.items.length > 0) satisfies AlbumDesignSpreadExportData[];

  if (spreads.length === 0) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=no-spreads`);
  }

  const review = await prisma.albumReview.create({
    data: {
      customerId: albumDesign.customerId,
      title: `${albumDesign.title} ellenőrző`,
      status: "ready",
      clientEmail: albumDesign.customer.primaryEmail,
      accessToken: createAlbumAccessToken()
    },
    select: {
      id: true,
      accessToken: true
    }
  });
  const uploadedObjectKeys: string[] = [];

  try {
    const reviewSpreads = [];

    for (const [index, spread] of spreads.entries()) {
      const jpegBuffer = await renderAlbumDesignSpreadJpeg(spread);
      const filename = albumDesignSpreadExportFilename(spread);
      const r2Key = createAlbumReviewSpreadObjectKey({
        customerId: albumDesign.customerId,
        reviewId: review.id,
        originalFilename: filename
      });

      await savePhotoObject({
        r2Key,
        bytes: jpegBuffer,
        contentType: "image/jpeg"
      });
      uploadedObjectKeys.push(r2Key);

      reviewSpreads.push({
        filename,
        title: spread.title ?? `Oldalpár ${spread.sortOrder}`,
        r2Key,
        imageUrl: getPhotoPublicUrl(r2Key),
        fileSize: jpegBuffer.length,
        imageWidth: ALBUM_DESIGN_EXPORT_WIDTH,
        imageHeight: ALBUM_DESIGN_EXPORT_HEIGHT,
        sortOrder: index + 1
      });
    }

    await prisma.albumReview.update({
      where: { id: review.id },
      data: {
        spreads: {
          createMany: {
            data: reviewSpreads
          }
        }
      }
    });
  } catch (error) {
    console.error("Album design export failed", {
      customerId,
      designId,
      error
    });

    await prisma.albumReview.delete({ where: { id: review.id } }).catch(() => undefined);
    await Promise.all(uploadedObjectKeys.map((r2Key) => deletePhotoObject(r2Key)));
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=export-failed`);
  }

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath(`/album/${review.accessToken}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumDesignExported=${spreads.length}`);
}

export async function updateAlbumDesignSpreadSlotAction(customerId: string, designId: string, spreadId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=favorite-list`);
  }

  const slotIndex = formInteger(formData, "slotIndex");
  const photoId = formString(formData, "photoId");

  if (slotIndex === null || !photoId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=slot`);
  }

  const spread = await prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      designId: design.id
    },
    select: {
      id: true,
      layoutKey: true
    }
  });

  if (!spread) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  const layout = getAlbumLayoutTemplate(spread.layoutKey);
  const slot = layout.slots[slotIndex];

  if (!slot) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=slot`);
  }

  await requireFavoritePhoto({
    customerId,
    favoriteListId: design.favoriteListId,
    photoId
  });

  const item = await prisma.albumDesignSpreadItem.findFirst({
    where: {
      spreadId: spread.id,
      slotIndex
    },
    select: { id: true }
  });

  if (item) {
    await prisma.albumDesignSpreadItem.update({
      where: { id: item.id },
      data: { photoId, cropX: 50, cropY: 50 }
    });
  } else {
    await prisma.albumDesignSpreadItem.create({
      data: {
        spreadId: spread.id,
        photoId,
        slotIndex,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        cropX: 50,
        cropY: 50
      }
    });
  }

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadSlotUpdated=1`);
}

export async function saveAlbumDesignSpreadSlotDraftAction(customerId: string, designId: string, spreadId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=favorite-list`);
  }

  const spread = await prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      designId: design.id
    },
    select: {
      id: true,
      layoutKey: true
    }
  });

  if (!spread) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  const layout = getAlbumLayoutTemplate(spread.layoutKey);
  const photoIds = getOrderedFormStrings(formData, "slotPhotoIds");
  const cropPositions = getOrderedCropPositions(formData, layout.slots.length);

  if (photoIds.length !== layout.slots.length) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=photo-count`);
  }

  const uniquePhotoIds = [...new Set(photoIds)];
  const validPhotos = await prisma.photo.findMany({
    where: {
      id: { in: uniquePhotoIds },
      favoriteItems: {
        some: {
          listId: design.favoriteListId
        }
      }
    },
    select: { id: true }
  });
  const validPhotoIds = new Set(validPhotos.map((photo) => photo.id));

  if (uniquePhotoIds.some((photoId) => !validPhotoIds.has(photoId))) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=invalid-photos`);
  }

  await prisma.albumDesignSpread.update({
    where: { id: spread.id },
    data: {
      items: {
        deleteMany: {},
        create: createSpreadItems(layout, photoIds, cropPositions)
      }
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadSlotUpdated=1`);
}

export async function saveAlbumDesignSpreadDraftsAction(customerId: string, designId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=favorite-list`);
  }

  const draftSpreadIds = [
    ...new Set(
      getOrderedFormStrings(formData, "draftSpreadIds")
    )
  ];

  if (draftSpreadIds.length === 0) {
    redirect(`/admin/clients/${customerId}?tab=album`);
  }

  const spreads = await prisma.albumDesignSpread.findMany({
    where: {
      id: { in: draftSpreadIds },
      designId: design.id
    },
    select: {
      id: true,
      layoutKey: true
    }
  });

  if (spreads.length !== draftSpreadIds.length) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  const spreadDrafts = spreads.map((spread) => {
    const layout = getAlbumLayoutTemplate(spread.layoutKey);
    const photoIds = getOrderedFormStrings(formData, `spread-${spread.id}-slotPhotoIds`);
    const cropPositions = getOrderedCropPositions(formData, layout.slots.length, {
      cropX: `spread-${spread.id}-slotCropX`,
      cropY: `spread-${spread.id}-slotCropY`
    });

    if (photoIds.length !== layout.slots.length) {
      redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=photo-count`);
    }

    return {
      spread,
      layout,
      photoIds,
      cropPositions
    };
  });

  const uniquePhotoIds = [
    ...new Set(
      spreadDrafts.flatMap((draft) => draft.photoIds)
    )
  ];
  const validPhotos = await prisma.photo.findMany({
    where: {
      id: { in: uniquePhotoIds },
      favoriteItems: {
        some: {
          listId: design.favoriteListId
        }
      }
    },
    select: { id: true }
  });
  const validPhotoIds = new Set(validPhotos.map((photo) => photo.id));

  if (uniquePhotoIds.some((photoId) => !validPhotoIds.has(photoId))) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=invalid-photos`);
  }

  await prisma.$transaction(
    spreadDrafts.map((draft) =>
      prisma.albumDesignSpread.update({
        where: { id: draft.spread.id },
        data: {
          items: {
            deleteMany: {},
            create: createSpreadItems(draft.layout, draft.photoIds, draft.cropPositions)
          }
        }
      })
    )
  );

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadSlotUpdated=1`);
}

export async function deleteAlbumDesignAction(customerId: string, designId: string) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  await prisma.albumDesign.delete({
    where: { id: design.id }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumDesignDeleted=1`);
}

export async function deleteAlbumDesignSpreadAction(customerId: string, designId: string, spreadId: string) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);
  const spread = await prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      designId: design.id
    },
    select: { id: true }
  });

  if (!spread) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  await prisma.albumDesignSpread.delete({
    where: { id: spread.id }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadDeleted=1`);
}
