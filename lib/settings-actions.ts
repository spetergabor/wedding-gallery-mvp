"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ensureDefaultPublicSubdomainForAdmin,
  isValidPublicSubdomain,
  normalizePublicSubdomain
} from "@/lib/public-subdomain";
import { logSystemEvent } from "@/lib/system-events";
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

function formOptionalDate(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formNullableString(formData: FormData, key: string) {
  return formString(formData, key) || null;
}

export async function updatePhotographerProfileAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = formString(formData, "name");
  const email = formString(formData, "email").toLowerCase();

  if (!name || !email) {
    redirect("/admin/settings?tab=profile&error=profile_required");
  }

  if (!email.includes("@")) {
    redirect("/admin/settings?tab=profile&error=profile_email");
  }

  if (email !== admin.email) {
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingAdmin && existingAdmin.id !== admin.id) {
      redirect("/admin/settings?tab=profile&error=profile_email_taken");
    }
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      name,
      email,
      legalName: formNullableString(formData, "legalName"),
      birthDate: formOptionalDate(formData, "birthDate"),
      birthPlace: formNullableString(formData, "birthPlace"),
      phone: formNullableString(formData, "phone"),
      addressLine: formNullableString(formData, "addressLine"),
      postalCode: formNullableString(formData, "postalCode"),
      city: formNullableString(formData, "city"),
      country: formNullableString(formData, "country"),
      taxNumber: formNullableString(formData, "taxNumber"),
      businessRegistrationNumber: formNullableString(formData, "businessRegistrationNumber"),
      profileNotes: formNullableString(formData, "profileNotes")
    }
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
  redirect("/admin/settings?tab=profile&saved=1");
}

export async function updateGoogleCalendarSettingsAction(formData: FormData) {
  const admin = await requireAdmin();

  if (admin.isTeamWorkspace) {
    redirect("/admin/settings?tab=profile");
  }

  const adminId = ownerAdminId(admin);
  const [calendarIdValue, calendarSummaryValue] = (formString(formData, "calendarId") || "primary").split("|||");
  const calendarId = calendarIdValue || "primary";
  const calendarSummary = calendarSummaryValue || null;

  await prisma.googleCalendarIntegration.update({
    where: { adminId },
    data: {
      calendarId,
      calendarSummary,
      syncMiniSessionBookings: formData.get("syncMiniSessionBookings") === "on",
      syncCustomerProjects: formData.get("syncCustomerProjects") === "on",
      blockAvailabilityFromGoogleCalendar: formData.get("blockAvailabilityFromGoogleCalendar") === "on",
      deleteCancelledEvents: formData.get("deleteCancelledEvents") === "on",
      lastSyncError: null
    }
  });

  await logSystemEvent({
    actorAdminId: admin.id,
    targetAdminId: adminId,
    type: "google_calendar.settings.updated",
    title: "Google naptár beállítások módosítva",
    message: calendarSummary || calendarId,
    severity: "success",
    status: "success",
    source: "google_calendar",
    href: "/admin/settings?tab=integrations",
    metadata: {
      calendarId,
      calendarSummary,
      syncMiniSessionBookings: formData.get("syncMiniSessionBookings") === "on",
      syncCustomerProjects: formData.get("syncCustomerProjects") === "on",
      blockAvailabilityFromGoogleCalendar: formData.get("blockAvailabilityFromGoogleCalendar") === "on",
      deleteCancelledEvents: formData.get("deleteCancelledEvents") === "on"
    }
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?tab=integrations&google=saved");
}

export async function disconnectGoogleCalendarAction() {
  const admin = await requireAdmin();

  if (admin.isTeamWorkspace) {
    redirect("/admin/settings?tab=profile");
  }

  await prisma.googleCalendarIntegration.deleteMany({
    where: { adminId: ownerAdminId(admin) }
  });

  await logSystemEvent({
    actorAdminId: admin.id,
    targetAdminId: ownerAdminId(admin),
    type: "google_calendar.disconnected",
    title: "Google naptár kapcsolat leválasztva",
    severity: "warning",
    status: "success",
    source: "google_calendar",
    href: "/admin/settings?tab=integrations"
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?tab=integrations&google=disconnected");
}

export async function updateSiteSettingsAction(formData: FormData) {
  const admin = await requireAdmin();

  if (admin.isTeamWorkspace) {
    redirect("/admin/settings?tab=profile");
  }

  const logoHeight = formClampedNumber(formData, "logoHeight", 80, 32, 140);
  const adminName = formString(formData, "adminName") || admin.name;
  let publicSubdomain = normalizePublicSubdomain(formString(formData, "publicSubdomain"));

  if (publicSubdomain && !isValidPublicSubdomain(publicSubdomain)) {
    redirect("/admin/settings?tab=brand&error=public_subdomain");
  }

  const existingSettings = await prisma.siteSettings.findFirst({
    where: {
      OR: [{ adminId: admin.id }, ...(admin.role === "super_admin" ? [{ id: "default" }] : [])]
    },
    select: { id: true, logoR2Key: true, signatureR2Key: true }
  });

  if (!publicSubdomain && admin.role !== "super_admin") {
    publicSubdomain =
      (await ensureDefaultPublicSubdomainForAdmin({
        id: admin.id,
        name: adminName,
        email: admin.email,
        role: admin.role
      })) ?? "";
  }

  if (publicSubdomain) {
    const existingSubdomain = await prisma.siteSettings.findUnique({
      where: { publicSubdomain },
      select: { id: true }
    });

    if (existingSubdomain && existingSubdomain.id !== (existingSettings?.id ?? admin.id)) {
      redirect("/admin/settings?tab=brand&error=public_subdomain_taken");
    }
  }
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

  if (adminName !== admin.name) {
    await prisma.admin.update({
      where: { id: admin.id },
      data: { name: adminName }
    });
  }

  const settings = await prisma.siteSettings.upsert({
    where: { id: existingSettings?.id ?? admin.id },
    create: {
      id: admin.id,
      adminId: admin.id,
      businessName: formString(formData, "businessName"),
      publicSubdomain: publicSubdomain || null,
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
      publicSubdomain: publicSubdomain || null,
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
