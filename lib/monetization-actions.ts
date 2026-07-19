"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { MONETIZATION_FEATURES, normalizePlanSlug } from "@/lib/monetization";
import { prisma } from "@/lib/prisma";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formOptionalText(formData: FormData, key: string) {
  const value = formText(formData, key);
  return value.length > 0 ? value : null;
}

function formCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function formOptionalInt(formData: FormData, key: string) {
  const value = formText(formData, key);

  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formMoneyCents(formData: FormData, key: string) {
  const value = formText(formData, key).replace(/\s/g, "").replace(",", ".");

  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function formNullableBoolean(formData: FormData, key: string) {
  const value = formData.get(key);

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function redirectToMonetization(params = "saved=1") {
  revalidatePath("/admin/settings");
  redirect(`/admin/settings?tab=monetization&${params}`);
}

function planDataFromForm(formData: FormData) {
  const name = formText(formData, "name");
  const slug = normalizePlanSlug(formText(formData, "slug") || name);

  return {
    name,
    slug,
    description: formOptionalText(formData, "description"),
    monthlyPriceCents: formMoneyCents(formData, "monthlyPrice"),
    currency: (formText(formData, "currency") || "EUR").toUpperCase().slice(0, 8),
    storageLimitGb: formOptionalInt(formData, "storageLimitGb"),
    featureGallery: formCheckbox(formData, "featureGallery"),
    featureAlbum: formCheckbox(formData, "featureAlbum"),
    featureContracts: formCheckbox(formData, "featureContracts"),
    featureBooking: formCheckbox(formData, "featureBooking"),
    featureStripe: formCheckbox(formData, "featureStripe"),
    isActive: formCheckbox(formData, "isActive"),
    sortOrder: formOptionalInt(formData, "sortOrder") ?? 0
  };
}

export async function createSubscriptionPlanAction(formData: FormData) {
  await requireSuperAdmin();

  const data = planDataFromForm(formData);

  if (!data.name || !data.slug) {
    redirectToMonetization("error=plan_required");
  }

  try {
    await prisma.subscriptionPlan.create({
      data
    });
  } catch (error) {
    console.error("Create subscription plan failed", error);
    redirectToMonetization("error=plan_save");
  }

  redirectToMonetization();
}

export async function updateSubscriptionPlanAction(planId: string, formData: FormData) {
  await requireSuperAdmin();

  const data = planDataFromForm(formData);

  if (!data.name || !data.slug) {
    redirectToMonetization("error=plan_required");
  }

  try {
    await prisma.subscriptionPlan.update({
      where: { id: planId },
      data
    });
  } catch (error) {
    console.error("Update subscription plan failed", error);
    redirectToMonetization("error=plan_save");
  }

  redirectToMonetization();
}

export async function deleteSubscriptionPlanAction(planId: string) {
  await requireSuperAdmin();

  const assignedCount = await prisma.adminPlanOverride.count({
    where: { planId }
  });

  if (assignedCount > 0) {
    await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: { isActive: false }
    });
  } else {
    await prisma.subscriptionPlan.delete({
      where: { id: planId }
    });
  }

  redirectToMonetization();
}

export async function updatePhotographerPlanAction(adminId: string, formData: FormData) {
  await requireSuperAdmin();

  const target = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, role: true }
  });

  if (!target || target.role === "super_admin") {
    revalidatePath("/admin/photographers");
    redirect("/admin/photographers?plan=error");
  }

  const planId = formOptionalText(formData, "planId");
  const freeAccess = formCheckbox(formData, "freeAccess");
  const storageLimitGbOverride = formOptionalInt(formData, "storageLimitGbOverride");
  const notes = formOptionalText(formData, "notes");
  const featureOverrides = MONETIZATION_FEATURES.reduce<Record<string, boolean | null>>((data, feature) => {
    data[feature.overrideKey] = formNullableBoolean(formData, feature.overrideKey);
    return data;
  }, {});

  const hasOverride =
    Boolean(planId) ||
    freeAccess ||
    storageLimitGbOverride != null ||
    Boolean(notes) ||
    Object.values(featureOverrides).some((value) => value != null);

  if (!hasOverride) {
    await prisma.adminPlanOverride.deleteMany({
      where: { adminId }
    });
  } else {
    await prisma.adminPlanOverride.upsert({
      where: { adminId },
      create: {
        adminId,
        planId,
        freeAccess,
        storageLimitGbOverride,
        notes,
        ...featureOverrides
      },
      update: {
        planId,
        freeAccess,
        storageLimitGbOverride,
        notes,
        ...featureOverrides
      }
    });
  }

  revalidatePath("/admin/photographers");
  redirect("/admin/photographers?plan=updated");
}
