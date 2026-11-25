import assert from "node:assert/strict";
import test from "node:test";
import { summarizeCityBookingEvent } from "../city-bookings";

test("counts real bookings separately while blocked slots still consume capacity", () => {
  const summary = summarizeCityBookingEvent({
    bookingMode: "single_day",
    sessionDate: new Date("2026-11-28T08:00:00.000Z"),
    startsAt: new Date("2026-11-28T08:00:00.000Z"),
    endsAt: new Date("2026-11-28T10:00:00.000Z"),
    durationMinutes: 30,
    eventDays: [],
    availabilityRules: [],
    bookings: [
      { startsAt: new Date("2026-11-28T08:00:00.000Z"), endsAt: new Date("2026-11-28T08:30:00.000Z"), status: "booked", source: "client" },
      { startsAt: new Date("2026-11-28T08:30:00.000Z"), endsAt: new Date("2026-11-28T09:00:00.000Z"), status: "cancelled", source: "client" },
      { startsAt: new Date("2026-11-28T09:00:00.000Z"), endsAt: new Date("2026-11-28T09:30:00.000Z"), status: "booked", source: "blocked" }
    ]
  });

  assert.deepEqual(summary, { bookingCount: 1, totalSlots: 4, freeSlots: 2 });
});
