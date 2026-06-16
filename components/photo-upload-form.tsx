"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useFormStatus } from "react-dom";
import { addPhotoAction } from "@/lib/gallery-actions";
import { Button } from "@/components/button";

function UploadButton({
  selectedCount,
  isSubmitting
}: {
  selectedCount: number;
  isSubmitting: boolean;
}) {
  const { pending } = useFormStatus();
  const isUploading = pending || isSubmitting;

  return (
    <Button type="submit" disabled={isUploading || selectedCount === 0}>
      <UploadCloud size={16} />
      {isUploading ? "Feltöltés..." : selectedCount > 0 ? `${selectedCount} kép feltöltése` : "Fotók feltöltése"}
    </Button>
  );
}

function UploadProgress({
  selectedCount,
  isSubmitting
}: {
  selectedCount: number;
  isSubmitting: boolean;
}) {
  const { pending } = useFormStatus();
  const [progress, setProgress] = useState(0);
  const isUploading = pending || isSubmitting;

  useEffect(() => {
    if (!isUploading) {
      setProgress(0);
      return;
    }

    setProgress(12);
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) {
          return current;
        }

        return current + Math.max(2, Math.round((92 - current) * 0.12));
      });
    }, 650);

    return () => window.clearInterval(interval);
  }, [isUploading]);

  if (!isUploading) {
    return null;
  }

  return (
    <div className="mt-5 rounded-md border border-ink/10 bg-paper p-4" aria-live="polite">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-ink">
          Feltöltés folyamatban
        </p>
        <p className="text-sm text-graphite/70">
          {selectedCount} kép előkészítése és mentése
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-ink transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-graphite/70">
        Nagyobb albumoknál ez eltarthat pár percig. Az oldalt hagyd nyitva a folyamat végéig.
      </p>
    </div>
  );
}

export function PhotoUploadForm({ galleryId }: { galleryId: string }) {
  const [selectedCount, setSelectedCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedCount(event.target.files?.length ?? 0);
    setIsSubmitting(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const selectedFiles = formData
      .getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (selectedFiles.length > 0) {
      setSelectedCount(selectedFiles.length);
      setIsSubmitting(true);
    }
  }

  return (
    <form
      action={addPhotoAction.bind(null, galleryId)}
      onSubmit={handleSubmit}
      className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft"
    >
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink">Fotók feltöltése</h2>
        <p className="mt-1 text-sm text-graphite/70">Több kép egyszerre feltölthető. A feltöltési sorrend lesz az alap galéria sorrend.</p>
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
            onChange={handleFileChange}
            className="block w-full rounded-md border border-dashed border-ink/20 bg-paper px-4 py-6 text-sm text-graphite file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:border-ink/40"
          />
          <span className="block text-xs text-graphite/70">
            {selectedCount > 0 ? `${selectedCount} fájl kiválasztva.` : "Nincs kiválasztott fájl."}
          </span>
        </label>
        <UploadButton selectedCount={selectedCount} isSubmitting={isSubmitting} />
      </div>
      <UploadProgress selectedCount={selectedCount} isSubmitting={isSubmitting} />
    </form>
  );
}
