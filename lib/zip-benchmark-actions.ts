"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { invalidatePublicGalleryDownloadPackages } from "@/lib/download-packages";
import { kickGalleryZipJobs, preparePublicGalleryZipPackages } from "@/lib/jobs";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function startZipBenchmarkAction(formData: FormData) {
  await requireSuperAdmin();

  const galleryId = formString(formData, "galleryId");
  const forceFresh = formString(formData, "forceFresh") === "1";

  if (!galleryId) {
    redirect("/admin/zip-benchmark?error=missing-gallery");
  }

  if (forceFresh) {
    await invalidatePublicGalleryDownloadPackages(galleryId);
  }

  const zipResult = await preparePublicGalleryZipPackages(galleryId, "original");

  if (zipResult.ok && zipResult.payloads.length > 0) {
    await kickGalleryZipJobs(zipResult.payloads);
  }

  revalidatePath("/admin/zip-benchmark");

  const status = zipResult.ok ? (zipResult.cached ? "cached" : zipResult.payloads.length > 0 ? "queued" : zipResult.status) : zipResult.reason;
  redirect(`/admin/zip-benchmark?gallery=${galleryId}&status=${status}`);
}
