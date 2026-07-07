"use client";

import { ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

type UploadedCover = {
  url: string;
  r2Key: string;
};

type UploadResponse =
  | {
      ok: true;
      url: string;
      r2Key: string;
    }
  | {
      ok: false;
      message?: string;
    };

type MiniSessionCoverUploadBoxProps = {
  helperText?: string;
};

const fileInputClass =
  "block w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink outline-none transition file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-graphite focus:border-ink/50";

async function deleteDraftCover(r2Key: string) {
  await fetch("/api/mini-session-cover", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ r2Key })
  }).catch(() => undefined);
}

export function MiniSessionCoverUploadBox({ helperText }: MiniSessionCoverUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [uploadedCover, setUploadedCover] = useState<UploadedCover | null>(null);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const previewUrl = uploadedCover?.url || localPreviewUrl;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    if (uploadedCover?.r2Key) {
      void deleteDraftCover(uploadedCover.r2Key);
    }

    setUploadedCover(null);
    setError("");
    setFile(selectedFile);
    setLocalPreviewUrl(selectedFile ? URL.createObjectURL(selectedFile) : "");
  }

  async function handleUpload() {
    if (!file) {
      setError("Válassz ki egy képet a feltöltéshez.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Csak képfájlt lehet feltölteni.");
      return;
    }

    setIsUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("coverImage", file);

    try {
      const response = await fetch("/api/mini-session-cover", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => null)) as UploadResponse | null;

      if (!response.ok || !payload || !payload.ok) {
        const message = payload && !payload.ok ? payload.message : undefined;
        setError(message || "A borítókép feltöltése nem sikerült.");
        return;
      }

      setUploadedCover({ url: payload.url, r2Key: payload.r2Key });
    } catch {
      setError("A borítókép feltöltése nem sikerült.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleClear() {
    setIsRemoving(true);
    setError("");

    if (uploadedCover?.r2Key) {
      await deleteDraftCover(uploadedCover.r2Key);
    }

    setUploadedCover(null);
    setFile(null);
    setLocalPreviewUrl("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setIsRemoving(false);
  }

  return (
    <div className="rounded-md border border-ink/10 bg-paper p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-graphite">
        <ImageIcon size={15} />
        Borítókép az érkező oldalra
      </div>
      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
        <input ref={inputRef} name="coverImage" type="file" accept="image/*" className={fileInputClass} onChange={handleFileChange} />
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || Boolean(uploadedCover) || isUploading}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          {isUploading ? "Feltöltés..." : uploadedCover ? "Feltöltve" : "Feltöltés"}
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-graphite/60">
        {helperText || "Válassz képet, töltsd fel, és az előnézet azonnal megjelenik."}
      </p>

      {previewUrl ? (
        <div className="mt-3 flex flex-col gap-3 rounded-md border border-ink/10 bg-white p-3 sm:flex-row sm:items-center">
          <div className="h-20 w-full overflow-hidden rounded-md bg-paper sm:w-32">
            <img src={previewUrl} alt="Borítókép előnézet" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{file?.name || "Feltöltött borítókép"}</p>
            <p className={`mt-1 text-xs ${uploadedCover ? "text-green-700" : "text-graphite/60"}`}>
              {uploadedCover ? "A kép feltöltve, a létrehozáskor ez kerül mentésre." : "A kép ki van választva, de még nincs feltöltve."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={isRemoving}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={15} />
            Eltávolítás
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
      <input type="hidden" name="uploadedCoverImageR2Key" value={uploadedCover?.r2Key || ""} />
    </div>
  );
}
