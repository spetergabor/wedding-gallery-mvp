"use client";

import { useEffect } from "react";
import { recordGalleryViewAction } from "@/lib/public-actions";

const VIEW_TRACKING_WINDOW_MS = 1000 * 60 * 60 * 12;

export function GalleryViewTracker({ galleryId }: { galleryId: string }) {
  useEffect(() => {
    const storageKey = `wgm-gallery-view-${galleryId}`;
    const lastTrackedAt = Number(window.localStorage.getItem(storageKey) ?? 0);

    if (lastTrackedAt && Date.now() - lastTrackedAt < VIEW_TRACKING_WINDOW_MS) {
      return;
    }

    window.localStorage.setItem(storageKey, String(Date.now()));
    recordGalleryViewAction(galleryId).catch(() => {
      window.localStorage.removeItem(storageKey);
    });
  }, [galleryId]);

  return null;
}
