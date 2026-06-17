"use client";

import { ChangeEvent, DragEvent, FormEvent, useMemo, useRef, useState } from "react";
import * as exifr from "exifr";
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
  fileSize?: number;
  imageWidth?: number;
  imageHeight?: number;
  capturedAt?: string | null;
  originalIndex?: number;
};

type SelectedPhotoFile = {
  file: File;
  capturedAt: string | null;
  imageWidth: number;
  imageHeight: number;
  originalIndex: number;
};

const UPLOAD_BATCH_SIZE = 25;
const UPLOAD_CONCURRENCY = 3;
const MAX_UPLOAD_ATTEMPTS = 3;

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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function PhotoUploadForm({ galleryId }: { galleryId: string }) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedPhotoFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isReadingExif, setIsReadingExif] = useState(false);
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

  async function readPhotoMetadata(file: File) {
    try {
      const tags = await exifr.parse(file, [
        "DateTimeOriginal",
        "CreateDate",
        "ModifyDate",
        "PixelXDimension",
        "PixelYDimension",
        "ExifImageWidth",
        "ExifImageHeight",
        "ImageWidth",
        "ImageHeight"
      ]);
      const value = tags?.DateTimeOriginal ?? tags?.CreateDate ?? tags?.ModifyDate;
      const imageWidth = Number(tags?.PixelXDimension ?? tags?.ExifImageWidth ?? tags?.ImageWidth ?? 0);
      const imageHeight = Number(tags?.PixelYDimension ?? tags?.ExifImageHeight ?? tags?.ImageHeight ?? 0);

      return {
        capturedAt: value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null,
        imageWidth: Number.isFinite(imageWidth) ? imageWidth : 0,
        imageHeight: Number.isFinite(imageHeight) ? imageHeight : 0
      };
    } catch {
      return {
        capturedAt: null,
        imageWidth: 0,
        imageHeight: 0
      };
    }
  }

  async function setFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    setIsReadingExif(true);
    setUploadedCount(0);
    setUploadError("");

    const enrichedFiles = await Promise.all(
      imageFiles.map(async (file, index) => {
        const metadata = await readPhotoMetadata(file);

        return {
          file,
          ...metadata,
          originalIndex: index
        };
      })
    );

    enrichedFiles.sort((a, b) => {
      const aTime = a.capturedAt ? Date.parse(a.capturedAt) : Number.POSITIVE_INFINITY;
      const bTime = b.capturedAt ? Date.parse(b.capturedAt) : Number.POSITIVE_INFINITY;

      if (aTime !== bTime) {
        return aTime - bTime;
      }

      return a.originalIndex - b.originalIndex;
    });

    setSelectedFiles(enrichedFiles);
    setIsReadingExif(false);
  }

  function captureDateLabel(value: string | null) {
    if (!value) {
      return "Nincs EXIF idő";
    }

    return new Date(value).toLocaleString("hu-HU", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void setFiles(Array.from(event.target.files ?? []));
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
    void setFiles(Array.from(event.dataTransfer.files));
  }

  function resetSelection() {
    setSelectedFiles([]);
    setUploadedCount(0);
    setUploadError("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function uploadFile(file: File, target: PreparedUpload) {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(target.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream"
          },
          body: file
        });

        if (response.ok) {
          return;
        }

        lastError = new Error(`${file.name} feltöltése nem sikerült. (${response.status})`);
      } catch (error) {
        lastError = error;
      }

      if (attempt < MAX_UPLOAD_ATTEMPTS) {
        await wait(800 * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`${file.name} feltöltése nem sikerült.`);
  }

  async function uploadBatch(batch: SelectedPhotoFile[]) {
    const targetResult = await createPhotoUploadTargetsAction(
      galleryId,
      batch.map((file) => ({
        filename: file.file.name,
        contentType: file.file.type
      }))
    );

    if (!targetResult.ok) {
      throw new Error(targetResult.message);
    }

    const uploadTargets = targetResult.uploads ?? [];
    const completedUploads: PreparedUpload[] = new Array(batch.length);
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < batch.length) {
        const index = nextIndex;
        nextIndex += 1;

        const selectedFile = batch[index];
        const target = uploadTargets[index];

        if (!target) {
          throw new Error(`${selectedFile.file.name} feltöltése nem lett előkészítve.`);
        }

        await uploadFile(selectedFile.file, target);
        completedUploads[index] = {
          ...target,
          fileSize: selectedFile.file.size,
          imageWidth: selectedFile.imageWidth,
          imageHeight: selectedFile.imageHeight,
          capturedAt: selectedFile.capturedAt,
          originalIndex: selectedFile.originalIndex
        };
        setUploadedCount((current) => current + 1);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, batch.length) }, () => worker())
    );

    const completeResult = await completePhotoUploadsAction(galleryId, completedUploads);

    if (!completeResult.ok) {
      throw new Error(completeResult.message);
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
      for (const batch of chunkArray(selectedFiles, UPLOAD_BATCH_SIZE)) {
        await uploadBatch(batch);
      }

      window.location.href = `/admin/galleries/${galleryId}?photoAdded=1`;
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
            disabled={isUploading || isReadingExif}
            onChange={handleFileChange}
            className="sr-only"
          />
          <div className="flex size-14 items-center justify-center rounded-md bg-white text-ink shadow-soft">
            <ImagePlus size={24} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-ink">Fotók feltöltése</h2>
          <p className="mt-2 max-w-md text-sm text-graphite/70">
            Húzd ide a képeket, vagy kattints a fájlok kiválasztásához. A sorrend EXIF capture time alapján készül.
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
              {isReadingExif
                ? "EXIF adatok olvasása..."
                : selectedFiles.length > 0
                  ? "A lista már capture time szerint rendezve látszik."
                  : "Még nincs kiválasztott fájl."}
            </p>

            {selectedFiles.length > 0 ? (
              <div className="mt-5 max-h-32 space-y-2 overflow-auto pr-1">
                {selectedFiles.slice(0, 5).map((item) => (
                  <div key={`${item.file.name}-${item.file.size}`} className="rounded-md bg-white px-3 py-2 text-sm text-graphite">
                    <p className="truncate">{item.file.name}</p>
                    <p className="mt-0.5 text-xs text-graphite/60">{captureDateLabel(item.capturedAt)}</p>
                  </div>
                ))}
                {selectedFiles.length > 5 ? (
                  <p className="text-xs text-graphite/70">+{selectedFiles.length - 5} további kép</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-2">
            <Button type="submit" disabled={isUploading || isReadingExif || selectedFiles.length === 0} className="w-full">
              <UploadCloud size={16} />
              {isUploading ? "Feltöltés..." : selectedFiles.length > 0 ? `${selectedFiles.length} kép feltöltése` : "Fotók feltöltése"}
            </Button>
            {selectedFiles.length > 0 && !isUploading ? (
              <button type="button" onClick={resetSelection} className="h-10 rounded-md text-sm font-medium text-graphite hover:bg-ink/5">
                Kiválasztás törlése
              </button>
            ) : null}
          </div>
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
