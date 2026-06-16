"use client";

import { ChangeEvent, DragEvent, FormEvent, useMemo, useRef, useState } from "react";
import { ImagePlus, UploadCloud } from "lucide-react";
import {
  completePhotoUploadsAction,
  createPhotoUploadTargetsAction
} from "@/lib/gallery-actions";
import { Button } from "@/components/button";

type PreparedUpload = {
  filename: string;
  r2Key: string;
  imageUrl: string;
  thumbnailUrl: string;
  uploadUrl: string;
};

function uploadStatusLabel({
  uploadedCount,
  totalCount
}: {
  uploadedCount: number;
  totalCount: number;
}) {
  if (totalCount === 0) {
    return "Feltöltés előkészítése";
  }

  return `${uploadedCount}/${totalCount} kép feltöltve`;
}

export function PhotoUploadForm({ galleryId }: { galleryId: string }) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const progress = useMemo(() => {
    if (!isUploading || selectedFiles.length === 0) {
      return 0;
    }

    return Math.max(8, Math.round((uploadedCount / selectedFiles.length) * 100));
  }, [isUploading, selectedFiles.length, uploadedCount]);

  function setFiles(files: File[]) {
    setSelectedFiles(files.filter((file) => file.type.startsWith("image/")));
    setUploadedCount(0);
    setUploadError("");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    setFiles(Array.from(event.dataTransfer.files));
  }

  async function uploadFile(file: File, target: PreparedUpload) {
    const response = await fetch(target.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });

    if (!response.ok) {
      throw new Error(`${file.name} feltöltése nem sikerült.`);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedFiles.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadedCount(0);
    setUploadError("");

    try {
      const targetResult = await createPhotoUploadTargetsAction(
        galleryId,
        selectedFiles.map((file) => ({
          filename: file.name,
          contentType: file.type
        }))
      );

      if (!targetResult.ok) {
        throw new Error(targetResult.message);
      }

      const uploadTargets = targetResult.uploads ?? [];
      const completedUploads: PreparedUpload[] = [];

      for (const [index, file] of selectedFiles.entries()) {
        const target = uploadTargets[index];

        if (!target) {
          throw new Error(`${file.name} feltöltése nem lett előkészítve.`);
        }

        await uploadFile(file, target);
        completedUploads.push(target);
        setUploadedCount((current) => current + 1);
      }

      const completeResult = await completePhotoUploadsAction(galleryId, completedUploads);

      if (!completeResult.ok) {
        throw new Error(completeResult.message);
      }

      window.location.href = completeResult.redirectTo ?? `/admin/galleries/${galleryId}?photoAdded=1`;
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "A feltöltés nem sikerült.");
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-stretch">
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition ${
            isDragging ? "border-ink bg-ink/[0.03]" : "border-ink/20 bg-paper hover:border-ink/40"
          } ${isUploading ? "pointer-events-none opacity-70" : ""}`}
        >
          <input
            ref={inputRef}
            name="photos"
            type="file"
            accept="image/*"
            multiple
            required
            disabled={isUploading}
            onChange={handleFileChange}
            className="sr-only"
          />
          <div className="flex size-14 items-center justify-center rounded-md bg-white text-ink shadow-soft">
            <ImagePlus size={24} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-ink">Fotók feltöltése</h2>
          <p className="mt-2 max-w-md text-sm text-graphite/70">
            Húzd ide a képeket, vagy kattints a fájlok kiválasztásához. A képek közvetlenül a Cloudflare R2 tárhelyre kerülnek.
          </p>
          <span className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white">
            Fájlok kiválasztása
          </span>
        </label>

        <div className="flex flex-col justify-between rounded-lg border border-ink/10 bg-paper p-5">
          <div>
            <p className="text-sm font-medium text-graphite">Kiválasztott képek</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{selectedFiles.length}</p>
            <p className="mt-1 text-sm text-graphite/70">
              {selectedFiles.length > 0 ? "Ellenőrizd a listát, majd indítsd a feltöltést." : "Még nincs kiválasztott fájl."}
            </p>

            {selectedFiles.length > 0 ? (
              <div className="mt-5 max-h-32 space-y-2 overflow-auto pr-1">
                {selectedFiles.slice(0, 5).map((file) => (
                  <div key={`${file.name}-${file.size}`} className="truncate rounded-md bg-white px-3 py-2 text-sm text-graphite">
                    {file.name}
                  </div>
                ))}
                {selectedFiles.length > 5 ? (
                  <p className="text-xs text-graphite/70">+{selectedFiles.length - 5} további kép</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <Button type="submit" disabled={isUploading || selectedFiles.length === 0} className="mt-5 w-full">
            <UploadCloud size={16} />
            {isUploading ? "Feltöltés..." : selectedFiles.length > 0 ? `${selectedFiles.length} kép feltöltése` : "Fotók feltöltése"}
          </Button>
        </div>
      </div>

      {isUploading ? (
        <div className="mt-5 rounded-md border border-ink/10 bg-paper p-4" aria-live="polite">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-ink">Feltöltés folyamatban</p>
            <p className="text-sm text-graphite/70">
              {uploadStatusLabel({ uploadedCount, totalCount: selectedFiles.length })}
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-ink transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-graphite/70">
            Az oldal maradjon nyitva, amíg minden kép fel nem töltődik.
          </p>
        </div>
      ) : null}

      {uploadError ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {uploadError}
        </div>
      ) : null}
    </form>
  );
}
