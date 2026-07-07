"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { customerAccessWhere, ownerAdminId } from "@/lib/admin-scope";
import { createCustomerPortalToken } from "@/lib/customer-portal";
import { normalizeCustomerProjectStatus, normalizeCustomerProjectType } from "@/lib/customer-project-options";
import { normalizeCustomerStatus, normalizeCustomerType } from "@/lib/customer-options";
import { normalizeCustomerLanguage } from "@/lib/customer-language";
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

function formTime(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    return { valid: true, value: null };
  }

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
    ? { valid: true, value }
    : { valid: false, value: null };
}

function projectTimePayload(formData: FormData) {
  const startTime = formTime(formData, "startTime");
  const endTime = formTime(formData, "endTime");

  if (!startTime.valid || !endTime.valid || Boolean(startTime.value) !== Boolean(endTime.value)) {
    return null;
  }

  return {
    startTime: startTime.value,
    endTime: endTime.value
  };
}

function customerPayload(formData: FormData) {
  const coupleName = formString(formData, "coupleName");
  const primaryEmail = formString(formData, "primaryEmail").toLowerCase();
  const preferredLanguageValue = formData.get("preferredLanguage");

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
    preferredLanguage: normalizeCustomerLanguage(typeof preferredLanguageValue === "string" ? preferredLanguageValue : null),
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
      adminId: ownerAdminId(admin),
      portalToken: payload.customerType === "wedding_couple" ? createCustomerPortalToken() : null
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
    select: {
      id: true,
      portalToken: true,
      galleries: {
        select: {
          id: true,
          slug: true
        }
      }
    }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      ...payload,
      portalToken:
        payload.customerType === "wedding_couple" && !customer.portalToken
          ? createCustomerPortalToken()
          : customer.portalToken
    }
  });

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${customerId}`);
  if (customer.portalToken) {
    revalidatePath(`/portal/${customer.portalToken}`);
  }
  for (const gallery of customer.galleries) {
    revalidatePath(`/admin/galleries/${gallery.id}`);
    revalidatePath(`/g/${gallery.slug}`);
    revalidatePath(`/client/${gallery.slug}`);
  }
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
  const eventDate = formDate(formData, "eventDate");
  const projectTimes = projectTimePayload(formData);

  if (!title) {
    redirect(`/admin/clients/${customerId}?tab=projects&projectError=missing`);
  }

  if (!projectTimes) {
    redirect(`/admin/clients/${customerId}?tab=projects&projectError=time`);
  }

  if ((projectTimes.startTime || projectTimes.endTime) && !eventDate) {
    redirect(`/admin/clients/${customerId}?tab=projects&projectError=date`);
  }

  await prisma.customerProject.create({
    data: {
      customerId: customer.id,
      title,
      projectType: normalizeCustomerProjectType(formString(formData, "projectType")),
      status: normalizeCustomerProjectStatus(formString(formData, "status")),
      eventDate,
      startTime: projectTimes.startTime,
      endTime: projectTimes.endTime,
      venue: formOptionalString(formData, "venue"),
      notes: formOptionalString(formData, "notes")
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${customerId}?tab=projects&projectCreated=1`);
}

export async function updateCustomerProjectAction(customerId: string, projectId: string, formData: FormData) {
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

  const title = formString(formData, "title");
  const eventDate = formDate(formData, "eventDate");
  const projectTimes = projectTimePayload(formData);

  if (!title) {
    redirect(`/admin/clients/${customerId}?tab=projects&projectError=missing`);
  }

  if (!projectTimes) {
    redirect(`/admin/clients/${customerId}?tab=projects&projectError=time`);
  }

  if ((projectTimes.startTime || projectTimes.endTime) && !eventDate) {
    redirect(`/admin/clients/${customerId}?tab=projects&projectError=date`);
  }

  await prisma.customerProject.update({
    where: { id: project.id },
    data: {
      title,
      projectType: normalizeCustomerProjectType(formString(formData, "projectType")),
      status: normalizeCustomerProjectStatus(formString(formData, "status")),
      eventDate,
      startTime: projectTimes.startTime,
      endTime: projectTimes.endTime,
      venue: formOptionalString(formData, "venue"),
      notes: formOptionalString(formData, "notes")
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${customerId}?tab=projects&projectUpdated=1`);
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
      },
      invoices: {
        select: {
          r2Key: true
        }
      },
      portalImages: {
        select: {
          r2Key: true
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
  const invoiceObjectKeys = customer.invoices.map((invoice) => invoice.r2Key).filter(Boolean);
  const portalImageObjectKeys = customer.portalImages.map((image) => image.r2Key).filter(Boolean);

  await prisma.customer.delete({
    where: { id: customer.id }
  });

  await Promise.all([...contractObjectKeys, ...invoiceObjectKeys, ...portalImageObjectKeys].map((key) => deletePhotoObject(key)));

  revalidatePath("/admin/clients");
  revalidatePath("/admin/galleries");
  revalidatePath("/admin/dashboard");
  redirect("/admin/clients?deleted=1");
}
