"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createContractObjectKey, getPhotoPublicUrl, savePhotoObject } from "@/lib/storage";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function uploadContractAction(customerId: string, formData: FormData) {
  await requireAdmin();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  const file = formData.get("contractPdf");
  const title = formString(formData, "title");

  if (!(file instanceof File) || file.size === 0 || !title) {
    redirect(`/admin/clients/${customerId}?contractError=missing`);
  }

  const fileName = file.name || "contract.pdf";
  const isPdf = file.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    redirect(`/admin/clients/${customerId}?contractError=type`);
  }

  const r2Key = createContractObjectKey({
    customerId,
    originalFilename: fileName
  });
  const bytes = Buffer.from(await file.arrayBuffer());

  await savePhotoObject({
    r2Key,
    bytes,
    contentType: "application/pdf"
  });

  await prisma.contract.create({
    data: {
      customerId,
      title,
      originalFilename: fileName,
      r2Key,
      fileUrl: getPhotoPublicUrl(r2Key),
      fileSize: file.size,
      status: "draft"
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?contractUploaded=1`);
}
