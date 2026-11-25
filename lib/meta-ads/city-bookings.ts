import {
  createMiniSessionSlots,
  filterMiniSessionSlotsByBusyTimes,
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_STATUS_CANCELLED
} from "@/lib/mini-sessions";

type CityBookingEvent = {
  bookingMode?: string | null;
  bookingWindowDays?: number | null;
  sessionDate: Date;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  eventDays: Array<{ date: Date; startsAt: string; endsAt: string }>;
  availabilityRules: Array<{ weekday: number; startsAt: string; endsAt: string; isActive: boolean }>;
  bookings: Array<{ startsAt: Date; endsAt: Date; status: string; source: string }>;
};

export function summarizeCityBookingEvent(event: CityBookingEvent) {
  const slots = createMiniSessionSlots(event);
  const occupiedBookings = event.bookings.filter((booking) => booking.status.toLowerCase() !== MINI_SESSION_BOOKING_STATUS_CANCELLED);
  const actualBookingCount = occupiedBookings.filter((booking) => booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED).length;
  return {
    bookingCount: actualBookingCount,
    totalSlots: slots.length,
    freeSlots: filterMiniSessionSlotsByBusyTimes(slots, occupiedBookings).length
  };
}
