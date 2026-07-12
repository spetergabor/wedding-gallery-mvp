"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { adminOwnedWhere, ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { DELIVERY_CHANNEL_EMAIL, runLoggedDelivery } from "@/lib/delivery-log";
import {
  deleteCustomerProjectFromGoogleCalendar,
  syncMiniSessionBookingToGoogleCalendar
} from "@/lib/google-calendar-api";
import {
  adminMiniSessionUrl,
  miniSessionBookingCalendarUrl,
  miniSessionBookingCancelUrl,
  miniSessionBookingRescheduleUrl,
  miniSessionPublicUrl,
  sendMiniSessionAdminBookingEmail,
  sendMiniSessionBookingCancelledEmail,
  sendMiniSessionBookingConfirmationEmail
} from "@/lib/email";
import { buildMiniSessionCalendarIcs, miniSessionCalendarFilename } from "@/lib/mini-session-calendar";
import { hasMiniSessionSlotConflict } from "@/lib/mini-session-availability";
import {
  cleanupMiniSessionBookingCustomerProject,
  linkMiniSessionBookingToCustomerProject,
  updateMiniSessionBookingCustomerProject
} from "@/lib/mini-session-customer-sync";
import {
  createMiniSessionSlots,
  type MiniSessionLanguage,
  MINI_SESSION_BOOKING_MODE_RECURRING,
  MINI_SESSION_BOOKING_MODE_SINGLE_DAY,
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_SOURCE_CLIENT,
  MINI_SESSION_BOOKING_SOURCE_MANUAL,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_COMPLETED,
  MINI_SESSION_BOOKING_STATUS_NO_SHOW,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  MINI_SESSION_WEEKDAYS,
  isMiniSessionSlotBookable,
  normalizeBookingWindowDays,
  normalizeMiniSessionMinBookingNoticeMinutes,
  normalizeMiniSessionLanguage,
  normalizeMiniSessionWeekday,
  parseMiniSessionLocalDateTime
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";
import { isAnyRateLimited } from "@/lib/rate-limit";
import { normalizeSlug } from "@/lib/slug";
import { logSystemEvent, systemEventErrorMessage } from "@/lib/system-events";
import {
  createMiniSessionCoverObjectKey,
  deletePhotoObject,
  getPhotoPublicUrl,
  savePhotoObject
} from "@/lib/storage";

const MINI_SESSION_COVER_MAX_BYTES = 12 * 1024 * 1024;
const MINI_SESSION_ADMIN_STATUS_VALUES = [
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_COMPLETED,
  MINI_SESSION_BOOKING_STATUS_NO_SHOW
] as const;

function normalizeAdminBookingStatus(value: FormDataEntryValue | null) {
  return typeof value === "string" && MINI_SESSION_ADMIN_STATUS_VALUES.includes(value as (typeof MINI_SESSION_ADMIN_STATUS_VALUES)[number])
    ? value
    : null;
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function miniSessionLanguageFromForm(formData: FormData) {
  return normalizeMiniSessionLanguage(formString(formData, "language"));
}

function miniSessionBookingModeFromForm(formData: FormData) {
  return formString(formData, "bookingMode") === MINI_SESSION_BOOKING_MODE_RECURRING
    ? MINI_SESSION_BOOKING_MODE_RECURRING
    : MINI_SESSION_BOOKING_MODE_SINGLE_DAY;
}

function miniSessionAvailabilityRulesFromForm(formData: FormData) {
  const selectedWeekdays = new Set(
    formData
      .getAll("availabilityWeekday")
      .map((value) => (typeof value === "string" ? normalizeMiniSessionWeekday(value) : null))
      .filter((value): value is number => value !== null)
  );

  return MINI_SESSION_WEEKDAYS
    .filter((weekday) => selectedWeekdays.has(weekday.value))
    .map((weekday) => ({
      weekday: weekday.value,
      startsAt: formString(formData, `availabilityStart-${weekday.value}`),
      endsAt: formString(formData, `availabilityEnd-${weekday.value}`)
    }))
    .filter((rule) => rule.startsAt && rule.endsAt && rule.endsAt > rule.startsAt);
}

function miniSessionMinBookingNoticeFromForm(formData: FormData) {
  return normalizeMiniSessionMinBookingNoticeMinutes(parseInteger(formString(formData, "minBookingNoticeMinutes"), 0));
}

function createCancelToken() {
  return randomBytes(32).toString("base64url");
}

async function uploadMiniSessionCover(adminId: string, file: FormDataEntryValue | null, errorPath = "/admin/mini-sessions") {
  const errorUrl = (code: string) => `${errorPath}${errorPath.includes("?") ? "&" : "?"}error=${code}`;

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  if (!file.type.startsWith("image/")) {
    redirect(errorUrl("cover"));
  }

  if (file.size > MINI_SESSION_COVER_MAX_BYTES) {
    redirect(errorUrl("cover_size"));
  }

  const r2Key = createMiniSessionCoverObjectKey({
    adminId,
    originalFilename: file.name
  });
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await savePhotoObject({
      r2Key,
      bytes,
      contentType: file.type
    });
  } catch (error) {
    console.error("Mini session cover upload failed", {
      adminId,
      r2Key,
      storageDriver: process.env.STORAGE_DRIVER,
      error
    });
    redirect(errorUrl("cover_upload"));
  }

  return {
    r2Key,
    url: getPhotoPublicUrl(r2Key)
  };
}

function uploadedMiniSessionCoverFromForm(formData: FormData, adminId: string, errorPath = "/admin/mini-sessions") {
  const r2Key = formString(formData, "uploadedCoverImageR2Key");

  if (!r2Key) {
    return null;
  }

  if (!r2Key.startsWith(`mini-sessions/${adminId}/covers/`)) {
    redirect(`${errorPath}${errorPath.includes("?") ? "&" : "?"}error=cover`);
  }

  return {
    r2Key,
    url: getPhotoPublicUrl(r2Key)
  };
}

function miniSessionCalendarUid(bookingId: string) {
  return `mini-session-${bookingId}@spetly.app`;
}

async function deleteLinkedMiniSessionProjectCalendarEvent(projectId: string | null) {
  if (!projectId) {
    return;
  }

  try {
    await deleteCustomerProjectFromGoogleCalendar(projectId);
  } catch (error) {
    console.error("Mini session linked customer project Google Calendar delete failed", error);
  }
}

async function rescheduleMiniSessionBookingRecord({
  bookingId,
  slot,
  session
}: {
  bookingId: string;
  slot: { startsAt: Date; endsAt: Date };
  session: {
    id: string;
    adminId: string;
    title: string;
    location: string;
    language: string;
  };
}) {
  return prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.miniSessionBooking.update({
      where: { id: bookingId },
      data: {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt
      }
    });

    await updateMiniSessionBookingCustomerProject({
      tx,
      session,
      booking: updatedBooking
    });

    return updatedBooking;
  });
}

function miniSessionCalendarDescription({
  location,
  name,
  email,
  phone,
  attendeeCount,
  cancelUrl,
  adminUrl,
  status,
  language = "hu"
}: {
  location: string;
  name: string;
  email: string;
  phone: string;
  attendeeCount: number;
  cancelUrl?: string;
  adminUrl?: string;
  status?: "booked" | "cancelled";
  language?: MiniSessionLanguage;
}) {
  const copy =
    language === "de"
      ? {
          booked: "Mini-Session-Buchung.",
          cancelled: "Die Mini-Session-Buchung wurde storniert.",
          location: "Ort",
          name: "Name",
          email: "E-Mail",
          phone: "Telefon",
          attendeeCount: "Personen",
          cancel: "Termin stornieren",
          admin: "Admin"
        }
      : {
          booked: "Mini session foglalás.",
          cancelled: "A mini session foglalás törölve lett.",
          location: "Helyszín",
          name: "Név",
          email: "Email",
          phone: "Telefon",
          attendeeCount: "Létszám",
          cancel: "Időpont törlése",
          admin: "Admin"
        };

  return [
    status === "cancelled" ? copy.cancelled : copy.booked,
    `${copy.location}: ${location}`,
    `${copy.name}: ${name}`,
    `${copy.email}: ${email}`,
    `${copy.phone}: ${phone}`,
    `${copy.attendeeCount}: ${attendeeCount}`,
    cancelUrl ? `${copy.cancel}: ${cancelUrl}` : null,
    adminUrl ? `${copy.admin}: ${adminUrl}` : null
  ].filter(Boolean).join("\n");
}

