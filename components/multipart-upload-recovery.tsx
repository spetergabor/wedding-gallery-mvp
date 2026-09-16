"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { recoverStalePhotoMultipartUploadsAction } from "@/lib/gallery-actions";

const RECOVERY_POLL_INTERVAL_MS = 15_000;

export function MultipartUploadRecovery({ galleryId }: { galleryId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    async function recover() {
      try {
        const result = await recoverStalePhotoMultipartUploadsAction(galleryId);

        if (cancelled) {
          return;
        }

        if (result.completedCount > 0) {
          router.refresh();
        }

        if (result.pendingCount > 0) {
          timeout = setTimeout(recover, RECOVERY_POLL_INTERVAL_MS);
        }
      } catch (error) {
        console.error("Multipart upload recovery check failed", error);

        if (!cancelled) {
          timeout = setTimeout(recover, RECOVERY_POLL_INTERVAL_MS);
        }
      }
    }

    void recover();

    return () => {
      cancelled = true;

      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [galleryId, router]);

  return null;
}
