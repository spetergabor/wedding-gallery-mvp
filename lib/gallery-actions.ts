"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/slug";
import { hasAnyAdmin, requireAdmin, signInAdmin, signOutAdmin } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createPresignedPhotoUploadUrl,
  createPhotoObjectKey,
  deleteGalleryObjects,
  deletePhotoObject,
  getPhotoPublicUrl,
  isR2StorageEnabled,
  savePhotoObject
} from "@/lib/storage";
import { verifyTotpCode } from "@/lib/totp";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

type PhotoUploadRequest = {
  filename: string;
  contentType?: string;
};

type CompletedPhotoUpload = {
  filename: string;
  r2Key: string;
  imageUrl: string;
  thumbnailUrl: string;
  capturedAt?: string | null;
  originalIndex?: number;
};

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
        isActive
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
        select: { r2Key: true }
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
    gallery.photos.map((photo) => photo.r2Key)
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

export async function createPhotoUploadTargetsAction(galleryId: string, files: PhotoUploadRequest[]) {
  await requireAdmin();

  if (!isR2StorageEnabled()) {
    return {
      ok: false,
      message: "A közvetlen feltöltés csak R2 storage módban érhető el."
    };
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { slug: true }
  });

  if (!gallery) {
    return {
      ok: false,
      message: "A galéria nem található."
    };
  }

  const validFiles = files.filter((file) => file.filename.trim());

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
          gallerySlug: gallery.slug,
          originalFilename: file.filename
        });
        const publicUrl = getPhotoPublicUrl(r2Key);

        return {
          filename: file.filename,
          r2Key,
          imageUrl: publicUrl,
          thumbnailUrl: publicUrl,
          uploadUrl: await createPresignedPhotoUploadUrl({
            r2Key,
            contentType: file.contentType
          })
        };
      })
    );

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

export async function completePhotoUploadsAction(galleryId: string, uploads: CompletedPhotoUpload[]) {
  await requireAdmin();

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { slug: true }
  });

  if (!gallery) {
    return {
      ok: false,
      message: "A galéria nem található."
    };
  }

  const validUploads = uploads.filter((upload) => upload.filename && upload.r2Key && upload.imageUrl);

  if (validUploads.length === 0) {
    return {
      ok: false,
      message: "Nincs menthető feltöltés."
    };
  }

  const latestPhoto = await prisma.photo.findFirst({
    where: { galleryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  const nextSortOrder = (latestPhoto?.sortOrder ?? 0) + 1;

  const sortedUploads = [...validUploads].sort((a, b) => {
    const aTime = a.capturedAt ? Date.parse(a.capturedAt) : Number.POSITIVE_INFINITY;
    const bTime = b.capturedAt ? Date.parse(b.capturedAt) : Number.POSITIVE_INFINITY;

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
  });

  await prisma.photo.createMany({
    data: sortedUploads.map((upload, index) => ({
      galleryId,
      filename: upload.filename,
      r2Key: upload.r2Key,
      imageUrl: upload.imageUrl,
      thumbnailUrl: upload.thumbnailUrl || upload.imageUrl,
      capturedAt: upload.capturedAt ? new Date(upload.capturedAt) : null,
      sortOrder: nextSortOrder + index
    }))
  });

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${gallery.slug}`);

  return {
    ok: true,
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
    select: { r2Key: true }
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

  await deletePhotoObject(photo?.r2Key ?? "");

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
