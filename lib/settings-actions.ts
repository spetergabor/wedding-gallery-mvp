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

const SETTINGS_ID = "default";

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

export async function updateSiteSettingsAction(formData: FormData) {
  await requireAdmin();

  const existingSettings = await prisma.siteSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { logoR2Key: true }
  });
  const logoFile = formData.get("logo");
  const shouldRemoveLogo = formData.get("removeLogo") === "on";
  let logoUrl: string | null | undefined = undefined;
  let logoR2Key: string | null | undefined = undefined;

  if (shouldRemoveLogo) {
    logoUrl = null;
    logoR2Key = null;
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

  const settings = await prisma.siteSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      businessName: formString(formData, "businessName"),
      logoUrl: logoUrl ?? null,
      logoR2Key: logoR2Key ?? null,
      websiteUrl: formOptionalUrl(formData, "websiteUrl"),
      instagramUrl: formOptionalUrl(formData, "instagramUrl"),
      facebookUrl: formOptionalUrl(formData, "facebookUrl"),
      tiktokUrl: formOptionalUrl(formData, "tiktokUrl"),
      youtubeUrl: formOptionalUrl(formData, "youtubeUrl"),
      contactEmail: formString(formData, "contactEmail") || null,
      contactPhone: formString(formData, "contactPhone") || null
    },
    update: {
      businessName: formString(formData, "businessName"),
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      ...(logoR2Key !== undefined ? { logoR2Key } : {}),
      websiteUrl: formOptionalUrl(formData, "websiteUrl"),
      instagramUrl: formOptionalUrl(formData, "instagramUrl"),
      facebookUrl: formOptionalUrl(formData, "facebookUrl"),
      tiktokUrl: formOptionalUrl(formData, "tiktokUrl"),
      youtubeUrl: formOptionalUrl(formData, "youtubeUrl"),
      contactEmail: formString(formData, "contactEmail") || null,
      contactPhone: formString(formData, "contactPhone") || null
    },
    select: { logoR2Key: true }
  });

  const previousLogoKey = existingSettings?.logoR2Key;

  if (previousLogoKey && previousLogoKey !== settings.logoR2Key && (shouldRemoveLogo || logoR2Key)) {
    await deletePhotoObject(previousLogoKey);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/galleries");
  revalidatePath("/g/[slug]", "page");

  redirect("/admin/settings?saved=1");
}
