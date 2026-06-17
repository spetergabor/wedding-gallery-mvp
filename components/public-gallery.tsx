"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { ChevronLeft, ChevronRight, Download, Heart, Images, Mail, Maximize2, X } from "lucide-react";
import { Button } from "@/components/button";
import {
  createFavoriteListAction,
  getFavoriteListsAction,
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

type FavoriteListState = {
  id: string;
  name: string;
  photoIds: string[];
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

function getColumnCount(width: number) {
  if (width >= 1280) {
    return 4;
  }

  if (width >= 1024) {
    return 3;
  }

  if (width >= 640) {
    return 2;
  }

  return 1;
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
  const [favoriteLists, setFavoriteLists] = useState<FavoriteListState[]>([]);
  const [activeFavoriteListId, setActiveFavoriteListId] = useState("");
  const [newFavoriteListName, setNewFavoriteListName] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const [favoritePromptPhotoId, setFavoritePromptPhotoId] = useState<string | null>(null);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const activeFavoriteList = favoriteLists.find((list) => list.id === activeFavoriteListId) ?? favoriteLists[0] ?? null;
  const favoriteIds = useMemo(() => new Set(activeFavoriteList?.photoIds ?? []), [activeFavoriteList]);

  const visiblePhotos = useMemo(() => {
    if (!showFavoritesOnly) {
      return photos;
    }

    return photos.filter((photo) => favoriteIds.has(photo.id));
  }, [favoriteIds, photos, showFavoritesOnly]);

  const selectedPhoto = useMemo(() => {
    if (selectedIndex === null) {
      return null;
    }

    return visiblePhotos[selectedIndex] ?? null;
  }, [selectedIndex, visiblePhotos]);

  const selectedPosition = selectedIndex === null ? 0 : selectedIndex + 1;
  const favoriteCount = favoriteIds.size;
  const photoColumns = useMemo(() => {
    return visiblePhotos.reduce<Array<Array<{ photo: PublicPhoto; index: number }>>>((columns, photo, index) => {
      const columnIndex = index % columnCount;
      columns[columnIndex]?.push({ photo, index });

      return columns;
    }, Array.from({ length: columnCount }, () => []));
  }, [columnCount, visiblePhotos]);

  useEffect(() => {
    if (showFavoritesOnly && favoriteCount === 0) {
      setShowFavoritesOnly(false);
    }
  }, [favoriteCount, showFavoritesOnly]);

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= visiblePhotos.length) {
      setSelectedIndex(visiblePhotos.length > 0 ? visiblePhotos.length - 1 : null);
    }
  }, [selectedIndex, visiblePhotos.length]);

  useEffect(() => {
    function updateColumnCount() {
      setColumnCount(getColumnCount(window.innerWidth));
    }

    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);

    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(`wgm-favorite-email-${galleryId}`);

    if (!storedEmail) {
      return;
    }

    setFavoriteEmail(storedEmail);
    setFavoriteEmailDraft(storedEmail);
    getFavoriteListsAction(galleryId, storedEmail).then((result) => {
      if (result.ok) {
        setFavoriteLists(result.lists);
        setActiveFavoriteListId(result.lists[0]?.id ?? "");
      }
    });
  }, [galleryId]);

  function showPreviousPhoto() {
    setSelectedIndex((current) => {
      if (current === null || visiblePhotos.length === 0) {
        return current;
      }

      return current === 0 ? visiblePhotos.length - 1 : current - 1;
    });
  }

  function showNextPhoto() {
    setSelectedIndex((current) => {
      if (current === null || visiblePhotos.length === 0) {
        return current;
      }

      return current === visiblePhotos.length - 1 ? 0 : current + 1;
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
  }, [selectedIndex, visiblePhotos.length]);

  async function createZipDownload() {
    if (isZipping) {
      return;
    }

    setIsZipping(true);
    setEmailError("");
    setZipProgress("Fotos werden vorbereitet...");

    try {
      const zip = new JSZip();

      for (const [index, photo] of photos.entries()) {
        setZipProgress(`${index + 1}/${photos.length} Fotos werden hinzugefügt...`);
        const response = await fetch(photo.imageUrl, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Dieses Foto konnte nicht heruntergeladen werden: ${photo.filename}`);
        }

        const blob = await response.blob();
        zip.file(photoFileName(photo, index), blob);
      }

      setZipProgress("ZIP-Datei wird erstellt...");
      const content = await zip.generateAsync({ type: "blob" });
      setZipProgress("Download wird vorbereitet...");

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
      setEmailError(error instanceof Error ? error.message : "Die ZIP-Datei konnte nicht erstellt werden.");
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

  async function downloadSinglePhoto(photo: PublicPhoto) {
    if (downloadingPhotoId) {
      return;
    }

    setDownloadingPhotoId(photo.id);

    try {
      const response = await fetch(photo.imageUrl, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Das Foto konnte nicht heruntergeladen werden.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = photoFileName(photo, selectedIndex ?? 0);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setDownloadingPhotoId(null);
    }
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
      const result = await toggleFavoritePhotoAction(galleryId, photoId, emailForFavorite, activeFavoriteList?.id);

      if (!result.ok) {
        throw new Error(result.message);
      }

      if (!result.listId) {
        throw new Error("Die Favoritenliste konnte nicht gefunden werden.");
      }

      const resultListId = result.listId;
      const resultListName = result.listName ?? "Favoriten";

      setFavoriteLists((current) =>
        current.some((list) => list.id === resultListId)
          ? current.map((list) => {
              if (list.id !== resultListId) {
                return list;
              }

              const photoIds = new Set(list.photoIds);

              if (result.isFavorite) {
                photoIds.add(photoId);
              } else {
                photoIds.delete(photoId);
              }

              return { ...list, photoIds: Array.from(photoIds) };
            })
          : [
              {
                id: resultListId,
                name: resultListName,
                photoIds: result.isFavorite ? [photoId] : []
              },
              ...current
            ]
      );
      setActiveFavoriteListId(resultListId);
    } catch (error) {
      setFavoriteError(error instanceof Error ? error.message : "Der Favorit konnte nicht gespeichert werden.");
    } finally {
      setPendingFavoriteId(null);
    }
  }

  async function submitFavoriteEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = favoriteEmailDraft.trim().toLowerCase();

    if (!normalizedEmail) {
      setFavoriteError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }

    setFavoriteEmail(normalizedEmail);
    window.localStorage.setItem(`wgm-favorite-email-${galleryId}`, normalizedEmail);
    const queuedPhotoId = favoritePromptPhotoId;
    setFavoritePromptPhotoId(null);

    let listsResult = await getFavoriteListsAction(galleryId, normalizedEmail);

    if (listsResult.ok && listsResult.lists.length === 0) {
      const created = await createFavoriteListAction(galleryId, normalizedEmail, "Favoriten");

      if (created.ok && created.list) {
        listsResult = {
          ok: true,
          lists: [created.list]
        };
      }
    }

    if (listsResult.ok) {
      setFavoriteLists(listsResult.lists);
      setActiveFavoriteListId(listsResult.lists[0]?.id ?? "");
    }

    if (queuedPhotoId) {
      await toggleFavorite(queuedPhotoId, normalizedEmail);
    }
  }

  async function createNewFavoriteList() {
    const normalizedEmail = favoriteEmail || favoriteEmailDraft.trim().toLowerCase();
    const listName = newFavoriteListName.trim();

    if (!normalizedEmail) {
      setFavoritePromptPhotoId(photos[0]?.id ?? "");
      return;
    }

    if (!listName) {
      setFavoriteError("Bitte gib einen Namen für die Liste ein.");
      return;
    }

    setFavoriteError("");
    const result = await createFavoriteListAction(galleryId, normalizedEmail, listName);

    if (!result.ok || !result.list) {
      setFavoriteError(result.message ?? "Die Liste konnte nicht erstellt werden.");
      return;
    }

    setFavoriteLists((current) => {
      const withoutDuplicate = current.filter((list) => list.id !== result.list?.id);
      return [result.list!, ...withoutDuplicate];
    });
    setActiveFavoriteListId(result.list.id);
    setNewFavoriteListName("");
    setShowFavoritesOnly(false);
  }

  function favoriteButtonClass(photoId: string) {
    return favoriteIds.has(photoId)
      ? "bg-ink text-white"
      : "bg-white/90 text-ink hover:bg-white";
  }

  return (
    <>
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {favoriteEmail ? (
          <div className="col-span-full mb-2 rounded-lg border border-ink/10 bg-white/90 p-3 shadow-soft">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-graphite">Favoritenliste</span>
                <select
                  value={activeFavoriteList?.id ?? ""}
                  onChange={(event) => {
                    setActiveFavoriteListId(event.target.value);
                    setShowFavoritesOnly(false);
                  }}
                  className="h-10 rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                >
                  {favoriteLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.photoIds.length})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={newFavoriteListName}
                  onChange={(event) => setNewFavoriteListName(event.target.value)}
                  placeholder="Neue Liste, z. B. Album"
                  className="h-10 rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                />
                <Button type="button" variant="secondary" onClick={() => void createNewFavoriteList()}>
                  Liste erstellen
                </Button>
              </div>
            </div>
            {favoriteError ? <p className="mt-2 text-sm text-red-700">{favoriteError}</p> : null}
          </div>
        ) : null}
        {photoColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="grid content-start gap-2">
            {column.map(({ photo, index }) => (
              <div
                key={photo.id}
                className="group block w-full overflow-hidden rounded-lg bg-mist text-left"
              >
                <span className="relative block w-full">
                  <button
                    type="button"
                    title="Foto öffnen"
                    aria-label={`${photo.filename} öffnen`}
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
                    title="Favorit"
                    aria-label={`${photo.filename} zu den Favoriten hinzufügen`}
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
          </div>
        ))}
      </section>

      <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-ink/10 bg-white/90 px-3 py-3 shadow-soft backdrop-blur">
        <span className="hidden items-center gap-2 px-2 text-sm text-graphite sm:flex">
          <Images size={16} />
          {showFavoritesOnly ? `${visiblePhotos.length}/${photos.length} Fotos` : `${photos.length} Fotos`}
        </span>
        <button
          type="button"
          onClick={() => favoriteCount > 0 && setShowFavoritesOnly((current) => !current)}
          disabled={favoriteCount === 0}
          className={`flex h-10 items-center gap-2 rounded-md px-2 text-sm transition ${
            showFavoritesOnly ? "bg-ink text-white" : "text-graphite hover:bg-ink/5"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <Heart size={16} />
          {favoriteCount} Favoriten
        </button>
        <Button type="button" onClick={() => setIsEmailOpen(true)} disabled={isZipping || photos.length === 0}>
          <Download size={16} />
          {isZipping ? "ZIP wird erstellt" : "ZIP herunterladen"}
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
                <h2 className="mt-4 text-xl font-semibold text-ink">Album herunterladen</h2>
                <p className="mt-2 text-sm text-graphite/70">
                  Gib deine E-Mail-Adresse ein, um die komplette Galerie als ZIP-Datei herunterzuladen.
                </p>
              </div>
              <button
                type="button"
                title="Schließen"
                onClick={() => setIsEmailOpen(false)}
                className="flex size-9 items-center justify-center rounded-md text-graphite hover:bg-ink/5"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-medium text-graphite">E-Mail-Adresse</span>
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
                {isZipping ? "ZIP wird erstellt" : "Download starten"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setIsEmailOpen(false)}>
                Abbrechen
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
                <h2 className="mt-4 text-xl font-semibold text-ink">Favoriten speichern</h2>
                <p className="mt-2 text-sm text-graphite/70">
                  Gib deine E-Mail-Adresse ein. Deine ausgewählten Lieblingsfotos werden damit gespeichert.
                </p>
              </div>
              <button
                type="button"
                title="Schließen"
                onClick={() => setFavoritePromptPhotoId(null)}
                className="flex size-9 items-center justify-center rounded-md text-graphite hover:bg-ink/5"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-medium text-graphite">E-Mail-Adresse</span>
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
                Favorit speichern
              </Button>
              <Button type="button" variant="secondary" onClick={() => setFavoritePromptPhotoId(null)}>
                Abbrechen
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
                title="Favorit"
                aria-label={`${selectedPhoto.filename} zu den Favoriten hinzufügen`}
                onClick={() => void toggleFavorite(selectedPhoto.id)}
                className={`flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium ${favoriteIds.has(selectedPhoto.id) ? "bg-white text-ink" : "bg-white/10 text-white hover:bg-white/20"}`}
              >
                <Heart size={16} fill={favoriteIds.has(selectedPhoto.id) ? "currentColor" : "none"} />
                Favorit
              </button>
              <button
                type="button"
                onClick={() => void downloadSinglePhoto(selectedPhoto)}
                disabled={downloadingPhotoId === selectedPhoto.id}
                className="flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink disabled:opacity-60"
              >
                <Download size={16} />
                {downloadingPhotoId === selectedPhoto.id ? "Lädt..." : "Herunterladen"}
              </button>
              <button
                title="Schließen"
                onClick={() => setSelectedIndex(null)}
                className="flex size-10 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {visiblePhotos.length > 1 ? (
            <>
              <button
                type="button"
                title="Vorheriges Foto"
                onClick={showPreviousPhoto}
                className="absolute left-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-md bg-white/15 text-white backdrop-blur transition hover:bg-white/25 md:left-4 md:size-12"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                title="Nächstes Foto"
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
          {visiblePhotos.length > 1 ? <p className="mt-3 text-center text-sm text-white/70">{selectedPosition}/{visiblePhotos.length}</p> : null}
        </div>
      ) : null}
    </>
  );
}
