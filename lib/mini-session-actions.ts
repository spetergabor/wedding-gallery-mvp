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
  miniSessionBookingCancelUrl,
  miniSessionPublicUrl,
  sendMiniSessionAdminBookingEmail,
  sendMiniSessionBookingCancelledEmail,
  sendMiniSessionBookingConfirmationEmail
} from "@/lib/email";
import {
  createMiniSessionSlots,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_CANCELLED
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/slug";

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

export async function createMiniSessionAction(formData: FormData) {
  const admin = await requireAdmin();
  const title = formString(formData, "title");
  const location = formString(formData, "location");
  const date = formString(formData, "date");
  const startTime = formString(formData, "startTime");
  const endTime = formString(formData, "endTime");
  const durationMinutes = Math.max(5, parseInteger(formString(formData, "durationMinutes"), 20));
  const notes = formString(formData, "notes");
  const slug = normalizeSlug(formString(formData, "slug") || title);
  const startsAt = parseLocalDateTime(date, startTime);
  const endsAt = parseLocalDateTime(date, endTime);

  if (!title || !location || !slug || !startsAt || !endsAt || endsAt <= startsAt) {
    redirect("/admin/mini-sessions?error=missing");
  }

  try {
    const miniSession = await prisma.miniSession.create({
      data: {
        adminId: admin.id,
        title,
        slug,
        location,
        sessionDate: parseLocalDateTime(date, "12:00") ?? startsAt,
        startsAt,
        endsAt,
        durationMinutes,
        isActive: formData.get("isActive") === "on",
        notes: notes || null
      }
    });

    revalidatePath("/admin/mini-sessions");
    redirect(`/admin/mini-sessions?created=${miniSession.id}`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/admin/mini-sessions?error=slug");
    }

    throw error;
  }
}

export async function updateMiniSessionAction(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const current = await prisma.miniSession.findFirst({
    where: { id, ...adminOwnedWhere(admin) },
    select: { id: true }
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
  const notes = formString(formData, "notes");
  const slug = normalizeSlug(formString(formData, "slug") || title);
  const startsAt = parseLocalDateTime(date, startTime);
  const endsAt = parseLocalDateTime(date, endTime);

  if (!title || !location || !slug || !startsAt || !endsAt || endsAt <= startsAt) {
    redirect("/admin/mini-sessions?error=missing");
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
        isActive: formData.get("isActive") === "on",
        notes: notes || null
      }
    });

    revalidatePath("/admin/mini-sessions");
    revalidatePath(`/mini-session/${slug}`);
    redirect(`/admin/mini-sessions?updated=${id}`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/admin/mini-sessions?error=slug");
    }

    throw error;
  }
}

export async function deleteMiniSessionAction(id: string) {
  const admin = await requireAdmin();
  const miniSession = await prisma.miniSession.findFirst({
    where: { id, ...adminOwnedWhere(admin) },
    select: { id: true, slug: true }
  });

  if (!miniSession) {
    redirect("/admin/mini-sessions");
  }

  await prisma.miniSession.delete({
    where: { id: miniSession.id }
  });

  revalidatePath("/admin/mini-sessions");
  revalidatePath(`/mini-session/${miniSession.slug}`);
  redirect("/admin/mini-sessions?deleted=1");
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
  const adminUrl = adminMiniSessionUrl(session.id);
  const publicUrl = miniSessionPublicUrl(session.slug);
  let customerEmailSentAt: Date | null = null;
  let adminEmailSentAt: Date | null = null;

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
      cancelUrl
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
      publicUrl
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
  redirect(`/mini-session/${slug}?booked=1`);
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
    await prisma.miniSessionBooking.update({
      where: { id: booking.id },
      data: {
        status: MINI_SESSION_BOOKING_STATUS_CANCELLED,
        cancelledAt: new Date()
      }
    });

    try {
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
        adminUrl: adminMiniSessionUrl(booking.miniSession.id)
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
  redirect(`/mini-session/${booking.miniSession.slug}?cancelled=1`);
}

export async function cancelMiniSessionBookingByAdminAction(bookingId: string) {
  const admin = await requireAdmin();
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
  revalidatePath(`/mini-session/${booking.miniSession.slug}`);
  redirect(`/admin/mini-sessions?bookingCancelled=1#mini-session-${booking.miniSession.id}`);
}
