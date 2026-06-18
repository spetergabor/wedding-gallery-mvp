"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deletePhotoObject } from "@/lib/storage";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formOptionalString(formData: FormData, key: string) {
  const value = formString(formData, key);
  return value || null;
}

function formDate(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeStatus(value: string) {
  const allowed = new Set(["lead", "contract_pending", "booked", "completed", "archived"]);
  return allowed.has(value) ? value : "lead";
}

function customerPayload(formData: FormData) {
  const coupleName = formString(formData, "coupleName");
  const primaryEmail = formString(formData, "primaryEmail").toLowerCase();

  if (!coupleName || !primaryEmail) {
    return null;
  }

  return {
    coupleName,
    primaryEmail,
    secondaryEmail: formOptionalString(formData, "secondaryEmail")?.toLowerCase() ?? null,
    phone: formOptionalString(formData, "phone"),
    weddingDate: formDate(formData, "weddingDate"),
    venue: formOptionalString(formData, "venue"),
    status: normalizeStatus(formString(formData, "status")),
    notes: formOptionalString(formData, "notes")
  };
}

export async function createCustomerAction(formData: FormData) {
  await requireAdmin();

  const payload = customerPayload(formData);

  if (!payload) {
    redirect("/admin/clients/new?error=missing");
  }

  const customer = await prisma.customer.create({
    data: payload,
    select: { id: true }
  });

  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${customer.id}?created=1`);
}

export async function updateCustomerAction(customerId: string, formData: FormData) {
  await requireAdmin();

  const payload = customerPayload(formData);

  if (!payload) {
    redirect(`/admin/clients/${customerId}?error=missing`);
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: payload
  });

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?updated=1`);
}

export async function deleteCustomerAction(customerId: string) {
  await requireAdmin();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      contracts: {
        select: {
          r2Key: true,
          signedR2Key: true
        }
      }
    }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  const contractObjectKeys = customer.contracts.flatMap((contract) =>
    [contract.r2Key, contract.signedR2Key].filter((key): key is string => Boolean(key))
  );

  await prisma.customer.delete({
    where: { id: customer.id }
  });

  await Promise.all(contractObjectKeys.map((key) => deletePhotoObject(key)));

  revalidatePath("/admin/clients");
  revalidatePath("/admin/dashboard");
  redirect("/admin/clients?deleted=1");
}
