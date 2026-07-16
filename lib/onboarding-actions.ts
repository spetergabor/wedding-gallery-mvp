"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidPublicSubdomain, normalizePublicSubdomain } from "@/lib/public-subdomain";

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

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function completeAdminOnboardingAction(formData: FormData) {
  const admin = await requireAdmin({ allowIncompleteOnboarding: true });
  const businessName = formString(formData, "businessName");
  const publicSubdomain = normalizePublicSubdomain(formString(formData, "publicSubdomain"));
  const country = formString(formData, "country");
  const phone = formString(formData, "phone");
  const websiteUrl = formOptionalUrl(formData, "websiteUrl");

  if (admin.role === "super_admin") {
    redirect("/admin/dashboard");
  }

  if (!businessName || !publicSubdomain || !country) {
    redirect("/admin/onboarding?error=missing");
  }

  if (!isValidPublicSubdomain(publicSubdomain)) {
    redirect("/admin/onboarding?error=subdomain");
  }

  const existingSubdomain = await prisma.siteSettings.findUnique({
    where: { publicSubdomain },
    select: { id: true, adminId: true }
  });

  if (existingSubdomain && existingSubdomain.adminId !== admin.id) {
    redirect("/admin/onboarding?error=taken");
  }

  try {
    await prisma.$transaction([
      prisma.admin.update({
        where: { id: admin.id },
        data: {
          country,
          phone: phone || null,
          onboardingCompletedAt: new Date()
        }
      }),
      prisma.siteSettings.upsert({
        where: { adminId: admin.id },
        create: {
          id: admin.id,
          adminId: admin.id,
          businessName,
          publicSubdomain,
          contactEmail: admin.email,
          contactPhone: phone || null,
          websiteUrl
        },
        update: {
          businessName,
          publicSubdomain,
          contactEmail: admin.email,
          contactPhone: phone || null,
          websiteUrl
        }
      })
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect("/admin/onboarding?error=taken");
    }

    throw error;
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?onboarding=done");
}
