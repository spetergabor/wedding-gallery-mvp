"use client";

import { ChangeEvent, DragEvent, FormEvent, useMemo, useRef, useState } from "react";
import * as exifr from "exifr";
import { ImagePlus, UploadCloud } from "lucide-react";
import {
  completePhotoUploadsAction,
  createPhotoUploadSessionAction,
  createPhotoUploadTargetsAction,
  markPhotoUploadItemFailedAction
} from "@/lib/gallery-actions";
import { Button } from "@/components/button";

type PreparedUpload = {
  uploadItemId: string;
  clientId: string;
  filename: string;
  r2Key: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  thumbnailR2Key: string | null;
  previewR2Key: string | null;
  uploadUrl: string;
  mediaType: "image" | "video";
  fileSize?: number;
  imageWidth?: number;
  imageHeight?: number;
  capturedAt?: string | null;
  originalIndex?: number;
};

type PhotoUploadStatus = "queued" | "preparing" | "uploading" | "uploaded" | "completed" | "failed";

type SelectedPhotoFile = {
  clientId: string;
  file: File;
  capturedAt: string | null;
  imageWidth: number;
  imageHeight: number;
  mediaType: "image" | "video";
  originalIndex: number;
  status: PhotoUploadStatus;
  errorMessage: string | null;
  uploadItemId: string | null;
};

const UPLOAD_BATCH_SIZE = 100;
const UPLOAD_CONCURRENCY = 6;
const MAX_UPLOAD_ATTEMPTS = 3;