export async function createMiniSessionAction(formData: FormData) {
  const admin = await requireAdmin();
  const workspaceAdminId = ownerAdminId(admin);
  const title = formString(formData, "title");
  const location = formString(formData, "location");
  const date = formString(formData, "date");
  const startTime = formString(formData, "startTime");
  const endTime = formString(formData, "endTime");
  const durationMinutes = Math.max(5, parseInteger(formString(formData, "durationMinutes"), 20));
  const bookingMode = miniSessionBookingModeFromForm(formData);
  const endDate = bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING ? date : formString(formData, "endDate") || date;
  const bookingWindowDays = normalizeBookingWindowDays(parseInteger(formString(formData, "bookingWindowDays"), 60));
  const minBookingNoticeMinutes = miniSessionMinBookingNoticeFromForm(formData);
  const availabilityRules = bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING ? miniSessionAvailabilityRulesFromForm(formData) : [];
  const createCustomerOnBooking = formData.get("createCustomerOnBooking") === "on";
  const language = miniSessionLanguageFromForm(formData);
  const notes = formString(formData, "notes");
  const stylingNotes = formString(formData, "stylingNotes");
  const slug = normalizeSlug(formString(formData, "slug") || title);
  const startsAt = parseMiniSessionLocalDateTime(date, startTime);
  const sameDayEndsAt = parseMiniSessionLocalDateTime(date, endTime);
  const endsAt = parseMiniSessionLocalDateTime(endDate, endTime);

  if (!title || !location || !slug || !startsAt || !sameDayEndsAt || !endsAt || sameDayEndsAt <= startsAt || endsAt <= startsAt) {
    redirect("/admin/mini-sessions?error=missing");
  }

  const uploadedCover =
    uploadedMiniSessionCoverFromForm(formData, workspaceAdminId) ??
    (await uploadMiniSessionCover(workspaceAdminId, formData.get("coverImage")));
  let miniSession: { id: string };

  try {
    miniSession = await prisma.miniSession.create({
      data: {
        adminId: workspaceAdminId,
        title,
        slug,
        location,
        bookingMode,
        bookingWindowDays,
        sessionDate: parseMiniSessionLocalDateTime(date, "12:00") ?? startsAt,
        startsAt,
        endsAt,
        durationMinutes,
        minBookingNoticeMinutes,
        language,
        isActive: formData.get("isActive") === "on",
        createCustomerOnBooking,
        notes: notes || null,
        stylingNotes: stylingNotes || null,
        coverImageUrl: uploadedCover?.url ?? null,
        coverImageR2Key: uploadedCover?.r2Key ?? null,
        availabilityRules: availabilityRules.length > 0 ? { create: availabilityRules } : undefined
      }
    });
  } catch (error) {
    if (uploadedCover) {
      await deletePhotoObject(uploadedCover.r2Key);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/admin/mini-sessions?error=slug");
    }

    throw error;
  }

  revalidatePath("/admin/mini-sessions");
  redirect(`/admin/mini-sessions/${miniSession.id}?created=1`);
}

export async function createAdminCalendarBlockAction(formData: FormData) {
  const admin = await requireAdmin();
  const workspaceAdminId = ownerAdminId(admin);
  const title = formString(formData, "title") || "Blokkolt időszak";
  const startDate = formString(formData, "startDate");
  const endDate = formString(formData, "endDate") || startDate;
  const startTime = formString(formData, "startTime") || "00:00";
  const endTime = formString(formData, "endTime") || "23:59";
  const notes = formString(formData, "notes");
  const startsAt = parseMiniSessionLocalDateTime(startDate, startTime);
  let endsAt = parseMiniSessionLocalDateTime(endDate, endTime);

  if (startsAt && endsAt && endsAt <= startsAt) {
    endsAt = parseMiniSessionLocalDateTime(endDate, "23:59");
  }

  if (!startsAt || !endsAt || endsAt <= startsAt) {
    redirect("/admin/mini-sessions?tab=calendar&calendarError=missing");
  }

  await prisma.adminCalendarBlock.create({
    data: {
      adminId: workspaceAdminId,
      title,
      startsAt,
      endsAt,
      notes: notes || null
    }
  });

  revalidatePath("/admin/mini-sessions");
  revalidatePath("/mini-session/[slug]", "page");
  redirect("/admin/mini-sessions?tab=calendar&calendarBlocked=1");
}

export async function deleteAdminCalendarBlockAction(id: string) {
  const admin = await requireAdmin();
  const block = await prisma.adminCalendarBlock.findFirst({
    where: {
      id,
      adminId: ownerAdminId(admin)
    },
    select: { id: true }
  });

  if (!block) {
    redirect("/admin/mini-sessions?tab=calendar");
  }

  await prisma.adminCalendarBlock.delete({
    where: { id: block.id }
  });

  revalidatePath("/admin/mini-sessions");
  revalidatePath("/mini-session/[slug]", "page");
  redirect("/admin/mini-sessions?tab=calendar&calendarDeleted=1");
}

export async function updateMiniSessionAction(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const current = await prisma.miniSession.findFirst({
    where: { id, ...adminOwnedWhere(admin) },
    select: { id: true, slug: true }
  });

  if (!current) {
    redirect("/admin/mini-sessions");
  }

  const title = formString(formData, "title");
  const location = formString(formData, "location");
  const date = formString(formData, "date");
  const startTime = formString(formData, "startTime");
  const endTime = formString(formData, "endTime");
  const durationMinutes = Math.max(5, parseInteger(formString(formData, "durationMinutes"), 20));
  const bookingMode = miniSessionBookingModeFromForm(formData);
  const endDate = bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING ? date : formString(formData, "endDate") || date;
  const bookingWindowDays = normalizeBookingWindowDays(parseInteger(formString(formData, "bookingWindowDays"), 60));
  const minBookingNoticeMinutes = miniSessionMinBookingNoticeFromForm(formData);
  const availabilityRules = bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING ? miniSessionAvailabilityRulesFromForm(formData) : [];
  const createCustomerOnBooking = formData.get("createCustomerOnBooking") === "on";
  const language = miniSessionLanguageFromForm(formData);
  const notes = formString(formData, "notes");
  const stylingNotes = formString(formData, "stylingNotes");
  const slug = normalizeSlug(formString(formData, "slug") || title);
  const startsAt = parseMiniSessionLocalDateTime(date, startTime);
  const sameDayEndsAt = parseMiniSessionLocalDateTime(date, endTime);
  const endsAt = parseMiniSessionLocalDateTime(endDate, endTime);

  if (!title || !location || !slug || !startsAt || !sameDayEndsAt || !endsAt || sameDayEndsAt <= startsAt || endsAt <= startsAt) {
    redirect(`/admin/mini-sessions/${id}?tab=settings&error=missing`);
  }

  try {
    await prisma.miniSession.update({
      where: { id },
      data: {
        title,
        slug,
        location,
        bookingMode,
        bookingWindowDays,
        sessionDate: parseMiniSessionLocalDateTime(date, "12:00") ?? startsAt,
        startsAt,
        endsAt,
        durationMinutes,
        minBookingNoticeMinutes,
        language,
        isActive: formData.get("isActive") === "on",
        createCustomerOnBooking,
        notes: notes || null,
        stylingNotes: stylingNotes || null,
        availabilityRules: {
          deleteMany: {},
          create: availabilityRules
        }
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`/admin/mini-sessions/${id}?tab=settings&error=slug`);
    }

    throw error;
  }

  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${id}`);
  revalidatePath(`/mini-session/${current.slug}`);
  revalidatePath(`/mini-session/${slug}`);
  redirect(`/admin/mini-sessions/${id}?tab=settings&updated=1`);
}

export async function updateMiniSessionCoverAction(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const workspaceAdminId = ownerAdminId(admin);
  const current = await prisma.miniSession.findFirst({
    where: { id, ...adminOwnedWhere(admin) },
    select: { id: true, slug: true, coverImageR2Key: true }
  });

  if (!current) {
    redirect("/admin/mini-sessions");
  }

  const uploadedCover = await uploadMiniSessionCover(workspaceAdminId, formData.get("coverImage"), `/admin/mini-sessions/${id}?tab=settings`);

  if (!uploadedCover) {
    redirect(`/admin/mini-sessions/${id}?tab=settings&error=cover_missing`);
  }

  try {
    await prisma.miniSession.update({
      where: { id },
      data: {
        coverImageUrl: uploadedCover.url,
        coverImageR2Key: uploadedCover.r2Key
      }
    });
  } catch (error) {
    await deletePhotoObject(uploadedCover.r2Key);
    throw error;
  }

  if (current.coverImageR2Key && current.coverImageR2Key !== uploadedCover.r2Key) {
    await deletePhotoObject(current.coverImageR2Key);
  }

  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${id}`);
  revalidatePath(`/mini-session/${current.slug}`);
  redirect(`/admin/mini-sessions/${id}?tab=settings&coverUpdated=1`);
}

