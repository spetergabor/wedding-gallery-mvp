"use client";

import { ChangeEvent, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useFormStatus } from "react-dom";
import { addPhotoAction } from "@/lib/gallery-actions";
import { Button } from "@/components/button";

function UploadButton({ selectedCount }: { selectedCount: number }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || selectedCount === 0}>
      <UploadCloud size={16} />
      {pending ? "Feltöltés..." : selectedCount > 0 ? `${selectedCount} kép feltöltése` : "Fotók feltöltése"}
    </Button>
  );
}

export function PhotoUploadForm({ galleryId }: { galleryId: string }) {
  const [selectedCount, setSelectedCount] = useState(0);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedCount(event.target.files?.length ?? 0);
  }

  return (
    <form action={addPhotoAction.bind(null, galleryId)} className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
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
        <UploadButton selectedCount={selectedCount} />
      </div>
    </form>
  );
}
