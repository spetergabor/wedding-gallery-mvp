"use client";

import { useEffect } from "react";
import { recordGalleryViewAction, updateGalleryViewLocationAction } from "@/lib/public-actions";

const VIEW_TRACKING_WINDOW_MS = 1000 * 60 * 60 * 12;
const VIEW_TRACKING_DELAY_MS = 5000;

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

    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    let trackingStarted = false;

    const removeInteractionListeners = () => {
      window.removeEventListener("pointerdown", startTracking);
      window.removeEventListener("keydown", startTracking);
      window.removeEventListener("scroll", startTracking);
    };

    const requestPreciseLocation = (viewId: string) => {
      if (!("geolocation" in navigator) || hasRecentPreciseView) {
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateGalleryViewLocationAction({
            galleryId,
            viewId,
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
    };

    function startTracking() {
      if (trackingStarted || document.visibilityState !== "visible") {
        return;
      }

      trackingStarted = true;
      removeInteractionListeners();

      if (delayTimer) {
        clearTimeout(delayTimer);
        delayTimer = null;
      }

      recordGalleryViewAction(galleryId)
        .then((result) => {
          if (!result.ok || !result.viewId) {
            return;
          }

          window.localStorage.setItem(storageKey, String(Date.now()));
          requestPreciseLocation(result.viewId);
        })
        .catch(() => {
          trackingStarted = false;
        });
    }

    const scheduleDelayedTracking = () => {
      if (trackingStarted || delayTimer || document.visibilityState !== "visible") {
        return;
      }

      delayTimer = setTimeout(startTracking, VIEW_TRACKING_DELAY_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleDelayedTracking();
        return;
      }

      if (delayTimer) {
        clearTimeout(delayTimer);
        delayTimer = null;
      }
    };

    window.addEventListener("pointerdown", startTracking, { passive: true });
    window.addEventListener("keydown", startTracking);
    window.addEventListener("scroll", startTracking, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleDelayedTracking();

    return () => {
      if (delayTimer) {
        clearTimeout(delayTimer);
      }

      removeInteractionListeners();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [galleryId]);

  return null;
}
