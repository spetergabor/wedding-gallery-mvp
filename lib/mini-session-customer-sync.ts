import type { MiniSessionBooking, Prisma } from "@prisma/client";
import { APP_TIME_ZONE } from "@/lib/date-format";

export const MINI_SESSION_CUSTOMER_TAG = "mini shooting";

type MiniSessionForCustomerSync = {
  id: string;
  adminId: string;
  title: string;
  location: string;
  language: string;
};

function uniqueTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function projectTime(date: Date) {
  return date.toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
    timeZone: APP_TIME_ZONE
  });
}

function miniSessionProjectNotes(booking: MiniSessionBooking) {
  return [
    "Automatikusan létrehozva mini shooting foglalásból.",
    `Foglaló neve: ${booking.name}`,
    `Email: ${booking.email}`,
    `Telefon: ${booking.phone}`,
    `Létszám: ${booking.attendeeCount}`
  ].join("\n");
}

async function findOrCreateMiniSessionCustomer(
  tx: Prisma.TransactionClient,
  session: MiniSessionForCustomerSync,
  booking: MiniSessionBooking
) {
  const existingCustomer = await tx.customer.findFirst({
    where: {
      adminId: session.adminId,
      OR: [
        { primaryEmail: { equals: booking.email, mode: "insensitive" } },
        { secondaryEmail: { equals: booking.email, mode: "insensitive" } },
        { wifeEmail: { equals: booking.email, mode: "insensitive" } },
        { husbandEmail: { equals: booking.email, mode: "insensitive" } },
        { partnerEmail: { equals: booking.email, mode: "insensitive" } }
      ]
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phone: true,
      weddingDate: true,
      venue: true,
      tags: true
    }
  });

  if (existingCustomer) {
    const tags = uniqueTags([...existingCustomer.tags, MINI_SESSION_CUSTOMER_TAG]);
    const updateData: Prisma.CustomerUpdateInput = {
      tags
    };

    if (!existingCustomer.phone && booking.phone) {
      updateData.phone = booking.phone;
    }

    if (!existingCustomer.weddingDate) {
      updateData.weddingDate = booking.startsAt;
    }

    if (!existingCustomer.venue && session.location) {
      updateData.venue = session.location;
    }

    return tx.customer.update({
      where: { id: existingCustomer.id },
      data: updateData,
      select: { id: true }
    });
  }

  return tx.customer.create({
    data: {
      adminId: session.adminId,
      customerType: "mini_session",
      coupleName: booking.name,
      primaryEmail: booking.email,
      phone: booking.phone,
      weddingDate: booking.startsAt,
      venue: session.location || null,
      preferredLanguage: session.language === "hu" ? "hu" : "de",
      status: "booked",
      tags: [MINI_SESSION_CUSTOMER_TAG]
    },
    select: { id: true }
  });
}

export async function linkMiniSessionBookingToCustomerProject({
  tx,
  session,
  booking
}: {
  tx: Prisma.TransactionClient;
  session: MiniSessionForCustomerSync;
  booking: MiniSessionBooking;
}) {
  const customer = await findOrCreateMiniSessionCustomer(tx, session, booking);
  const project = await tx.customerProject.create({
    data: {
      customerId: customer.id,
      title: session.title,
      projectType: "mini_session",
      status: "planned",
      eventDate: booking.startsAt,
      startTime: projectTime(booking.startsAt),
      endTime: projectTime(booking.endsAt),
      venue: session.location || null,
      notes: miniSessionProjectNotes(booking)
    },
    select: { id: true }
  });

  return tx.miniSessionBooking.update({
    where: { id: booking.id },
    data: {
      customerId: customer.id,
      projectId: project.id
    }
  });
}

export async function cleanupMiniSessionBookingCustomerProject({
  tx,
  booking
}: {
  tx: Prisma.TransactionClient;
  booking: Pick<MiniSessionBooking, "id" | "customerId" | "projectId">;
}) {
  if (booking.projectId) {
    const project = await tx.customerProject.findFirst({
      where: {
        id: booking.projectId,
        projectType: "mini_session",
        miniSessionBookings: {
          some: { id: booking.id }
        }
      },
      select: { id: true }
    });

    if (project) {
      await tx.customerProject.delete({
        where: { id: project.id }
      });
    }
  }

  if (!booking.customerId) {
    return;
  }

  const customer = await tx.customer.findUnique({
    where: { id: booking.customerId },
    select: {
      id: true,
      customerType: true,
      tags: true,
      _count: {
        select: {
          projects: true,
          galleries: true,
          contracts: true,
          invoices: true,
          albumReviews: true,
          albumDesigns: true,
          portalImages: true,
          vendors: true
        }
      }
    }
  });

  if (!customer) {
    return;
  }

  const otherMiniSessionBookingCount = await tx.miniSessionBooking.count({
    where: {
      customerId: customer.id,
      id: { not: booking.id }
    }
  });
  const hasOtherCustomerWork =
    customer._count.projects > 0 ||
    customer._count.galleries > 0 ||
    customer._count.contracts > 0 ||
    customer._count.invoices > 0 ||
    customer._count.albumReviews > 0 ||
    customer._count.albumDesigns > 0 ||
    customer._count.portalImages > 0 ||
    customer._count.vendors > 0 ||
    otherMiniSessionBookingCount > 0;

  if (customer.customerType === "mini_session" && customer.tags.includes(MINI_SESSION_CUSTOMER_TAG) && !hasOtherCustomerWork) {
    await tx.customer.delete({
      where: { id: customer.id }
    });
  }
}
