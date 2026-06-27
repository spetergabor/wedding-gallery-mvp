"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { adminOwnedWhere } from "@/lib/admin-scope";
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
      adminId: admin.id,
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
