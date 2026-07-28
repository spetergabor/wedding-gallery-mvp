"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminOwnedWhere, ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import {
  isClosedCustomerTaskStatus,
  normalizeCustomerTaskPriority,
  normalizeCustomerTaskStatus,
  normalizeCustomerTaskType
} from "@/lib/customer-task-options";
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

function formTime(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    return null;
  }

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? value : undefined;
}

function dashboardPath(params: string) {
  return `/admin/dashboard?${params}#task-board`;
}

export async function createDashboardTaskAction(formData: FormData) {
  const admin = await requireAdmin();
  const workspaceAdminId = ownerAdminId(admin);
  const title = formString(formData, "title");
  const dueTime = formTime(formData, "dueTime");

  if (!title) {
    redirect(dashboardPath("taskError=missing"));
  }

  if (dueTime === undefined) {
    redirect(dashboardPath("taskError=time"));
  }

  const requestedCustomerId = formString(formData, "customerId");
  const customer = requestedCustomerId
    ? await prisma.customer.findFirst({
        where: {
          id: requestedCustomerId,
          ...adminOwnedWhere(admin)
        },
        select: { id: true }
      })
    : null;

  if (requestedCustomerId && !customer) {
    redirect(dashboardPath("taskError=customer"));
  }

  const status = normalizeCustomerTaskStatus(formString(formData, "status"));

  await prisma.customerTask.create({
    data: {
      adminId: workspaceAdminId,
      customerId: customer?.id ?? null,
      title,
      taskType: normalizeCustomerTaskType(formString(formData, "taskType")),
      status,
      priority: normalizeCustomerTaskPriority(formString(formData, "priority")),
      dueDate: formDate(formData, "dueDate"),
      dueTime,
      notes: formOptionalString(formData, "notes"),
      completedAt: isClosedCustomerTaskStatus(status) ? new Date() : null
    }
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  if (customer?.id) {
    revalidatePath(`/admin/clients/${customer.id}`);
  }
  redirect(dashboardPath("taskCreated=1"));
}

export async function updateDashboardTaskStatusAction(taskId: string, formData: FormData) {
  const admin = await requireAdmin();
  const status = normalizeCustomerTaskStatus(formString(formData, "status"));
  const task = await prisma.customerTask.findFirst({
    where: {
      id: taskId,
      OR: [
        { adminId: ownerAdminId(admin) },
        { customer: adminOwnedWhere(admin) }
      ]
    },
    select: {
      id: true,
      customerId: true,
      completedAt: true
    }
  });

  if (!task) {
    redirect(dashboardPath("taskError=missing"));
  }

  await prisma.customerTask.update({
    where: { id: task.id },
    data: {
      status,
      completedAt: isClosedCustomerTaskStatus(status) ? task.completedAt ?? new Date() : null
    }
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  if (task.customerId) {
    revalidatePath(`/admin/clients/${task.customerId}`);
  }
  redirect(dashboardPath("taskStatusUpdated=1"));
}

export async function deleteDashboardTaskAction(taskId: string) {
  const admin = await requireAdmin();
  const task = await prisma.customerTask.findFirst({
    where: {
      id: taskId,
      OR: [
        { adminId: ownerAdminId(admin) },
        { customer: adminOwnedWhere(admin) }
      ]
    },
    select: {
      id: true,
      customerId: true
    }
  });

  if (!task) {
    redirect(dashboardPath("taskError=missing"));
  }

  await prisma.customerTask.delete({
    where: { id: task.id }
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  if (task.customerId) {
    revalidatePath(`/admin/clients/${task.customerId}`);
  }
  redirect(dashboardPath("taskDeleted=1"));
}
