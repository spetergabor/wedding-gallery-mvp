export type CapacityForecastInput = {
  eventDate: Date | null;
  totalCapacity: number | null;
  booked: number | null;
  averageDailyBookings: number | null;
  currentDailySpend: number | null;
  costPerBooking: number | null;
  now?: Date;
};

export function buildCapacityForecast(input: CapacityForecastInput) {
  const now = input.now ?? new Date();
  const required = {
    eventDate: input.eventDate,
    totalCapacity: input.totalCapacity,
    booked: input.booked,
    averageDailyBookings: input.averageDailyBookings
  };
  const missing = Object.entries(required).filter(([, value]) => value == null).map(([key]) => key);
  if (missing.length) {
    return { reliable: false, missing, generatedAt: now, scenarios: [] as Array<Record<string, unknown>> };
  }

  const totalCapacity = Math.max(0, input.totalCapacity!);
  const booked = Math.min(totalCapacity, Math.max(0, input.booked!));
  const daysRemaining = Math.max(0, Math.ceil((input.eventDate!.getTime() - now.getTime()) / 86_400_000));
  const remainingCapacity = Math.max(0, totalCapacity - booked);
  const scenarios = [
    { name: "conservative", factor: 0.7 },
    { name: "base", factor: 1 },
    { name: "optimistic", factor: 1.3 }
  ].map(({ name, factor }) => {
    const expectedNewBookings = Math.min(remainingCapacity, Math.max(0, input.averageDailyBookings! * factor * daysRemaining));
    const expectedBooked = Math.min(totalCapacity, booked + expectedNewBookings);
    return {
      name,
      factor,
      expectedNewBookings: Number(expectedNewBookings.toFixed(2)),
      expectedBooked: Number(expectedBooked.toFixed(2)),
      expectedUtilization: totalCapacity > 0 ? Number((expectedBooked / totalCapacity).toFixed(4)) : null,
      remainingToFull: Number(Math.max(0, totalCapacity - expectedBooked).toFixed(2))
    };
  });
  return {
    reliable: true,
    generatedAt: now,
    eventDate: input.eventDate,
    daysRemaining,
    totalCapacity,
    booked,
    remainingCapacity,
    assumptions: {
      averageDailyBookings: input.averageDailyBookings,
      currentDailySpend: input.currentDailySpend,
      costPerBooking: input.costPerBooking
    },
    paidMediaProjection: {
      projectedSpendToEvent: input.currentDailySpend == null ? null : Number((Math.max(0, input.currentDailySpend) * daysRemaining).toFixed(2)),
      bookingsAtCurrentEfficiency: input.currentDailySpend == null || !input.costPerBooking || input.costPerBooking <= 0
        ? null
        : Number(((Math.max(0, input.currentDailySpend) * daysRemaining) / input.costPerBooking).toFixed(2)),
      estimatedSpendToFill: !input.costPerBooking || input.costPerBooking <= 0
        ? null
        : Number((remainingCapacity * input.costPerBooking).toFixed(2))
    },
    scenarios,
    note: "Decision support only. No campaign budget is changed automatically."
  };
}
