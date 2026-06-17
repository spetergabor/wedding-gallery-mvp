"use client";

import { useEffect } from "react";
import { recordGalleryViewAction, updateGalleryViewLocationAction } from "@/lib/public-actions";

const VIEW_TRACKING_WINDOW_MS = 1000 * 60 * 60 * 12;

export function GalleryViewTracker({ galleryId }: { galleryId: string }) {
  useEffect(() => {
    const storageKey = `wgm-gallery-view-${galleryId}`;
    const preciseStorageKey = `wgm-gallery-view-precise-${galleryId}`;
    const lastTrackedAt = Number(window.localStorage.getItem(storageKey) ?? 0);
    const lastPreciseTrackedAt = Number(window.localStorage.getItem(preciseStorageKey) ?? 0);
    const hasRecentView = lastTrackedAt && Date.now() - lastTrackedAt < VIEW_TRACKING_WINDOW_MS;
    const hasRecentPreciseView = lastPreciseTrackedAt && Date.now() - lastPreciseTrackedAt < VIEW_TRACKING_WINDOW_MS;

    if (hasRecentView && hasRecentPreciseView) {
      return;
    }

    if (!hasRecentView) {
      window.localStorage.setItem(storageKey, String(Date.now()));
    }

    recordGalleryViewAction(galleryId)
      .then((result) => {
        if (!result.ok || !result.viewId || !("geolocation" in navigator)) {
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            updateGalleryViewLocationAction({
              galleryId,
              viewId: result.viewId,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            })
              .then(() => {
                window.localStorage.setItem(preciseStorageKey, String(Date.now()));
              })
              .catch(() => undefined);
          },
          () => {
            window.localStorage.setItem(preciseStorageKey, String(Date.now()));
          },
          {
            enableHighAccuracy: false,
            maximumAge: 1000 * 60 * 30,
            timeout: 8000
          }
        );
      })
      .catch(() => {
        window.localStorage.removeItem(storageKey);
      });
  }, [galleryId]);

  return null;
}
