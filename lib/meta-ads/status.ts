export type DeliveryStatusInput = {
  effectiveStatus?: string | null;
  status?: string | null;
  stopTime?: Date | string | null;
  parentStopTime?: Date | string | null;
};

export function resolveDeliveryStatus(input: DeliveryStatusInput, now = new Date()) {
  const rawStatus = (input.effectiveStatus ?? input.status ?? "UNKNOWN").toUpperCase();
  if (rawStatus === "DELETED" || rawStatus === "ARCHIVED") return rawStatus;

  const endValue = input.stopTime ?? input.parentStopTime;
  if (endValue) {
    const end = endValue instanceof Date ? endValue : new Date(endValue);
    if (Number.isFinite(end.getTime()) && end.getTime() <= now.getTime()) return "COMPLETED";
  }

  return rawStatus;
}
