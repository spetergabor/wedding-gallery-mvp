import { ensureLeadPipelineSchema } from "@/lib/leads";
import {
  formatMiniSessionSlotWithDate,
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_SOURCE_CLIENT
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

const MINI_SESSION_LEAD_EVENT_TYPE = "mini_session";
const MINI_SESSION_LEAD_STATUS = "booked";

type MiniSessionLeadBooking = {
  id: string;
  name: string;
  email: string;
  phone: string;
  attendeeCount: number;
  startsAt: Date;
  endsAt: Date;
  source: string;
};

type MiniSessionLeadSession = {
  adminId: string;
  title: string;
  slug: string;
  location: string;
  sessionDate: Date;
  admin: {
    email: string;
  };
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function miniSessionLeadNote(booking: MiniSessionLeadBooking, miniSession: MiniSessionLeadSession) {
  return [
    `Mini session foglalás (${booking.id})`,
    `Session: ${miniSession.title}`,
    `Idősáv: ${formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt)}`,
    `Helyszín: ${miniSession.location}`,
    `Létszám: ${booking.attendeeCount}`,
    `Publikus link: /mini-session/${miniSession.slug}`
  ].join("\n");
}

function appendBookingNote(notes: string | null, booking: MiniSessionLeadBooking, miniSession: MiniSessionLeadSession) {
  if (notes?.includes(booking.id)) {
    return notes;
  }

  const bookingNote = miniSessionLeadNote(booking, miniSession);
  return notes ? `${notes}\n\n${bookingNote}` : bookingNote;
}

async function nextLeadSortOrder(adminId: string, status: string) {
  const maxSort = await prisma.lead.aggregate({
    where: {
      adminId,
      status
    },
    _max: { sortOrder: true }
  });

  return (maxSort._max.sortOrder ?? -1) + 1;
}

export async function syncMiniSessionBookingLead({
  booking,
  miniSession
}: {
  booking: MiniSessionLeadBooking;
  miniSession: MiniSessionLeadSession;
}) {
  if (booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED) {
    return { action: "skipped_blocked" as const };
  }

  const email = normalizeEmail(booking.email);
  const adminEmail = normalizeEmail(miniSession.admin.email);

  if (!isValidEmail(email) || (booking.source !== MINI_SESSION_BOOKING_SOURCE_CLIENT && email === adminEmail)) {
    return { action: "skipped_email" as const };
  }

  await ensureLeadPipelineSchema(prisma);

  const existingCustomer = await prisma.customer.findFirst({
    where: {
      adminId: miniSession.adminId,
      OR: [
        { primaryEmail: { equals: email, mode: "insensitive" } },
        { secondaryEmail: { equals: email, mode: "insensitive" } }
      ]
    },
    select: { id: true }
  });

  if (existingCustomer) {
    return { action: "customer_exists" as const, customerId: existingCustomer.id };
  }

  const existingMiniSessionLead = await prisma.lead.findFirst({
    where: {
      adminId: miniSession.adminId,
      email: { equals: email, mode: "insensitive" },
      eventType: MINI_SESSION_LEAD_EVENT_TYPE
    },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, notes: true, status: true }
  });

  if (existingMiniSessionLead) {
    const sortOrder =
      existingMiniSessionLead.status === MINI_SESSION_LEAD_STATUS
        ? undefined
        : await nextLeadSortOrder(miniSession.adminId, MINI_SESSION_LEAD_STATUS);

    await prisma.lead.update({
      where: { id: existingMiniSessionLead.id },
      data: {
        name: booking.name,
        phone: booking.phone || undefined,
        status: MINI_SESSION_LEAD_STATUS,
        sortOrder,
        eventDate: booking.startsAt,
        venue: miniSession.location,
        notes: appendBookingNote(existingMiniSessionLead.notes, booking, miniSession)
      }
    });

    return { action: "updated_mini_session_lead" as const, leadId: existingMiniSessionLead.id };
  }

  const existingLead = await prisma.lead.findFirst({
    where: {
      adminId: miniSession.adminId,
      email: { equals: email, mode: "insensitive" }
    },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, notes: true, phone: true }
  });

  if (existingLead) {
    await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        phone: existingLead.phone || booking.phone || undefined,
        notes: appendBookingNote(existingLead.notes, booking, miniSession)
      }
    });

    return { action: "updated_existing_lead" as const, leadId: existingLead.id };
  }

  const lead = await prisma.lead.create({
    data: {
      adminId: miniSession.adminId,
      name: booking.name,
      email,
      phone: booking.phone || null,
      eventType: MINI_SESSION_LEAD_EVENT_TYPE,
      eventDate: booking.startsAt,
      venue: miniSession.location,
      status: MINI_SESSION_LEAD_STATUS,
      sortOrder: await nextLeadSortOrder(miniSession.adminId, MINI_SESSION_LEAD_STATUS),
      notes: miniSessionLeadNote(booking, miniSession)
    }
  });

  return { action: "created" as const, leadId: lead.id };
}
