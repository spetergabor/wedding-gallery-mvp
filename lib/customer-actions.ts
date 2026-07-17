"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { customerAccessWhere, ownerAdminId } from "@/lib/admin-scope";
import { createCustomerPortalToken } from "@/lib/customer-portal";
import { normalizeCustomerMeetingStatus, normalizeCustomerMeetingType } from "@/lib/customer-meeting-options";
import { normalizeCustomerProjectStatus, normalizeCustomerProjectType } from "@/lib/customer-project-options";
import { normalizeCustomerTaskPriority, normalizeCustomerTaskStatus, normalizeCustomerTaskType } from "@/lib/customer-task-options";
import { normalizeCustomerStatus, normalizeCustomerType } from "@/lib/customer-options";
import { normalizeCustomerLanguage } from "@/lib/customer-language";
import {
  deleteCustomerMeetingFromGoogleCalendar,
  deleteCustomerProjectFromGoogleCalendar,
  deleteCustomerTaskFromGoogleCalendar,
  syncCustomerMeetingToGoogleCalendar,
  syncCustomerProjectToGoogleCalendar,
  syncCustomerTaskToGoogleCalendar
} from "@/lib/google-calendar-api";
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

function meetingTimePayload(formData: FormData) {
  const startTime = formTime(formData, "startTime");
  const endTime = formTime(formData, "endTime");

  if (!startTime.valid || !endTime.valid || !startTime.value || !endTime.value) {
    return null;
  }

  return {
    startTime: startTime.value,
    endTime: endTime.value
  };
}

function taskDueTimePayload(formData: FormData) {
  const dueTime = formTime(formData, "dueTime");

  return dueTime.valid ? dueTime.value : undefined;
}

async function customerProjectGoogleCalendarStatus(projectId: string) {
  try {
    const result = await syncCustomerProjectToGoogleCalendar(projectId);
    return result.status;
  } catch (error) {
    console.error("Customer project Google Calendar sync failed", error);
    return "error";
  }
}

function projectCalendarQuery(status: string) {
  return `&projectCalendar=${encodeURIComponent(status)}`;
}

async function projectIdForCustomer(admin: Awaited<ReturnType<typeof requireAdmin>>, customerId: string, projectId: string) {
  if (!projectId) {
    return null;
  }

  const project = await prisma.customerProject.findFirst({
    where: {
      id: projectId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: { id: true }
  });

  return project?.id ?? null;
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

  const project = await prisma.customerProject.create({
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
    },
    select: { id: true }
  });

  const googleCalendarStatus = await customerProjectGoogleCalendarStatus(project.id);

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=projects&projectCreated=1${projectCalendarQuery(googleCalendarStatus)}`);
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

  const googleCalendarStatus = await customerProjectGoogleCalendarStatus(project.id);

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=projects&projectUpdated=1${projectCalendarQuery(googleCalendarStatus)}`);
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

  const googleCalendarStatus = await customerProjectGoogleCalendarStatus(project.id);

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=projects&projectStatusUpdated=1${projectCalendarQuery(googleCalendarStatus)}`);
}

export async function syncCustomerProjectGoogleCalendarAction(customerId: string, projectId: string) {
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

  const googleCalendarStatus = await customerProjectGoogleCalendarStatus(project.id);

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=projects${projectCalendarQuery(googleCalendarStatus)}`);
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

  try {
    await deleteCustomerProjectFromGoogleCalendar(project.id);
  } catch (error) {
    console.error("Customer project Google Calendar delete failed", error);
  }

  await prisma.customerProject.delete({
    where: { id: project.id }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/galleries");
  redirect(`/admin/clients/${customerId}?tab=projects&projectDeleted=1`);
}

export async function createCustomerMeetingAction(customerId: string, formData: FormData) {
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
  const meetingTimes = meetingTimePayload(formData);

  if (!title || !eventDate) {
    redirect(`/admin/clients/${customerId}?tab=meetings&meetingError=missing`);
  }

  if (!meetingTimes) {
    redirect(`/admin/clients/${customerId}?tab=meetings&meetingError=time`);
  }

  const meeting = await prisma.customerMeeting.create({
    data: {
      customerId: customer.id,
      title,
      meetingType: normalizeCustomerMeetingType(formString(formData, "meetingType")),
      status: normalizeCustomerMeetingStatus(formString(formData, "status")),
      eventDate,
      startTime: meetingTimes.startTime,
      endTime: meetingTimes.endTime,
      location: formOptionalString(formData, "location"),
      notes: formOptionalString(formData, "notes")
    },
    select: { id: true }
  });

  try {
    await syncCustomerMeetingToGoogleCalendar(meeting.id);
  } catch (error) {
    console.error("Customer meeting Google Calendar sync failed", error);
  }

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=meetings&meetingCreated=1`);
}

export async function updateCustomerMeetingAction(customerId: string, meetingId: string, formData: FormData) {
  const admin = await requireAdmin();

  const meeting = await prisma.customerMeeting.findFirst({
    where: {
      id: meetingId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: { id: true }
  });

  if (!meeting) {
    redirect(`/admin/clients/${customerId}?tab=meetings&meetingError=missing`);
  }

  const title = formString(formData, "title");
  const eventDate = formDate(formData, "eventDate");
  const meetingTimes = meetingTimePayload(formData);

  if (!title || !eventDate) {
    redirect(`/admin/clients/${customerId}?tab=meetings&meetingError=missing`);
  }

  if (!meetingTimes) {
    redirect(`/admin/clients/${customerId}?tab=meetings&meetingError=time`);
  }

  await prisma.customerMeeting.update({
    where: { id: meeting.id },
    data: {
      title,
      meetingType: normalizeCustomerMeetingType(formString(formData, "meetingType")),
      status: normalizeCustomerMeetingStatus(formString(formData, "status")),
      eventDate,
      startTime: meetingTimes.startTime,
      endTime: meetingTimes.endTime,
      location: formOptionalString(formData, "location"),
      notes: formOptionalString(formData, "notes")
    }
  });

  try {
    await syncCustomerMeetingToGoogleCalendar(meeting.id);
  } catch (error) {
    console.error("Customer meeting Google Calendar sync failed", error);
  }

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=meetings&meetingUpdated=1`);
}