export async function deleteMiniSessionCoverAction(id: string) {
  const admin = await requireAdmin();
  const current = await prisma.miniSession.findFirst({
    where: { id, ...adminOwnedWhere(admin) },
    select: { id: true, slug: true, coverImageR2Key: true }
  });

  if (!current) {
    redirect("/admin/mini-sessions");
  }

  await prisma.miniSession.update({
    where: { id },
    data: {
      coverImageUrl: null,
      coverImageR2Key: null
    }
  });

  if (current.coverImageR2Key) {
    await deletePhotoObject(current.coverImageR2Key);
  }

  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${id}`);
  revalidatePath(`/mini-session/${current.slug}`);
  redirect(`/admin/mini-sessions/${id}?tab=settings&coverDeleted=1`);
}

export async function deleteMiniSessionAction(id: string) {
  const admin = await requireAdmin();
  const miniSession = await prisma.miniSession.findFirst({
    where: { id, ...adminOwnedWhere(admin) },
    select: { id: true, slug: true, coverImageR2Key: true }
  });

  if (!miniSession) {
    redirect("/admin/mini-sessions");
  }

  await prisma.miniSession.delete({
    where: { id: miniSession.id }
  });

  if (miniSession.coverImageR2Key) {
    await deletePhotoObject(miniSession.coverImageR2Key);
  }

  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/mini-session/${miniSession.slug}`);
  redirect("/admin/mini-sessions?deleted=1");
}

