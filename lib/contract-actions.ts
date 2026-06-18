"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { contractPublicUrl, sendContractSignatureRequestEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { createContractObjectKey, getPhotoPublicUrl, savePhotoObject } from "@/lib/storage";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function createContractAccessToken() {
  return randomBytes(32).toString("base64url");
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

export async function sendContractAction(customerId: string, contractId: string) {
  await requireAdmin();

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      customerId
    },
    include: {
      customer: {
        select: {
          coupleName: true,
          primaryEmail: true,
          secondaryEmail: true
        }
      }
    }
  });

  if (!contract) {
    redirect(`/admin/clients/${customerId}?contractError=not-found`);
  }

  const accessToken = contract.accessToken ?? createContractAccessToken();
  const expiresAt = contract.accessTokenExpiresAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const contractUrl = contractPublicUrl(accessToken);

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      accessToken,
      accessTokenExpiresAt: expiresAt
    }
  });

  await sendContractSignatureRequestEmail({
    to: [contract.customer.primaryEmail, contract.customer.secondaryEmail].filter((email): email is string => Boolean(email)),
    coupleName: contract.customer.coupleName,
    contractTitle: contract.title,
    contractUrl
  });

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: contract.status === "signed" ? "signed" : "sent",
      sentAt: new Date()
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?contractSent=1`);
}
