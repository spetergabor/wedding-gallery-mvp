import {
  createMiniSessionSlots,
  filterMiniSessionSlotsByBusyTimes,
  miniSessionDateKey,
  miniSessionSlotOverlaps,
  parseMiniSessionLocalDateTime,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  type MiniSessionBusyTime,
  type MiniSessionSlot
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

type MiniSessionAvailabilityInput = {
  id?: string;
  adminId: string;
  bookingMode?: string | null;
  bookingWindowDays?: number | null;
  sessionDate?: Date;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  availabilityRules?: Array<{
    weekday: number;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
  }>;
};

function slotRange(slots: MiniSessionSlot[]) {
  if (slots.length === 0) {
    return null;
  }

  return slots.reduce(
    (range, slot) => ({
      startsAt: slot.startsAt < range.startsAt ? slot.startsAt : range.startsAt,
      endsAt: slot.endsAt > range.endsAt ? slot.endsAt : range.endsAt
    }),
    { startsAt: slots[0].startsAt, endsAt: slots[0].endsAt }
  );
}

function addOneDay(date: Date) {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

function projectBusyTime(project: { eventDate: Date | null; startTime: string | null; endTime: string | null }) {
  if (!project.eventDate) {
    return null;
  }

  const dateKey = miniSessionDateKey(project.eventDate);
  const startsAt = parseMiniSessionLocalDateTime(dateKey, project.startTime || "00:00");
  let endsAt = parseMiniSessionLocalDateTime(dateKey, project.endTime || "23:59");

  if (!startsAt || !endsAt) {
    return null;
  }

  if (endsAt <= startsAt) {
    endsAt = addOneDay(endsAt);
  }

  return { startsAt, endsAt };
}

export async function getMiniSessionBusyTimes(adminId: string, slots: MiniSessionSlot[]) {
  const range = slotRange(slots);

  if (!range) {
    return [];
  }

  const rangeStartKey = miniSessionDateKey(range.startsAt);
  const rangeEndKey = miniSessionDateKey(range.endsAt);
  const projectRangeStartsAt = parseMiniSessionLocalDateTime(rangeStartKey, "00:00") ?? range.startsAt;
  const projectRangeEndsAt = parseMiniSessionLocalDateTime(rangeEndKey, "23:59") ?? range.endsAt;

  const [bookings, projects] = await Promise.all([
    prisma.miniSessionBooking.findMany({
      where: {
        status: MINI_SESSION_BOOKING_STATUS_BOOKED,
        startsAt: { lt: range.endsAt },
        endsAt: { gt: range.startsAt },
        miniSession: { adminId }
      },
      select: {
        startsAt: true,
        endsAt: true
      }
    }),
    prisma.customerProject.findMany({
      where: {
        eventDate: {
          gte: projectRangeStartsAt,
          lte: projectRangeEndsAt
        },
        customer: { adminId }
      },
      select: {
        eventDate: true,
        startTime: true,
        endTime: true
      }
    })
  ]);

  const projectBusyTimes = projects
    .map(projectBusyTime)
    .filter((busyTime): busyTime is MiniSessionBusyTime => Boolean(busyTime));

  return [
    ...bookings.map((booking) => ({ startsAt: booking.startsAt, endsAt: booking.endsAt })),
    ...projectBusyTimes
  ];
}

export async function getAvailableMiniSessionSlots(
  session: MiniSessionAvailabilityInput,
  options: { rangeStart?: Date; rangeDays?: number } = {}
) {
  const slots = createMiniSessionSlots(session, options);
  const busyTimes = await getMiniSessionBusyTimes(session.adminId, slots);

  return filterMiniSessionSlotsByBusyTimes(slots, busyTimes);
}

export async function hasMiniSessionSlotConflict(adminId: string, slot: MiniSessionBusyTime) {
  const booking = await prisma.miniSessionBooking.findFirst({
    where: {
      status: MINI_SESSION_BOOKING_STATUS_BOOKED,
      startsAt: { lt: slot.endsAt },
      endsAt: { gt: slot.startsAt },
      miniSession: { adminId }
    },
    select: { id: true }
  });

  if (booking) {
    return true;
  }

  const dateKey = miniSessionDateKey(slot.startsAt);
  const dayStartsAt = parseMiniSessionLocalDateTime(dateKey, "00:00");
  const dayEndsAt = parseMiniSessionLocalDateTime(dateKey, "23:59");

  if (!dayStartsAt || !dayEndsAt) {
    return false;
  }

  const projects = await prisma.customerProject.findMany({
    where: {
      eventDate: {
        gte: dayStartsAt,
        lte: dayEndsAt
      },
      customer: { adminId }
    },
    select: {
      eventDate: true,
      startTime: true,
      endTime: true
    }
  });

  return projects
    .map(projectBusyTime)
    .some((busyTime) => busyTime ? miniSessionSlotOverlaps(slot, busyTime) : false);
}
