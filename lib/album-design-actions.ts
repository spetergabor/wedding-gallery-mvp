"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminOwnedWhere, albumDesignAccessWhere, customerAccessWhere, ownerAdminId } from "@/lib/admin-scope";
import {
  ALBUM_DESIGN_EXPORT_HEIGHT,
  ALBUM_DESIGN_EXPORT_WIDTH,
  albumDesignSpreadExportFilename,
  renderAlbumDesignSpreadJpeg,
  type AlbumDesignSpreadExportData
} from "@/lib/album-design-export";
import { requireAdmin } from "@/lib/auth";
import { ALBUM_LAYOUT_TEMPLATES, getAlbumLayoutTemplate, pickRandomAlbumLayoutTemplate, type AlbumLayoutTemplate } from "@/lib/album-design-templates";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_ALBUM_SOURCE, GALLERY_MODE_FULL } from "@/lib/proofing";
import {
  createAlbumReviewSpreadObjectKey,
  deleteGalleryObjects,
  deletePhotoObject,
  getPhotoPublicUrl,
  getR2KeyFromPublicUrl,
  savePhotoObject
} from "@/lib/storage";

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

function createSpreadItemsForSlotIndexes(
  layout: AlbumLayoutTemplate,
  photoIds: string[],
  slotIndexes: number[],
  cropPositions?: Array<{ cropX: number; cropY: number }>
) {
  return photoIds
    .map((photoId, index) => {
      const slotIndex = slotIndexes[index] ?? index;
      const slot = layout.slots[slotIndex];

      if (!photoId || !slot) {
        return null;
      }

      return {
        photoId,
        slotIndex,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        cropX: cropPositions?.[index]?.cropX ?? 50,
        cropY: cropPositions?.[index]?.cropY ?? 50
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function createAlbumAccessToken() {
  return randomBytes(32).toString("base64url");
}

function createAlbumSourceGallerySlug() {
  return `album-source-${randomBytes(10).toString("hex")}`;
}

function albumDesignRedirectPath(customerId: string | null | undefined, query = "") {
  const basePath = customerId ? `/admin/clients/${customerId}?tab=album&albumMode=editor` : "/admin/albums";

  if (!query) {
    return basePath;
  }

  return `${basePath}${customerId ? "&" : "?"}${query}`;
}

function albumDesignEditorRedirectQuery(designId: string, query: string) {
  return `${query}&albumWorkspace=projects&albumDesignId=${designId}&albumEditor=1`;
}

function revalidateAlbumDesignPaths(customerId: string | null | undefined) {
  revalidatePath("/admin/albums");

  if (customerId) {
    revalidatePath(`/admin/clients/${customerId}`);
  }
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

async function requireAlbumDesignContext(customerId: string | null | undefined) {
  if (customerId) {
    return requireCustomerAccess(customerId);
  }

  return {
    admin: await requireAdmin(),
    customer: null
  };
}

async function albumProjectIdForCustomer(admin: Awaited<ReturnType<typeof requireAdmin>>, customerId: string, projectId: string) {
  if (!projectId) {
    return null;
  }

  const project = await prisma.customerProject.findFirst({
    where: {
      id: projectId,
      customer: customerAccessWhere(admin, customerId),
      projectType: "album"
    },
    select: { id: true }
  });

  return project?.id ?? null;
}

async function createAlbumSourceGallery({
  adminId,
  customerId,
  title
}: {
  adminId: string;
  customerId: string | null;
  title: string;
}) {
  const gallery = await prisma.gallery.create({
    data: {
      adminId,
      customerId,
      title: `${title} forrásképek`,
      slug: createAlbumSourceGallerySlug(),
      galleryMode: GALLERY_MODE_ALBUM_SOURCE,
      isActive: false,
      downloadsEnabled: false
    },
    select: {
      id: true
    }
  });

  return gallery.id;
}

async function requireAlbumDesignAccess(customerId: string | null | undefined, designId: string) {
  const { admin } = await requireAlbumDesignContext(customerId);
  const design = await prisma.albumDesign.findFirst({
    where: {
      ...albumDesignAccessWhere(admin, designId),
      ...(customerId ? { customerId } : {})
    },
    select: {
      id: true,
      customerId: true,
      adminId: true,
      favoriteListId: true,
      sourceGalleryId: true,
      projectId: true
    }
  });

  if (!design) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=missing"));
  }

  return { admin, design };
}

type AlbumDesignPhotoSource = {
  favoriteListId: string | null;
  sourceGalleryId: string | null;
};

function parseAlbumDesignSource(formData: FormData) {
  const sourceId = formString(formData, "sourceId");

  if (sourceId.startsWith("favorite:")) {
    return {
      favoriteListId: sourceId.replace("favorite:", ""),
      sourceGalleryId: ""
    };
  }

  if (sourceId.startsWith("gallery:")) {
    return {
      favoriteListId: "",
      sourceGalleryId: sourceId.replace("gallery:", "")
    };
  }

  return {
    favoriteListId: formString(formData, "favoriteListId"),
    sourceGalleryId: formString(formData, "sourceGalleryId")
  };
}

async function findValidDesignPhotoIds(design: AlbumDesignPhotoSource, photoIds: string[]) {
  const photos = await prisma.photo.findMany({
    where: design.favoriteListId
      ? {
          id: { in: photoIds },
          favoriteItems: {
            some: {
              listId: design.favoriteListId
            }
          }
        }
      : design.sourceGalleryId
        ? {
            id: { in: photoIds },
            galleryId: design.sourceGalleryId,
            mediaType: "image"
          }
        : {
            id: "__missing_album_design_source__"
          },
    select: { id: true }
  });

  return new Set(photos.map((photo) => photo.id));
}

async function getVerifiedDesignPhotoIds({
  customerId,
  design,
  formData,
  photoCount
}: {
  customerId: string | null | undefined;
  design: AlbumDesignPhotoSource;
  formData: FormData;
  photoCount: number;
}) {
  const selectedPhotoIds = getSelectedPhotoIds(formData);

  if (selectedPhotoIds.length !== photoCount) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=photo-count"));
  }

  const validPhotoIds = await findValidDesignPhotoIds(design, selectedPhotoIds);
  const photoIds = selectedPhotoIds.filter((photoId) => validPhotoIds.has(photoId));

  if (photoIds.length !== photoCount) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=invalid-photos"));
  }

  return photoIds;
}

async function requireFavoritePhoto({
  customerId,
  design,
  photoId
}: {
  customerId: string | null | undefined;
  design: AlbumDesignPhotoSource;
  photoId: string;
}) {
  const validPhotoIds = await findValidDesignPhotoIds(design, [photoId]);

  if (!validPhotoIds.has(photoId)) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=invalid-photos"));
  }

  return { id: photoId };
}

export async function createAlbumDesignAction(customerId: string | null, formData: FormData) {
  const { admin, customer } = await requireAlbumDesignContext(customerId);
  const title = formString(formData, "title") || "Albumterv";
  const source = parseAlbumDesignSource(formData);
  const favoriteListId = source.favoriteListId;
  const requestedSourceGalleryId = source.sourceGalleryId;
  const requestedProjectId = formString(formData, "projectId");
  const favoriteList = favoriteListId
    ? await prisma.galleryFavoriteList.findFirst({
        where: {
          id: favoriteListId,
          gallery: customer ? { customer: customerAccessWhere(admin, customer.id) } : adminOwnedWhere(admin)
        },
        select: { id: true }
      })
    : null;

  if (favoriteListId && !favoriteList) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=favorite-list"));
  }

  const existingSourceGallery = requestedSourceGalleryId
    ? await prisma.gallery.findFirst({
        where: {
          id: requestedSourceGalleryId,
          ...(customer
            ? {
                customerId: customer.id,
                ...adminOwnedWhere(admin)
              }
            : adminOwnedWhere(admin)),
          galleryMode: GALLERY_MODE_FULL,
          photos: {
            some: {
              mediaType: "image"
            }
          }
        },
        select: { id: true }
      })
    : null;

  if (requestedSourceGalleryId && !existingSourceGallery) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=source-gallery"));
  }

  const projectId = customer ? await albumProjectIdForCustomer(admin, customer.id, requestedProjectId) : null;

  if (requestedProjectId && !projectId) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=project"));
  }

  const sourceGalleryId = favoriteList
    ? null
    : existingSourceGallery?.id ??
      (await createAlbumSourceGallery({
        adminId: ownerAdminId(admin),
        customerId: customer?.id ?? null,
        title
      }));

  await prisma.albumDesign.create({
    data: {
      adminId: ownerAdminId(admin),
      customerId: customer?.id ?? null,
      projectId,
      favoriteListId: favoriteList?.id ?? null,
      sourceGalleryId,
      title
    }
  });

  revalidateAlbumDesignPaths(customerId);
  revalidatePath("/admin/clients");
  redirect(albumDesignRedirectPath(customerId, "albumDesignCreated=1"));
}

