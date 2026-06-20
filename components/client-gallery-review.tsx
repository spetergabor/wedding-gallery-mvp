"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, Copy, ExternalLink, Eye, EyeOff, Film, ImageIcon } from "lucide-react";
import { Button } from "@/components/button";
import { SocialShareButtons } from "@/components/social-share-buttons";
import { toggleClientPhotoVisibilityAction } from "@/lib/client-gallery-actions";

type ClientPhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  mediaType: string;
  processingStatus: string;
  isClientHidden: boolean;
};

function hasLightweightThumbnail(photo: ClientPhoto) {
  return photo.mediaType !== "video" && photo.processingStatus === "ready" && photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl;
}

export function ClientGalleryReview({
  galleryId,
  publicSlug,
  title,
  token,
  photos
}: {
  galleryId: string;
  publicSlug: string;
  title: string;
  token: string;
  photos: ClientPhoto[];
}) {
  const [hiddenPhotoIds, setHiddenPhotoIds] = useState<Set<string>>(
    () => new Set(photos.filter((photo) => photo.isClientHidden).map((photo) => photo.id))
  );
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const publicHref = `/g/${publicSlug}`;

  async function copyPublicLink() {
    const publicUrl = new URL(publicHref, window.location.origin).toString();

    try {
      await window.navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

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
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-medium text-ink">{hiddenPhotoIds.size} kép elrejtve a publikus galériából</p>
            <p className="mt-1 text-sm text-graphite/70">
              Az elrejtett képek itt továbbra is láthatók, de a normál publikus galériában nem jelennek meg.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="secondary" onClick={copyPublicLink}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Publikus link másolva" : "Publikus link másolása"}
            </Button>
            <a
              href={publicHref}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
            >
              <ExternalLink size={16} />
              Publikus galéria megosztása
            </a>
          </div>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => {
          const isHidden = hiddenPhotoIds.has(photo.id);

          return (
            <article key={photo.id} className={`overflow-hidden rounded-lg border bg-white shadow-soft ${isHidden ? "border-brass/40" : "border-ink/10"}`}>
              <div className="relative aspect-[4/3] bg-mist">
                {photo.mediaType === "video" ? (
                  <div className={`relative h-full w-full bg-ink transition ${isHidden ? "opacity-45 grayscale" : ""}`}>
                    <video src={photo.imageUrl} preload="metadata" muted playsInline className="h-full w-full object-cover opacity-85" />
                    <span className="absolute inset-0 grid place-items-center text-white">
                      <span className="inline-flex items-center gap-2 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-ink shadow-soft">
                        <Film size={16} />
                        Videó
                      </span>
                    </span>
                  </div>
                ) : hasLightweightThumbnail(photo) ? (
                  <Image
                    src={photo.thumbnailUrl}
                    alt={photo.filename}
                    fill
                    unoptimized
                    className={`object-cover transition ${isHidden ? "opacity-45 grayscale" : ""}`}
                    sizes="(min-width: 1024px) 33vw, 50vw"
                  />
                ) : (
                  <div className={`grid h-full w-full place-items-center text-graphite/60 transition ${isHidden ? "opacity-45 grayscale" : ""}`}>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <ImageIcon size={24} />
                      <span className="text-xs font-medium">Előnézet készül</span>
                    </div>
                  </div>
                )}
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

      <section className="mt-8 rounded-lg border border-ink/10 bg-white p-5 text-center shadow-soft">
        <p className="text-lg font-semibold text-ink">Elkészültetek az elrejtéssel?</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-graphite/70">
          A publikus galériában már csak azok a képek jelennek meg, amelyeket nem rejtettetek el. Ezt a linket küldhetitek tovább családnak és vendégeknek.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" variant="secondary" onClick={copyPublicLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Publikus link másolva" : "Publikus link másolása"}
          </Button>
          <a
            href={publicHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
          >
            <ExternalLink size={16} />
            Publikus galéria megosztása
          </a>
        </div>
        <div className="mt-4 flex justify-center">
          <SocialShareButtons path={publicHref} title={title} variant="card" />
        </div>
      </section>
    </>
  );
}
