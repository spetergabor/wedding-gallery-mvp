"use client";

import Image from "next/image";
import { type CSSProperties, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  CheckSquare,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  ImageIcon,
  RefreshCw,
  RotateCcw,
  Save,
  Square
} from "lucide-react";
import { Button } from "@/components/button";
import { SocialShareButtons } from "@/components/social-share-buttons";
import { saveClientPhotoVisibilityChangesAction } from "@/lib/client-gallery-actions";
import type { CustomerLanguage } from "@/lib/customer-language";

type ClientPhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  mediaType: string;
  processingStatus: string;
  isClientHidden: boolean;
  imageWidth: number;
  imageHeight: number;
};

type SaveNotice = {
  hiddenCount: number;
  zipNeedsManualRefresh: boolean;
};

const CLIENT_REVIEW_COPY = {
  de: {
    saveVisibilityError: "Die Sichtbarkeit der Fotos konnte nicht gespeichert werden.",
    guestGallery: "Öffentliche Gästegalerie",
    visible: "sichtbar",
    hidden: "ausgeblendet",
    intro: "Wählt in Ruhe aus. Eure Änderungen werden erst übernommen, wenn ihr unten speichert; sie betreffen nur die öffentliche Galerie. Das ZIP-Downloadpaket bleibt unverändert.",
    visibleLabel: "Sichtbar",
    hiddenLabel: "Ausgeblendet",
    savedSummary: (visibleCount: number, hiddenCount: number) => `Gespeichert: ${visibleCount} Fotos sind sichtbar, ${hiddenCount} sind ausgeblendet.`,
    galleryUpdated: "Die öffentliche Galerie ist aktualisiert.",
    zipNeedsManualRefresh: " Das Download-Paket wird nicht automatisch neu erstellt; der Fotograf startet es im Adminbereich, wenn die Galerie final ist.",
    zipCurrent: " Das ZIP-Downloadpaket bleibt unverändert.",
    copied: "Öffentlicher Link kopiert",
    copyLink: "Öffentlichen Link kopieren",
    openGallery: "Öffentliche Galerie öffnen",
    previewPending: "Vorschau wird erstellt",
    hiddenBadge: "Nicht für Gäste sichtbar",
    visibleBadge: "Für Gäste sichtbar",
    unsaved: "Ungespeichert",
    hiddenDescription: "Dieses Foto bleibt hier sichtbar, erscheint aber nicht in der öffentlichen Galerie.",
    visibleDescription: "Dieses Foto erscheint in der öffentlichen Galerie.",
    showAgain: "Für Gäste wieder anzeigen",
    hideForGuests: "Für Gäste ausblenden",
    bulkTitle: "Mehrere Fotos auswählen",
    bulkHint: "Die Auswahl wirkt erst nach dem Speichern und verändert das ZIP-Downloadpaket nicht.",
    selectAll: "Alle auswählen",
    clearSelection: "Auswahl löschen",
    selected: (count: number) => `${count} ausgewählt`,
    selectPhoto: "Foto auswählen",
    unselectPhoto: "Auswahl entfernen",
    hideSelected: "Ausgewählte ausblenden",
    showSelected: "Ausgewählte anzeigen",
    doneTitle: "Seid ihr mit dem Ausblenden fertig?",
    doneIntro: "Speichert die Auswahl, wenn alles passt. Erst danach erscheinen die Änderungen in der öffentlichen Galerie.",
    shareGallery: "Öffentliche Galerie teilen",
    bottomStatus: (hiddenCount: number, visibleCount: number) => `${hiddenCount} ausgeblendet · ${visibleCount} sichtbar`,
    unsavedStatus: "Ungespeicherte Änderungen. Speichern aktualisiert nur die Gästegalerie; das ZIP-Downloadpaket bleibt unverändert.",
    savedStatus: "Alles gespeichert. Das ZIP-Downloadpaket bleibt unverändert.",
    reset: "Zurücksetzen",
    saving: "Wird gespeichert",
    save: "Auswahl speichern"
  },
  hu: {
    saveVisibilityError: "A fotók láthatóságát nem sikerült menteni.",
    guestGallery: "Publikus vendéggaléria",
    visible: "látható",
    hidden: "elrejtve",
    intro: "Válogassatok nyugodtan. A módosítások csak akkor kerülnek át a publikus galériába, amikor lent mentitek őket. A ZIP letöltési csomag változatlan marad.",
    visibleLabel: "Látható",
    hiddenLabel: "Elrejtve",
    savedSummary: (visibleCount: number, hiddenCount: number) => `Mentve: ${visibleCount} fotó látható, ${hiddenCount} fotó el van rejtve.`,
    galleryUpdated: "A publikus galéria frissült.",
    zipNeedsManualRefresh: " A letöltési csomag nem készül újra automatikusan; a fotós az adminban indítja, amikor a galéria végleges.",
    zipCurrent: " A ZIP letöltési csomag változatlan marad.",
    copied: "Publikus link másolva",
    copyLink: "Publikus link másolása",
    openGallery: "Publikus galéria megnyitása",
    previewPending: "Előnézet készül",
    hiddenBadge: "Vendégeknek nem látható",
    visibleBadge: "Vendégeknek látható",
    unsaved: "Nincs mentve",
    hiddenDescription: "Ez a fotó itt látható marad, de nem jelenik meg a publikus galériában.",
    visibleDescription: "Ez a fotó megjelenik a publikus galériában.",
    showAgain: "Újra mutatás vendégeknek",
    hideForGuests: "Elrejtés vendégek elől",
    bulkTitle: "Több fotó kijelölése",
    bulkHint: "A kijelölés csak mentés után élesedik, és nem módosítja a ZIP letöltési csomagot.",
    selectAll: "Összes kijelölése",
    clearSelection: "Kijelölés törlése",
    selected: (count: number) => `${count} kijelölve`,
    selectPhoto: "Fotó kijelölése",
    unselectPhoto: "Kijelölés levétele",
    hideSelected: "Kijelöltek elrejtése",
    showSelected: "Kijelöltek mutatása",
    doneTitle: "Készen vagytok az elrejtésekkel?",
    doneIntro: "Mentsétek a válogatást, amikor minden rendben van. A változások csak mentés után jelennek meg a publikus galériában.",
    shareGallery: "Publikus galéria megosztása",
    bottomStatus: (hiddenCount: number, visibleCount: number) => `${hiddenCount} elrejtve · ${visibleCount} látható`,
    unsavedStatus: "Nem mentett módosítások. A mentés csak a vendéggalériát frissíti; a ZIP letöltési csomag változatlan marad.",
    savedStatus: "Minden mentve. A ZIP letöltési csomag változatlan marad.",
    reset: "Visszaállítás",
    saving: "Mentés",
    save: "Válogatás mentése"
  }
} as const;

