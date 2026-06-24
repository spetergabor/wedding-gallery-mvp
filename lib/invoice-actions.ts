"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { customerAccessWhere } from "@/lib/admin-scope";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { normalizeCustomerLanguage } from "@/lib/customer-language";
import { sendCustomerInvoiceEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { createInvoiceObjectKey, getPhotoPublicUrl, savePhotoObject } from "@/lib/storage";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseAmountCents(value: string) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const amount = Number.parseFloat(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

function parseDateInput(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function invoiceRedirect(customerId: string, query: string): never {
  redirect(`/admin/clients/${customerId}?tab=invoices&${query}`);
}

function formatAmount(amountCents: number | null, currency: string) {
  if (amountCents === null) {
    return null;
  }

  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency
  }).format(amountCents / 100);
}

function formatDueDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return date.toLocaleDateString("de-AT", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

export async function uploadInvoiceAction(customerId: string, formData: FormData) {
  const admin = await requireAdmin();
  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: {
      id: true,
      projects: {
        select: { id: true }
      }
    }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  const file = formData.get("invoicePdf");
  const title = formString(formData, "title");
  const projectId = formString(formData, "projectId");
  const amountCents = parseAmountCents(formString(formData, "amount"));
  const currency = formString(formData, "currency") || "EUR";
  const dueDate = parseDateInput(formString(formData, "dueDate"));
  const notes = formString(formData, "notes");
  const validProjectId = projectId && customer.projects.some((project) => project.id === projectId) ? projectId : null;

  if (!(file instanceof File) || file.size === 0 || !title) {
    invoiceRedirect(customerId, "invoiceError=missing");
  }

  const fileName = file.name || "invoice.pdf";
  const isPdf = file.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    invoiceRedirect(customerId, "invoiceError=type");
  }

  const r2Key = createInvoiceObjectKey({
    customerId,
    originalFilename: fileName
  });
  const bytes = Buffer.from(await file.arrayBuffer());

  await savePhotoObject({
    r2Key,
    bytes,
    contentType: "application/pdf"
  });

  await prisma.customerInvoice.create({
    data: {
      customerId,
      projectId: validProjectId,
      title,
      originalFilename: fileName,
      r2Key,
      fileUrl: getPhotoPublicUrl(r2Key),
      fileSize: file.size,
      amountCents,
      currency,
      dueDate,
      notes: notes || null,
      status: "open"
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  invoiceRedirect(customerId, "invoiceUploaded=1");
}

export async function sendInvoiceAction(customerId: string, invoiceId: string) {
  const admin = await requireAdmin();
  const invoice = await prisma.customerInvoice.findFirst({
    where: {
      id: invoiceId,
      customerId,
      customer: { is: customerAccessWhere(admin, customerId) }
    },
    include: {
      customer: {
        select: {
          coupleName: true,
          primaryEmail: true,
          secondaryEmail: true,
          preferredLanguage: true
        }
      }
    }
  });

  if (!invoice) {
    invoiceRedirect(customerId, "invoiceError=not-found");
  }

  const recipients = [invoice.customer.primaryEmail, invoice.customer.secondaryEmail].filter((email): email is string => Boolean(email));

  try {
    await sendCustomerInvoiceEmail({
      to: recipients,
      coupleName: invoice.customer.coupleName,
      invoiceTitle: invoice.title,
      invoiceUrl: invoice.fileUrl,
      amountLabel: formatAmount(invoice.amountCents, invoice.currency),
      dueDateLabel: formatDueDate(invoice.dueDate),
      language: normalizeCustomerLanguage(invoice.customer.preferredLanguage)
    });

    await prisma.customerInvoice.update({
      where: { id: invoice.id },
      data: {
        sentAt: new Date(),
        sentTo: recipients.join(", "),
        emailError: null
      }
    });

    revalidatePath(`/admin/clients/${customerId}`);
  } catch (error) {
    await prisma.customerInvoice.update({
      where: { id: invoice.id },
      data: {
        emailError: error instanceof Error ? error.message : "Invoice email failed"
      }
    });

    revalidatePath(`/admin/clients/${customerId}`);
    invoiceRedirect(customerId, "invoiceError=email");
  }

  invoiceRedirect(customerId, "invoiceSent=1");
}

export async function updateInvoiceStatusAction(customerId: string, invoiceId: string, formData: FormData) {
  const admin = await requireAdmin();
  const status = formString(formData, "status") === "paid" ? "paid" : "open";
  const invoice = await prisma.customerInvoice.findFirst({
    where: {
      id: invoiceId,
      customerId,
      customer: { is: customerAccessWhere(admin, customerId) }
    },
    select: {
      id: true,
      paidAt: true
    }
  });

  if (!invoice) {
    invoiceRedirect(customerId, "invoiceError=not-found");
  }

  await prisma.customerInvoice.update({
    where: { id: invoice.id },
    data: {
      status,
      paidAt: status === "paid" ? invoice.paidAt ?? new Date() : null
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  invoiceRedirect(customerId, "invoiceStatusUpdated=1");
}
