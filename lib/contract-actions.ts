"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { customerAccessWhere, customerContractAccessWhere } from "@/lib/admin-scope";
import { mergeContractFieldsFromTemplate } from "@/lib/contract-fields";
import { parseContractPdfFieldsJson } from "@/lib/contract-pdf-fields";
import { contractBodyToPlainText, normalizeContractBodyHtml } from "@/lib/contract-rich-text";
import { contractPublicUrl, sendContractSignatureRequestEmail } from "@/lib/email";
import { normalizeCustomerLanguage } from "@/lib/customer-language";
import { prisma } from "@/lib/prisma";
import {
  createContractObjectKey,
  deletePhotoObject,
  getPhotoPublicUrl,
  getR2KeyFromPublicUrl,
  savePhotoObject
} from "@/lib/storage";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function emailListFromForm(formData: FormData) {
  const selectedRecipients = formData
    .getAll("recipients")
    .filter((value): value is string => typeof value === "string");
  const additionalRecipients = formString(formData, "additionalRecipients")
    .split(/[\s,;]+/)
    .filter(Boolean);

  return [...new Set([...selectedRecipients, ...additionalRecipients].map(normalizeEmail).filter(isValidEmail))];
}

function createContractAccessToken() {
  return randomBytes(32).toString("base64url");
}

function sha256Hex(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function uploadContractAction(customerId: string, formData: FormData) {
  const admin = await requireAdmin();

  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  const file = formData.get("contractPdf");
  const title = formString(formData, "title");

  if (!(file instanceof File) || file.size === 0 || !title) {
    redirect(`/admin/clients/${customerId}?tab=contracts&contractFlow=upload&contractError=missing`);
  }

  const fileName = file.name || "contract.pdf";
  const isPdf = file.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    redirect(`/admin/clients/${customerId}?tab=contracts&contractFlow=upload&contractError=type`);
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

  const contract = await prisma.contract.create({
    data: {
      customerId,
      title,
      originalFilename: fileName,
      r2Key,
      fileUrl: getPhotoPublicUrl(r2Key),
      fileSize: file.size,
      documentHash: sha256Hex(bytes),
      status: "draft"
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=contracts&contractFlow=fields&contractId=${contract.id}&contractUploaded=1`);
}

export async function createWrittenContractAction(customerId: string, formData: FormData) {
  const admin = await requireAdmin();

  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  const title = formString(formData, "title");
  const bodyText = normalizeContractBodyHtml(formString(formData, "bodyText"));
  const selectedKeys = formData.getAll("clientFields").filter((value): value is string => typeof value === "string");
  const clientFields = mergeContractFieldsFromTemplate(bodyText, selectedKeys);

  if (!title || !contractBodyToPlainText(bodyText)) {
    redirect(`/admin/clients/${customerId}?tab=contracts&contractFlow=write&contractError=written-missing`);
  }

  const contract = await prisma.contract.create({
    data: {
      customerId,
      title,
      sourceType: "written",
      originalFilename: `${title}.pdf`,
      r2Key: "",
      fileUrl: "",
      fileSize: 0,
      bodyText,
      clientFields,
      documentHash: sha256Hex(JSON.stringify({ title, bodyText, clientFields })),
      status: "draft"
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=contracts&contractFlow=email&contractId=${contract.id}&contractWritten=1`);
}

export async function sendContractAction(customerId: string, contractId: string, formData: FormData) {
  const admin = await requireAdmin();

  const contract = await prisma.contract.findFirst({
    where: customerContractAccessWhere(admin, customerId, contractId),
    include: {
      customer: {
        select: {
          coupleName: true,
          primaryEmail: true,
          secondaryEmail: true,
          wifeEmail: true,
          husbandEmail: true,
          partnerEmail: true,
          preferredLanguage: true
        }
      }
    }
  });

  if (!contract) {
    redirect(`/admin/clients/${customerId}?tab=contracts&contractError=not-found`);
  }

  const recipients = emailListFromForm(formData);

  if (recipients.length === 0) {
    redirect(`/admin/clients/${customerId}?tab=contracts&contractFlow=email&contractId=${contract.id}&contractError=no-recipient`);
  }

  const accessToken = contract.accessToken ?? createContractAccessToken();
  const expiresAt = contract.accessTokenExpiresAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const contractUrl = contractPublicUrl(accessToken);
  const subject = formString(formData, "emailSubject");
  const message = formString(formData, "emailMessage");
  const replyToRaw = formString(formData, "emailReplyTo");
  const replyTo = replyToRaw ? normalizeEmail(replyToRaw) : undefined;

  if (replyTo && !isValidEmail(replyTo)) {
    redirect(`/admin/clients/${customerId}?tab=contracts&contractFlow=email&contractId=${contract.id}&contractError=invalid-reply-to`);
  }

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      accessToken,
      accessTokenExpiresAt: expiresAt
    }
  });

  await sendContractSignatureRequestEmail({
    to: recipients,
    replyTo,
    coupleName: contract.customer.coupleName,
    contractTitle: contract.title,
    contractUrl,
    subject,
    message,
    language: normalizeCustomerLanguage(contract.customer.preferredLanguage)
  });

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: contract.status === "signed" ? "signed" : "sent",
      sentAt: new Date()
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=contracts&contractFlow=email&contractId=${contract.id}&contractSent=1`);
}

export async function saveContractPdfFieldsAction(customerId: string, contractId: string, formData: FormData) {
  const admin = await requireAdmin();
  const contract = await prisma.contract.findFirst({
    where: customerContractAccessWhere(admin, customerId, contractId),
    select: {
      id: true,
      sourceType: true
    }
  });

  if (!contract || contract.sourceType === "written") {
    redirect(`/admin/clients/${customerId}?tab=contracts&contractError=not-found`);
  }

  const fieldsJson = formString(formData, "pdfFields");
  const fields = parseContractPdfFieldsJson(fieldsJson);

  if (!fields) {
    redirect(`/admin/clients/${customerId}?tab=contracts&contractError=pdf-fields`);
  }

  await prisma.contract.update({
    where: { id: contract.id },
    data: { clientFields: fields }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=contracts&contractFlow=email&contractId=${contract.id}&contractFieldsSaved=1`);
}

export async function deleteContractAction(customerId: string, contractId: string) {
  const admin = await requireAdmin();

  const contract = await prisma.contract.findFirst({
    where: customerContractAccessWhere(admin, customerId, contractId),
    select: {
      id: true,
      r2Key: true,
      signedR2Key: true,
      signedFileUrl: true
    }
  });

  if (!contract) {
    redirect(`/admin/clients/${customerId}?tab=contracts&contractError=not-found`);
  }

  await prisma.contract.delete({
    where: { id: contract.id }
  });

  await Promise.all([
    deletePhotoObject(contract.r2Key),
    deletePhotoObject(contract.signedR2Key ?? getR2KeyFromPublicUrl(contract.signedFileUrl) ?? "")
  ]);

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=contracts&contractDeleted=1`);
}
