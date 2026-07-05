"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { APP_TIME_ZONE } from "@/lib/date-format";
import {
  adminMiniSessionUrl,
  miniSessionBookingCalendarUrl,
  miniSessionBookingCancelUrl,
  miniSessionPublicUrl,
  sendMiniSessionAdminBookingEmail,
  sendMiniSessionBookingCancelledEmail,
  sendMiniSessionBookingConfirmationEmail
} from "@/lib/email";
import { buildMiniSessionCalendarIcs, miniSessionCalendarFilename } from "@/lib/mini-session-calendar";
import {
  createMiniSessionSlots,
  type MiniSessionLanguage,
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_SOURCE_CLIENT,
  MINI_SESSION_BOOKING_SOURCE_MANUAL,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  normalizeMiniSessionLanguage
} from "@/lib/mini-sessions";
import { syncMiniSessionBookingLead } from "@/lib/mini-session-leads";
import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/slug";
import {
  createMiniSessionCoverObjectKey,
  deletePhotoObject,
  getPhotoPublicUrl,
  savePhotoObject
} from "@/lib/storage";

const MINI_SESSION_COVER_MAX_BYTES = 12 * 1024 * 1024;

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

function parseLocalDateTime(date: string, time: string) {
  if (!date || !time) {
    return null;
  }

  const [year, month, day] = date.split("-").map((part) => Number.parseInt(part, 10));
  const [hour, minute] = time.split(":").map((part) => Number.parseInt(part, 10));

  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    return null;
  }

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = timeZoneOffsetMs(utcGuess, APP_TIME_ZONE);
  const value = new Date(utcGuess.getTime() - offset);
  const refinedOffset = timeZoneOffsetMs(value, APP_TIME_ZONE);

  return new Date(utcGuess.getTime() - refinedOffset);
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return asUtc - date.getTime();
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