export async function updateAlbumDesignAssignmentAction(customerId: string | null, designId: string, formData: FormData) {
  const { admin, design } = await requireAlbumDesignAccess(customerId, designId);
  const requestedCustomerId = customerId ?? formString(formData, "customerId");
  const requestedProjectId = formString(formData, "projectId");
  let targetCustomerId = requestedCustomerId || null;
  let projectId: string | null = null;

  if (targetCustomerId) {
    const customer = await prisma.customer.findFirst({
      where: customerAccessWhere(admin, targetCustomerId),
      select: { id: true }
    });

    if (!customer) {
      redirect(albumDesignRedirectPath(customerId, "albumDesignError=customer"));
    }
  }

  if (requestedProjectId) {
    const project = await prisma.customerProject.findFirst({
      where: {
        id: requestedProjectId,
        customer: adminOwnedWhere(admin),
        projectType: "album"
      },
      select: { id: true, customerId: true }
    });

    if (!project || (targetCustomerId && project.customerId !== targetCustomerId)) {
      redirect(albumDesignRedirectPath(customerId, "albumDesignError=project"));
    }

    targetCustomerId = project.customerId;
    projectId = project.id;
  }

  if (customerId && targetCustomerId !== customerId) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=customer"));
  }

  await prisma.albumDesign.update({
    where: { id: design.id },
    data: {
      adminId: design.adminId ?? ownerAdminId(admin),
      customerId: targetCustomerId,
      projectId
    }
  });

  if (design.sourceGalleryId) {
    const sourceGallery = await prisma.gallery.findUnique({
      where: { id: design.sourceGalleryId },
      select: { galleryMode: true }
    });

    if (sourceGallery?.galleryMode === GALLERY_MODE_ALBUM_SOURCE) {
      await prisma.gallery.update({
        where: { id: design.sourceGalleryId },
        data: { customerId: targetCustomerId }
      });
    }
  }

  revalidateAlbumDesignPaths(customerId);
  if (targetCustomerId && targetCustomerId !== customerId) {
    revalidatePath(`/admin/clients/${targetCustomerId}`);
  }
  revalidatePath("/admin/clients");
  redirect(albumDesignRedirectPath(customerId, "albumDesignUpdated=1"));
}

