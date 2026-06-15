"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { ChevronLeft, ChevronRight, Download, Images, Mail, Maximize2, X } from "lucide-react";
import { Button } from "@/components/button";
import { recordGalleryDownloadAction } from "@/lib/public-actions";

type PublicPhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
};

const tileAspects = [
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-square",
  "aspect-[5/4]",
  "aspect-[4/3]",
  "aspect-[2/3]"
];

function galleryFileName(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "gallery"}.zip`;
}

function photoFileName(photo: PublicPhoto, index: number) {
  const fallback = `photo-${String(index + 1).padStart(3, "0")}.jpg`;
  return (photo.filename || fallback).replace(/[\\/:*?"<>|]/g, "-");
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

  const selectedPhoto = useMemo(() => {
    if (selectedIndex === null) {
      return null;
    }

    return photos[selectedIndex] ?? null;
  }, [photos, selectedIndex]);

  const selectedPosition = selectedIndex === null ? 0 : selectedIndex + 1;

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

  return (
    <>
      <section className="masonry-grid">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            onClick={() => setSelectedIndex(index)}
            className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-lg bg-mist text-left"
          >
            <span className={`relative block w-full ${tileAspects[index % tileAspects.length]}`}>
              <Image
                src={photo.thumbnailUrl}
                alt={photo.filename}
                fill
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
                sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              />
              <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-md bg-white/90 opacity-0 transition group-hover:opacity-100">
                <Maximize2 size={16} />
              </span>
            </span>
          </button>
        ))}
      </section>

      <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-ink/10 bg-white/90 px-3 py-3 shadow-soft backdrop-blur">
        <span className="hidden items-center gap-2 px-2 text-sm text-graphite sm:flex">
          <Images size={16} />
          {photos.length} fotó
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

      {selectedPhoto ? (
        <div className="fixed inset-0 z-50 bg-ink/95 p-4 text-white">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="truncate text-sm text-white/80">{selectedPhoto.filename}</p>
            <div className="flex items-center gap-2">
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
                className="absolute left-4 top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-md bg-white/10 text-white backdrop-blur transition hover:bg-white/20 md:flex"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                title="Következő kép"
                onClick={showNextPhoto}
                className="absolute right-4 top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-md bg-white/10 text-white backdrop-blur transition hover:bg-white/20 md:flex"
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

          {photos.length > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-3 md:hidden">
              <Button type="button" variant="secondary" onClick={showPreviousPhoto} className="bg-white/10 text-white hover:bg-white/20">
                <ChevronLeft size={18} />
                Előző
              </Button>
              <p className="text-sm text-white/70">
                {selectedPosition}/{photos.length}
              </p>
              <Button type="button" variant="secondary" onClick={showNextPhoto} className="bg-white/10 text-white hover:bg-white/20">
                Következő
                <ChevronRight size={18} />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