export async function createAdminMiniSessionBookingAction(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const selectedSlot = formString(formData, "slot");
  const source =
    formString(formData, "source") === MINI_SESSION_BOOKING_SOURCE_BLOCKED
      ? MINI_SESSION_BOOKING_SOURCE_BLOCKED
      : MINI_SESSION_BOOKING_SOURCE_MANUAL;
  const rawName = formString(formData, "name");
  const rawEmail = normalizeEmail(formString(formData, "email"));
  const rawPhone = formString(formData, "phone");
  const attendeeCount = Math.max(1, parseInteger(formString(formData, "attendeeCount"), 1));
  const adminNote = formString(formData, "adminNote");

  const session = await prisma.miniSession.findFirst({
    where: { id, ...adminOwnedWhere(admin) },
    include: {
      availabilityRules: true,
      admin: {
        select: {
          name: true,
          email: true,
          siteSettings: {
            select: {
              publicSubdomain: true
            }
          }
        }
      }
    }
  });

  if (!session) {
    redirect("/admin/mini-sessions");
  }

  const slot = createMiniSessionSlots(session).find((candidate) => candidate.token === selectedSlot);

  if (!slot) {
    redirect(`/admin/mini-sessions/${session.id}?tab=slots&error=slot`);
  }

  if (!isMiniSessionSlotBookable(slot, session.minBookingNoticeMinutes)) {
    redirect(`/admin/mini-sessions/${session.id}?tab=slots&error=notice`);
  }

  if (await hasMiniSessionSlotConflict(session.adminId, slot)) {
    redirect(`/admin/mini-sessions/${session.id}?tab=slots&error=taken`);
  }

  if (source === MINI_SESSION_BOOKING_SOURCE_MANUAL && !rawName) {
    redirect(`/admin/mini-sessions/${session.id}?tab=slots&error=missing`);
  }

  if (rawEmail && !isValidEmail(rawEmail)) {
    redirect(`/admin/mini-sessions/${session.id}?tab=slots&error=missing`);
  }

  const name =
    source === MINI_SESSION_BOOKING_SOURCE_BLOCKED
      ? adminNote || "Blokkolt idősáv"
      : rawName;
  const email = rawEmail || session.admin.email;
  const phone = rawPhone || "-";
  const cancelToken = createCancelToken();

  const booking = await prisma.$transaction(async (tx) => {
    const existing = await tx.miniSessionBooking.findFirst({
      where: {
        miniSessionId: session.id,
        startsAt: slot.startsAt,
        status: MINI_SESSION_BOOKING_STATUS_BOOKED
      },
      select: { id: true }
    });

    if (existing) {
      return null;
    }

    const createdBooking = await tx.miniSessionBooking.create({
      data: {
        miniSessionId: session.id,
        name,
        email,
        phone,
        attendeeCount: source === MINI_SESSION_BOOKING_SOURCE_BLOCKED ? 0 : attendeeCount,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: MINI_SESSION_BOOKING_STATUS_BOOKED,
        source,
        adminNote: adminNote || null,
        cancelToken
      }
    });

    if (source === MINI_SESSION_BOOKING_SOURCE_BLOCKED || !session.createCustomerOnBooking) {
      return createdBooking;
    }

    return linkMiniSessionBookingToCustomerProject({
      tx,
      session,
      booking: createdBooking
    });
  }).catch((error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`/admin/mini-sessions/${session.id}?tab=slots&error=taken`);
    }

    throw error;
  });

  if (!booking) {
    redirect(`/admin/mini-sessions/${session.id}?tab=slots&error=taken`);
  }

  let googleCalendarSyncStatus = "not_run";

  try {
    const googleCalendarSync = await syncMiniSessionBookingToGoogleCalendar(booking.id);
    googleCalendarSyncStatus = googleCalendarSync.status;
  } catch (error) {
    googleCalendarSyncStatus = "failed";
    console.error("Mini session Google Calendar sync failed", error);
    await logSystemEvent({
      actorAdminId: admin.id,
      targetAdminId: session.adminId,
      type: "google_calendar.mini_session_booking.sync_failed",
      title: "Google Calendar szinkron hiba",
      message: systemEventErrorMessage(error),
      severity: "error",
      status: "failed",
      source: "google_calendar",
      href: `/admin/mini-sessions/${session.id}`,
      metadata: {
        bookingId: booking.id,
        sessionId: session.id,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString()
      }
    });
  }

  await logSystemEvent({
    actorAdminId: admin.id,
    targetAdminId: session.adminId,
    type: source === MINI_SESSION_BOOKING_SOURCE_BLOCKED ? "mini_session.slot.blocked" : "mini_session.booking.created_by_admin",
    title: source === MINI_SESSION_BOOKING_SOURCE_BLOCKED ? "Idősáv blokkolva" : "Admin foglalás létrehozva",
    message: `${name} · ${session.title}`,
    severity: "success",
    status: "success",
    source: "mini_session",
    href: `/admin/mini-sessions/${session.id}?tab=bookings`,
    metadata: {
      bookingId: booking.id,
      sessionId: session.id,
      bookingSource: source,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      googleCalendarSyncStatus,
      customerId: booking.customerId ?? null,
      projectId: booking.projectId ?? null
    }
  });

  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${session.id}`);
  revalidatePath(`/mini-session/${session.slug}`);
  redirect(`/admin/mini-sessions/${session.id}?tab=slots&adminBooking=1`);
}

export async function bookMiniSessionAction(slug: string, formData: FormData) {
  const selectedSlot = formString(formData, "slot");
  const name = formString(formData, "name");
  const email = normalizeEmail(formString(formData, "email"));
  const phone = formString(formData, "phone");
  const attendeeCount = Math.max(1, parseInteger(formString(formData, "attendeeCount"), 1));
  const bookingPath = formString(formData, "returnTo") === "embed" ? `/mini-session/${slug}/embed` : `/mini-session/${slug}`;

  if (!selectedSlot || !name || !isValidEmail(email) || !phone) {
    redirect(`${bookingPath}?error=missing`);
  }

  if (
    await isAnyRateLimited([
      { scope: "public:mini-session-book:email", limit: 4, windowSeconds: 30 * 60, identifier: `${slug}:${email}` },
      { scope: "public:mini-session-book:ip", limit: 25, windowSeconds: 15 * 60, identifier: slug }
    ])
  ) {
    redirect(`${bookingPath}?error=rate_limit`);
  }

  const session = await prisma.miniSession.findUnique({
    where: { slug },
    include: {
      availabilityRules: true,
      admin: {
        select: {
          name: true,
          email: true,
          siteSettings: {
            select: {
              publicSubdomain: true
            }
          }
        }
      }
    }
  });

  if (!session || !session.isActive) {
    redirect(`${bookingPath}?error=inactive`);
  }

  const slot = createMiniSessionSlots(session).find((candidate) => candidate.token === selectedSlot);

  if (!slot) {
    redirect(`${bookingPath}?error=slot`);
  }

  if (!isMiniSessionSlotBookable(slot, session.minBookingNoticeMinutes)) {
    redirect(`${bookingPath}?error=notice`);
  }

  if (await hasMiniSessionSlotConflict(session.adminId, slot)) {
    redirect(`${bookingPath}?error=taken`);
  }

  const cancelToken = createCancelToken();

  const booking = await prisma.$transaction(async (tx) => {
    const existing = await tx.miniSessionBooking.findFirst({
      where: {
        miniSessionId: session.id,
        startsAt: slot.startsAt,
        status: MINI_SESSION_BOOKING_STATUS_BOOKED
      },
      select: { id: true }
    });

    if (existing) {
      return null;
    }

    const createdBooking = await tx.miniSessionBooking.create({
      data: {
        miniSessionId: session.id,
        name,
        email,
        phone,
        attendeeCount,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        source: MINI_SESSION_BOOKING_SOURCE_CLIENT,
        cancelToken
      }
    });

    if (!session.createCustomerOnBooking) {
      return createdBooking;
    }

    return linkMiniSessionBookingToCustomerProject({
      tx,
      session,
      booking: createdBooking
    });
  }).catch((error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`${bookingPath}?error=taken`);
    }

    throw error;
  });

  if (!booking) {
    redirect(`${bookingPath}?error=taken`);
  }

  const publicSubdomain = session.admin.siteSettings?.publicSubdomain ?? null;
  const cancelUrl = miniSessionBookingCancelUrl(slug, cancelToken, publicSubdomain);
  const rescheduleUrl = miniSessionBookingRescheduleUrl(slug, cancelToken, publicSubdomain);
  const calendarUrl = miniSessionBookingCalendarUrl(slug, cancelToken, publicSubdomain);
  const adminUrl = adminMiniSessionUrl(session.id);
  const publicUrl = miniSessionPublicUrl(session.slug, publicSubdomain);
  const calendarFilename = miniSessionCalendarFilename(session.title);
  const language = normalizeMiniSessionLanguage(session.language);
  const customerCalendarIcs = buildMiniSessionCalendarIcs({
    uid: miniSessionCalendarUid(booking.id),
    sessionTitle: session.title,
    location: session.location,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    url: calendarUrl,
    description: miniSessionCalendarDescription({
      location: session.location,
      name,
      email,
      phone,
      attendeeCount,
      cancelUrl,
      language
    })
  });
  const adminCalendarIcs = buildMiniSessionCalendarIcs({
    uid: miniSessionCalendarUid(booking.id),
    sessionTitle: session.title,
    location: session.location,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    url: adminUrl,
    description: miniSessionCalendarDescription({
      location: session.location,
      name,
      email,
      phone,
      attendeeCount,
      adminUrl
    })
  });
  let customerEmailSentAt: Date | null = null;
  let adminEmailSentAt: Date | null = null;

  let googleCalendarSyncStatus = "not_run";

  try {
    const googleCalendarSync = await syncMiniSessionBookingToGoogleCalendar(booking.id);
    googleCalendarSyncStatus = googleCalendarSync.status;
  } catch (error) {
    googleCalendarSyncStatus = "failed";
    console.error("Mini session Google Calendar sync failed", error);
    await logSystemEvent({
      targetAdminId: session.adminId,
      type: "google_calendar.mini_session_booking.sync_failed",
      title: "Google Calendar szinkron hiba",
      message: systemEventErrorMessage(error),
      severity: "error",
      status: "failed",
      source: "google_calendar",
      href: adminUrl,
      metadata: {
        bookingId: booking.id,
        sessionId: session.id,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString()
      }
    });
  }

  try {
    const delivery = await runLoggedDelivery({
      adminId: session.adminId,
      channel: DELIVERY_CHANNEL_EMAIL,
      type: "email.mini_session.customer_confirmation",
      recipient: email,
      subject: `${session.title} visszaigazolás`,
      provider: "resend",
      entityType: "mini_session_booking",
      entityId: booking.id,
      metadata: {
        sessionId: session.id,
        recipient: email,
        source: "booking_created"
      },
      send: () => sendMiniSessionBookingConfirmationEmail({
        to: email,
        replyTo: session.admin.email,
        senderName: session.admin.name,
        sessionTitle: session.title,
        sessionDate: booking.startsAt,
        location: session.location,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        name,
        attendeeCount,
        cancelUrl,
        rescheduleUrl,
        calendarUrl,
        calendarIcs: customerCalendarIcs,
        calendarFilename,
        calendarButtonLabel: language === "de" ? "Zum Kalender hinzufügen" : "Naptárhoz adás",
        language
      })
    });
    customerEmailSentAt = delivery.ok ? delivery.log.sentAt ?? new Date() : null;
    if (!delivery.ok) {
      await logSystemEvent({
        targetAdminId: session.adminId,
        type: "email.mini_session.customer_confirmation.failed",
        title: "Ügyfél visszaigazoló email nem ment ki",
        message: delivery.errorMessage || `${name} · ${email}`,
        severity: "warning",
        status: delivery.status === "retry" ? "warning" : "failed",
        source: "email",
        href: adminUrl,
        metadata: {
          bookingId: booking.id,
          sessionId: session.id,
          recipient: email,
          deliveryLogId: delivery.log.id,
          deliveryStatus: delivery.status
        }
      });
    }
  } catch (error) {
    console.error("Mini session customer email failed", error);
    await logSystemEvent({
      targetAdminId: session.adminId,
      type: "email.mini_session.customer_confirmation.failed",
      title: "Ügyfél visszaigazoló email hiba",
      message: systemEventErrorMessage(error),
      severity: "error",
      status: "failed",
      source: "email",
      href: adminUrl,
      metadata: {
        bookingId: booking.id,
        sessionId: session.id,
        recipient: email
      }
    });
  }

  try {
    const delivery = await runLoggedDelivery({
      adminId: session.adminId,
      channel: DELIVERY_CHANNEL_EMAIL,
      type: "email.mini_session.admin_notification",
      recipient: session.admin.email,
      subject: `Új mini session foglalás: ${session.title}`,
      provider: "resend",
      entityType: "mini_session_booking",
      entityId: booking.id,
      metadata: {
        sessionId: session.id,
        recipient: session.admin.email,
        source: "booking_created"
      },
      send: () => sendMiniSessionAdminBookingEmail({
        to: session.admin.email,
        replyTo: email,
        sessionTitle: session.title,
        sessionDate: booking.startsAt,
        location: session.location,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        name,
        email,
        phone,
        attendeeCount,
        adminUrl,
        publicUrl,
        calendarUrl,
        calendarIcs: adminCalendarIcs,
        calendarFilename
      })
    });
    adminEmailSentAt = delivery.ok ? delivery.log.sentAt ?? new Date() : null;
    if (!delivery.ok) {
      await logSystemEvent({
        targetAdminId: session.adminId,
        type: "email.mini_session.admin_notification.failed",
        title: "Admin értesítő email nem ment ki",
        message: delivery.errorMessage || `${session.title} · ${name}`,
        severity: "warning",
        status: delivery.status === "retry" ? "warning" : "failed",
        source: "email",
        href: adminUrl,
        metadata: {
          bookingId: booking.id,
          sessionId: session.id,
          recipient: session.admin.email,
          deliveryLogId: delivery.log.id,
          deliveryStatus: delivery.status
        }
      });
    }
  } catch (error) {
    console.error("Mini session admin email failed", error);
    await logSystemEvent({
      targetAdminId: session.adminId,
      type: "email.mini_session.admin_notification.failed",
      title: "Admin értesítő email hiba",
      message: systemEventErrorMessage(error),
      severity: "error",
      status: "failed",
      source: "email",
      href: adminUrl,
      metadata: {
        bookingId: booking.id,
        sessionId: session.id,
        recipient: session.admin.email
      }
    });
  }

  if (customerEmailSentAt || adminEmailSentAt) {
    await prisma.miniSessionBooking.update({
      where: { id: booking.id },
      data: { customerEmailSentAt, adminEmailSentAt }
    });
  }

  await logSystemEvent({
    targetAdminId: session.adminId,
    type: "mini_session.booking.created",
    title: "Új mini session foglalás",
    message: `${name} · ${session.title}`,
    severity: "success",
    status: "success",
    source: "mini_session",
    href: adminUrl,
    metadata: {
      bookingId: booking.id,
      sessionId: session.id,
      email,
      phone,
      attendeeCount,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      googleCalendarSyncStatus,
      customerEmailSent: Boolean(customerEmailSentAt),
      adminEmailSent: Boolean(adminEmailSentAt),
      customerId: booking.customerId ?? null,
      projectId: booking.projectId ?? null
    }
  });

  revalidatePath(`/mini-session/${slug}`);
  revalidatePath(`/mini-session/${slug}/embed`);
  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${session.id}`);
  redirect(`${bookingPath}?booked=1&calendar=${cancelToken}`);
}