export async function createAlbumDesignSpreadAction(customerId: string | null, designId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId && !design.sourceGalleryId) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=favorite-list"));
  }

  const layout = getAlbumLayoutTemplate(formString(formData, "layoutKey"));
  const photoIds = await getVerifiedDesignPhotoIds({
    customerId,
    design,
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

  revalidateAlbumDesignPaths(customerId);
  redirect(albumDesignRedirectPath(customerId, albumDesignEditorRedirectQuery(design.id, "albumSpreadCreated=1")));
}

export async function createEmptyAlbumDesignSpreadAction(customerId: string | null, designId: string) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId && !design.sourceGalleryId) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=favorite-list"));
  }

  const layout = ALBUM_LAYOUT_TEMPLATES[1] ?? ALBUM_LAYOUT_TEMPLATES[0];
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
      sortOrder
    }
  });

  revalidateAlbumDesignPaths(customerId);
  redirect(albumDesignRedirectPath(customerId, albumDesignEditorRedirectQuery(design.id, "albumSpreadCreated=1")));
}

export async function createAutoAlbumDesignSpreadAction(customerId: string | null, designId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId && !design.sourceGalleryId) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=favorite-list"));
  }

  const selectedPhotoIds = getSelectedPhotoIds(formData);

  if (selectedPhotoIds.length === 0) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=photo-count"));
  }

  const layout = pickRandomAlbumLayoutTemplate(selectedPhotoIds.length);

  if (!layout) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=layout-count"));
  }

  const photoIds = await getVerifiedDesignPhotoIds({
    customerId,
    design,
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

  revalidateAlbumDesignPaths(customerId);
  redirect(albumDesignRedirectPath(customerId, albumDesignEditorRedirectQuery(design.id, "albumSpreadAutoCreated=1")));
}

export async function updateAlbumDesignSpreadAction(customerId: string | null, designId: string, spreadId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId && !design.sourceGalleryId) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=favorite-list"));
  }

  const spread = await prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      designId: design.id
    },
    select: { id: true }
  });

  if (!spread) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=missing"));
  }

  const layout = getAlbumLayoutTemplate(formString(formData, "layoutKey"));
  const photoIds = await getVerifiedDesignPhotoIds({
    customerId,
    design,
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

  revalidateAlbumDesignPaths(customerId);
  redirect(albumDesignRedirectPath(customerId, albumDesignEditorRedirectQuery(design.id, "albumSpreadUpdated=1")));
}

export async function updateAlbumDesignSpreadLayoutOnlyAction(customerId: string | null, designId: string, spreadId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId && !design.sourceGalleryId) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=favorite-list"));
  }

  const spread = await prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      designId: design.id
    },
    select: {
      id: true,
      items: {
        orderBy: { slotIndex: "asc" },
        select: {
          photoId: true,
          cropX: true,
          cropY: true
        }
      }
    }
  });

  if (!spread) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=missing"));
  }

  const layout = getAlbumLayoutTemplate(formString(formData, "layoutKey"));
  const keptItems = spread.items.slice(0, layout.slots.length);

  await prisma.albumDesignSpread.update({
    where: { id: spread.id },
    data: {
      layoutKey: layout.key,
      items: {
        deleteMany: {},
        create: createSpreadItemsForSlotIndexes(
          layout,
          keptItems.map((item) => item.photoId),
          keptItems.map((_, index) => index),
          keptItems.map((item) => ({ cropX: item.cropX, cropY: item.cropY }))
        )
      }
    }
  });

  revalidateAlbumDesignPaths(customerId);
  redirect(albumDesignRedirectPath(customerId, albumDesignEditorRedirectQuery(design.id, "albumSpreadUpdated=1")));
}

