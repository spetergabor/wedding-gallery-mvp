"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { customerAccessWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { createCustomerPortalToken } from "@/lib/customer-portal";
import { prisma } from "@/lib/prisma";
import {
  createCustomerPortalImageObjectKey,
  deletePhotoObject,
  getPhotoPublicUrl,
  savePhotoObject
} from "@/lib/storage";

const CUSTOMER_PORTAL_IMAGE_MAX_BYTES = 12 * 1024 * 1024;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formOptionalString(formData: FormData, key: string) {
  const value = formString(formData, key);
  return value || null;
}

function normalizeEmail(value: string | null) {
  return value?.toLowerCase() ?? null;
}

function normalizeWebsite(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

function formDate(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function portalRedirect(token: string, query: string): never {
  redirect(`/portal/${token}?${query}`);
}

async function findCustomerByPortalToken(token: string) {
  if (!token) {
    notFound();
  }

  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      customerType: true,
      adminId: true,
      portalToken: true
    }
  });

  if (!customer || customer.customerType !== "wedding_couple") {
    notFound();
  }

  return customer;
}

export async function ensureCustomerPortalAction(customerId: string) {
  const admin = await requireAdmin();
  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true, customerType: true, portalToken: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  if (customer.customerType !== "wedding_couple") {
    redirect(`/admin/clients/${customerId}?tab=portal&portalError=type`);
  }

  if (!customer.portalToken) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { portalToken: createCustomerPortalToken() }
    });
  }

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=portal&portalCreated=1`);
}

export async function updateCustomerPortalDetailsAction(token: string, formData: FormData) {
  const customer = await findCustomerByPortalToken(token);
  const wifeName = formString(formData, "wifeName");
  const husbandName = formString(formData, "husbandName");
  const wifeEmail = normalizeEmail(formOptionalString(formData, "wifeEmail"));
  const husbandEmail = normalizeEmail(formOptionalString(formData, "husbandEmail"));
  const wifePhone = formOptionalString(formData, "wifePhone");
  const husbandPhone = formOptionalString(formData, "husbandPhone");
  const mainLocation = formOptionalString(formData, "mainLocation");
  const gettingReadyLocation = formOptionalString(formData, "gettingReadyLocation");
  const churchCeremonyLocation = formOptionalString(formData, "churchCeremonyLocation");
  const civilCeremonyLocation = formOptionalString(formData, "civilCeremonyLocation");

  if (!wifeName || !husbandName || !wifeEmail || !husbandEmail) {
    portalRedirect(token, "error=missing");
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      coupleName: `${wifeName} & ${husbandName}`,
      primaryEmail: wifeEmail,
      secondaryEmail: husbandEmail !== wifeEmail ? husbandEmail : null,
      phone: wifePhone || husbandPhone,
      wifeName,
      wifeEmail,
      wifePhone,
      husbandName,
      husbandEmail,
      husbandPhone,
      partnerName: husbandName,
      partnerEmail: husbandEmail,
      partnerPhone: husbandPhone,
      weddingDate: formDate(formData, "weddingDate"),
      venue: mainLocation,
      weddingLocation: mainLocation,
      weddingAddress: formOptionalString(formData, "weddingAddress"),
      gettingReadyLocation,
      churchCeremonyLocation,
      civilCeremonyLocation,
      mainLocation,
      ceremonyLocation: churchCeremonyLocation || civilCeremonyLocation,
      receptionLocation: mainLocation,
      weddingSchedule: formOptionalString(formData, "weddingSchedule"),
      weddingStyleNotes: formOptionalString(formData, "weddingStyleNotes"),
      importantPeopleNotes: formOptionalString(formData, "importantPeopleNotes"),
      portalNotes: formOptionalString(formData, "portalNotes")
    }
  });

  revalidatePath(`/portal/${token}`);
  revalidatePath(`/admin/clients/${customer.id}`);
  portalRedirect(token, "updated=1");
}

export async function createCustomerVendorAction(token: string, formData: FormData) {
  const customer = await findCustomerByPortalToken(token);
  const role = formString(formData, "role");
  const name = formString(formData, "name");

  if (!role || !name) {
    portalRedirect(token, "vendorError=missing");
  }

  await prisma.customerVendor.create({
    data: {
      customerId: customer.id,
      role,
      name,
      contactName: formOptionalString(formData, "contactName"),
      email: normalizeEmail(formOptionalString(formData, "email")),
      phone: formOptionalString(formData, "phone"),
      website: normalizeWebsite(formOptionalString(formData, "website")),
      notes: formOptionalString(formData, "notes")
    }
  });

  revalidatePath(`/portal/${token}`);
  revalidatePath(`/admin/clients/${customer.id}`);
  portalRedirect(token, "vendorCreated=1");
}

export async function deleteCustomerVendorAction(token: string, vendorId: string) {
  const customer = await findCustomerByPortalToken(token);
  const vendor = await prisma.customerVendor.findFirst({
    where: { id: vendorId, customerId: customer.id },
    select: { id: true }
  });

  if (!vendor) {
    portalRedirect(token, "vendorError=missing");
  }

  await prisma.customerVendor.delete({
    where: { id: vendor.id }
  });

  revalidatePath(`/portal/${token}`);
  revalidatePath(`/admin/clients/${customer.id}`);
  portalRedirect(token, "vendorDeleted=1");
}

export async function uploadCustomerPortalImageAction(token: string, formData: FormData) {
  const customer = await findCustomerByPortalToken(token);
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    portalRedirect(token, "imageError=missing");
  }

  const fileName = file.name || "inspiration.jpg";
  const extensionLooksLikeImage = /\.(jpe?g|png|webp|gif)$/i.test(fileName);
  const isImage = file.type.startsWith("image/") || extensionLooksLikeImage;

  if (!isImage) {
    portalRedirect(token, "imageError=type");
  }

  if (file.size > CUSTOMER_PORTAL_IMAGE_MAX_BYTES) {
    portalRedirect(token, "imageError=size");
  }

  const r2Key = createCustomerPortalImageObjectKey({
    customerId: customer.id,
    originalFilename: fileName
  });
  const bytes = Buffer.from(await file.arrayBuffer());

  await savePhotoObject({
    r2Key,
    bytes,
    contentType: file.type || "image/jpeg"
  });

  await prisma.customerPortalImage.create({
    data: {
      customerId: customer.id,
      title: formOptionalString(formData, "title"),
      notes: formOptionalString(formData, "notes"),
      originalFilename: fileName,
      imageUrl: getPhotoPublicUrl(r2Key),
      r2Key,
      fileSize: file.size,
      contentType: file.type || null
    }
  });

  revalidatePath(`/portal/${token}`);
  revalidatePath(`/admin/clients/${customer.id}`);
  portalRedirect(token, "imageUploaded=1");
}

export async function deleteCustomerPortalImageAction(token: string, imageId: string) {
  const customer = await findCustomerByPortalToken(token);
  const image = await prisma.customerPortalImage.findFirst({
    where: { id: imageId, customerId: customer.id },
    select: { id: true, r2Key: true }
  });

  if (!image) {
    portalRedirect(token, "imageError=missing");
  }

  await prisma.customerPortalImage.delete({
    where: { id: image.id }
  });
  await deletePhotoObject(image.r2Key);

  revalidatePath(`/portal/${token}`);
  revalidatePath(`/admin/clients/${customer.id}`);
  portalRedirect(token, "imageDeleted=1");
}
