"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { adminOwnedWhere, ownerAdminId } from "@/lib/admin-scope";
import { createCustomerPortalToken } from "@/lib/customer-portal";
import { ensureLeadPipelineSchema, normalizeLeadEventType, normalizeLeadStatus } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

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

export async function createLeadAction(formData: FormData) {
  const admin = await requireAdmin();
  await ensureLeadPipelineSchema(prisma);
  const name = formString(formData, "name");
  const status = normalizeLeadStatus(formString(formData, "status"));

  if (!name) {
    return { ok: false, message: "Adj meg nevet a leadhez." };
  }

  const maxSort = await prisma.lead.aggregate({
    where: {
      ...adminOwnedWhere(admin),
      status
    },
    _max: { sortOrder: true }
  });

  const lead = await prisma.lead.create({
    data: {
      adminId: ownerAdminId(admin),
      name,
      status,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      eventType: normalizeLeadEventType(formString(formData, "eventType")),
      email: formOptionalString(formData, "email")?.toLowerCase() ?? null,
      phone: formOptionalString(formData, "phone"),
      eventDate: formDate(formData, "eventDate"),
      venue: formOptionalString(formData, "venue"),
      notes: formOptionalString(formData, "notes")
    }
  });

  revalidatePath("/admin/dashboard");
  return { ok: true, leadId: lead.id };
}

export async function moveLeadAction(leadId: string, statusValue: string, targetIndex: number) {
  const admin = await requireAdmin();
  await ensureLeadPipelineSchema(prisma);
  const status = normalizeLeadStatus(statusValue);
  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      ...adminOwnedWhere(admin)
    },
    select: { id: true }
  });

  if (!lead) {
    return { ok: false };
  }

  const leadsInTargetStatus = await prisma.lead.findMany({
    where: {
      ...adminOwnedWhere(admin),
      status,
      id: { not: lead.id }
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true }
  });
  const insertIndex = Math.max(0, Math.min(targetIndex, leadsInTargetStatus.length));
  const orderedLeadIds = [
    ...leadsInTargetStatus.slice(0, insertIndex).map((item) => item.id),
    lead.id,
    ...leadsInTargetStatus.slice(insertIndex).map((item) => item.id)
  ];

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: { status }
    }),
    ...orderedLeadIds.map((id, index) =>
      prisma.lead.update({
        where: { id },
        data: { sortOrder: index }
      })
    )
  ]);

  revalidatePath("/admin/dashboard");
  return { ok: true };
}

export async function deleteLeadAction(leadId: string) {
  const admin = await requireAdmin();
  await ensureLeadPipelineSchema(prisma);
  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      ...adminOwnedWhere(admin)
    },
    select: { id: true }
  });

  if (!lead) {
    return { ok: false };
  }

  await prisma.lead.delete({ where: { id: lead.id } });
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

function customerStatusForLead(status: string) {
  if (status === "booked") {
    return "booked";
  }

  if (status === "booking") {
    return "offer_sent";
  }

  return "lead";
}

export async function convertWeddingLeadToCustomerAction(leadId: string) {
  const admin = await requireAdmin();
  await ensureLeadPipelineSchema(prisma);
  const adminId = ownerAdminId(admin);

  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({
      where: {
        id: leadId,
        ...adminOwnedWhere(admin)
      }
    });

    if (!lead || lead.eventType !== "wedding") {
      return { ok: false as const, message: "Ez a lead nem alakítható esküvős ügyféllé." };
    }

    const primaryEmail = lead.email?.trim().toLowerCase();

    if (!primaryEmail) {
      return { ok: false as const, message: "Az ügyfél létrehozásához előbb adj meg e-mail címet a leadnél." };
    }

    const existingCustomer = await tx.customer.findFirst({
      where: {
        adminId,
        primaryEmail: {
          equals: primaryEmail,
          mode: "insensitive"
        }
      },
      select: { id: true }
    });

    if (existingCustomer) {
      return {
        ok: true as const,
        customerId: existingCustomer.id,
        created: false
      };
    }

    const customer = await tx.customer.create({
      data: {
        adminId,
        customerType: "wedding_couple",
        coupleName: lead.name,
        primaryEmail,
        phone: lead.phone,
        weddingDate: lead.eventDate,
        venue: lead.venue,
        preferredLanguage: "de",
        portalToken: createCustomerPortalToken(),
        status: customerStatusForLead(lead.status),
        notes: lead.notes
      },
      select: { id: true }
    });

    await tx.lead.delete({ where: { id: lead.id } });

    return {
      ok: true as const,
      customerId: customer.id,
      created: true
    };
  });

  if (result.ok) {
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/clients");
    revalidatePath(`/admin/clients/${result.customerId}`);
  }

  return result;
}