export async function regenerateAlbumDesignSpreadLayoutAction(customerId: string | null, designId: string, spreadId: string) {
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
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=missing"));
  }

  const photoIds = spread.items.map((item) => item.photoId);

  if (photoIds.length === 0) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=photo-count"));
  }

  const layout = pickRandomAlbumLayoutTemplate(photoIds.length, spread.layoutKey);

  if (!layout) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=layout-count"));
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

  revalidateAlbumDesignPaths(customerId);
  redirect(albumDesignRedirectPath(customerId, albumDesignEditorRedirectQuery(design.id, "albumSpreadRegenerated=1")));
}

export async function exportAlbumDesignToReviewAction(customerId: string | null, designId: string) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);
  const albumDesign = await prisma.albumDesign.findUnique({
    where: { id: design.id },
    select: {
      id: true,
      title: true,
      customerId: true,
      projectId: true,
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
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=missing"));
  }

  if (!albumDesign.customerId || !albumDesign.customer) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=customer"));
  }

  const spreads = albumDesign.spreads.filter((spread) => spread.items.length > 0) satisfies AlbumDesignSpreadExportData[];

  if (spreads.length === 0) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=no-spreads"));
  }

  const review = await prisma.albumReview.create({
    data: {
      customerId: albumDesign.customerId,
      projectId: albumDesign.projectId,
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
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=export-failed"));
  }

  revalidateAlbumDesignPaths(customerId);
  revalidatePath(`/album/${review.accessToken}`);
  redirect(albumDesignRedirectPath(customerId, `albumDesignExported=${spreads.length}`));
}

export async function updateAlbumDesignSpreadSlotAction(customerId: string | null, designId: string, spreadId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId && !design.sourceGalleryId) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=favorite-list"));
  }

  const slotIndex = formInteger(formData, "slotIndex");
  const photoId = formString(formData, "photoId");

  if (slotIndex === null || !photoId) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=slot"));
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
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=missing"));
  }

  const layout = getAlbumLayoutTemplate(spread.layoutKey);
  const slot = layout.slots[slotIndex];

  if (!slot) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=slot"));
  }

  await requireFavoritePhoto({
    customerId,
    design,
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

  revalidateAlbumDesignPaths(customerId);
  redirect(albumDesignRedirectPath(customerId, albumDesignEditorRedirectQuery(design.id, "albumSpreadSlotUpdated=1")));
}

export async function saveAlbumDesignSpreadSlotDraftAction(customerId: string | null, designId: string, spreadId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId && !design.sourceGalleryId) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=favorite-list"));
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
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=missing"));
  }

  const layout = getAlbumLayoutTemplate(spread.layoutKey);
  const photoIds = getOrderedFormStrings(formData, "slotPhotoIds");
  const slotIndexes = getOrderedFormStrings(formData, "slotIndexes").map((value, index) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : index;
  });
  const cropPositions = getOrderedCropPositions(formData, layout.slots.length);

  if (photoIds.length === 0 || photoIds.length > layout.slots.length || slotIndexes.some((slotIndex) => !layout.slots[slotIndex])) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=photo-count"));
  }

  const uniquePhotoIds = [...new Set(photoIds)];
  const validPhotoIds = await findValidDesignPhotoIds(design, uniquePhotoIds);

  if (uniquePhotoIds.some((photoId) => !validPhotoIds.has(photoId))) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=invalid-photos"));
  }

  await prisma.albumDesignSpread.update({
    where: { id: spread.id },
    data: {
      items: {
        deleteMany: {},
        create: createSpreadItemsForSlotIndexes(layout, photoIds, slotIndexes, cropPositions)
      }
    }
  });

  revalidateAlbumDesignPaths(customerId);
  redirect(albumDesignRedirectPath(customerId, albumDesignEditorRedirectQuery(design.id, "albumSpreadSlotUpdated=1")));
}