export async function updateCustomerMeetingStatusAction(customerId: string, meetingId: string, formData: FormData) {
  const admin = await requireAdmin();
  const status = normalizeCustomerMeetingStatus(formString(formData, "status"));

  const meeting = await prisma.customerMeeting.findFirst({
    where: {
      id: meetingId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: { id: true }
  });

  if (!meeting) {
    redirect(`/admin/clients/${customerId}?tab=meetings&meetingError=missing`);
  }

  await prisma.customerMeeting.update({
    where: { id: meeting.id },
    data: { status }
  });

  try {
    await syncCustomerMeetingToGoogleCalendar(meeting.id);
  } catch (error) {
    console.error("Customer meeting Google Calendar status sync failed", error);
  }

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=meetings&meetingStatusUpdated=1`);
}

export async function deleteCustomerMeetingAction(customerId: string, meetingId: string) {
  const admin = await requireAdmin();

  const meeting = await prisma.customerMeeting.findFirst({
    where: {
      id: meetingId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: { id: true }
  });

  if (!meeting) {
    redirect(`/admin/clients/${customerId}?tab=meetings&meetingError=missing`);
  }

  try {
    await deleteCustomerMeetingFromGoogleCalendar(meeting.id);
  } catch (error) {
    console.error("Customer meeting Google Calendar delete failed", error);
  }

  await prisma.customerMeeting.delete({
    where: { id: meeting.id }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=meetings&meetingDeleted=1`);
}

export async function createCustomerTaskAction(customerId: string, formData: FormData) {
  const admin = await requireAdmin();

  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  const title = formString(formData, "title");
  const dueDate = formDate(formData, "dueDate");
  const dueTime = taskDueTimePayload(formData);

  if (!title) {
    redirect(`/admin/clients/${customerId}?tab=tasks&taskError=missing`);
  }

  if (dueTime === undefined) {
    redirect(`/admin/clients/${customerId}?tab=tasks&taskError=time`);
  }

  const requestedProjectId = formString(formData, "projectId");
  const projectId = await projectIdForCustomer(admin, customer.id, requestedProjectId);

  if (requestedProjectId && !projectId) {
    redirect(`/admin/clients/${customerId}?tab=tasks&taskError=project`);
  }

  const status = normalizeCustomerTaskStatus(formString(formData, "status"));

  const task = await prisma.customerTask.create({
    data: {
      customerId: customer.id,
      projectId,
      title,
      taskType: normalizeCustomerTaskType(formString(formData, "taskType")),
      status,
      priority: normalizeCustomerTaskPriority(formString(formData, "priority")),
      dueDate,
      dueTime,
      notes: formOptionalString(formData, "notes"),
      completedAt: status === "done" ? new Date() : null
    }
  });

  try {
    await syncCustomerTaskToGoogleCalendar(task.id);
  } catch (error) {
    console.error("Customer task Google Calendar sync failed", error);
  }

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=tasks&taskCreated=1`);
}

export async function updateCustomerTaskAction(customerId: string, taskId: string, formData: FormData) {
  const admin = await requireAdmin();

  const task = await prisma.customerTask.findFirst({
    where: {
      id: taskId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: { id: true, customerId: true, status: true, completedAt: true }
  });

  if (!task) {
    redirect(`/admin/clients/${customerId}?tab=tasks&taskError=missing`);
  }

  const title = formString(formData, "title");
  const dueDate = formDate(formData, "dueDate");
  const dueTime = taskDueTimePayload(formData);

  if (!title) {
    redirect(`/admin/clients/${customerId}?tab=tasks&taskError=missing`);
  }

  if (dueTime === undefined) {
    redirect(`/admin/clients/${customerId}?tab=tasks&taskError=time`);
  }

  const requestedProjectId = formString(formData, "projectId");
  const projectId = await projectIdForCustomer(admin, task.customerId, requestedProjectId);

  if (requestedProjectId && !projectId) {
    redirect(`/admin/clients/${customerId}?tab=tasks&taskError=project`);
  }

  const status = normalizeCustomerTaskStatus(formString(formData, "status"));

  await prisma.customerTask.update({
    where: { id: task.id },
    data: {
      projectId,
      title,
      taskType: normalizeCustomerTaskType(formString(formData, "taskType")),
      status,
      priority: normalizeCustomerTaskPriority(formString(formData, "priority")),
      dueDate,
      dueTime,
      notes: formOptionalString(formData, "notes"),
      completedAt: status === "done" ? task.completedAt ?? new Date() : null
    }
  });

  try {
    await syncCustomerTaskToGoogleCalendar(task.id);
  } catch (error) {
    console.error("Customer task Google Calendar sync failed", error);
  }

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=tasks&taskUpdated=1`);
}