export async function rescheduleMiniSessionBookingAction(token: string, formData: FormData) {
  const selectedSlot = formString(formData, "slot");
  const booking = await prisma.miniSessionBooking.findUnique({
    where: { cancelToken: token },
    include: {
      miniSession: {
        include: {
          availabilityRules: true
        }
      }
    }
  });

  if (!booking) {
    redirect("/mini-session/cancelled?error=missing");
  }

  const slug = booking.miniSession.slug;

  if (
    await isAnyRateLimited([
      { scope: "public:mini-session-reschedule:token", limit: 8, windowSeconds: 15 * 60, identifier: token },
      { scope: "public:mini-session-reschedule:ip", limit: 30, windowSeconds: 15 * 60, identifier: slug }
    ])
  ) {
    redirect(`/mini-session/${slug}/reschedule/${token}?error=rate_limit`);
  }

  if (booking.status !== MINI_SESSION_BOOKING_STATUS_BOOKED) {
    redirect(`/mini-session/${slug}/reschedule/${token}?error=cancelled`);
  }

  const slot = createMiniSessionSlots(booking.miniSession).find((candidate) => candidate.token === selectedSlot);

  if (!slot) {
    redirect(`/mini-session/${slug}/reschedule/${token}?error=slot`);
  }

  if (!isMiniSessionSlotBookable(slot, booking.miniSession.minBookingNoticeMinutes)) {
    redirect(`/mini-session/${slug}/reschedule/${token}?error=notice`);
  }

  if (
    await hasMiniSessionSlotConflict(booking.miniSession.adminId, slot, {
      excludeBookingId: booking.id,
      excludeProjectId: booking.projectId
    })
  ) {
    redirect(`/mini-session/${slug}/reschedule/${token}?error=taken`);
  }

  await rescheduleMiniSessionBookingRecord({
    bookingId: booking.id,
    slot,
    session: booking.miniSession
  });

  let googleCalendarSyncStatus = "not_run";

  try {
    const googleCalendarSync = await syncMiniSessionBookingToGoogleCalendar(booking.id);
    googleCalendarSyncStatus = googleCalendarSync.status;
  } catch (error) {
    googleCalendarSyncStatus = "failed";
    console.error("Mini session Google Calendar reschedule sync failed", error);
    await logSystemEvent({
      targetAdminId: booking.miniSession.adminId,
      type: "google_calendar.mini_session_booking.sync_failed",
      title: "Google Calendar átütemezési sync hiba",
      message: systemEventErrorMessage(error),
      severity: "error",
      status: "failed",
      source: "google_calendar",
      href: `/admin/mini-sessions/${booking.miniSession.id}`,
      metadata: {
        bookingId: booking.id,
        sessionId: booking.miniSession.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString()
      }
    });
  }

  await logSystemEvent({
    targetAdminId: booking.miniSession.adminId,
    type: "mini_session.booking.rescheduled",
    title: "Foglalás átütemezve",
    message: `${booking.name} · ${booking.miniSession.title}`,
    severity: "success",
    status: "success",
    source: "mini_session",
    href: `/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`,
    metadata: {
      bookingId: booking.id,
      sessionId: booking.miniSession.id,
      email: booking.email,
      previousStartsAt: booking.startsAt.toISOString(),
      previousEndsAt: booking.endsAt.toISOString(),
      newStartsAt: slot.startsAt.toISOString(),
      newEndsAt: slot.endsAt.toISOString(),
      googleCalendarSyncStatus
    }
  });

  revalidatePath(`/mini-session/${slug}`);
  revalidatePath(`/mini-session/${slug}/reschedule/${token}`);
  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
  if (booking.customerId) {
    revalidatePath(`/admin/clients/${booking.customerId}`);
  }
  redirect(`/mini-session/${slug}/reschedule/${token}?rescheduled=1&calendar=${token}`);
}