export async function saveAlbumDesignSpreadDraftsAction(customerId: string | null, designId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId && !design.sourceGalleryId) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=favorite-list"));
  }

  const draftSpreadIds = [
    ...new Set(
      getOrderedFormStrings(formData, "draftSpreadIds")
    )
  ];

  if (draftSpreadIds.length === 0) {
    redirect(albumDesignRedirectPath(customerId));
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
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=missing"));
  }

  const spreadDrafts = spreads.map((spread) => {
    const layout = getAlbumLayoutTemplate(spread.layoutKey);
    const photoIds = getOrderedFormStrings(formData, `spread-${spread.id}-slotPhotoIds`);
    const slotIndexes = getOrderedFormStrings(formData, `spread-${spread.id}-slotIndexes`).map((value, index) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : index;
    });
    const cropPositions = getOrderedCropPositions(formData, layout.slots.length, {
      cropX: `spread-${spread.id}-slotCropX`,
      cropY: `spread-${spread.id}-slotCropY`
    });

    if (photoIds.length === 0 || photoIds.length > layout.slots.length || slotIndexes.some((slotIndex) => !layout.slots[slotIndex])) {
      redirect(albumDesignRedirectPath(customerId, "albumDesignError=photo-count"));
    }

    return {
      spread,
      layout,
      photoIds,
      slotIndexes,
      cropPositions
    };
  });

  const uniquePhotoIds = [
    ...new Set(
      spreadDrafts.flatMap((draft) => draft.photoIds)
    )
  ];
  const validPhotoIds = await findValidDesignPhotoIds(design, uniquePhotoIds);

  if (uniquePhotoIds.some((photoId) => !validPhotoIds.has(photoId))) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=invalid-photos"));
  }

  await prisma.$transaction(
    spreadDrafts.map((draft) =>
      prisma.albumDesignSpread.update({
        where: { id: draft.spread.id },
        data: {
          items: {
            deleteMany: {},
            create: createSpreadItemsForSlotIndexes(draft.layout, draft.photoIds, draft.slotIndexes, draft.cropPositions)
          }
        }
      })
    )
  );

  revalidateAlbumDesignPaths(customerId);
  redirect(albumDesignRedirectPath(customerId, albumDesignEditorRedirectQuery(design.id, "albumSpreadSlotUpdated=1")));
}

export async function deleteAlbumDesignAction(customerId: string | null, designId: string) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);
  const sourceGallery = design.sourceGalleryId
    ? await prisma.gallery.findUnique({
        where: { id: design.sourceGalleryId },
        select: {
          id: true,
          galleryMode: true,
          slug: true,
          photos: {
            select: {
              r2Key: true,
              thumbnailUrl: true,
              previewUrl: true
            }
          }
        }
      })
    : null;

  await prisma.albumDesign.delete({
    where: { id: design.id }
  });

  if (sourceGallery?.galleryMode === GALLERY_MODE_ALBUM_SOURCE) {
    await prisma.gallery.delete({ where: { id: sourceGallery.id } }).catch(() => undefined);
    await deleteGalleryObjects(
      sourceGallery.slug,
      sourceGallery.photos.flatMap((photo) => [
        photo.r2Key,
        getR2KeyFromPublicUrl(photo.thumbnailUrl),
        getR2KeyFromPublicUrl(photo.previewUrl)
      ])
    );
  }

  revalidateAlbumDesignPaths(customerId);
  redirect(albumDesignRedirectPath(customerId, "albumDesignDeleted=1"));
}

export async function deleteAlbumDesignSpreadAction(customerId: string | null, designId: string, spreadId: string) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);
  const spread = await prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      designId: design.id
    },
    select: { id: true }
  });

  if (!spread) {
    redirect(albumDesignRedirectPath(customerId, "albumDesignError=missing"));
  }

  await prisma.albumDesignSpread.delete({
    where: { id: spread.id }
  });

  revalidateAlbumDesignPaths(customerId);
  redirect(albumDesignRedirectPath(customerId, albumDesignEditorRedirectQuery(design.id, "albumSpreadDeleted=1")));
}