function uploadStatusLabel({
  completedCount,
  failedCount,
  totalCount
}: {
  completedCount: number;
  failedCount: number;
  totalCount: number;
}) {
  if (totalCount === 0) {
    return "Feltöltés előkészítése";
  }

  if (failedCount > 0) {
      return `${completedCount}/${totalCount} média mentve, ${failedCount} hibás`;
  }

  return `${completedCount}/${totalCount} média mentve`;
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

function statusLabel(status: PhotoUploadStatus) {
  switch (status) {
    case "preparing":
      return "Előkészítés";
    case "uploading":
      return "Feltöltés";
    case "uploaded":
      return "R2-ben, mentés alatt";
    case "completed":
      return "Mentve";
    case "failed":
      return "Hibás";
    default:
      return "Várakozik";
  }
}

function statusClass(status: PhotoUploadStatus) {
  switch (status) {
    case "completed":
      return "bg-sage/15 text-sage";
    case "failed":
      return "bg-red-50 text-red-700";
    case "preparing":
    case "uploading":
    case "uploaded":
      return "bg-brass/15 text-brass";
    default:
      return "bg-ink/5 text-graphite";
  }
}

export function PhotoUploadForm({ galleryId }: { galleryId: string }) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedPhotoFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isReadingExif, setIsReadingExif] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const completedCount = selectedFiles.filter((file) => file.status === "completed").length;
  const failedCount = selectedFiles.filter((file) => file.status === "failed").length;
  const activeCount = selectedFiles.filter((file) => ["preparing", "uploading", "uploaded"].includes(file.status)).length;
  const previewFiles = useMemo(() => {
    return [...selectedFiles].sort((a, b) => {
      if (a.status === "failed" && b.status !== "failed") {
        return -1;
      }

      if (a.status !== "failed" && b.status === "failed") {
        return 1;
      }

      return a.originalIndex - b.originalIndex;
    });
  }, [selectedFiles]);

  const progress = useMemo(() => {
    if (selectedFiles.length === 0) {
      return 0;
    }

    return Math.round((completedCount / selectedFiles.length) * 100);
  }, [completedCount, selectedFiles.length]);

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

  async function readVideoMetadata(file: File) {
    return new Promise<{ imageWidth: number; imageHeight: number }>((resolve) => {
      const video = document.createElement("video");
      const objectUrl = URL.createObjectURL(file);

      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          imageWidth: video.videoWidth || 0,
          imageHeight: video.videoHeight || 0
        });
      };
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ imageWidth: 0, imageHeight: 0 });
      };
      video.src = objectUrl;
    });
  }

  async function setFiles(files: File[]) {
    const mediaFiles = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));

    setIsReadingExif(true);
    setUploadError("");
    setUploadSessionId(null);

    const enrichedFiles = await Promise.all(
      mediaFiles.map(async (file, index) => {
        const mediaType: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
        const metadata =
          mediaType === "video"
            ? {
                capturedAt: null,
                ...(await readVideoMetadata(file))
              }
            : await readPhotoMetadata(file);

        return {
          clientId: `${index}-${file.name}-${file.size}-${file.lastModified}`,
          file,
          ...metadata,
          mediaType,
          originalIndex: index,
          status: "queued" as PhotoUploadStatus,
          errorMessage: null,
          uploadItemId: null
        };
      })
    );

    enrichedFiles.sort((a, b) => {
      if (a.mediaType !== b.mediaType) {
        return a.mediaType === "video" ? -1 : 1;
      }

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
      return "Nincs capture time";
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
    setUploadError("");
    setUploadSessionId(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function setFileStatus(clientId: string, status: PhotoUploadStatus, updates?: Partial<SelectedPhotoFile>) {
    setSelectedFiles((current) =>
      current.map((item) =>
        item.clientId === clientId
          ? {
              ...item,
              ...updates,
              status
            }
          : item
      )
    );
  }

  async function uploadBlob({
    body,
    uploadUrl,
    filename,
    contentType
  }: {
    body: Blob;
    uploadUrl: string;
    filename: string;
    contentType: string;
  }) {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": contentType
          },
          body
        });

        if (response.ok) {
          return;
        }

        lastError = new Error(`${filename} feltöltése nem sikerült. (${response.status})`);
      } catch (error) {
        lastError = error;
      }

      if (attempt < MAX_UPLOAD_ATTEMPTS) {
        await wait(800 * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`${filename} feltöltése nem sikerült.`);
  }

  async function uploadFile(file: File, target: PreparedUpload) {
    await uploadBlob({
      body: file,
      uploadUrl: target.uploadUrl,
      filename: file.name,
      contentType: file.type || "application/octet-stream"
    });
  }

  async function uploadBatch(sessionId: string, batch: SelectedPhotoFile[]) {
    batch.forEach((file) => setFileStatus(file.clientId, "preparing", { errorMessage: null }));

    const targetResult = await createPhotoUploadTargetsAction(
      galleryId,
      sessionId,
      batch.map((file) => ({
        clientId: file.clientId,
        filename: file.file.name,
        contentType: file.file.type,
        fileSize: file.file.size,
        imageWidth: file.imageWidth,
        imageHeight: file.imageHeight,
        mediaType: file.mediaType,
        capturedAt: file.capturedAt,
        originalIndex: file.originalIndex
      }))
    );

    if (!targetResult.ok) {
      throw new Error(targetResult.message);
    }

    const uploadTargets = targetResult.uploads ?? [];
    const completedUploads: PreparedUpload[] = [];
    let failedUploads = 0;
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < batch.length) {
        const index = nextIndex;
        nextIndex += 1;

        const selectedFile = batch[index];
        const rawTarget = uploadTargets[index];
        const target = rawTarget
          ? {
              ...rawTarget,
              mediaType: rawTarget.mediaType === "video" ? "video" : "image"
            } satisfies PreparedUpload
          : null;

        if (!target) {
          throw new Error(`${selectedFile.file.name} feltöltése nem lett előkészítve.`);
        }

        setFileStatus(selectedFile.clientId, "uploading", {
          uploadItemId: target.uploadItemId,
          errorMessage: null
        });

        try {
          await uploadFile(selectedFile.file, target);
          setFileStatus(selectedFile.clientId, "uploaded", {
            uploadItemId: target.uploadItemId,
            errorMessage: null
          });
          completedUploads.push({
            ...target,
            fileSize: selectedFile.file.size,
            imageWidth: selectedFile.imageWidth,
            imageHeight: selectedFile.imageHeight,
            mediaType: selectedFile.mediaType,
            capturedAt: selectedFile.capturedAt,
            originalIndex: selectedFile.originalIndex
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : `${selectedFile.file.name} feltöltése nem sikerült.`;
          setFileStatus(selectedFile.clientId, "failed", {
            uploadItemId: target.uploadItemId,
            errorMessage: message
          });
          await markPhotoUploadItemFailedAction({
            galleryId,
            sessionId,
            uploadItemId: target.uploadItemId,
            message
          });
          failedUploads += 1;
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, batch.length) }, () => worker())
    );

    if (completedUploads.length === 0) {
      return;
    }

    const completeResult = await completePhotoUploadsAction(galleryId, sessionId, completedUploads);

    if (!completeResult.ok) {
      throw new Error(completeResult.message);
    }

    const completedItemIds = new Set(completeResult.completedItemIds ?? []);
    completedUploads.forEach((upload) => {
      if (completedItemIds.has(upload.uploadItemId)) {
        setFileStatus(upload.clientId, "completed", { errorMessage: null });
      }
    });

    return {
      completedCount: completedUploads.length,
      failedCount: failedUploads
    };
  }

  async function uploadFiles(files: SelectedPhotoFile[], existingSessionId?: string | null) {
    if (files.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      let sessionId = existingSessionId ?? uploadSessionId;

      if (!sessionId) {
        const sessionResult = await createPhotoUploadSessionAction(galleryId, selectedFiles.length);

        if (!sessionResult.ok || !sessionResult.sessionId) {
          throw new Error(sessionResult.message);
        }

        sessionId = sessionResult.sessionId;
        setUploadSessionId(sessionId);
      }

      let failedUploads = 0;

      for (const batch of chunkArray(files, UPLOAD_BATCH_SIZE)) {
        const batchResult = await uploadBatch(sessionId, batch);
        failedUploads += batchResult?.failedCount ?? 0;
      }

      if (failedUploads === 0) {
        window.location.href = `/admin/galleries/${galleryId}?photoAdded=1`;
      } else {
        setUploadError(`${failedUploads} média feltöltése hibára futott. Csak a hibás elemeket újra tudod próbálni.`);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "A feltöltés nem sikerült.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await uploadFiles(selectedFiles.filter((file) => file.status !== "completed"));
  }

  async function retryFailedUploads() {
    await uploadFiles(selectedFiles.filter((file) => file.status === "failed"), uploadSessionId);
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
            accept="image/*,video/*"
            multiple
            required
            disabled={isUploading || isReadingExif}
            onChange={handleFileChange}
            className="sr-only"
          />
          <div className="flex size-14 items-center justify-center rounded-md bg-white text-ink shadow-soft">
            <ImagePlus size={24} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-ink">Fotók és videók feltöltése</h2>
          <p className="mt-2 max-w-md text-sm text-graphite/70">
            Húzd ide a képeket és videókat, vagy kattints a fájlok kiválasztásához. A videók a galéria elejére kerülnek.
          </p>
          <span className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white">
            Fájlok kiválasztása
          </span>
        </label>

        <div className="flex flex-col justify-between rounded-lg border border-ink/10 bg-paper p-5">
          <div>
            <p className="text-sm font-medium text-graphite">Kiválasztott médiák</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{selectedFiles.length}</p>
            <p className="mt-1 text-sm text-graphite/70">
              {isReadingExif
                ? "EXIF adatok olvasása..."
                : selectedFiles.length > 0
                  ? "A lista videókkal elöl, majd capture time szerint rendezve látszik."
                  : "Még nincs kiválasztott fájl."}
            </p>

            {selectedFiles.length > 0 ? (
              <div className="mt-5 max-h-44 space-y-2 overflow-auto pr-1">
                {previewFiles.slice(0, 10).map((item) => (
                  <div key={item.clientId} className="rounded-md bg-white px-3 py-2 text-sm text-graphite">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate">{item.file.name}</p>
                        <p className="mt-0.5 text-xs text-graphite/60">
                          {item.mediaType === "video" ? "Videó" : captureDateLabel(item.capturedAt)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    {item.errorMessage ? <p className="mt-2 text-xs text-red-700">{item.errorMessage}</p> : null}
                  </div>
                ))}
                {previewFiles.length > 10 ? (
                  <p className="text-xs text-graphite/70">+{previewFiles.length - 10} további média</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-2">
            <Button type="submit" disabled={isUploading || isReadingExif || selectedFiles.length === 0} className="w-full">
              <UploadCloud size={16} />
              {isUploading
                ? "Feltöltés..."
                : failedCount > 0
                  ? "Feltöltés folytatása"
                  : selectedFiles.length > 0
                    ? `${selectedFiles.length} média feltöltése`
                    : "Médiák feltöltése"}
            </Button>
            {failedCount > 0 && !isUploading ? (
              <Button type="button" variant="secondary" onClick={() => void retryFailedUploads()} className="w-full">
                <UploadCloud size={16} />
                Csak a hibásak újrapróbálása ({failedCount})
              </Button>
            ) : null}
            {selectedFiles.length > 0 && !isUploading ? (
              <button type="button" onClick={resetSelection} className="h-10 rounded-md text-sm font-medium text-graphite hover:bg-ink/5">
                Kiválasztás törlése
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {isUploading || completedCount > 0 || failedCount > 0 ? (
        <div className="mt-5 rounded-md border border-ink/10 bg-paper p-4" aria-live="polite">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-ink">
              {isUploading ? "Feltöltés folyamatban" : failedCount > 0 ? "Feltöltés részben kész" : "Feltöltés kész"}
            </p>
            <p className="text-sm text-graphite/70">
              {uploadStatusLabel({ completedCount, failedCount, totalCount: selectedFiles.length })}
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-ink transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-graphite/70">
            {activeCount > 0
              ? `Aktív fájlok: ${activeCount}. Az oldal maradjon nyitva, amíg minden kép fel nem töltődik.`
              : failedCount > 0
                ? "A hibás elemek listája fent látszik, ezeket külön újra tudod próbálni."
                : "Minden kiválasztott média mentve lett."}
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
