"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Mail, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/button";
import {
  completeGuestUploadsAction,
  createGuestUploadTargetsAction
} from "@/lib/guest-upload-actions";
import type { CustomerLanguage } from "@/lib/customer-language";

type GuestPhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  imageWidth: number;
  imageHeight: number;
};

type GuestUploadFile = {
  clientId: string;
  file: File;
  imageWidth: number;
  imageHeight: number;
  status: "queued" | "uploading" | "done" | "failed";
};

const MAX_FILES = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const OPEN_GUEST_UPLOAD_EVENT = "spetly:open-guest-photo-upload";

const COPY = {
  de: {
    title: "Gästefotos",
    count: (count: number) => `${count} ${count === 1 ? "Foto" : "Fotos"}`,
    empty: "Noch keine Gästefotos hochgeladen.",
    openUpload: "Fotos hochladen",
    uploadTitle: "Eigene Fotos hochladen",
    uploadText: "Teile deine Lieblingsmomente mit dem Paar. Deine Fotos erscheinen nach dem Upload in diesem separaten Bereich.",
    email: "E-Mail-Adresse",
    choose: "Fotos auswählen",
    dropTitle: "Fotos hierher ziehen",
    dropText: "oder klicken, um Bilder auszuwählen",
    upload: "Hochladen",
    uploading: "Wird hochgeladen...",
    cancel: "Schließen",
    selected: (count: number) => `${count} ${count === 1 ? "Foto" : "Fotos"} ausgewählt`,
    success: (count: number) => `${count} ${count === 1 ? "Foto wurde" : "Fotos wurden"} hochgeladen.`,
    emailError: "Bitte gib eine gültige E-Mail-Adresse ein.",
    fileError: "Bitte wähle JPG, PNG, WebP, HEIC oder HEIF Bilder bis 25 MB aus.",
    uploadError: "Der Upload ist fehlgeschlagen. Bitte versuche es erneut."
  },
  hu: {
    title: "Vendégfotók",
    count: (count: number) => `${count} kép`,
    empty: "Még nincs feltöltött vendégfotó.",
    openUpload: "Képek feltöltése",
    uploadTitle: "Saját képek feltöltése",
    uploadText: "Oszd meg a kedvenc pillanataidat a párral. A képeid feltöltés után ebben a külön blokkban jelennek meg.",
    email: "E-mail cím",
    choose: "Képek kiválasztása",
    dropTitle: "Húzd ide a képeket",
    dropText: "vagy kattints a kiválasztáshoz",
    upload: "Feltöltés",
    uploading: "Feltöltés...",
    cancel: "Bezárás",
    selected: (count: number) => `${count} kép kiválasztva`,
    success: (count: number) => `${count} kép feltöltve.`,
    emailError: "Adj meg egy érvényes email címet.",
    fileError: "JPG, PNG, WebP, HEIC vagy HEIF képeket válassz, maximum 25 MB méretben.",
    uploadError: "A feltöltés nem sikerült. Próbáld újra."
  }
} as const;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function createClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function previewUrl(photo: GuestPhoto) {
  return photo.thumbnailUrl || photo.previewUrl || photo.imageUrl;
}

function readImageSize(file: File) {
  if (file.type === "image/heic" || file.type === "image/heif") {
    return Promise.resolve({ width: 0, height: 0 });
  }

  return new Promise<{ width: number; height: number }>((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    image.src = url;
  });
}