export async function rescheduleMiniSessionBookingByAdminAction(bookingId: string, formData: FormData) {
  const admin = await requireAdmin();
  const selectedSlot = formString(formData, "slot");
  const returnTab = formData.get("returnTab") === "slots" ? "slots" : "bookings";
  const booking = await prisma.miniSessionBooking.findFirst({
    where: {
      id: bookingId,
      miniSession: adminOwnedWhere(admin)
    },
    include: {
      miniSession: {
        include: {
          availabilityRules: true
        }
      }
    }
  });

  if (!booking) {
    redirect("/admin/mini-sessions");
  }

  if (booking.status !== MINI_SESSION_BOOKING_STATUS_BOOKED) {
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=${returnTab}&error=slot`);
  }

  const slot = createMiniSessionSlots(booking.miniSession).find((candidate) => candidate.token === selectedSlot);

  if (!slot) {
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=${returnTab}&error=slot`);
  }

  if (!isMiniSessionSlotBookable(slot, booking.miniSession.minBookingNoticeMinutes)) {
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=${returnTab}&error=notice`);
  }

  if (
    await hasMiniSessionSlotConflict(booking.miniSession.adminId, slot, {
      excludeBookingId: booking.id,
      excludeProjectId: booking.projectId
    })
  ) {
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=${returnTab}&error=taken`);
  }

  await rescheduleMiniSessionBookingRecord({
    bookingId: booking.id,
    slot,
    session: booking.miniSession
  });

  let googleCalendarSyncStatus = "not_run";

  try {
    const googleCalendarSync = await syncMiniSessionBookingToGoogleCalendar(booking.id);
    googleCalendarSyncStatus = googleCalendarSync.status;
  } catch (error) {
    googleCalendarSyncStatus = "failed";
    console.error("Mini session Google Calendar admin reschedule sync failed", error);
    await logSystemEvent({
      actorAdminId: admin.id,
      targetAdminId: booking.miniSession.adminId,
      type: "google_calendar.mini_session_booking.sync_failed",
      title: "Google Calendar admin átütemezési sync hiba",
      message: systemEventErrorMessage(error),
      severity: "error",
      status: "failed",
      source: "google_calendar",
      href: `/admin/mini-sessions/${booking.miniSession.id}`,
      metadata: {
        bookingId: booking.id,
        sessionId: booking.miniSession.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString()
      }
    });
  }

  await logSystemEvent({
    actorAdminId: admin.id,
    targetAdminId: booking.miniSession.adminId,
    type: "mini_session.booking.rescheduled_by_admin",
    title: "Admin módosította a foglalás időpontját",
    message: `${booking.name} · ${booking.miniSession.title}`,
    severity: "success",
    status: "success",
    source: "mini_session",
    href: `/admin/mini-sessions/${booking.miniSession.id}?tab=${returnTab}`,
    metadata: {
      bookingId: booking.id,
      sessionId: booking.miniSession.id,
      email: booking.email,
      previousStartsAt: booking.startsAt.toISOString(),
      previousEndsAt: booking.endsAt.toISOString(),
      newStartsAt: slot.startsAt.toISOString(),
      newEndsAt: slot.endsAt.toISOString(),
      googleCalendarSyncStatus
    }
  });

  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
  revalidatePath(`/mini-session/${booking.miniSession.slug}`);
  if (booking.customerId) {
    revalidatePath(`/admin/clients/${booking.customerId}`);
  }
  redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=${returnTab}&bookingRescheduled=1`);
}

export async function cancelMiniSessionBookingAction(token: string) {
  const booking = await prisma.miniSessionBooking.findUnique({
    where: { cancelToken: token },
    include: {
      miniSession: {
        include: {
          admin: {
            select: {
              name: true,
              email: true,
              siteSettings: {
                select: {
                  publicSubdomain: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!booking) {
    redirect("/mini-session/cancelled?error=missing");
  }

  if (
    await isAnyRateLimited([
      { scope: "public:mini-session-cancel:token", limit: 8, windowSeconds: 15 * 60, identifier: token },
      { scope: "public:mini-session-cancel:ip", limit: 30, windowSeconds: 15 * 60, identifier: booking.miniSession.slug }
    ])
  ) {
    redirect(`/mini-session/${booking.miniSession.slug}/cancel/${token}?error=rate_limit`);
  }

  if (booking.status !== MINI_SESSION_BOOKING_STATUS_CANCELLED) {
    const cancelledAt = new Date();

    await deleteLinkedMiniSessionProjectCalendarEvent(booking.projectId);

    await prisma.$transaction(async (tx) => {
      const cancelledBooking = await tx.miniSessionBooking.update({
        where: { id: booking.id },
        data: {
          status: MINI_SESSION_BOOKING_STATUS_CANCELLED,
          cancelledAt
        }
      });

      await cleanupMiniSessionBookingCustomerProject({
        tx,
        booking: cancelledBooking
      });
    });

    let googleCalendarSyncStatus = "not_run";

    try {
      const googleCalendarSync = await syncMiniSessionBookingToGoogleCalendar(booking.id);
      googleCalendarSyncStatus = googleCalendarSync.status;
    } catch (error) {
      googleCalendarSyncStatus = "failed";
      console.error("Mini session Google Calendar cancellation sync failed", error);
      await logSystemEvent({
        targetAdminId: booking.miniSession.adminId,
        type: "google_calendar.mini_session_booking.sync_failed",
        title: "Google Calendar törlési sync hiba",
        message: systemEventErrorMessage(error),
        severity: "error",
        status: "failed",
        source: "google_calendar",
        href: `/admin/mini-sessions/${booking.miniSession.id}`,
        metadata: {
          bookingId: booking.id,
          sessionId: booking.miniSession.id,
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString()
        }
      });
    }

    try {
      const publicSubdomain = booking.miniSession.admin.siteSettings?.publicSubdomain ?? null;
      const calendarUrl = miniSessionBookingCalendarUrl(booking.miniSession.slug, booking.cancelToken, publicSubdomain);
      const adminUrl = adminMiniSessionUrl(booking.miniSession.id);
      const cancellationIcs = buildMiniSessionCalendarIcs({
        uid: miniSessionCalendarUid(booking.id),
        sessionTitle: booking.miniSession.title,
        location: booking.miniSession.location,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        createdAt: booking.createdAt,
        updatedAt: cancelledAt,
        url: adminUrl,
        status: "CANCELLED",
        method: "CANCEL",
        sequence: 1,
        description: miniSessionCalendarDescription({
          location: booking.miniSession.location,
          name: booking.name,
          email: booking.email,
          phone: booking.phone,
          attendeeCount: booking.attendeeCount,
          adminUrl,
          status: "cancelled"
        })
      });
      const delivery = await runLoggedDelivery({
        adminId: booking.miniSession.adminId,
        channel: DELIVERY_CHANNEL_EMAIL,
        type: "email.mini_session.cancellation_notification",
        recipient: booking.miniSession.admin.email,
        subject: `Mini session foglalás törölve: ${booking.miniSession.title}`,
        provider: "resend",
        entityType: "mini_session_booking",
        entityId: booking.id,
        metadata: {
          sessionId: booking.miniSession.id,
          recipient: booking.miniSession.admin.email,
          source: "booking_cancelled"
        },
        send: () => sendMiniSessionBookingCancelledEmail({
          to: booking.miniSession.admin.email,
          replyTo: booking.email,
          sessionTitle: booking.miniSession.title,
          sessionDate: booking.startsAt,
          location: booking.miniSession.location,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          name: booking.name,
          email: booking.email,
          phone: booking.phone,
          attendeeCount: booking.attendeeCount,
          adminUrl,
          calendarUrl,
          calendarIcs: cancellationIcs,
          calendarFilename: miniSessionCalendarFilename(booking.miniSession.title, "CANCELLED"),
          calendarButtonLabel: "Naptárból eltávolítás"
        })
      });

      if (delivery.ok) {
        await prisma.miniSessionBooking.update({
          where: { id: booking.id },
          data: { cancellationEmailSentAt: delivery.log.sentAt ?? new Date() }
        });
      } else {
        await logSystemEvent({
          targetAdminId: booking.miniSession.adminId,
          type: "email.mini_session.cancellation_notification.failed",
          title: "Lemondási értesítő email nem ment ki",
          message: delivery.errorMessage || `${booking.name} · ${booking.email}`,
          severity: "warning",
          status: delivery.status === "retry" ? "warning" : "failed",
          source: "email",
          href: adminUrl,
          metadata: {
            bookingId: booking.id,
            sessionId: booking.miniSession.id,
            recipient: booking.miniSession.admin.email,
            deliveryLogId: delivery.log.id,
            deliveryStatus: delivery.status
          }
        });
      }
    } catch (error) {
      console.error("Mini session cancellation email failed", error);
      await logSystemEvent({
        targetAdminId: booking.miniSession.adminId,
        type: "email.mini_session.cancellation_notification.failed",
        title: "Lemondási értesítő email hiba",
        message: systemEventErrorMessage(error),
        severity: "error",
        status: "failed",
        source: "email",
        href: `/admin/mini-sessions/${booking.miniSession.id}`,
        metadata: {
          bookingId: booking.id,
          sessionId: booking.miniSession.id,
          recipient: booking.miniSession.admin.email
        }
      });
    }

    await logSystemEvent({
      targetAdminId: booking.miniSession.adminId,
      type: "mini_session.booking.cancelled",
      title: "Foglalás törölve ügyfél által",
      message: `${booking.name} · ${booking.miniSession.title}`,
      severity: "warning",
      status: "success",
      source: "mini_session",
      href: `/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`,
      metadata: {
        bookingId: booking.id,
        sessionId: booking.miniSession.id,
        email: booking.email,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        googleCalendarSyncStatus
      }
    });
  } else {
    await deleteLinkedMiniSessionProjectCalendarEvent(booking.projectId);

    await prisma.$transaction(async (tx) => {
      await cleanupMiniSessionBookingCustomerProject({
        tx,
        booking
      });
    });
  }

  revalidatePath(`/mini-session/${booking.miniSession.slug}`);
  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
  revalidatePath("/admin/clients");
  if (booking.customerId) {
    revalidatePath(`/admin/clients/${booking.customerId}`);
  }
  redirect(`/mini-session/${booking.miniSession.slug}?cancelled=1&calendar=${booking.cancelToken}`);
}

export async function cancelMiniSessionBookingByAdminAction(bookingId: string, formData?: FormData) {
  const admin = await requireAdmin();
  const returnTab = formData?.get("returnTab") === "slots" ? "slots" : "bookings";
  const booking = await prisma.miniSessionBooking.findFirst({
    where: {
      id: bookingId,
      miniSession: adminOwnedWhere(admin)
    },
    select: {
      id: true,
      name: true,
      email: true,
      startsAt: true,
      endsAt: true,
      status: true,
      customerId: true,
      projectId: true,
      miniSession: {
        select: {
          id: true,
          adminId: true,
          title: true,
          slug: true
        }
      }
    }
  });

  if (!booking) {
    redirect("/admin/mini-sessions");
  }

  if (booking.status !== MINI_SESSION_BOOKING_STATUS_CANCELLED) {
    await deleteLinkedMiniSessionProjectCalendarEvent(booking.projectId);

    await prisma.$transaction(async (tx) => {
      const cancelledBooking = await tx.miniSessionBooking.update({
        where: { id: booking.id },
        data: {
          status: MINI_SESSION_BOOKING_STATUS_CANCELLED,
          cancelledAt: new Date()
        }
      });

      await cleanupMiniSessionBookingCustomerProject({
        tx,
        booking: cancelledBooking
      });
    });

    let googleCalendarSyncStatus = "not_run";

    try {
      const googleCalendarSync = await syncMiniSessionBookingToGoogleCalendar(booking.id);
      googleCalendarSyncStatus = googleCalendarSync.status;
    } catch (error) {
      googleCalendarSyncStatus = "failed";
      console.error("Mini session Google Calendar admin cancellation sync failed", error);
      await logSystemEvent({
        actorAdminId: admin.id,
        targetAdminId: booking.miniSession.adminId,
        type: "google_calendar.mini_session_booking.sync_failed",
        title: "Google Calendar admin törlési sync hiba",
        message: systemEventErrorMessage(error),
        severity: "error",
        status: "failed",
        source: "google_calendar",
        href: `/admin/mini-sessions/${booking.miniSession.id}`,
        metadata: {
          bookingId: booking.id,
          sessionId: booking.miniSession.id,
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString()
        }
      });
    }

    await logSystemEvent({
      actorAdminId: admin.id,
      targetAdminId: booking.miniSession.adminId,
      type: "mini_session.booking.cancelled_by_admin",
      title: "Admin törölte a foglalást",
      message: `${booking.name} · ${booking.miniSession.title}`,
      severity: "warning",
      status: "success",
      source: "mini_session",
      href: `/admin/mini-sessions/${booking.miniSession.id}?tab=${returnTab}`,
      metadata: {
        bookingId: booking.id,
        sessionId: booking.miniSession.id,
        email: booking.email,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        googleCalendarSyncStatus
      }
    });
  } else {
    await deleteLinkedMiniSessionProjectCalendarEvent(booking.projectId);

    await prisma.$transaction(async (tx) => {
      await cleanupMiniSessionBookingCustomerProject({
        tx,
        booking
      });
    });
  }

  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
  revalidatePath(`/mini-session/${booking.miniSession.slug}`);
  revalidatePath("/admin/clients");
  if (booking.customerId) {
    revalidatePath(`/admin/clients/${booking.customerId}`);
  }
  redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=${returnTab}&bookingCancelled=1`);
}

