"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
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

  const progress = useMemo(() => {
    if (!isUploading || selectedFiles.length === 0) {
      return 0;
    }

    return Math.max(8, Math.round((uploadedCount / selectedFiles.length) * 100));
  }, [isUploading, selectedFiles.length, uploadedCount]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(event.target.files ?? []));
    setUploadedCount(0);
    setUploadError("");
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
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink">Fotók feltöltése</h2>
        <p className="mt-1 text-sm text-graphite/70">
          Több kép egyszerre feltölthető. A képek közvetlenül a Cloudflare R2 tárhelyre kerülnek.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Képek kiválasztása</span>
          <input
            name="photos"
            type="file"
            accept="image/*"
            multiple
            required
            disabled={isUploading}
            onChange={handleFileChange}
            className="block w-full rounded-md border border-dashed border-ink/20 bg-paper px-4 py-6 text-sm text-graphite file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span className="block text-xs text-graphite/70">
            {selectedFiles.length > 0 ? `${selectedFiles.length} fájl kiválasztva.` : "Nincs kiválasztott fájl."}
          </span>
        </label>
        <Button type="submit" disabled={isUploading || selectedFiles.length === 0}>
          <UploadCloud size={16} />
          {isUploading ? "Feltöltés..." : selectedFiles.length > 0 ? `${selectedFiles.length} kép feltöltése` : "Fotók feltöltése"}
        </Button>
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
