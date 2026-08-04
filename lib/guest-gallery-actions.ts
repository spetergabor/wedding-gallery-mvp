"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminOwnedWhere, galleryAccessWhere, ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { GALLERY_DELIVERY_VIEW_ONLY } from "@/lib/gallery-delivery";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";
import { normalizeSlug } from "@/lib/slug";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formDate(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createGuestGallerySlug(title: string) {
  const base = normalizeSlug(title) || "vendeggaleria";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

function normalizeModerationMode(value: string) {
  return value === "approval" ? "approval" : "automatic";
}

function normalizeGuestUploadLimit(value: string, fallback = 1000) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(5000, Math.max(20, parsed)) : fallback;
}

async function requireGuestGallery(galleryId: string) {
  const admin = await requireAdmin();
  const gallery = await prisma.gallery.findFirst({
    where: {
      ...galleryAccessWhere(admin, galleryId),
      galleryMode: GALLERY_MODE_GUEST
    },
    select: {
      id: true,
      slug: true,
      customerId: true
    }
  });

  if (!gallery) {
    redirect("/admin/guest-galleries?error=missing");
  }

  return { admin, gallery };
}

export async function createGuestGalleryAction(formData: FormData) {
  const admin = await requireAdmin();
  const title = formString(formData, "title");
  const customerId = formString(formData, "customerId");
  const password = formString(formData, "password");
  const submittedEventDate = formDate(formData, "eventDate");

  if (!title) {
    redirect("/admin/guest-galleries/new?error=missing");
  }

  const customer = customerId
    ? await prisma.customer.findFirst({
        where: {
          id: customerId,
          ...adminOwnedWhere(admin)
        },
        select: {
          id: true,
          primaryEmail: true,
          weddingDate: true
        }
      })
    : null;

  if (customerId && !customer) {
    redirect("/admin/guest-galleries/new?error=customer");
  }

  let gallery;

  try {
    gallery = await prisma.gallery.create({
      data: {
        adminId: ownerAdminId(admin),
        customerId: customer?.id ?? null,
        title,
        slug: createGuestGallerySlug(title),
        password: password || null,
        eventDate: submittedEventDate ?? customer?.weddingDate ?? null,
        isActive: true,
        galleryMode: GALLERY_MODE_GUEST,
        deliveryMode: GALLERY_DELIVERY_VIEW_ONLY,
        downloadsEnabled: false,
        guestUploadsEnabled: true,
        guestUploadModerationMode: "automatic",
        guestUploadLimit: 1000,
        showContactBox: false,
        publicColumnCount: 2,
        clientEmail: customer?.primaryEmail.toLowerCase() ?? null,
        clientAccessToken: randomBytes(24).toString("base64url")
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/admin/guest-galleries/new?error=slug");
    }

    throw error;
  }

  revalidatePath("/admin/guest-galleries");
  redirect(`/admin/guest-galleries/${gallery.id}?created=1`);
}

export async function updateGuestGalleryAction(galleryId: string, formData: FormData) {
  const { gallery } = await requireGuestGallery(galleryId);
  const title = formString(formData, "title");
  const password = formString(formData, "password");
  const eventDate = formDate(formData, "eventDate");
  const isActive = formData.get("isActive") === "on";
  const guestUploadsEnabled = formData.get("guestUploadsEnabled") === "on";
  const guestUploadModerationMode = normalizeModerationMode(formString(formData, "guestUploadModerationMode"));
  const guestUploadLimit = normalizeGuestUploadLimit(formString(formData, "guestUploadLimit"));

  if (!title) {
    redirect(`/admin/guest-galleries/${gallery.id}?error=missing`);
  }

  await prisma.gallery.update({
    where: { id: gallery.id },
    data: {
      title,
      password: password || null,
      eventDate,
      isActive,
      guestUploadsEnabled,
      guestUploadModerationMode,
      guestUploadLimit
    }
  });

  revalidatePath("/admin/guest-galleries");
  revalidatePath(`/admin/guest-galleries/${gallery.id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/guest-galleries/${gallery.id}?saved=1`);
}

export async function toggleGuestGalleryActiveAction(galleryId: string, nextIsActive: boolean) {
  const { gallery } = await requireGuestGallery(galleryId);

  await prisma.gallery.update({
    where: { id: gallery.id },
    data: { isActive: nextIsActive }
  });

  revalidatePath("/admin/guest-galleries");
  revalidatePath(`/admin/guest-galleries/${gallery.id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect("/admin/guest-galleries?updated=1");
}

export async function setGuestPhotoVisibilityAction(
  galleryId: string,
  uploadId: string,
  visible: boolean
) {
  const { gallery } = await requireGuestGallery(galleryId);
  const upload = await prisma.galleryGuestUpload.findFirst({
    where: {
      id: uploadId,
      galleryId: gallery.id
    },
    select: { id: true }
  });

  if (!upload) {
    redirect(`/admin/guest-galleries/${gallery.id}?error=photo`);
  }

  await prisma.galleryGuestUpload.update({
    where: { id: upload.id },
    data: { status: visible ? "visible" : "hidden" }
  });

  revalidatePath(`/admin/guest-galleries/${gallery.id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/guest-galleries/${gallery.id}?photo=${visible ? "shown" : "hidden"}`);
}