export async function updateMiniSessionBookingStatusAction(bookingId: string, formData: FormData) {
  const admin = await requireAdmin();
  const status = normalizeAdminBookingStatus(formData.get("status"));
  const returnScope = formString(formData, "returnScope");
  const returnTab = formData.get("returnTab") === "slots" ? "slots" : "bookings";

  const booking = await prisma.miniSessionBooking.findFirst({
    where: {
      id: bookingId,
      miniSession: adminOwnedWhere(admin)
    },
    select: {
      id: true,
      name: true,
      email: true,
      startsAt: true,
      endsAt: true,
      source: true,
      status: true,
      miniSession: {
        select: {
          id: true,
          adminId: true,
          title: true,
          slug: true
        }
      }
    }
  });

  if (!booking) {
    redirect("/admin/mini-sessions");
  }

  const detailRedirect = `/admin/mini-sessions/${booking.miniSession.id}?tab=${returnTab}`;
  const hubRedirect = "/admin/mini-sessions?tab=bookings";
  const redirectBase = returnScope === "hub" ? hubRedirect : detailRedirect;

  if (!status || booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED || booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED) {
    redirect(`${redirectBase}&bookingStatusError=1`);
  }

  if (status !== MINI_SESSION_BOOKING_STATUS_BOOKED && booking.endsAt > new Date()) {
    redirect(`${redirectBase}&bookingStatusError=1`);
  }

  if (booking.status !== status) {
    await prisma.miniSessionBooking.update({
      where: { id: booking.id },
      data: {
        status,
        cancelledAt: null
      }
    });

    const statusLabel =
      status === MINI_SESSION_BOOKING_STATUS_COMPLETED
        ? "Kész"
        : status === MINI_SESSION_BOOKING_STATUS_NO_SHOW
          ? "Nem jelent meg"
          : "Aktív";

    await logSystemEvent({
      actorAdminId: admin.id,
      targetAdminId: booking.miniSession.adminId,
      type: "mini_session.booking.status_updated",
      title: "Foglalás állapota frissítve",
      message: `${booking.name} · ${booking.miniSession.title} · ${statusLabel}`,
      severity: status === MINI_SESSION_BOOKING_STATUS_NO_SHOW ? "warning" : "info",
      status: "success",
      source: "mini_session",
      href: detailRedirect,
      metadata: {
        bookingId: booking.id,
        sessionId: booking.miniSession.id,
        email: booking.email,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        previousStatus: booking.status,
        status
      }
    });
  }

  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/work");
  redirect(`${redirectBase}&bookingStatusUpdated=1`);
}

