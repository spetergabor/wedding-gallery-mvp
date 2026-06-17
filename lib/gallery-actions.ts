"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/slug";
import { hasAnyAdmin, requireAdmin, signInAdmin, signOutAdmin } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createPresignedPhotoUploadUrl,
  createPhotoObjectKey,
  createPhotoVariantObjectKey,
  deleteGalleryObjects,
  deletePhotoObject,
  getPhotoPublicUrl,
  getR2KeyFromPublicUrl,
  isR2StorageEnabled,
  savePhotoObject
} from "@/lib/storage";
import { verifyTotpCode } from "@/lib/totp";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function createClientAccessToken() {
  return randomBytes(24).toString("base64url");
}

type PhotoUploadRequest = {
  clientId: string;
  filename: string;
  contentType?: string;
  fileSize?: number;
  imageWidth?: number;
  imageHeight?: number;
  capturedAt?: string | null;
  originalIndex?: number;
};

type CompletedPhotoUpload = {
  uploadItemId?: string;
  clientId?: string;
  filename: string;
  r2Key: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl?: string;
  fileSize?: number;
  imageWidth?: number;
  imageHeight?: number;
  capturedAt?: string | null;
  originalIndex?: number;
};

async function refreshUploadSessionCounts(sessionId: string) {
  const [uploadedCount, completedCount, failedCount] = await Promise.all([
    prisma.galleryUploadItem.count({
      where: {
        sessionId,
        status: { in: ["uploaded", "completed"] }
      }
    }),
    prisma.galleryUploadItem.count({
      where: {
        sessionId,
        status: "completed"
      }
    }),
    prisma.galleryUploadItem.count({
      where: {
        sessionId,
        status: "failed"
      }
    })
  ]);

  const session = await prisma.galleryUploadSession.findUnique({
    where: { id: sessionId },
    select: { totalCount: true }
  });
  const totalCount = session?.totalCount ?? 0;
  const status =
    completedCount >= totalCount && totalCount > 0
      ? "completed"
      : failedCount > 0
        ? "partial"
        : uploadedCount > 0
          ? "uploading"
          : "pending";

  await prisma.galleryUploadSession.update({
    where: { id: sessionId },
    data: {
      uploadedCount,
      completedCount,
      failedCount,
      status
    }
  });
}

export async function loginAction(formData: FormData) {
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  const twoFactorCode = formString(formData, "twoFactorCode");
  const success = await signInAdmin(email, password, twoFactorCode);

  if (!success) {
    redirect("/admin/login?error=1");
  }

  redirect("/admin/dashboard");
}

export async function registerAdminAction(formData: FormData) {
  const alreadyHasAdmin = await hasAnyAdmin();

  if (alreadyHasAdmin) {
    redirect("/admin/login?registered=1");
  }

  const name = formString(formData, "name");
  const email = formString(formData, "email").toLowerCase();
  const password = formString(formData, "password");
  const confirmPassword = formString(formData, "confirmPassword");

  if (!name || !email || !password || password.length < 8) {
    redirect("/admin/register?error=missing");
  }

  if (password !== confirmPassword) {
    redirect("/admin/register?error=password");
  }

  const passwordHash = await hashPassword(password);

  await prisma.admin.create({
    data: {
      name,
      email,
      passwordHash
    }
  });

  await signInAdmin(email, password);
  redirect("/admin/dashboard");
}

export async function logoutAction() {
  await signOutAdmin();
  redirect("/admin/login");
}

export async function enableTwoFactorAction(formData: FormData) {
  const admin = await requireAdmin();
  const secret = formString(formData, "secret").replace(/\s/g, "").toUpperCase();
  const code = formString(formData, "code");

  if (!secret || !verifyTotpCode(secret, code)) {
    redirect("/admin/security?error=code");
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: secret
    }
  });

  redirect("/admin/security?enabled=1");
}

export async function disableTwoFactorAction(formData: FormData) {
  const adminSession = await requireAdmin();
  const password = formString(formData, "password");

  const admin = await prisma.admin.findUnique({
    where: { id: adminSession.id },
    select: { passwordHash: true }
  });

  if (!admin || !password || !(await verifyPassword(password, admin.passwordHash))) {
    redirect("/admin/security?error=password");
  }

  await prisma.admin.update({
    where: { id: adminSession.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null
    }
  });

  redirect("/admin/security?disabled=1");
}