function getClientPreviewUrl(photo: ClientPhoto) {
  if (photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl) {
    return photo.thumbnailUrl;
  }

  if (photo.previewUrl && photo.previewUrl !== photo.imageUrl) {
    return photo.previewUrl;
  }

  return photo.imageUrl;
}

function getClientPreviewStyle(photo: ClientPhoto): CSSProperties {
  if (photo.mediaType === "video") {
    return { aspectRatio: "16 / 9" };
  }

  if (photo.imageWidth > 0 && photo.imageHeight > 0) {
    return { aspectRatio: `${photo.imageWidth} / ${photo.imageHeight}` };
  }

  return { aspectRatio: "4 / 3" };
}

export function ClientGalleryReview({
  galleryId,
  publicSlug,
  title,
  token,
  photos,
  language
}: {
  galleryId: string;
  publicSlug: string;
  title: string;
  token: string;
  photos: ClientPhoto[];
  language?: CustomerLanguage;
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
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(() => new Set());
  const copy = CLIENT_REVIEW_COPY[language ?? "de"];
  const publicHref = `/g/${publicSlug}`;
  const hiddenCount = hiddenPhotoIds.size;
  const visibleCount = photos.length - hiddenCount;
  const reviewedPhotoIds = useMemo(() => photos.map((photo) => photo.id), [photos]);
  const selectedCount = selectedPhotoIds.size;
  const allPhotosSelected = photos.length > 0 && selectedCount === photos.length;
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

  function toggleSelectedPhoto(photoId: string) {
    setSelectedPhotoIds((current) => {
      const next = new Set(current);

      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }

      return next;
    });
  }

  function selectAllPhotos() {
    setSelectedPhotoIds(new Set(reviewedPhotoIds));
  }

  function clearSelection() {
    setSelectedPhotoIds(new Set());
  }

  function hideSelectedPhotos() {
    if (selectedPhotoIds.size === 0) {
      return;
    }

    setError("");
    setSaveNotice(null);
    setHiddenPhotoIds((current) => {
      const next = new Set(current);

      for (const photoId of selectedPhotoIds) {
        next.add(photoId);
      }

      return next;
    });
  }

  function showSelectedPhotos() {
    if (selectedPhotoIds.size === 0) {
      return;
    }

    setError("");
    setSaveNotice(null);
    setHiddenPhotoIds((current) => {
      const next = new Set(current);

      for (const photoId of selectedPhotoIds) {
        next.delete(photoId);
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
      setError(result.message ?? copy.saveVisibilityError);
      setIsSaving(false);
      return;
    }

    setSavedHiddenPhotoIds(new Set(hiddenPhotoIds));
    setSaveNotice({
      hiddenCount: result.hiddenCount ?? hiddenPhotoIds.size,
      zipNeedsManualRefresh: Boolean(result.zipNeedsManualRefresh)
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
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass">{copy.guestGallery}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              {visibleCount} {copy.visible} · {hiddenCount} {copy.hidden}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
              {copy.intro}
            </p>
          </div>
          <div className="grid min-w-[220px] grid-cols-2 gap-2 text-center">
            <div className="rounded-md bg-paper px-3 py-2">
              <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">{copy.visibleLabel}</p>
              <p className="mt-1 text-xl font-semibold text-ink">{visibleCount}</p>
            </div>
            <div className="rounded-md bg-paper px-3 py-2">
              <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">{copy.hiddenLabel}</p>
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
                  {copy.savedSummary(photos.length - saveNotice.hiddenCount, saveNotice.hiddenCount)}
                </p>
                <p className="mt-1 text-graphite/70">
                  {copy.galleryUpdated}
                  {saveNotice.zipNeedsManualRefresh ? copy.zipNeedsManualRefresh : copy.zipCurrent}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col justify-end gap-3 sm:flex-row">
          <Button type="button" variant="secondary" onClick={copyPublicLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? copy.copied : copy.copyLink}
          </Button>
          <a
            href={publicHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
          >
            <ExternalLink size={16} />
            {copy.openGallery}
          </a>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">{copy.bulkTitle}</p>
            <p className="mt-1 text-xs leading-5 text-graphite/65">{copy.bulkHint}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={photos.length === 0 || allPhotosSelected} onClick={selectAllPhotos}>
              <CheckSquare size={16} />
              {copy.selectAll}
            </Button>
          </div>
        </div>
        {selectedCount > 0 ? (
          <p className="mt-3 text-xs font-medium text-brass">{copy.selected(selectedCount)}</p>
        ) : null}
      </div>

      <section className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4">
        {photos.map((photo) => {
          const isHidden = hiddenPhotoIds.has(photo.id);
          const wasHidden = savedHiddenPhotoIds.has(photo.id);
          const hasDraftChange = isHidden !== wasHidden;
          const isSelected = selectedPhotoIds.has(photo.id);

          return (
            <article
              key={photo.id}
              className={`mb-4 inline-block w-full break-inside-avoid overflow-hidden rounded-lg border bg-white shadow-soft transition ${
                isSelected ? "border-brass ring-2 ring-brass/20" : isHidden ? "border-brass/40" : hasDraftChange ? "border-sage/50" : "border-ink/10"
              }`}
            >
              <div className="relative w-full bg-mist" style={getClientPreviewStyle(photo)}>
                {photo.mediaType === "video" ? (
                  <div className={`relative h-full w-full bg-ink transition ${isHidden ? "opacity-45 grayscale" : ""}`}>
                    <video src={photo.imageUrl} preload="metadata" muted playsInline className="h-full w-full object-contain opacity-85" />
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
                    className={`object-contain transition ${isHidden ? "opacity-45 grayscale" : ""}`}
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                  />
                ) : (
                  <div className={`grid h-full w-full place-items-center text-graphite/60 transition ${isHidden ? "opacity-45 grayscale" : ""}`}>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <ImageIcon size={24} />
                      <span className="text-xs font-medium">{copy.previewPending}</span>
                    </div>
                  </div>
                )}
                {isHidden ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-ink/85 px-2.5 py-1 text-xs font-medium text-white">
                    <EyeOff size={13} />
                    {copy.hiddenBadge}
                  </span>
                ) : (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-ink shadow-soft">
                    <Eye size={13} />
                    {copy.visibleBadge}
                  </span>
                )}
                {hasDraftChange ? (
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-sage px-2.5 py-1 text-xs font-medium text-white shadow-soft">
                    <Save size={13} />
                    {copy.unsaved}
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={isSelected ? copy.unselectPhoto : copy.selectPhoto}
                  className={`absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md border text-ink shadow-soft transition ${
                    isSelected ? "border-ink bg-ink text-white" : "border-ink/10 bg-white/90 hover:bg-white"
                  }`}
                  onClick={() => toggleSelectedPhoto(photo.id)}
                >
                  {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                </button>
              </div>
              <div className="space-y-3 p-3">
                <p className="truncate text-sm font-medium text-ink">{photo.filename}</p>
                <p className="text-xs leading-5 text-graphite/65">
                  {isHidden
                    ? copy.hiddenDescription
                    : copy.visibleDescription}
                </p>
                <Button
                  type="button"
                  variant={isHidden ? "secondary" : "danger"}
                  className="w-full"
                  disabled={isSaving}
                  onClick={() => togglePhoto(photo.id)}
                >
                  {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                  {isHidden ? copy.showAgain : copy.hideForGuests}
                </Button>
              </div>
            </article>
          );
        })}
      </section>

      {selectedCount > 0 ? (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border border-ink/10 bg-ink px-3 py-2 text-white shadow-[0_18px_45px_rgba(31,29,26,0.24)]">
            <span className="px-2 text-sm font-semibold">{copy.selected(selectedCount)}</span>
            <span className="h-6 w-px bg-white/20" aria-hidden="true" />
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50"
              disabled={isSaving}
              onClick={hideSelectedPhotos}
            >
              <EyeOff size={16} />
              {copy.hideSelected}
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50"
              disabled={isSaving}
              onClick={showSelectedPhotos}
            >
              <Eye size={16} />
              {copy.showSelected}
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label={copy.clearSelection}
              onClick={clearSelection}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      ) : null}

      <section className="mt-8 rounded-lg border border-ink/10 bg-white p-5 text-center shadow-soft">
        <p className="text-lg font-semibold text-ink">{copy.doneTitle}</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-graphite/70">
          {copy.doneIntro}
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" variant="secondary" onClick={copyPublicLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? copy.copied : copy.copyLink}
          </Button>
          <a
            href={publicHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
          >
            <ExternalLink size={16} />
            {copy.shareGallery}
          </a>
        </div>
        <div className="mt-4 flex justify-center">
          <SocialShareButtons path={publicHref} title={title} variant="card" language={language} />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white/95 px-4 py-3 shadow-[0_-12px_35px_rgba(31,29,26,0.12)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {copy.bottomStatus(hiddenCount, visibleCount)}
            </p>
            <p className="mt-0.5 text-xs text-graphite/70">
              {hasUnsavedChanges
                ? copy.unsavedStatus
                : copy.savedStatus}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" disabled={!hasUnsavedChanges || isSaving} onClick={resetChanges}>
              <RotateCcw size={16} />
              {copy.reset}
            </Button>
            <Button type="button" disabled={!hasUnsavedChanges || isSaving} onClick={() => void saveChanges()}>
              {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
              {isSaving ? copy.saving : copy.save}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
