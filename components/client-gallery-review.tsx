"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, CheckCircle2, Copy, ExternalLink, Eye, EyeOff, Film, ImageIcon, RefreshCw, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/button";
import { SocialShareButtons } from "@/components/social-share-buttons";
import { saveClientPhotoVisibilityChangesAction } from "@/lib/client-gallery-actions";

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
  hiddenCount: number;
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
  const [savedHiddenPhotoIds, setSavedHiddenPhotoIds] = useState<Set<string>>(
    () => new Set(photos.filter((photo) => photo.isClientHidden).map((photo) => photo.id))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
  const [copied, setCopied] = useState(false);
  const publicHref = `/g/${publicSlug}`;
  const hiddenCount = hiddenPhotoIds.size;
  const visibleCount = photos.length - hiddenCount;
  const reviewedPhotoIds = useMemo(() => photos.map((photo) => photo.id), [photos]);
  const hasUnsavedChanges = useMemo(() => {
    if (hiddenPhotoIds.size !== savedHiddenPhotoIds.size) {
      return true;
    }

    for (const photoId of hiddenPhotoIds) {
      if (!savedHiddenPhotoIds.has(photoId)) {
        return true;
      }
    }

    return false;
  }, [hiddenPhotoIds, savedHiddenPhotoIds]);

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

  function togglePhoto(photoId: string) {
    setError("");
    setSaveNotice(null);

    setHiddenPhotoIds((current) => {
      const next = new Set(current);

      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }

      return next;
    });
  }

  function resetChanges() {
    setHiddenPhotoIds(new Set(savedHiddenPhotoIds));
    setError("");
    setSaveNotice(null);
  }

  async function saveChanges() {
    setIsSaving(true);
    setError("");
    setSaveNotice(null);

    const result = await saveClientPhotoVisibilityChangesAction({
      galleryId,
      token,
      reviewedPhotoIds,
      hiddenPhotoIds: Array.from(hiddenPhotoIds)
    });

    if (!result.ok) {
      setError(result.message ?? "Die Sichtbarkeit der Fotos konnte nicht gespeichert werden.");
      setIsSaving(false);
      return;
    }

    setSavedHiddenPhotoIds(new Set(hiddenPhotoIds));
    setSaveNotice({
      hiddenCount: result.hiddenCount ?? hiddenPhotoIds.size,
      zipRefreshing: Boolean(result.zipRefreshing)
    });
    window.setTimeout(() => setSaveNotice(null), 4500);
    setIsSaving(false);
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
              Wählt in Ruhe aus. Eure Änderungen werden erst übernommen, wenn ihr unten speichert; danach werden die öffentliche Galerie und das Download-Paket aktualisiert.
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
                  Gespeichert: {photos.length - saveNotice.hiddenCount} Fotos sind sichtbar, {saveNotice.hiddenCount} sind ausgeblendet.
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
          const wasHidden = savedHiddenPhotoIds.has(photo.id);
          const hasDraftChange = isHidden !== wasHidden;

          return (
            <article key={photo.id} className={`overflow-hidden rounded-lg border bg-white shadow-soft ${isHidden ? "border-brass/40" : hasDraftChange ? "border-sage/50" : "border-ink/10"}`}>
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
                {hasDraftChange ? (
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-sage px-2.5 py-1 text-xs font-medium text-white shadow-soft">
                    <Save size={13} />
                    Ungespeichert
                  </span>
                ) : null}
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
                  disabled={isSaving}
                  onClick={() => togglePhoto(photo.id)}
                >
                  {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                  {isHidden ? "Für Gäste wieder anzeigen" : "Für Gäste ausblenden"}
                </Button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-8 rounded-lg border border-ink/10 bg-white p-5 text-center shadow-soft">
        <p className="text-lg font-semibold text-ink">Seid ihr mit dem Ausblenden fertig?</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-graphite/70">
          Speichert die Auswahl, wenn alles passt. Erst danach erscheinen die Änderungen in der öffentlichen Galerie und im Gäste-Download.
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white/95 px-4 py-3 shadow-[0_-12px_35px_rgba(31,29,26,0.12)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {hiddenCount} ausgeblendet · {visibleCount} sichtbar
            </p>
            <p className="mt-0.5 text-xs text-graphite/70">
              {hasUnsavedChanges
                ? "Ungespeicherte Änderungen. Speichern aktualisiert die Gästegalerie und startet ein neues Download-Paket."
                : "Alles gespeichert. Das aktuelle Download-Paket passt zur Auswahl."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" disabled={!hasUnsavedChanges || isSaving} onClick={resetChanges}>
              <RotateCcw size={16} />
              Zurücksetzen
            </Button>
            <Button type="button" disabled={!hasUnsavedChanges || isSaving} onClick={() => void saveChanges()}>
              {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
              {isSaving ? "Wird gespeichert" : "Auswahl speichern"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