export async function markAllNotificationsReadAction() {
  await requireAdmin();

  await prisma.adminNotification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() }
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/notifications");
}

export async function generateClientAccessLinkAction(galleryId: string) {
  await requireAdmin();

  const gallery = await prisma.gallery.update({
    where: { id: galleryId },
    data: { clientAccessToken: createClientAccessToken() },
    select: { slug: true }
  });

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/client/${gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?clientLink=1`);
}

export async function restoreClientHiddenPhotoAction(galleryId: string, photoId: string) {
  await requireAdmin();

  const photo = await prisma.photo.findFirst({
    where: { id: photoId, galleryId },
    select: {
      gallery: {
        select: { slug: true }
      }
    }
  });

  if (!photo) {
    redirect(`/admin/galleries/${galleryId}?photoError=missing`);
  }

  await prisma.photo.update({
    where: { id: photoId },
    data: {
      isClientHidden: false,
      clientHiddenAt: null
    }
  });

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${photo.gallery.slug}`);
  revalidatePath(`/client/${photo.gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?clientRestored=1`);
}

export async function createGalleryAction(formData: FormData) {
  await requireAdmin();

  const title = formString(formData, "title");
  const rawSlug = formString(formData, "slug");
  const password = formString(formData, "password");
  const slug = normalizeSlug(rawSlug || title);
  const isActive = formData.get("isActive") === "on";

  if (!title || !slug) {
    redirect("/admin/galleries/new?error=missing");
  }

  let gallery;

  try {
    gallery = await prisma.gallery.create({
      data: {
        title,
        slug,
        password: password || null,
        isActive,
        clientAccessToken: createClientAccessToken()
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/admin/galleries/new?error=slug");
    }

    throw error;
  }

  revalidatePath("/admin/galleries");
  redirect(`/admin/galleries/${gallery.id}`);
}

export async function updateGalleryAction(id: string, formData: FormData) {
  await requireAdmin();

  const title = formString(formData, "title");
  const rawSlug = formString(formData, "slug");
  const password = formString(formData, "password");
  const slug = normalizeSlug(rawSlug || title);
  const isActive = formData.get("isActive") === "on";

  if (!title || !slug) {
    redirect(`/admin/galleries/${id}?error=missing`);
  }

  let previousSlug = slug;

  try {
    const previousGallery = await prisma.gallery.findUnique({
      where: { id },
      select: { slug: true }
    });

    previousSlug = previousGallery?.slug ?? slug;

    await prisma.gallery.update({
      where: { id },
      data: {
        title,
        slug,
        password: password || null,
        isActive
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`/admin/galleries/${id}?error=slug`);
    }

    throw error;
  }

  revalidatePath("/admin/galleries");
  revalidatePath(`/g/${previousSlug}`);
  revalidatePath(`/g/${slug}`);
  redirect(`/admin/galleries/${id}?saved=1`);
}

export async function archiveGalleryAction(id: string) {
  await requireAdmin();

  const gallery = await prisma.gallery.update({
    where: { id },
    data: { isActive: false },
    select: { slug: true }
  });

  revalidatePath("/admin/galleries");
  revalidatePath(`/admin/galleries/${id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/galleries/${id}?archived=1`);
}

export async function activateGalleryAction(id: string) {
  await requireAdmin();

  const gallery = await prisma.gallery.update({
    where: { id },
    data: { isActive: true },
    select: { slug: true }
  });

  revalidatePath("/admin/galleries");
  revalidatePath(`/admin/galleries/${id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/galleries/${id}?activated=1`);
}

export async function deleteGalleryAction(id: string) {
  await requireAdmin();

  const gallery = await prisma.gallery.findUnique({
    where: { id },
    select: {
      slug: true,
      photos: {
        select: { r2Key: true, thumbnailUrl: true, previewUrl: true }
      }
    }
  });

  if (!gallery) {
    redirect("/admin/galleries");
  }

  await prisma.gallery.delete({
    where: { id }
  });

  await deleteGalleryObjects(
    gallery.slug,
    gallery.photos.flatMap((photo) => [
      photo.r2Key,
      getR2KeyFromPublicUrl(photo.thumbnailUrl),
      getR2KeyFromPublicUrl(photo.previewUrl)
    ])
  );

  revalidatePath("/admin/galleries");
  revalidatePath(`/g/${gallery.slug}`);
  redirect("/admin/galleries?deleted=1");
}

export async function addPhotoAction(galleryId: string, formData: FormData) {
  await requireAdmin();

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { slug: true }
  });

  if (!gallery) {
    redirect("/admin/galleries");
  }

  const uploads = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (uploads.length === 0) {
    redirect(`/admin/galleries/${galleryId}?photoError=missing`);
  }

  const latestPhoto = await prisma.photo.findFirst({
    where: { galleryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  const nextSortOrder = (latestPhoto?.sortOrder ?? 0) + 1;

  const createdPhotos = await Promise.all(
    uploads.map(async (file, index) => {
      const r2Key = createPhotoObjectKey({
        gallerySlug: gallery.slug,
        originalFilename: file.name
      });
      const bytes = Buffer.from(await file.arrayBuffer());
      const publicUrl = getPhotoPublicUrl(r2Key);

      try {
        await savePhotoObject({
          r2Key,
          bytes,
          contentType: file.type
        });
      } catch (error) {
        console.error("Photo upload failed", {
          galleryId,
          r2Key,
          storageDriver: process.env.STORAGE_DRIVER,
          error
        });
        redirect(`/admin/galleries/${galleryId}?photoError=storage`);
      }

      return {
        galleryId,
        filename: file.name,
        r2Key,
        imageUrl: publicUrl,
        thumbnailUrl: publicUrl,
        previewUrl: publicUrl,
        fileSize: bytes.length,
        sortOrder: nextSortOrder + index
      };
    })
  );

  await prisma.photo.createMany({
    data: createdPhotos
  });

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?photoAdded=1`);
}

export async function createPhotoUploadSessionAction(galleryId: string, totalCount: number) {
  await requireAdmin();

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { id: true }
  });

  if (!gallery) {
    return {
      ok: false,
      message: "A galéria nem található.",
      sessionId: null
    };
  }

  const latestPhoto = await prisma.photo.findFirst({
    where: { galleryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  const session = await prisma.galleryUploadSession.create({
    data: {
      galleryId,
      totalCount: Math.max(0, totalCount),
      baseSortOrder: (latestPhoto?.sortOrder ?? 0) + 1,
      status: "pending"
    },
    select: { id: true }
  });

  return {
    ok: true,
    sessionId: session.id
  };
}

export async function createPhotoUploadTargetsAction(galleryId: string, sessionId: string, files: PhotoUploadRequest[]) {
  await requireAdmin();

  if (!isR2StorageEnabled()) {
    return {
      ok: false,
      message: "A közvetlen feltöltés csak R2 storage módban érhető el."
    };
  }

  const session = await prisma.galleryUploadSession.findFirst({
    where: { id: sessionId, galleryId },
    select: {
      id: true,
      gallery: {
        select: {
          slug: true
        }
      }
    }
  });

  if (!session) {
    return {
      ok: false,
      message: "A feltöltési munkamenet nem található."
    };
  }

  const validFiles = files.filter((file) => file.clientId.trim() && file.filename.trim());

  if (validFiles.length === 0) {
    return {
      ok: false,
      message: "Nem választottál ki fotót."
    };
  }

  try {
    const uploads = await Promise.all(
      validFiles.map(async (file) => {
        const r2Key = createPhotoObjectKey({
          gallerySlug: session.gallery.slug,
          originalFilename: file.filename
        });
        const thumbnailR2Key = createPhotoVariantObjectKey({
          gallerySlug: session.gallery.slug,
          originalFilename: file.filename,
          variant: "thumbnail"
        });
        const previewR2Key = createPhotoVariantObjectKey({
          gallerySlug: session.gallery.slug,
          originalFilename: file.filename,
          variant: "preview"
        });
        const publicUrl = getPhotoPublicUrl(r2Key);
        const thumbnailUrl = getPhotoPublicUrl(thumbnailR2Key);
        const previewUrl = getPhotoPublicUrl(previewR2Key);
        const uploadItem = await prisma.galleryUploadItem.upsert({
          where: {
            sessionId_clientId: {
              sessionId: session.id,
              clientId: file.clientId
            }
          },
          create: {
            sessionId: session.id,
            clientId: file.clientId,
            filename: file.filename,
            r2Key,
            imageUrl: publicUrl,
            thumbnailUrl,
            previewUrl,
            fileSize: file.fileSize ?? 0,
            imageWidth: file.imageWidth ?? 0,
            imageHeight: file.imageHeight ?? 0,
            capturedAt: file.capturedAt ? new Date(file.capturedAt) : null,
            originalIndex: file.originalIndex ?? 0,
            status: "uploading",
            errorMessage: null,
            uploadedAt: null,
            completedAt: null
          },
          update: {
            filename: file.filename,
            r2Key,
            imageUrl: publicUrl,
            thumbnailUrl,
            previewUrl,
            fileSize: file.fileSize ?? 0,
            imageWidth: file.imageWidth ?? 0,
            imageHeight: file.imageHeight ?? 0,
            capturedAt: file.capturedAt ? new Date(file.capturedAt) : null,
            originalIndex: file.originalIndex ?? 0,
            status: "uploading",
            errorMessage: null,
            uploadedAt: null,
            completedAt: null
          },
          select: {
            id: true
          }
        });

        return {
          uploadItemId: uploadItem.id,
          clientId: file.clientId,
          filename: file.filename,
          r2Key,
          imageUrl: publicUrl,
          thumbnailUrl,
          previewUrl,
          uploadUrl: await createPresignedPhotoUploadUrl({
            r2Key,
            contentType: file.contentType
          }),
          thumbnailUploadUrl: await createPresignedPhotoUploadUrl({
            r2Key: thumbnailR2Key,
            contentType: "image/jpeg"
          }),
          previewUploadUrl: await createPresignedPhotoUploadUrl({
            r2Key: previewR2Key,
            contentType: "image/jpeg"
          })
        };
      })
    );

    await refreshUploadSessionCounts(session.id);

    return {
      ok: true,
      uploads
    };
  } catch (error) {
    console.error("Photo upload target creation failed", {
      galleryId,
      storageDriver: process.env.STORAGE_DRIVER,
      error
    });

    return {
      ok: false,
      message: "Nem sikerült előkészíteni az R2 feltöltést."
    };
  }
}

export async function markPhotoUploadItemFailedAction({
  galleryId,
  sessionId,
  uploadItemId,
  message
}: {
  galleryId: string;
  sessionId: string;
  uploadItemId: string;
  message: string;
}) {
  await requireAdmin();

  const item = await prisma.galleryUploadItem.findFirst({
    where: {
      id: uploadItemId,
      sessionId,
      session: { galleryId }
    },
    select: { id: true }
  });

  if (!item) {
    return { ok: false };
  }

  await prisma.galleryUploadItem.update({
    where: { id: item.id },
    data: {
      status: "failed",
      errorMessage: message.slice(0, 500)
    }
  });
  await refreshUploadSessionCounts(sessionId);

  return { ok: true };
}

export async function completePhotoUploadsAction(galleryId: string, sessionId: string, uploads: CompletedPhotoUpload[]) {
  await requireAdmin();

  const session = await prisma.galleryUploadSession.findFirst({
    where: { id: sessionId, galleryId },
    select: {
      id: true,
      baseSortOrder: true,
      gallery: {
        select: {
          slug: true
        }
      }
    }
  });

  if (!session) {
    return {
      ok: false,
      message: "A feltöltési munkamenet nem található."
    };
  }

  const validUploads = uploads.filter((upload) => upload.uploadItemId && upload.filename && upload.r2Key && upload.imageUrl);

  if (validUploads.length === 0) {
    return {
      ok: false,
      message: "Nincs menthető feltöltés."
    };
  }

  const uploadItemIds = validUploads.map((upload) => upload.uploadItemId).filter((id): id is string => Boolean(id));
  const uploadItems = await prisma.galleryUploadItem.findMany({
    where: {
      id: { in: uploadItemIds },
      sessionId: session.id
    },
    select: {
      id: true,
      status: true
    }
  });
  const completableItemIds = new Set(
    uploadItems.filter((item) => item.status !== "completed").map((item) => item.id)
  );

  const sortedUploads = validUploads.filter((upload) => upload.uploadItemId && completableItemIds.has(upload.uploadItemId)).sort((a, b) => {
    const aTime = a.capturedAt ? Date.parse(a.capturedAt) : Number.POSITIVE_INFINITY;
    const bTime = b.capturedAt ? Date.parse(b.capturedAt) : Number.POSITIVE_INFINITY;

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
  });

  if (sortedUploads.length > 0) {
    await prisma.$transaction([
      prisma.photo.createMany({
        data: sortedUploads.map((upload) => ({
          galleryId,
          filename: upload.filename,
          r2Key: upload.r2Key,
          imageUrl: upload.imageUrl,
          thumbnailUrl: upload.thumbnailUrl || upload.imageUrl,
          previewUrl: upload.previewUrl || upload.imageUrl,
          fileSize: upload.fileSize ?? 0,
          imageWidth: upload.imageWidth ?? 0,
          imageHeight: upload.imageHeight ?? 0,
          capturedAt: upload.capturedAt ? new Date(upload.capturedAt) : null,
          sortOrder: session.baseSortOrder + (upload.originalIndex ?? 0)
        }))
      }),
      prisma.galleryUploadItem.updateMany({
        where: {
          id: { in: sortedUploads.map((upload) => upload.uploadItemId).filter((id): id is string => Boolean(id)) },
          sessionId: session.id
        },
        data: {
          status: "completed",
          errorMessage: null,
          uploadedAt: new Date(),
          completedAt: new Date()
        }
      })
    ]);
  }

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${session.gallery.slug}`);
  await refreshUploadSessionCounts(session.id);

  return {
    ok: true,
    completedItemIds: sortedUploads.map((upload) => upload.uploadItemId).filter((id): id is string => Boolean(id)),
    redirectTo: `/admin/galleries/${galleryId}?photoAdded=1`
  };
}

export async function deletePhotoAction(photoId: string, galleryId: string) {
  await requireAdmin();

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { coverPhotoId: true, slug: true }
  });
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { r2Key: true, thumbnailUrl: true, previewUrl: true }
  });

  await prisma.photo.delete({
    where: { id: photoId }
  });

  if (gallery?.coverPhotoId === photoId) {
    const nextCover = await prisma.photo.findFirst({
      where: { galleryId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true }
    });

    await prisma.gallery.update({
      where: { id: galleryId },
      data: { coverPhotoId: nextCover?.id ?? null }
    });
  }

  await Promise.all([
    deletePhotoObject(photo?.r2Key ?? ""),
    deletePhotoObject(getR2KeyFromPublicUrl(photo?.thumbnailUrl) ?? ""),
    deletePhotoObject(getR2KeyFromPublicUrl(photo?.previewUrl) ?? "")
  ]);

  revalidatePath(`/admin/galleries/${galleryId}`);

  if (gallery) {
    revalidatePath(`/g/${gallery.slug}`);
  }
}

export async function setCoverPhotoAction(galleryId: string, photoId: string) {
  await requireAdmin();

  const photo = await prisma.photo.findFirst({
    where: { id: photoId, galleryId },
    select: { gallery: { select: { slug: true } } }
  });

  if (!photo) {
    redirect(`/admin/galleries/${galleryId}?photoError=missing`);
  }

  await prisma.gallery.update({
    where: { id: galleryId },
    data: { coverPhotoId: photoId }
  });

  revalidatePath("/admin/galleries");
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${photo.gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?coverSet=1`);
}

export async function movePhotoAction(galleryId: string, photoId: string, direction: "up" | "down") {
  await requireAdmin();

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { slug: true }
  });

  if (!gallery) {
    redirect("/admin/galleries");
  }

  const photos = await prisma.photo.findMany({
    where: { galleryId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true }
  });
  const currentIndex = photos.findIndex((photo) => photo.id === photoId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= photos.length) {
    redirect(`/admin/galleries/${galleryId}`);
  }

  const reordered = [...photos];
  const [current] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, current);

  await prisma.$transaction(
    reordered.map((photo, index) =>
      prisma.photo.update({
        where: { id: photo.id },
        data: { sortOrder: index + 1 }
      })
    )
  );

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?ordered=1`);
}
