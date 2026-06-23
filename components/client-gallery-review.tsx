"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, CheckCircle2, Copy, ExternalLink, Eye, EyeOff, Film, ImageIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/button";
import { SocialShareButtons } from "@/components/social-share-buttons";
import { toggleClientPhotoVisibilityAction } from "@/lib/client-gallery-actions";

type ClientPhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  mediaType: string;
  processingStatus: string;
  isClientHidden: boolean;
};

type SaveNotice = {
  hidden: boolean;
  zipRefreshing: boolean;
};

function getClientPreviewUrl(photo: ClientPhoto) {
  if (photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl) {
    return photo.thumbnailUrl;
  }

  if (photo.previewUrl && photo.previewUrl !== photo.imageUrl) {
    return photo.previewUrl;
  }

  return photo.imageUrl;
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
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
  const [copied, setCopied] = useState(false);
  const publicHref = `/g/${publicSlug}`;
  const hiddenCount = hiddenPhotoIds.size;
  const visibleCount = photos.length - hiddenCount;

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
      setError(result.message ?? "Die Sichtbarkeit des Fotos konnte nicht geändert werden.");
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
    setSaveNotice({
      hidden: nextHidden,
      zipRefreshing: Boolean(result.zipRefreshing)
    });
    window.setTimeout(() => setSaveNotice(null), 4500);
    setPendingPhotoId(null);
  }

  return (
    <>
      {error ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="mb-5 rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass">Öffentliche Gästegalerie</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              {visibleCount} sichtbar · {hiddenCount} ausgeblendet
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
              Jede Änderung wird sofort gespeichert. Die öffentliche Galerie und das Download-Paket werden automatisch aktualisiert.
            </p>
          </div>
          <div className="grid min-w-[220px] grid-cols-2 gap-2 text-center">
            <div className="rounded-md bg-paper px-3 py-2">
              <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">Sichtbar</p>
              <p className="mt-1 text-xl font-semibold text-ink">{visibleCount}</p>
            </div>
            <div className="rounded-md bg-paper px-3 py-2">
              <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">Ausgeblendet</p>
              <p className="mt-1 text-xl font-semibold text-ink">{hiddenCount}</p>
            </div>
          </div>
        </div>

        {saveNotice ? (
          <div className="mt-4 rounded-md border border-sage/25 bg-sage/10 px-4 py-3 text-sm text-ink">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0 text-sage" size={17} />
              <div>
                <p className="font-medium">
                  Gespeichert: Das Foto ist jetzt {saveNotice.hidden ? "nicht mehr für Gäste sichtbar" : "wieder für Gäste sichtbar"}.
                </p>
                <p className="mt-1 text-graphite/70">
                  Die öffentliche Galerie ist aktualisiert.
                  {saveNotice.zipRefreshing ? " Das Download-Paket wird im Hintergrund neu vorbereitet." : " Das aktuelle Download-Paket bleibt passend."}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col justify-end gap-3 sm:flex-row">
          <Button type="button" variant="secondary" onClick={copyPublicLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Öffentlicher Link kopiert" : "Öffentlichen Link kopieren"}
          </Button>
          <a
            href={publicHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
          >
            <ExternalLink size={16} />
            Öffentliche Galerie öffnen
          </a>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => {
          const isHidden = hiddenPhotoIds.has(photo.id);
          const isPending = pendingPhotoId === photo.id;

          return (
            <article key={photo.id} className={`overflow-hidden rounded-lg border bg-white shadow-soft ${isHidden ? "border-brass/40" : "border-ink/10"}`}>
              <div className="relative aspect-[4/3] bg-mist">
                {photo.mediaType === "video" ? (
                  <div className={`relative h-full w-full bg-ink transition ${isHidden ? "opacity-45 grayscale" : ""}`}>
                    <video src={photo.imageUrl} preload="metadata" muted playsInline className="h-full w-full object-cover opacity-85" />
                    <span className="absolute inset-0 grid place-items-center text-white">
                      <span className="inline-flex items-center gap-2 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-ink shadow-soft">
                        <Film size={16} />
                        Video
                      </span>
                    </span>
                  </div>
                ) : getClientPreviewUrl(photo) ? (
                  <Image
                    src={getClientPreviewUrl(photo)}
                    alt={photo.filename}
                    fill
                    unoptimized
                    loading="lazy"
                    className={`object-cover transition ${isHidden ? "opacity-45 grayscale" : ""}`}
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                  />
                ) : (
                  <div className={`grid h-full w-full place-items-center text-graphite/60 transition ${isHidden ? "opacity-45 grayscale" : ""}`}>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <ImageIcon size={24} />
                      <span className="text-xs font-medium">Vorschau wird erstellt</span>
                    </div>
                  </div>
                )}
                {isHidden ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-ink/85 px-2.5 py-1 text-xs font-medium text-white">
                    <EyeOff size={13} />
                    Nicht für Gäste sichtbar
                  </span>
                ) : (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-ink shadow-soft">
                    <Eye size={13} />
                    Für Gäste sichtbar
                  </span>
                )}
              </div>
              <div className="space-y-3 p-3">
                <p className="truncate text-sm font-medium text-ink">{photo.filename}</p>
                <p className="text-xs leading-5 text-graphite/65">
                  {isHidden
                    ? "Dieses Foto bleibt hier sichtbar, erscheint aber nicht in der öffentlichen Galerie oder im Gäste-Download."
                    : "Dieses Foto erscheint in der öffentlichen Galerie und im Gäste-Download."}
                </p>
                <Button
                  type="button"
                  variant={isHidden ? "secondary" : "danger"}
                  className="w-full"
                  disabled={isPending}
                  onClick={() => void togglePhoto(photo.id)}
                >
                  {isPending ? <RefreshCw className="animate-spin" size={16} /> : isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                  {isPending ? "Wird gespeichert" : isHidden ? "Für Gäste wieder anzeigen" : "Für Gäste ausblenden"}
                </Button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-8 rounded-lg border border-ink/10 bg-white p-5 text-center shadow-soft">
        <p className="text-lg font-semibold text-ink">Seid ihr mit dem Ausblenden fertig?</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-graphite/70">
          Ihr müsst nichts extra speichern. In der öffentlichen Galerie erscheinen nur die Fotos, die als sichtbar markiert sind; den Link könnt ihr an Familie und Gäste weitergeben.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" variant="secondary" onClick={copyPublicLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Öffentlicher Link kopiert" : "Öffentlichen Link kopieren"}
          </Button>
          <a
            href={publicHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
          >
            <ExternalLink size={16} />
            Öffentliche Galerie teilen
          </a>
        </div>
        <div className="mt-4 flex justify-center">
          <SocialShareButtons path={publicHref} title={title} variant="card" />
        </div>
      </section>
    </>
  );
}
