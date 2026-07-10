"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { abortAllR2MultipartUploads, abortR2MultipartUpload, updateR2BrowserUploadCors } from "@/lib/r2-maintenance";

export async function abortR2MultipartUploadAction(key: string, uploadId: string) {
  await requireSuperAdmin();
  await abortR2MultipartUpload({ key, uploadId });
  revalidatePath("/admin/r2-storage");
  redirect("/admin/r2-storage?aborted=1");
}

export async function abortAllR2MultipartUploadsAction() {
  await requireSuperAdmin();
  const count = await abortAllR2MultipartUploads();
  revalidatePath("/admin/r2-storage");
  redirect(`/admin/r2-storage?aborted=${count}`);
}

export async function updateR2BrowserUploadCorsAction() {
  await requireSuperAdmin();
  const result = await updateR2BrowserUploadCors();
  revalidatePath("/admin/r2-storage");
  redirect(`/admin/r2-storage?cors=1&origins=${result.origins.length}`);
}