export function GuestPhotoUpload({
  galleryId,
  language,
  initialPhotos,
  uploadsEnabled = true
}: {
  galleryId: string;
  language: CustomerLanguage;
  initialPhotos: GuestPhoto[];
  uploadsEnabled?: boolean;
}) {
  const copy = COPY[language];
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [files, setFiles] = useState<GuestUploadFile[]>([]);
  const [photos] = useState(initialPhotos);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const completedCount = files.filter((file) => file.status === "done").length;
  const selectedCount = files.length;
  const visiblePhotos = useMemo(() => photos.filter((photo) => photo.imageUrl), [photos]);

  useEffect(() => {
    if (!uploadsEnabled) {
      return;
    }

    function openUploadDialog() {
      setIsUploadOpen(true);
    }

    window.addEventListener(OPEN_GUEST_UPLOAD_EVENT, openUploadDialog);

    return () => window.removeEventListener(OPEN_GUEST_UPLOAD_EVENT, openUploadDialog);
  }, [uploadsEnabled]);

  async function prepareFiles(selectedFiles: File[]) {
    const limitedFiles = selectedFiles.slice(0, MAX_FILES);
    setError("");
    setSuccess("");

    const validFiles = limitedFiles.filter((file) => ALLOWED_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_FILE_BYTES);

    if (validFiles.length !== limitedFiles.length) {
      setError(copy.fileError);
    }

    const nextFiles = await Promise.all(
      validFiles.map(async (file) => {
        const dimensions = await readImageSize(file);

        return {
          clientId: createClientId(),
          file,
          imageWidth: dimensions.width,
          imageHeight: dimensions.height,
          status: "queued" as const
        };
      })
    );

    setFiles(nextFiles);
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    await prepareFiles(Array.from(event.target.files ?? []));
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void prepareFiles(Array.from(event.dataTransfer.files ?? []));
  }

  async function uploadFiles() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setError(copy.emailError);
      return;
    }

    if (files.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    setError("");
    setSuccess("");

    try {
      const targetResult = await createGuestUploadTargetsAction(
        galleryId,
        normalizedEmail,
        files.map((item) => ({
          clientId: item.clientId,
          filename: item.file.name,
          contentType: item.file.type,
          fileSize: item.file.size,
          imageWidth: item.imageWidth,
          imageHeight: item.imageHeight
        }))
      );

      if (!targetResult.ok || !targetResult.targets) {
        throw new Error(targetResult.message ?? copy.uploadError);
      }

      const completedR2Keys: string[] = [];

      for (const target of targetResult.targets) {
        const current = files.find((item) => item.clientId === target.clientId);

        if (!current) {
          continue;
        }

        setFiles((items) => items.map((item) => item.clientId === target.clientId ? { ...item, status: "uploading" } : item));

        const response = await fetch(target.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": current.file.type || "application/octet-stream"
          },
          body: current.file
        });

        if (!response.ok) {
          setFiles((items) => items.map((item) => item.clientId === target.clientId ? { ...item, status: "failed" } : item));
          throw new Error(copy.uploadError);
        }

        completedR2Keys.push(target.r2Key);
        setFiles((items) => items.map((item) => item.clientId === target.clientId ? { ...item, status: "done" } : item));
      }

      const completeResult = await completeGuestUploadsAction(galleryId, normalizedEmail, completedR2Keys);

      if (!completeResult.ok) {
        throw new Error(completeResult.message ?? copy.uploadError);
      }

      setSuccess(copy.success(completeResult.completedCount ?? completedR2Keys.length));
      setFiles([]);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      window.location.reload();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : copy.uploadError);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section id="guest-photos" className="mt-14 scroll-mt-32 space-y-5" aria-labelledby="guest-photos-title">
      <div className="flex flex-col gap-4 border-b border-ink/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-graphite/55">{copy.count(visiblePhotos.length)}</p>
          <h2 id="guest-photos-title" className="font-playfair mt-1 text-3xl font-semibold text-ink md:text-4xl">
            {copy.title}
          </h2>
        </div>
        {uploadsEnabled ? (
          <Button type="button" onClick={() => setIsUploadOpen(true)} className="w-full sm:w-auto">
            <UploadCloud size={16} />
            {copy.openUpload}
          </Button>
        ) : null}
      </div>

      {visiblePhotos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visiblePhotos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-md bg-mist">
              {photo.imageWidth > 0 && photo.imageHeight > 0 ? (
                <Image
                  src={previewUrl(photo)}
                  alt={photo.filename}
                  width={photo.imageWidth}
                  height={photo.imageHeight}
                  unoptimized
                  className="block h-auto w-full"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                />
              ) : (
                <img src={previewUrl(photo)} alt={photo.filename} loading="lazy" className="block h-auto w-full" />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-ink/10 bg-white px-5 py-8 text-center text-sm text-graphite/70 shadow-soft">{copy.empty}</p>
      )}

      {uploadsEnabled && isUploadOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-upload-title"
        >
          <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">{copy.title}</p>
                <h3 id="guest-upload-title" className="mt-1 text-2xl font-semibold text-ink">
                  {copy.uploadTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-ink/10 text-graphite transition hover:bg-ink/5"
                aria-label={copy.cancel}
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-graphite/70">{copy.uploadText}</p>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                  <Mail size={15} />
                  {copy.email}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-ink outline-none transition focus:border-ink/50"
                />
              </label>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                multiple
                className="hidden"
                onChange={(event) => void handleFiles(event)}
              />

              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-5 py-8 text-center transition ${
                  isDragging ? "border-ink bg-paper" : "border-ink/20 bg-paper/60 hover:border-ink/35 hover:bg-paper"
                }`}
              >
                <ImagePlus size={26} className="text-graphite" />
                <p className="mt-3 text-sm font-semibold text-ink">{copy.dropTitle}</p>
                <p className="mt-1 text-xs text-graphite/65">{copy.dropText}</p>
              </div>

              {selectedCount > 0 ? (
                <p className="text-xs font-medium text-graphite/70">
                  {copy.selected(selectedCount)}
                  {isUploading ? ` · ${completedCount}/${selectedCount}` : ""}
                </p>
              ) : null}
              {success ? (
                <p className="flex items-center gap-2 rounded-md border border-sage/20 bg-sage/10 px-3 py-2 text-sm font-medium text-sage">
                  <CheckCircle2 size={16} />
                  {success}
                </p>
              ) : null}
              {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

              <div className="flex flex-col-reverse gap-2 border-t border-ink/10 pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setIsUploadOpen(false)} disabled={isUploading}>
                  {copy.cancel}
                </Button>
                <Button type="button" onClick={() => void uploadFiles()} disabled={isUploading || files.length === 0}>
                  {isUploading ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                  {isUploading ? copy.uploading : copy.upload}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function GuestPhotoUploadButton({
  label,
  className = ""
}: {
  label: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_GUEST_UPLOAD_EVENT))}
      className={className}
    >
      <UploadCloud size={16} />
      {label}
    </Button>
  );
}