export async function updateCustomerTaskStatusAction(customerId: string, taskId: string, formData: FormData) {
  const admin = await requireAdmin();
  const status = normalizeCustomerTaskStatus(formString(formData, "status"));

  const task = await prisma.customerTask.findFirst({
    where: {
      id: taskId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: { id: true, completedAt: true }
  });

  if (!task) {
    redirect(`/admin/clients/${customerId}?tab=tasks&taskError=missing`);
  }

  await prisma.customerTask.update({
    where: { id: task.id },
    data: {
      status,
      completedAt: status === "done" ? task.completedAt ?? new Date() : null
    }
  });

  try {
    await syncCustomerTaskToGoogleCalendar(task.id);
  } catch (error) {
    console.error("Customer task Google Calendar status sync failed", error);
  }

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=tasks&taskStatusUpdated=1`);
}

export async function deleteCustomerTaskAction(customerId: string, taskId: string) {
  const admin = await requireAdmin();

  const task = await prisma.customerTask.findFirst({
    where: {
      id: taskId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: { id: true }
  });

  if (!task) {
    redirect(`/admin/clients/${customerId}?tab=tasks&taskError=missing`);
  }

  try {
    await deleteCustomerTaskFromGoogleCalendar(task.id);
  } catch (error) {
    console.error("Customer task Google Calendar delete failed", error);
  }

  await prisma.customerTask.delete({
    where: { id: task.id }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`/admin/clients/${customerId}?tab=tasks&taskDeleted=1`);
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
      },
      projects: {
        select: {
          id: true
        }
      },
      meetings: {
        select: {
          id: true
        }
      },
      tasks: {
        select: {
          id: true
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
  const projectIds = customer.projects.map((project) => project.id);
  const meetingIds = customer.meetings.map((meeting) => meeting.id);
  const taskIds = customer.tasks.map((task) => task.id);

  await Promise.all([
    ...projectIds.map((projectId) =>
      deleteCustomerProjectFromGoogleCalendar(projectId).catch((error) => {
        console.error("Customer project Google Calendar delete failed during customer delete", error);
      })
    ),
    ...meetingIds.map((meetingId) =>
      deleteCustomerMeetingFromGoogleCalendar(meetingId).catch((error) => {
        console.error("Customer meeting Google Calendar delete failed during customer delete", error);
      })
    ),
    ...taskIds.map((taskId) =>
      deleteCustomerTaskFromGoogleCalendar(taskId).catch((error) => {
        console.error("Customer task Google Calendar delete failed during customer delete", error);
      })
    )
  ]);

  await prisma.$transaction(async (tx) => {
    if (projectIds.length > 0) {
      await tx.miniSessionBooking.updateMany({
        where: {
          OR: [{ customerId: customer.id }, { projectId: { in: projectIds } }]
        },
        data: {
          customerId: null,
          projectId: null
        }
      });

      await tx.gallery.updateMany({
        where: { projectId: { in: projectIds } },
        data: { projectId: null }
      });
    } else {
      await tx.miniSessionBooking.updateMany({
        where: { customerId: customer.id },
        data: { customerId: null }
      });
    }

    await tx.gallery.updateMany({
      where: { customerId: customer.id },
      data: { customerId: null }
    });

    await tx.customer.delete({
      where: { id: customer.id }
    });
  });

  await Promise.all([...contractObjectKeys, ...invoiceObjectKeys, ...portalImageObjectKeys].map((key) => deletePhotoObject(key)));

  revalidatePath("/admin/clients");
  revalidatePath("/admin/galleries");
  revalidatePath("/admin/dashboard");
  redirect("/admin/clients?deleted=1");
}
