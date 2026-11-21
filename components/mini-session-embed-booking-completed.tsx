"use client";

import { useEffect } from "react";

const BOOKING_COMPLETED_MESSAGE = "spetly:booking-completed";

export function MiniSessionEmbedBookingCompleted({
  eventId,
  slug
}: {
  eventId: string;
  slug: string;
}) {
  useEffect(() => {
    if (window.self === window.top) {
      return;
    }

    const storageKey = `${BOOKING_COMPLETED_MESSAGE}:${eventId}`;

    try {
      if (window.sessionStorage.getItem(storageKey)) {
        return;
      }

      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // The conversion signal can still be delivered when session storage is unavailable.
    }

    window.parent.postMessage(
      {
        type: BOOKING_COMPLETED_MESSAGE,
        eventId,
        slug
      },
      "*"
    );
  }, [eventId, slug]);

  return null;
}
