"use client";

import Image from "next/image";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/button";
import { toggleClientPhotoVisibilityAction } from "@/lib/client-gallery-actions";

type ClientPhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  isClientHidden: boolean;
};

export function ClientGalleryReview({
  galleryId,
  token,
  photos
}: {
  galleryId: string;
  token: string;
  photos: ClientPhoto[];
}) {
  const [hiddenPhotoIds, setHiddenPhotoIds] = useState<Set<string>>(
    () => new Set(photos.filter((photo) => photo.isClientHidden).map((photo) => photo.id))
  );
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function togglePhoto(photoId: string) {
    const nextHidden = !hiddenPhotoIds.has(photoId);
    setPendingPhotoId(photoId);
    setError("");

    const result = await toggleClientPhotoVisibilityAction({
      galleryId,
      photoId,
      token,
      hidden: nextHidden
    });

    if (!result.ok) {
      setError(result.message ?? "Nem sikerült módosítani a kép láthatóságát.");
      setPendingPhotoId(null);
      return;
    }

    setHiddenPhotoIds((current) => {
      const next = new Set(current);

      if (nextHidden) {
        next.add(photoId);
      } else {
        next.delete(photoId);
      }

      return next;
    });
    setPendingPhotoId(null);
  }

  return (
    <>
      {error ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="mb-5 rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
        <p className="text-sm font-medium text-ink">{hiddenPhotoIds.size} kép elrejtve a publikus galériából</p>
        <p className="mt-1 text-sm text-graphite/70">
          Az elrejtett képek itt továbbra is láthatók, de a normál publikus galériában nem jelennek meg.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => {
          const isHidden = hiddenPhotoIds.has(photo.id);

          return (
            <article key={photo.id} className={`overflow-hidden rounded-lg border bg-white shadow-soft ${isHidden ? "border-brass/40" : "border-ink/10"}`}>
              <div className="relative aspect-[4/3] bg-mist">
                <Image
                  src={photo.thumbnailUrl}
                  alt={photo.filename}
                  fill
                  className={`object-cover transition ${isHidden ? "opacity-45 grayscale" : ""}`}
                  sizes="(min-width: 1024px) 33vw, 50vw"
                />
                {isHidden ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-ink/85 px-2.5 py-1 text-xs font-medium text-white">
                    <EyeOff size={13} />
                    Elrejtve
                  </span>
                ) : null}
              </div>
              <div className="space-y-3 p-3">
                <p className="truncate text-sm font-medium text-ink">{photo.filename}</p>
                <Button
                  type="button"
                  variant={isHidden ? "secondary" : "danger"}
                  className="w-full"
                  disabled={pendingPhotoId === photo.id}
                  onClick={() => void togglePhoto(photo.id)}
                >
                  {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                  {isHidden ? "Visszatenni a publikus galériába" : "Elrejteni a publikus galériából"}
                </Button>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
