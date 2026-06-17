"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { ChevronLeft, ChevronRight, Download, Heart, Images, Mail, Maximize2, X } from "lucide-react";
import { Button } from "@/components/button";
import {
  getFavoritePhotoIdsAction,
  recordGalleryDownloadAction,
  toggleFavoritePhotoAction
} from "@/lib/public-actions";

type PublicPhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  imageWidth: number;
  imageHeight: number;
};

function galleryFileName(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "gallery"}.zip`;
}

function photoFileName(photo: PublicPhoto, index: number) {
  const fallback = `photo-${String(index + 1).padStart(3, "0")}.jpg`;
  return (photo.filename || fallback).replace(/[\\/:*?"<>|]/g, "-");
}

function hasImageDimensions(photo: PublicPhoto) {
  return photo.imageWidth > 0 && photo.imageHeight > 0;
}

export function PublicGallery({
  galleryId,
  title,
  photos
}: {
  galleryId: string;
  title: string;
  photos: PublicPhoto[];
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [zipProgress, setZipProgress] = useState("");
  const [favoriteEmail, setFavoriteEmail] = useState("");
  const [favoriteEmailDraft, setFavoriteEmailDraft] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [favoriteError, setFavoriteError] = useState("");
  const [favoritePromptPhotoId, setFavoritePromptPhotoId] = useState<string | null>(null);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);

  const selectedPhoto = useMemo(() => {
    if (selectedIndex === null) {
      return null;
    }

    return photos[selectedIndex] ?? null;
  }, [photos, selectedIndex]);

  const selectedPosition = selectedIndex === null ? 0 : selectedIndex + 1;
  const favoriteCount = favoriteIds.size;

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(`wgm-favorite-email-${galleryId}`);

    if (!storedEmail) {
      return;
    }

    setFavoriteEmail(storedEmail);
    setFavoriteEmailDraft(storedEmail);
    getFavoritePhotoIdsAction(galleryId, storedEmail).then((result) => {
      if (result.ok) {
        setFavoriteIds(new Set(result.photoIds));
      }
    });
  }, [galleryId]);

  function showPreviousPhoto() {
    setSelectedIndex((current) => {
      if (current === null || photos.length === 0) {
        return current;
      }

      return current === 0 ? photos.length - 1 : current - 1;
    });
  }

  function showNextPhoto() {
    setSelectedIndex((current) => {
      if (current === null || photos.length === 0) {
        return current;
      }

      return current === photos.length - 1 ? 0 : current + 1;
    });
  }

  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedIndex(null);
      }

      if (event.key === "ArrowLeft") {
        showPreviousPhoto();
      }

      if (event.key === "ArrowRight") {
        showNextPhoto();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, photos.length]);

  async function createZipDownload() {
    if (isZipping) {
      return;
    }

    setIsZipping(true);
    setEmailError("");
    setZipProgress("Képek előkészítése...");

    try {
      const zip = new JSZip();

      for (const [index, photo] of photos.entries()) {
        setZipProgress(`${index + 1}/${photos.length} kép hozzáadása...`);
        const response = await fetch(photo.imageUrl, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Nem sikerült letölteni: ${photo.filename}`);
        }

        const blob = await response.blob();
        zip.file(photoFileName(photo, index), blob);
      }

      setZipProgress("ZIP fájl készítése...");
      const content = await zip.generateAsync({ type: "blob" });
      setZipProgress("Letöltés naplózása...");

      const result = await recordGalleryDownloadAction(galleryId, email);

      if (!result.ok) {
        throw new Error(result.message);
      }

      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = galleryFileName(title);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setIsEmailOpen(false);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Nem sikerült elkészíteni a ZIP fájlt.");
    } finally {
      setIsZipping(false);
      setZipProgress("");
    }
  }

  async function submitDownloadEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError("");

    await createZipDownload();
  }

  async function toggleFavorite(photoId: string, emailOverride?: string) {
    const emailForFavorite = emailOverride ?? favoriteEmail;

    if (!emailForFavorite) {
      setFavoritePromptPhotoId(photoId);
      setFavoriteError("");
      return;
    }

    setPendingFavoriteId(photoId);
    setFavoriteError("");

    try {
      const result = await toggleFavoritePhotoAction(galleryId, photoId, emailForFavorite);

      if (!result.ok) {
        throw new Error(result.message);
      }

      setFavoriteIds((current) => {
        const next = new Set(current);

        if (result.isFavorite) {
          next.add(photoId);
        } else {
          next.delete(photoId);
        }

        return next;
      });
    } catch (error) {
      setFavoriteError(error instanceof Error ? error.message : "Nem sikerült menteni a kedvencet.");
    } finally {
      setPendingFavoriteId(null);
    }
  }

  async function submitFavoriteEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = favoriteEmailDraft.trim().toLowerCase();

    if (!normalizedEmail) {
      setFavoriteError("Adj meg egy email címet.");
      return;
    }

    setFavoriteEmail(normalizedEmail);
    window.localStorage.setItem(`wgm-favorite-email-${galleryId}`, normalizedEmail);
    const queuedPhotoId = favoritePromptPhotoId;
    setFavoritePromptPhotoId(null);

    const favorites = await getFavoritePhotoIdsAction(galleryId, normalizedEmail);

    if (favorites.ok) {
      setFavoriteIds(new Set(favorites.photoIds));
    }

    if (queuedPhotoId) {
      await toggleFavorite(queuedPhotoId, normalizedEmail);
    }
  }

  function favoriteButtonClass(photoId: string) {
    return favoriteIds.has(photoId)
      ? "bg-ink text-white"
      : "bg-white/90 text-ink hover:bg-white";
  }

  return (
    <>
      <section className="masonry-grid">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="group mb-2 block w-full break-inside-avoid overflow-hidden rounded-lg bg-mist text-left"
          >
            <span className="relative block w-full">
              <button
                type="button"
                title="Kép megnyitása"
                aria-label={`${photo.filename} megnyitása`}
                onClick={() => setSelectedIndex(index)}
                className="relative z-0 block w-full text-left"
              >
                {hasImageDimensions(photo) ? (
                  <Image
                    src={photo.thumbnailUrl}
                    alt={photo.filename}
                    width={photo.imageWidth}
                    height={photo.imageHeight}
                    className="block h-auto w-full transition duration-500 group-hover:scale-[1.03]"
                    sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                ) : (
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.filename}
                    loading="lazy"
                    className="block h-auto w-full transition duration-500 group-hover:scale-[1.03]"
                  />
                )}
                <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-md bg-white/90 opacity-0 transition group-hover:opacity-100">
                  <Maximize2 size={16} />
                </span>
              </button>
              <button
                type="button"
                title="Kedvenc"
                aria-label={`${photo.filename} kedvencekhez adása`}
                onClick={() => void toggleFavorite(photo.id)}
                className={`absolute left-3 top-3 z-10 flex size-9 items-center justify-center rounded-md transition ${favoriteButtonClass(photo.id)} ${
                  pendingFavoriteId === photo.id ? "opacity-60" : ""
                }`}
              >
                <Heart size={16} fill={favoriteIds.has(photo.id) ? "currentColor" : "none"} />
              </button>
            </span>
          </div>
        ))}
      </section>

      <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-ink/10 bg-white/90 px-3 py-3 shadow-soft backdrop-blur">
        <span className="hidden items-center gap-2 px-2 text-sm text-graphite sm:flex">
          <Images size={16} />
          {photos.length} fotó
        </span>
        <span className="hidden items-center gap-2 px-2 text-sm text-graphite sm:flex">
          <Heart size={16} />
          {favoriteCount} kedvenc
        </span>
        <Button type="button" onClick={() => setIsEmailOpen(true)} disabled={isZipping || photos.length === 0}>
          <Download size={16} />
          {isZipping ? "ZIP készül" : "ZIP letöltés"}
        </Button>
      </div>

      {isEmailOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/60 px-5 backdrop-blur-sm">
          <form onSubmit={submitDownloadEmail} className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex size-11 items-center justify-center rounded-md bg-paper text-graphite">
                  <Mail size={20} />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-ink">Album letöltése</h2>
                <p className="mt-2 text-sm text-graphite/70">
                  Add meg az email címed, és indul a teljes galéria ZIP letöltése.
                </p>
              </div>
              <button
                type="button"
                title="Bezárás"
                onClick={() => setIsEmailOpen(false)}
                className="flex size-9 items-center justify-center rounded-md text-graphite hover:bg-ink/5"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-medium text-graphite">Email cím</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
                placeholder="email@example.com"
                className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
              />
            </label>

            {emailError ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {emailError}
              </div>
            ) : null}

            {zipProgress ? (
              <div className="mt-4 rounded-md border border-ink/10 bg-paper px-4 py-3 text-sm text-graphite">
                {zipProgress}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={isZipping} className="sm:flex-1">
                <Download size={16} />
                {isZipping ? "ZIP készül" : "Letöltés indítása"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setIsEmailOpen(false)}>
                Mégsem
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {favoritePromptPhotoId ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/60 px-5 backdrop-blur-sm">
          <form onSubmit={submitFavoriteEmail} className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex size-11 items-center justify-center rounded-md bg-paper text-graphite">
                  <Heart size={20} />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-ink">Kedvencek mentése</h2>
                <p className="mt-2 text-sm text-graphite/70">
                  Add meg az email címed, és ehhez mentjük a kiválasztott kedvenc képeket.
                </p>
              </div>
              <button
                type="button"
                title="Bezárás"
                onClick={() => setFavoritePromptPhotoId(null)}
                className="flex size-9 items-center justify-center rounded-md text-graphite hover:bg-ink/5"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-medium text-graphite">Email cím</span>
              <input
                value={favoriteEmailDraft}
                onChange={(event) => setFavoriteEmailDraft(event.target.value)}
                type="email"
                required
                placeholder="email@example.com"
                className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
              />
            </label>

            {favoriteError ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {favoriteError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="sm:flex-1">
                <Heart size={16} />
                Kedvenc mentése
              </Button>
              <Button type="button" variant="secondary" onClick={() => setFavoritePromptPhotoId(null)}>
                Mégsem
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedPhoto ? (
        <div className="fixed inset-0 z-50 bg-ink/95 p-4 text-white">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="truncate text-sm text-white/80">{selectedPhoto.filename}</p>
            <div className="flex items-center gap-2">
              <button
                title="Kedvenc"
                aria-label={`${selectedPhoto.filename} kedvencekhez adása`}
                onClick={() => void toggleFavorite(selectedPhoto.id)}
                className={`flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium ${favoriteIds.has(selectedPhoto.id) ? "bg-white text-ink" : "bg-white/10 text-white hover:bg-white/20"}`}
              >
                <Heart size={16} fill={favoriteIds.has(selectedPhoto.id) ? "currentColor" : "none"} />
                Kedvenc
              </button>
              <a
                href={selectedPhoto.imageUrl}
                download={selectedPhoto.filename}
                className="flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink"
              >
                <Download size={16} />
                Letöltés
              </a>
              <button
                title="Bezárás"
                onClick={() => setSelectedIndex(null)}
                className="flex size-10 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {photos.length > 1 ? (
            <>
              <button
                type="button"
                title="Előző kép"
                onClick={showPreviousPhoto}
                className="absolute left-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-md bg-white/15 text-white backdrop-blur transition hover:bg-white/25 md:left-4 md:size-12"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                title="Következő kép"
                onClick={showNextPhoto}
                className="absolute right-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-md bg-white/15 text-white backdrop-blur transition hover:bg-white/25 md:right-4 md:size-12"
              >
                <ChevronRight size={26} />
              </button>
            </>
          ) : null}

          <div className="relative h-[calc(100vh-6rem)] w-full">
            <Image
              src={selectedPhoto.imageUrl}
              alt={selectedPhoto.filename}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>
          {photos.length > 1 ? <p className="mt-3 text-center text-sm text-white/70">{selectedPosition}/{photos.length}</p> : null}
        </div>
      ) : null}
    </>
  );
}
