"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createBrandAssetObjectKey,
  deletePhotoObject,
  getPhotoPublicUrl,
  savePhotoObject
} from "@/lib/storage";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formOptionalUrl(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

function formClampedNumber(formData: FormData, key: string, fallback: number, min: number, max: number) {
  const rawValue = formString(formData, key);
  const value = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

export async function updateSiteSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const logoHeight = formClampedNumber(formData, "logoHeight", 80, 32, 140);

  const existingSettings = await prisma.siteSettings.findFirst({
    where: {
      OR: [{ adminId: admin.id }, ...(admin.role === "super_admin" ? [{ id: "default" }] : [])]
    },
    select: { id: true, logoR2Key: true, signatureR2Key: true }
  });
  const logoFile = formData.get("logo");
  const signatureFile = formData.get("signature");
  const shouldRemoveLogo = formData.get("removeLogo") === "on";
  const shouldRemoveSignature = formData.get("removeSignature") === "on";
  let logoUrl: string | null | undefined = undefined;
  let logoR2Key: string | null | undefined = undefined;
  let signatureUrl: string | null | undefined = undefined;
  let signatureR2Key: string | null | undefined = undefined;

  if (shouldRemoveLogo) {
    logoUrl = null;
    logoR2Key = null;
  }

  if (shouldRemoveSignature) {
    signatureUrl = null;
    signatureR2Key = null;
  }

  if (logoFile instanceof File && logoFile.size > 0) {
    if (!logoFile.type.startsWith("image/")) {
      redirect("/admin/settings?error=logo");
    }

    const r2Key = createBrandAssetObjectKey({ originalFilename: logoFile.name });
    const bytes = Buffer.from(await logoFile.arrayBuffer());

    await savePhotoObject({
      r2Key,
      bytes,
      contentType: logoFile.type
    });

    logoR2Key = r2Key;
    logoUrl = getPhotoPublicUrl(r2Key);
  }

  if (signatureFile instanceof File && signatureFile.size > 0) {
    const isPng = signatureFile.type === "image/png" || signatureFile.name.toLowerCase().endsWith(".png");

    if (!isPng) {
      redirect("/admin/settings?error=signature");
    }

    const r2Key = createBrandAssetObjectKey({ originalFilename: signatureFile.name });
    const bytes = Buffer.from(await signatureFile.arrayBuffer());

    await savePhotoObject({
      r2Key,
      bytes,
      contentType: "image/png"
    });

    signatureR2Key = r2Key;
    signatureUrl = getPhotoPublicUrl(r2Key);
  }

  const settings = await prisma.siteSettings.upsert({
    where: { id: existingSettings?.id ?? admin.id },
    create: {
      id: admin.id,
      adminId: admin.id,
      businessName: formString(formData, "businessName"),
      logoUrl: logoUrl ?? null,
      logoR2Key: logoR2Key ?? null,
      logoHeight,
      signatureUrl: signatureUrl ?? null,
      signatureR2Key: signatureR2Key ?? null,
      websiteUrl: formOptionalUrl(formData, "websiteUrl"),
      instagramUrl: formOptionalUrl(formData, "instagramUrl"),
      facebookUrl: formOptionalUrl(formData, "facebookUrl"),
      tiktokUrl: formOptionalUrl(formData, "tiktokUrl"),
      youtubeUrl: formOptionalUrl(formData, "youtubeUrl"),
      contactEmail: formString(formData, "contactEmail") || null,
      contactPhone: formString(formData, "contactPhone") || null
    },
    update: {
      adminId: admin.id,
      businessName: formString(formData, "businessName"),
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      ...(logoR2Key !== undefined ? { logoR2Key } : {}),
      logoHeight,
      ...(signatureUrl !== undefined ? { signatureUrl } : {}),
      ...(signatureR2Key !== undefined ? { signatureR2Key } : {}),
      websiteUrl: formOptionalUrl(formData, "websiteUrl"),
      instagramUrl: formOptionalUrl(formData, "instagramUrl"),
      facebookUrl: formOptionalUrl(formData, "facebookUrl"),
      tiktokUrl: formOptionalUrl(formData, "tiktokUrl"),
      youtubeUrl: formOptionalUrl(formData, "youtubeUrl"),
      contactEmail: formString(formData, "contactEmail") || null,
      contactPhone: formString(formData, "contactPhone") || null
    },
    select: { logoR2Key: true, signatureR2Key: true }
  });

  const previousLogoKey = existingSettings?.logoR2Key;
  const previousSignatureKey = existingSettings?.signatureR2Key;

  if (previousLogoKey && previousLogoKey !== settings.logoR2Key && (shouldRemoveLogo || logoR2Key)) {
    await deletePhotoObject(previousLogoKey);
  }

  if (previousSignatureKey && previousSignatureKey !== settings.signatureR2Key && (shouldRemoveSignature || signatureR2Key)) {
    await deletePhotoObject(previousSignatureKey);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/galleries");
  revalidatePath("/g/[slug]", "page");

  redirect("/admin/settings?saved=1");
}
