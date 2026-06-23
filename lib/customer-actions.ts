"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { customerAccessWhere } from "@/lib/admin-scope";
import { normalizeCustomerProjectStatus, normalizeCustomerProjectType } from "@/lib/customer-project-options";
import { normalizeCustomerStatus, normalizeCustomerType } from "@/lib/customer-options";
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

function customerPayload(formData: FormData) {
  const coupleName = formString(formData, "coupleName");
  const primaryEmail = formString(formData, "primaryEmail").toLowerCase();

  if (!coupleName || !primaryEmail) {
    return null;
  }

  return {
    customerType: normalizeCustomerType(formString(formData, "customerType")),
    coupleName,
    primaryEmail,
    secondaryEmail: formOptionalString(formData, "secondaryEmail")?.toLowerCase() ?? null,
    phone: formOptionalString(formData, "phone"),
    weddingDate: formDate(formData, "weddingDate"),
    venue: formOptionalString(formData, "venue"),
    status: normalizeCustomerStatus(formString(formData, "status")),
    notes: formOptionalString(formData, "notes")
  };
}

export async function createCustomerAction(formData: FormData) {
  const admin = await requireAdmin();

  const payload = customerPayload(formData);

  if (!payload) {
    redirect("/admin/clients/new?error=missing");
  }

  const customer = await prisma.customer.create({
    data: {
      ...payload,
      adminId: admin.id
    },
    select: { id: true }
  });

  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${customer.id}?created=1`);
}

export async function updateCustomerAction(customerId: string, formData: FormData) {
  const admin = await requireAdmin();

  const payload = customerPayload(formData);

  if (!payload) {
    redirect(`/admin/clients/${customerId}?error=missing`);
  }

  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: payload
  });

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?updated=1`);
}

export async function updateCustomerStatusAction(customerId: string, formData: FormData) {
  const admin = await requireAdmin();
  const status = normalizeCustomerStatus(formString(formData, "status"));

  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { status }
  });

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?statusUpdated=1`);
}

export async function createCustomerProjectAction(customerId: string, formData: FormData) {
  const admin = await requireAdmin();

  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  const title = formString(formData, "title");

  if (!title) {
    redirect(`/admin/clients/${customerId}?tab=projects&projectError=missing`);
  }

  await prisma.customerProject.create({
    data: {
      customerId: customer.id,
      title,
      projectType: normalizeCustomerProjectType(formString(formData, "projectType")),
      status: normalizeCustomerProjectStatus(formString(formData, "status")),
      eventDate: formDate(formData, "eventDate"),
      venue: formOptionalString(formData, "venue"),
      notes: formOptionalString(formData, "notes")
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${customerId}?tab=projects&projectCreated=1`);
}

export async function updateCustomerProjectStatusAction(customerId: string, projectId: string, formData: FormData) {
  const admin = await requireAdmin();
  const status = normalizeCustomerProjectStatus(formString(formData, "status"));

  const project = await prisma.customerProject.findFirst({
    where: {
      id: projectId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: { id: true }
  });

  if (!project) {
    redirect(`/admin/clients/${customerId}?tab=projects&projectError=missing`);
  }

  await prisma.customerProject.update({
    where: { id: project.id },
    data: { status }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=projects&projectStatusUpdated=1`);
}

export async function deleteCustomerProjectAction(customerId: string, projectId: string) {
  const admin = await requireAdmin();

  const project = await prisma.customerProject.findFirst({
    where: {
      id: projectId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: { id: true }
  });

  if (!project) {
    redirect(`/admin/clients/${customerId}?tab=projects&projectError=missing`);
  }

  await prisma.customerProject.delete({
    where: { id: project.id }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/galleries");
  redirect(`/admin/clients/${customerId}?tab=projects&projectDeleted=1`);
}

export async function deleteCustomerAction(customerId: string) {
  const admin = await requireAdmin();

  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
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
  revalidatePath("/admin/galleries");
  revalidatePath("/admin/dashboard");
  redirect("/admin/clients?deleted=1");
}