export async function resendMiniSessionBookingConfirmationAction(bookingId: string) {
  const admin = await requireAdmin();
  const booking = await prisma.miniSessionBooking.findFirst({
    where: {
      id: bookingId,
      miniSession: adminOwnedWhere(admin)
    },
    include: {
      miniSession: {
        include: {
          admin: {
            select: {
              name: true,
              email: true,
              siteSettings: {
                select: {
                  publicSubdomain: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!booking) {
    redirect("/admin/mini-sessions");
  }

  if (booking.status !== MINI_SESSION_BOOKING_STATUS_BOOKED || booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED) {
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&error=email_unavailable`);
  }

  const language = normalizeMiniSessionLanguage(booking.miniSession.language);
  const publicSubdomain = booking.miniSession.admin.siteSettings?.publicSubdomain ?? null;
  const cancelUrl = miniSessionBookingCancelUrl(booking.miniSession.slug, booking.cancelToken, publicSubdomain);
  const rescheduleUrl = miniSessionBookingRescheduleUrl(booking.miniSession.slug, booking.cancelToken, publicSubdomain);
  const calendarUrl = miniSessionBookingCalendarUrl(booking.miniSession.slug, booking.cancelToken, publicSubdomain);
  const calendarFilename = miniSessionCalendarFilename(booking.miniSession.title);
  const calendarIcs = buildMiniSessionCalendarIcs({
    uid: miniSessionCalendarUid(booking.id),
    sessionTitle: booking.miniSession.title,
    location: booking.miniSession.location,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    url: calendarUrl,
    description: miniSessionCalendarDescription({
      location: booking.miniSession.location,
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      attendeeCount: booking.attendeeCount,
      cancelUrl,
      language
    })
  });

  let resendDeliveryFailed = false;

  try {
    const delivery = await runLoggedDelivery({
      adminId: booking.miniSession.adminId,
      channel: DELIVERY_CHANNEL_EMAIL,
      type: "email.mini_session.customer_confirmation",
      recipient: booking.email,
      subject: `${booking.miniSession.title} visszaigazolás`,
      provider: "resend",
      entityType: "mini_session_booking",
      entityId: booking.id,
      metadata: {
        sessionId: booking.miniSession.id,
        recipient: booking.email,
        source: "admin_resend"
      },
      send: () => sendMiniSessionBookingConfirmationEmail({
        to: booking.email,
        replyTo: booking.miniSession.admin.email,
        senderName: booking.miniSession.admin.name,
        sessionTitle: booking.miniSession.title,
        sessionDate: booking.startsAt,
        location: booking.miniSession.location,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        name: booking.name,
        attendeeCount: booking.attendeeCount,
        cancelUrl,
        rescheduleUrl,
        calendarUrl,
        calendarIcs,
        calendarFilename,
        calendarButtonLabel: language === "de" ? "Zum Kalender hinzufügen" : "Naptárhoz adás",
        language
      })
    });

    if (delivery.ok) {
      await prisma.miniSessionBooking.update({
        where: { id: booking.id },
        data: { customerEmailSentAt: delivery.log.sentAt ?? new Date() }
      });
      await logSystemEvent({
        actorAdminId: admin.id,
        targetAdminId: booking.miniSession.adminId,
        type: "email.mini_session.customer_confirmation.resent",
        title: "Visszaigazoló email újraküldve",
        message: `${booking.name} · ${booking.email}`,
        severity: "success",
        status: "success",
        source: "email",
        href: `/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`,
        metadata: {
          bookingId: booking.id,
          sessionId: booking.miniSession.id,
          recipient: booking.email,
          deliveryLogId: delivery.log.id
        }
      });
    } else {
      await logSystemEvent({
        actorAdminId: admin.id,
        targetAdminId: booking.miniSession.adminId,
        type: "email.mini_session.customer_confirmation.failed",
        title: "Visszaigazoló email újraküldése sikertelen",
        message: delivery.errorMessage || `${booking.name} · ${booking.email}`,
        severity: "warning",
        status: delivery.status === "retry" ? "warning" : "failed",
        source: "email",
        href: `/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`,
        metadata: {
          bookingId: booking.id,
          sessionId: booking.miniSession.id,
          recipient: booking.email,
          deliveryLogId: delivery.log.id,
          deliveryStatus: delivery.status
        }
      });
      resendDeliveryFailed = true;
    }
  } catch (error) {
    console.error("Mini session confirmation resend failed", error);
    await logSystemEvent({
      actorAdminId: admin.id,
      targetAdminId: booking.miniSession.adminId,
      type: "email.mini_session.customer_confirmation.failed",
      title: "Visszaigazoló email újraküldési hiba",
      message: systemEventErrorMessage(error),
      severity: "error",
      status: "failed",
      source: "email",
      href: `/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`,
      metadata: {
        bookingId: booking.id,
        sessionId: booking.miniSession.id,
        recipient: booking.email
      }
    });
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&error=email_send`);
  }

  if (resendDeliveryFailed) {
    revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&error=email_send`);
  }

  revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
  redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&confirmationSent=1`);
}

export async function resendMiniSessionAdminNotificationAction(bookingId: string) {
  const admin = await requireAdmin();
  const booking = await prisma.miniSessionBooking.findFirst({
    where: {
      id: bookingId,
      miniSession: adminOwnedWhere(admin)
    },
    include: {
      miniSession: {
        include: {
          admin: {
            select: {
              email: true,
              siteSettings: {
                select: {
                  publicSubdomain: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!booking) {
    redirect("/admin/mini-sessions");
  }

  if (booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED) {
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&error=email_unavailable`);
  }

  const adminUrl = adminMiniSessionUrl(booking.miniSession.id);
  const publicSubdomain = booking.miniSession.admin.siteSettings?.publicSubdomain ?? null;
  const publicUrl = miniSessionPublicUrl(booking.miniSession.slug, publicSubdomain);
  const calendarUrl = miniSessionBookingCalendarUrl(booking.miniSession.slug, booking.cancelToken, publicSubdomain);
  const calendarFilename = miniSessionCalendarFilename(booking.miniSession.title);
  const adminCalendarIcs = buildMiniSessionCalendarIcs({
    uid: miniSessionCalendarUid(booking.id),
    sessionTitle: booking.miniSession.title,
    location: booking.miniSession.location,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    url: adminUrl,
    description: miniSessionCalendarDescription({
      location: booking.miniSession.location,
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      attendeeCount: booking.attendeeCount,
      adminUrl
    })
  });
  let resendDeliveryFailed = false;

  try {
    const delivery = await runLoggedDelivery({
      adminId: booking.miniSession.adminId,
      channel: DELIVERY_CHANNEL_EMAIL,
      type: "email.mini_session.admin_notification",
      recipient: booking.miniSession.admin.email,
      subject: `Új mini session foglalás: ${booking.miniSession.title}`,
      provider: "resend",
      entityType: "mini_session_booking",
      entityId: booking.id,
      metadata: {
        sessionId: booking.miniSession.id,
        recipient: booking.miniSession.admin.email,
        source: "admin_resend"
      },
      send: () => sendMiniSessionAdminBookingEmail({
        to: booking.miniSession.admin.email,
        replyTo: booking.email,
        sessionTitle: booking.miniSession.title,
        sessionDate: booking.startsAt,
        location: booking.miniSession.location,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        name: booking.name,
        email: booking.email,
        phone: booking.phone,
        attendeeCount: booking.attendeeCount,
        adminUrl,
        publicUrl,
        calendarUrl,
        calendarIcs: adminCalendarIcs,
        calendarFilename
      })
    });

    if (delivery.ok) {
      await prisma.miniSessionBooking.update({
        where: { id: booking.id },
        data: { adminEmailSentAt: delivery.log.sentAt ?? new Date() }
      });
      await logSystemEvent({
        actorAdminId: admin.id,
        targetAdminId: booking.miniSession.adminId,
        type: "email.mini_session.admin_notification.resent",
        title: "Admin értesítő email újraküldve",
        message: `${booking.name} · ${booking.email}`,
        severity: "success",
        status: "success",
        source: "email",
        href: `/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`,
        metadata: {
          bookingId: booking.id,
          sessionId: booking.miniSession.id,
          recipient: booking.miniSession.admin.email,
          deliveryLogId: delivery.log.id
        }
      });
    } else {
      resendDeliveryFailed = true;
      await logSystemEvent({
        actorAdminId: admin.id,
        targetAdminId: booking.miniSession.adminId,
        type: "email.mini_session.admin_notification.failed",
        title: "Admin értesítő email újraküldése sikertelen",
        message: delivery.errorMessage || `${booking.name} · ${booking.email}`,
        severity: "warning",
        status: delivery.status === "retry" ? "warning" : "failed",
        source: "email",
        href: `/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`,
        metadata: {
          bookingId: booking.id,
          sessionId: booking.miniSession.id,
          recipient: booking.miniSession.admin.email,
          deliveryLogId: delivery.log.id,
          deliveryStatus: delivery.status
        }
      });
    }
  } catch (error) {
    console.error("Mini session admin notification resend failed", error);
    await logSystemEvent({
      actorAdminId: admin.id,
      targetAdminId: booking.miniSession.adminId,
      type: "email.mini_session.admin_notification.failed",
      title: "Admin értesítő email újraküldési hiba",
      message: systemEventErrorMessage(error),
      severity: "error",
      status: "failed",
      source: "email",
      href: `/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`,
      metadata: {
        bookingId: booking.id,
        sessionId: booking.miniSession.id,
        recipient: booking.miniSession.admin.email
      }
    });
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&error=email_send`);
  }

  revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
  if (resendDeliveryFailed) {
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&error=email_send`);
  }
  redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&adminNotificationSent=1`);
}

export async function retryMiniSessionBookingCalendarSyncAction(bookingId: string) {
  const admin = await requireAdmin();
  const booking = await prisma.miniSessionBooking.findFirst({
    where: {
      id: bookingId,
      miniSession: adminOwnedWhere(admin)
    },
    select: {
      id: true,
      miniSession: {
        select: {
          id: true,
          adminId: true
        }
      }
    }
  });

  if (!booking) {
    redirect("/admin/mini-sessions");
  }

  const result = await syncMiniSessionBookingToGoogleCalendar(booking.id);
  const syncOk = result.status !== "error" && result.status !== "not_configured";

  await logSystemEvent({
    actorAdminId: admin.id,
    targetAdminId: booking.miniSession.adminId,
    type: "google_calendar.mini_session_booking.retry",
    title: "Google Calendar újraszinkronizálás",
    message: result.status,
    severity: syncOk ? "success" : "warning",
    status: syncOk ? "success" : "failed",
    source: "google_calendar",
    href: `/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`,
    metadata: {
      bookingId: booking.id,
      sessionId: booking.miniSession.id,
      result: result.status
    }
  });

  revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
  redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&calendarSynced=${syncOk ? "1" : "0"}`);
}
