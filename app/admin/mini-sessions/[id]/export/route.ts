import { notFound } from "next/navigation";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { APP_TIME_ZONE } from "@/lib/date-format";
import {
  formatMiniSessionDate,
  formatMiniSessionSlot,
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_SOURCE_MANUAL,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_COMPLETED,
  MINI_SESSION_BOOKING_STATUS_NO_SHOW,
  MINI_SESSION_BOOKING_STATUS_CANCELLED
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const csvHeaders = [
  "Session",
  "Dátum",
  "Idősáv",
  "Név",
  "E-mail",
  "Telefonszám",
  "Létszám",
  "Típus",
  "Státusz",
  "Megjegyzés",
  "Létrehozva",
  "Törölve"
];

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvCell).join(";");
}

function bookingSourceLabel(source: string) {
  if (source === MINI_SESSION_BOOKING_SOURCE_BLOCKED) {
    return "Blokkolt idősáv";
  }

  if (source === MINI_SESSION_BOOKING_SOURCE_MANUAL) {
    return "Kézi foglalás";
  }

  return "Ügyfél";
}

function bookingStatusLabel(status: string) {
  if (status === MINI_SESSION_BOOKING_STATUS_BOOKED) {
    return "Foglalt";
  }

  if (status === MINI_SESSION_BOOKING_STATUS_CANCELLED) {
    return "Törölt";
  }

  if (status === MINI_SESSION_BOOKING_STATUS_COMPLETED) {
    return "Kész";
  }

  if (status === MINI_SESSION_BOOKING_STATUS_NO_SHOW) {
    return "Nem jelent meg";
  }

  return status;
}

function formatCsvDateTime(date: Date | null | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleString("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  });
}

function csvFilename(title: string) {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${slug || "mini-session"}-foglalasok.csv`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const session = await prisma.miniSession.findFirst({
    where: {
      id,
      ...adminOwnedWhere(admin)
    },
    include: {
      bookings: {
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!session) {
    notFound();
  }

  const rows = [
    csvRow(csvHeaders),
    ...session.bookings.map((booking) =>
      csvRow([
        session.title,
        formatMiniSessionDate(booking.startsAt, "hu"),
        formatMiniSessionSlot(booking.startsAt, booking.endsAt, "hu"),
        booking.name,
        booking.email,
        booking.phone,
        booking.attendeeCount,
        bookingSourceLabel(booking.source),
        bookingStatusLabel(booking.status),
        booking.adminNote,
        formatCsvDateTime(booking.createdAt),
        formatCsvDateTime(booking.cancelledAt)
      ])
    )
  ];

  const csv = `\uFEFF${rows.join("\r\n")}\r\n`;
  const filename = csvFilename(session.title);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
