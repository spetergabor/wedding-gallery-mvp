"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { abortAllR2MultipartUploads, abortR2MultipartUpload, updateR2BrowserUploadCors } from "@/lib/r2-maintenance";

function isR2AccessDenied(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { name?: string; Code?: string; code?: string; message?: string };

  return (
    candidate.name === "AccessDenied" ||
    candidate.Code === "AccessDenied" ||
    candidate.code === "AccessDenied" ||
    candidate.message?.includes("Access Denied") === true
  );
}

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
  let target = "/admin/r2-storage?cors=1";

  try {
    const result = await updateR2BrowserUploadCors();
    target = `/admin/r2-storage?cors=1&origins=${result.origins.length}`;
  } catch (error) {
    console.error("R2 CORS update failed", error);
    target = isR2AccessDenied(error) ? "/admin/r2-storage?cors=denied" : "/admin/r2-storage?cors=failed";
  }

  revalidatePath("/admin/r2-storage");
  redirect(target);
}
