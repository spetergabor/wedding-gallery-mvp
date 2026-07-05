import {
  miniSessionBookingCalendarUrl,
  miniSessionBookingCancelUrl,
  sendMiniSessionReminderEmail
} from "@/lib/email";
import {
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_SOURCE_CLIENT,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  normalizeMiniSessionLanguage
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

const HOUR_MS = 60 * 60 * 1000;
const REMINDER_LOOKAHEAD_HOURS = 36;
const DEFAULT_REMINDER_LIMIT = 50;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function sendMiniSessionReminderEmails({
  now = new Date(),
  limit = DEFAULT_REMINDER_LIMIT
}: {
  now?: Date;
  limit?: number;
} = {}) {
  const windowEnd = new Date(now.getTime() + REMINDER_LOOKAHEAD_HOURS * HOUR_MS);
  const bookings = await prisma.miniSessionBooking.findMany({
    where: {
      status: MINI_SESSION_BOOKING_STATUS_BOOKED,
      source: { not: MINI_SESSION_BOOKING_SOURCE_BLOCKED },
      reminderEmailSentAt: null,
      startsAt: {
        gt: now,
        lte: windowEnd
      },
      attendeeCount: { gt: 0 }
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    include: {
      miniSession: {
        select: {
          title: true,
          slug: true,
          location: true,
          sessionDate: true,
          language: true,
          admin: {
            select: {
              email: true
            }
          }
        }
      }
    }
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const booking of bookings) {
    const email = normalizeEmail(booking.email);
    const adminEmail = normalizeEmail(booking.miniSession.admin.email);

    if (!isValidEmail(email) || (booking.source !== MINI_SESSION_BOOKING_SOURCE_CLIENT && email === adminEmail)) {
      skipped += 1;
      continue;
    }

    const language = normalizeMiniSessionLanguage(booking.miniSession.language);

    try {
      const wasSent = await sendMiniSessionReminderEmail({
        to: email,
        sessionTitle: booking.miniSession.title,
        sessionDate: booking.miniSession.sessionDate,
        location: booking.miniSession.location,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        name: booking.name,
        attendeeCount: booking.attendeeCount,
        cancelUrl: miniSessionBookingCancelUrl(booking.miniSession.slug, booking.cancelToken),
        calendarUrl: miniSessionBookingCalendarUrl(booking.miniSession.slug, booking.cancelToken),
        calendarButtonLabel: language === "de" ? "Zum Kalender hinzufügen" : "Naptárhoz adás",
        language
      });

      if (!wasSent) {
        skipped += 1;
        continue;
      }

      await prisma.miniSessionBooking.update({
        where: { id: booking.id },
        data: { reminderEmailSentAt: new Date() }
      });

      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("Mini session reminder email failed", {
        bookingId: booking.id,
        miniSessionSlug: booking.miniSession.slug,
        error
      });
    }
  }

  return {
    checked: bookings.length,
    sent,
    skipped,
    failed,
    windowEnd: windowEnd.toISOString()
  };
}
