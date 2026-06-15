"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/slug";
import { hasAnyAdmin, requireAdmin, signInAdmin, signOutAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function localPublicPath(publicUrl: string) {
  if (!publicUrl.startsWith("/uploads/")) {
    return null;
  }

  return path.join(process.cwd(), "public", publicUrl);
}

export async function loginAction(formData: FormData) {
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  const success = await signInAdmin(email, password);

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
    select: { slug: true }
  });

  if (!gallery) {
    redirect("/admin/galleries");
  }

  await prisma.gallery.delete({
    where: { id }
  });

  await rm(path.join(process.cwd(), "public", "uploads", gallery.slug), {
    recursive: true,
    force: true
  });

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

  const uploadDir = path.join(process.cwd(), "public", "uploads", gallery.slug);
  await mkdir(uploadDir, { recursive: true });

  const latestPhoto = await prisma.photo.findFirst({
    where: { galleryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  const nextSortOrder = (latestPhoto?.sortOrder ?? 0) + 1;

  const createdPhotos = await Promise.all(
    uploads.map(async (file, index) => {
      const extension = path.extname(file.name) || ".jpg";
      const baseName = normalizeSlug(path.basename(file.name, extension)) || "photo";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}${extension.toLowerCase()}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(uploadDir, uniqueName);
      const publicUrl = `/uploads/${gallery.slug}/${uniqueName}`;

      await writeFile(filePath, bytes);

      return {
        galleryId,
        filename: file.name,
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

export async function deletePhotoAction(photoId: string, galleryId: string) {
  await requireAdmin();

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { coverPhotoId: true, slug: true }
  });
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { imageUrl: true, thumbnailUrl: true }
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

  if (photo) {
    const paths = [photo.imageUrl, photo.thumbnailUrl]
      .map(localPublicPath)
      .filter((value): value is string => Boolean(value));

    await Promise.all([...new Set(paths)].map((filePath) => unlink(filePath).catch(() => undefined)));
  }

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