function miniSessionCalendarUid(bookingId: string) {
  return `mini-session-${bookingId}@gallery.hochzeitsfotografgraz.at`;
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
  const title = formString(formData, "title");
  const location = formString(formData, "location");
  const date = formString(formData, "date");
  const startTime = formString(formData, "startTime");
  const endTime = formString(formData, "endTime");
  const durationMinutes = Math.max(5, parseInteger(formString(formData, "durationMinutes"), 20));
  const language = miniSessionLanguageFromForm(formData);
  const notes = formString(formData, "notes");
  const slug = normalizeSlug(formString(formData, "slug") || title);
  const startsAt = parseLocalDateTime(date, startTime);
  const endsAt = parseLocalDateTime(date, endTime);

  if (!title || !location || !slug || !startsAt || !endsAt || endsAt <= startsAt) {
    redirect("/admin/mini-sessions?error=missing");
  }

  const uploadedCover = await uploadMiniSessionCover(admin.id, formData.get("coverImage"));
  let miniSession: { id: string };

  try {
    miniSession = await prisma.miniSession.create({
      data: {
        adminId: admin.id,
        title,
        slug,
        location,
        sessionDate: parseLocalDateTime(date, "12:00") ?? startsAt,
        startsAt,
        endsAt,
        durationMinutes,
        language,
        isActive: formData.get("isActive") === "on",
        notes: notes || null,
        coverImageUrl: uploadedCover?.url ?? null,
        coverImageR2Key: uploadedCover?.r2Key ?? null
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
  const language = miniSessionLanguageFromForm(formData);
  const notes = formString(formData, "notes");
  const slug = normalizeSlug(formString(formData, "slug") || title);
  const startsAt = parseLocalDateTime(date, startTime);
  const endsAt = parseLocalDateTime(date, endTime);

  if (!title || !location || !slug || !startsAt || !endsAt || endsAt <= startsAt) {
    redirect(`/admin/mini-sessions/${id}?tab=settings&error=missing`);
  }

  try {
    await prisma.miniSession.update({
      where: { id },
      data: {
        title,
        slug,
        location,
        sessionDate: parseLocalDateTime(date, "12:00") ?? startsAt,
        startsAt,
        endsAt,
        durationMinutes,
        language,
        isActive: formData.get("isActive") === "on",
        notes: notes || null
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
  const current = await prisma.miniSession.findFirst({
    where: { id, ...adminOwnedWhere(admin) },
    select: { id: true, slug: true, coverImageR2Key: true }
  });

  if (!current) {
    redirect("/admin/mini-sessions");
  }

  const uploadedCover = await uploadMiniSessionCover(admin.id, formData.get("coverImage"), `/admin/mini-sessions/${id}?tab=settings`);

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
      admin: {
        select: {
          email: true
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

    return tx.miniSessionBooking.create({
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
  }).catch((error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`/admin/mini-sessions/${session.id}?tab=slots&error=taken`);
    }

    throw error;
  });

  if (!booking) {
    redirect(`/admin/mini-sessions/${session.id}?tab=slots&error=taken`);
  }

  try {
    await syncMiniSessionBookingLead({ booking, miniSession: session });
    revalidatePath("/admin/dashboard");
  } catch (error) {
    console.error("Mini session lead sync failed", error);
  }

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

  if (!selectedSlot || !name || !isValidEmail(email) || !phone) {
    redirect(`/mini-session/${slug}?error=missing`);
  }

  const session = await prisma.miniSession.findUnique({
    where: { slug },
    include: {
      admin: {
        select: {
          email: true
        }
      }
    }
  });

  if (!session || !session.isActive) {
    redirect(`/mini-session/${slug}?error=inactive`);
  }

  const slot = createMiniSessionSlots(session).find((candidate) => candidate.token === selectedSlot);

  if (!slot) {
    redirect(`/mini-session/${slug}?error=slot`);
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

    return tx.miniSessionBooking.create({
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
  }).catch((error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`/mini-session/${slug}?error=taken`);
    }

    throw error;
  });

  if (!booking) {
    redirect(`/mini-session/${slug}?error=taken`);
  }

  const cancelUrl = miniSessionBookingCancelUrl(slug, cancelToken);
  const calendarUrl = miniSessionBookingCalendarUrl(slug, cancelToken);
  const adminUrl = adminMiniSessionUrl(session.id);
  const publicUrl = miniSessionPublicUrl(session.slug);
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

  try {
    await syncMiniSessionBookingLead({ booking, miniSession: session });
    revalidatePath("/admin/dashboard");
  } catch (error) {
    console.error("Mini session lead sync failed", error);
  }

  try {
    const sent = await sendMiniSessionBookingConfirmationEmail({
      to: email,
      sessionTitle: session.title,
      sessionDate: session.sessionDate,
      location: session.location,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      name,
      attendeeCount,
      cancelUrl,
      calendarUrl,
      calendarIcs: customerCalendarIcs,
      calendarFilename,
      calendarButtonLabel: language === "de" ? "Zum Kalender hinzufügen" : "Naptárhoz adás",
      language
    });
    customerEmailSentAt = sent ? new Date() : null;
  } catch (error) {
    console.error("Mini session customer email failed", error);
  }

  try {
    const sent = await sendMiniSessionAdminBookingEmail({
      to: session.admin.email,
      sessionTitle: session.title,
      sessionDate: session.sessionDate,
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
    });
    adminEmailSentAt = sent ? new Date() : null;
  } catch (error) {
    console.error("Mini session admin email failed", error);
  }

  if (customerEmailSentAt || adminEmailSentAt) {
    await prisma.miniSessionBooking.update({
      where: { id: booking.id },
      data: { customerEmailSentAt, adminEmailSentAt }
    });
  }

  revalidatePath(`/mini-session/${slug}`);
  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${session.id}`);
  redirect(`/mini-session/${slug}?booked=1&calendar=${cancelToken}`);
}

export async function cancelMiniSessionBookingAction(token: string) {
  const booking = await prisma.miniSessionBooking.findUnique({
    where: { cancelToken: token },
    include: {
      miniSession: {
        include: {
          admin: {
            select: {
              email: true
            }
          }
        }
      }
    }
  });

  if (!booking) {
    redirect("/mini-session/cancelled?error=missing");
  }

  if (booking.status !== MINI_SESSION_BOOKING_STATUS_CANCELLED) {
    const cancelledAt = new Date();

    await prisma.miniSessionBooking.update({
      where: { id: booking.id },
      data: {
        status: MINI_SESSION_BOOKING_STATUS_CANCELLED,
        cancelledAt
      }
    });

    try {
      const calendarUrl = miniSessionBookingCalendarUrl(booking.miniSession.slug, booking.cancelToken);
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
      const sent = await sendMiniSessionBookingCancelledEmail({
        to: booking.miniSession.admin.email,
        sessionTitle: booking.miniSession.title,
        sessionDate: booking.miniSession.sessionDate,
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
      });

      if (sent) {
        await prisma.miniSessionBooking.update({
          where: { id: booking.id },
          data: { cancellationEmailSentAt: new Date() }
        });
      }
    } catch (error) {
      console.error("Mini session cancellation email failed", error);
    }
  }

  revalidatePath(`/mini-session/${booking.miniSession.slug}`);
  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
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
      status: true,
      miniSession: {
        select: {
          id: true,
          slug: true
        }
      }
    }
  });

  if (!booking) {
    redirect("/admin/mini-sessions");
  }

  if (booking.status !== MINI_SESSION_BOOKING_STATUS_CANCELLED) {
    await prisma.miniSessionBooking.update({
      where: { id: booking.id },
      data: {
        status: MINI_SESSION_BOOKING_STATUS_CANCELLED,
        cancelledAt: new Date()
      }
    });
  }

  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
  revalidatePath(`/mini-session/${booking.miniSession.slug}`);
  redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=${returnTab}&bookingCancelled=1`);
}

export async function resendMiniSessionBookingConfirmationAction(bookingId: string) {
  const admin = await requireAdmin();
  const booking = await prisma.miniSessionBooking.findFirst({
    where: {
      id: bookingId,
      miniSession: adminOwnedWhere(admin)
    },
    include: {
      miniSession: true
    }
  });

  if (!booking) {
    redirect("/admin/mini-sessions");
  }

  if (booking.status !== MINI_SESSION_BOOKING_STATUS_BOOKED || booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED) {
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&error=email_unavailable`);
  }

  const language = normalizeMiniSessionLanguage(booking.miniSession.language);
  const cancelUrl = miniSessionBookingCancelUrl(booking.miniSession.slug, booking.cancelToken);
  const calendarUrl = miniSessionBookingCalendarUrl(booking.miniSession.slug, booking.cancelToken);
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

  try {
    const sent = await sendMiniSessionBookingConfirmationEmail({
      to: booking.email,
      sessionTitle: booking.miniSession.title,
      sessionDate: booking.miniSession.sessionDate,
      location: booking.miniSession.location,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      name: booking.name,
      attendeeCount: booking.attendeeCount,
      cancelUrl,
      calendarUrl,
      calendarIcs,
      calendarFilename,
      calendarButtonLabel: language === "de" ? "Zum Kalender hinzufügen" : "Naptárhoz adás",
      language
    });

    if (sent) {
      await prisma.miniSessionBooking.update({
        where: { id: booking.id },
        data: { customerEmailSentAt: new Date() }
      });
    }
  } catch (error) {
    console.error("Mini session confirmation resend failed", error);
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&error=email_send`);
  }

  revalidatePath(`/admin/mini-sessions/${booking.miniSession.id}`);
  redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings&confirmationSent=1`);
}
