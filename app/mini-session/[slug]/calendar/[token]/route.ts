import { NextResponse } from "next/server";
import { miniSessionBookingCalendarUrl, miniSessionBookingCancelUrl } from "@/lib/email";
import { buildMiniSessionCalendarIcs, miniSessionCalendarFilename } from "@/lib/mini-session-calendar";
import { MINI_SESSION_BOOKING_STATUS_CANCELLED, normalizeMiniSessionLanguage } from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

function plainTextResponse(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

function miniSessionCalendarUid(bookingId: string) {
  return `mini-session-${bookingId}@spetly.app`;
}

function calendarDescriptionCopy(language: "hu" | "de") {
  return language === "de"
    ? {
        booked: "Mini-Session-Buchung.",
        cancelled: "Die Mini-Session-Buchung wurde storniert.",
        location: "Ort",
        name: "Name",
        email: "E-Mail",
        phone: "Telefon",
        attendeeCount: "Personen",
        cancel: "Termin stornieren"
      }
    : {
        booked: "Mini session foglalás.",
        cancelled: "A mini session foglalás törölve lett.",
        location: "Helyszín",
        name: "Név",
        email: "Email",
        phone: "Telefon",
        attendeeCount: "Létszám",
        cancel: "Időpont törlése"
      };
}

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: Promise<{ slug: string; token: string }>;
  }
) {
  const { slug, token } = await params;

  if (!slug || !token) {
    return plainTextResponse("Érvénytelen naptár link.", 404);
  }

  const booking = await prisma.miniSessionBooking.findUnique({
    where: { cancelToken: token },
    include: {
      miniSession: true
    }
  });

  if (!booking || booking.miniSession.slug !== slug) {
    return plainTextResponse("Érvénytelen naptár link.", 404);
  }

  const isCancelled = booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED;
  const calendarUrl = miniSessionBookingCalendarUrl(slug, token);
  const cancelUrl = miniSessionBookingCancelUrl(slug, token);
  const language = normalizeMiniSessionLanguage(booking.miniSession.language);
  const copy = calendarDescriptionCopy(language);
  const description = [
    isCancelled ? copy.cancelled : copy.booked,
    `${copy.location}: ${booking.miniSession.location}`,
    `${copy.name}: ${booking.name}`,
    `${copy.email}: ${booking.email}`,
    `${copy.phone}: ${booking.phone}`,
    `${copy.attendeeCount}: ${booking.attendeeCount}`,
    isCancelled ? null : `${copy.cancel}: ${cancelUrl}`
  ].filter(Boolean).join("\n");
  const ics = buildMiniSessionCalendarIcs({
    uid: miniSessionCalendarUid(booking.id),
    sessionTitle: booking.miniSession.title,
    location: booking.miniSession.location,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    createdAt: booking.createdAt,
    updatedAt: booking.cancelledAt ?? booking.updatedAt,
    url: calendarUrl,
    status: isCancelled ? "CANCELLED" : "CONFIRMED",
    method: isCancelled ? "CANCEL" : "PUBLISH",
    sequence: isCancelled ? 1 : 0,
    description
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${miniSessionCalendarFilename(booking.miniSession.title, isCancelled ? "CANCELLED" : "CONFIRMED")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
