"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Eye, EyeOff, Film, ImageIcon } from "lucide-react";
import { Button } from "@/components/button";
import { SocialShareButtons } from "@/components/social-share-buttons";
import { toggleClientPhotoVisibilityAction } from "@/lib/client-gallery-actions";

type ClientPhoto = {
  id: string;
  filename: string;
  displayUrl: string;
  mediaType: string;
  processingStatus: string;
  isClientHidden: boolean;
};

function createWatermarkStyle(text: string) {
  const safeText = text || "Preview";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="160" viewBox="0 0 260 160"><text x="130" y="82" text-anchor="middle" dominant-baseline="middle" transform="rotate(-24 130 82)" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="rgba(255,255,255,0.72)" stroke="rgba(23,23,23,0.28)" stroke-width="1">${safeText.replace(/[<>&"']/g, "")}</text></svg>`;

  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: "260px 160px"
  };
}

export function ClientGalleryReview({
  galleryId,
  publicSlug,
  title,
  token,
  photos,
  watermarkEnabled,
  watermarkText
}: {
  galleryId: string;
  publicSlug: string;
  title: string;
  token: string;
  photos: ClientPhoto[];
  watermarkEnabled: boolean;
  watermarkText: string;
}) {
  const [hiddenPhotoIds, setHiddenPhotoIds] = useState<Set<string>>(
    () => new Set(photos.filter((photo) => photo.isClientHidden).map((photo) => photo.id))
  );
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const publicHref = `/g/${publicSlug}`;
  const watermarkStyle = useMemo(() => createWatermarkStyle(watermarkText || title), [title, watermarkText]);

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
            <p className="text-sm font-medium text-ink">{hiddenPhotoIds.size} Fotos in der öffentlichen Galerie ausgeblendet</p>
            <p className="mt-1 text-sm text-graphite/70">
              Ausgeblendete Fotos bleiben hier sichtbar, erscheinen aber nicht in der normalen öffentlichen Galerie.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
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
                    <span className="absolute inset-0 grid place-items-center text-white">
                      <span className="inline-flex items-center gap-2 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-ink shadow-soft">
                        <Film size={16} />
                        Video
                      </span>
                    </span>
                    {watermarkEnabled ? <span className="pointer-events-none absolute inset-0 opacity-70" style={watermarkStyle} /> : null}
                  </div>
                ) : photo.displayUrl ? (
                  <>
                    <Image
                      src={photo.displayUrl}
                      alt={photo.filename}
                      fill
                      unoptimized
                      loading="lazy"
                      className={`object-cover transition ${isHidden ? "opacity-45 grayscale" : ""}`}
                      sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                    />
                    {watermarkEnabled ? <span className="pointer-events-none absolute inset-0 opacity-70" style={watermarkStyle} /> : null}
                  </>
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
                    Ausgeblendet
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
                  {isHidden ? "Wieder in der öffentlichen Galerie anzeigen" : "Aus der öffentlichen Galerie ausblenden"}
                </Button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-8 rounded-lg border border-ink/10 bg-white p-5 text-center shadow-soft">
        <p className="text-lg font-semibold text-ink">Seid ihr mit dem Ausblenden fertig?</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-graphite/70">
          In der öffentlichen Galerie erscheinen jetzt nur noch die Fotos, die ihr nicht ausgeblendet habt. Diesen Link könnt ihr an Familie und Gäste weitergeben.
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
