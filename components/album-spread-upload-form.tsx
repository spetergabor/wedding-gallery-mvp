"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/button";
import {
  completeAlbumReviewSpreadUploadsAction,
  createAlbumReviewSpreadUploadTargetsAction
} from "@/lib/album-review-actions";

type SelectedAlbumSpread = {
  clientId: string;
  file: File;
  status: "queued" | "preparing" | "uploading" | "uploaded" | "completed" | "failed";
  bytesSent: number;
  errorMessage: string | null;
};

type PreparedAlbumSpreadUpload = {
  clientId: string;
  filename: string;
  r2Key: string;
  imageUrl: string;
  fileSize: number;
  sortOrder: number;
  title: string;
  uploadUrl: string;
};

const UPLOAD_CONCURRENCY = 3;
const MAX_UPLOAD_ATTEMPTS = 3;

function createClientId(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function uploadFile({
  file,
  target,
  onProgress
}: {
  file: File;
  target: PreparedAlbumSpreadUpload;
  onProgress: (bytesSent: number) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", target.uploadUrl);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(file.size);
        resolve();
        return;
      }

      reject(new Error(`${file.name} feltöltése nem sikerült. (${request.status})`));
    };
    request.onerror = () => reject(new Error(`${file.name} feltöltése megszakadt.`));
    request.onabort = () => reject(new Error(`${file.name} feltöltése megszakadt.`));
    request.ontimeout = () => reject(new Error(`${file.name} feltöltése túl sokáig tartott.`));
    request.send(file);
  });
}

export function AlbumSpreadUploadForm({
  customerId,
  reviewId
}: {
  customerId: string;
  reviewId: string;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<SelectedAlbumSpread[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedCount = files.length;
  const completedCount = files.filter((file) => file.status === "completed").length;
  const uploadedBytes = files.reduce((sum, item) => sum + Math.min(item.bytesSent, item.file.size), 0);
  const totalBytes = files.reduce((sum, item) => sum + item.file.size, 0);
  const progress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
  const canUpload = selectedCount > 0 && !isUploading;
  const fileByClientId = useMemo(() => new Map(files.map((item) => [item.clientId, item])), [files]);

  function updateFile(clientId: string, patch: Partial<SelectedAlbumSpread>) {
    setFiles((current) => current.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)));
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []).filter((file) => file.size > 0);

    setFiles(
      selectedFiles.map((file, index) => ({
        clientId: createClientId(file, index),
        file,
        status: "queued",
        bytesSent: 0,
        errorMessage: null
      }))
    );
    setMessage("");
    setError("");
  }

  async function uploadTarget(target: PreparedAlbumSpreadUpload) {
    const selectedFile = fileByClientId.get(target.clientId);

    if (!selectedFile) {
      throw new Error(`${target.filename} nem található a kiválasztott fájlok között.`);
    }

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
      try {
        updateFile(target.clientId, { status: "uploading", bytesSent: 0, errorMessage: null });
        await uploadFile({
          file: selectedFile.file,
          target,
          onProgress: (bytesSent) => updateFile(target.clientId, { bytesSent })
        });
        updateFile(target.clientId, { status: "uploaded", bytesSent: selectedFile.file.size, errorMessage: null });
        return;
      } catch (uploadError) {
        lastError = uploadError;
        updateFile(target.clientId, {
          status: "failed",
          errorMessage: uploadError instanceof Error ? uploadError.message : "A feltöltés nem sikerült."
        });
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`${target.filename} feltöltése nem sikerült.`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canUpload) {
      return;
    }

    setIsUploading(true);
    setMessage("");
    setError("");
    setFiles((current) => current.map((item) => ({ ...item, status: "preparing", bytesSent: 0, errorMessage: null })));

    try {
      const targetResult = await createAlbumReviewSpreadUploadTargetsAction(
        customerId,
        reviewId,
        files.map((item) => ({
          clientId: item.clientId,
          filename: item.file.name,
          contentType: item.file.type || "application/octet-stream",
          fileSize: item.file.size
        }))
      );

      if (!targetResult.ok || !targetResult.uploads?.length) {
        throw new Error(targetResult.message ?? "Nem sikerült előkészíteni a feltöltést.");
      }

      const completedUploads: PreparedAlbumSpreadUpload[] = [];
      const failures: string[] = [];
      let nextIndex = 0;

      async function worker() {
        while (nextIndex < targetResult.uploads!.length) {
          const target = targetResult.uploads![nextIndex];

          nextIndex += 1;
          try {
            await uploadTarget(target);
            completedUploads.push(target);
          } catch (uploadError) {
            failures.push(uploadError instanceof Error ? uploadError.message : `${target.filename} feltöltése nem sikerült.`);
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, targetResult.uploads.length) }, () => worker())
      );

      if (completedUploads.length === 0) {
        throw new Error(failures[0] ?? "Egy oldalpárt sem sikerült feltölteni.");
      }

      const completeResult = await completeAlbumReviewSpreadUploadsAction(customerId, reviewId, completedUploads);

      if (!completeResult.ok) {
        throw new Error(completeResult.message ?? "A feltöltött oldalpárok mentése nem sikerült.");
      }

      const completedClientIds = new Set(completedUploads.map((upload) => upload.clientId));

      setFiles((current) =>
        current.map((item) => (completedClientIds.has(item.clientId) ? { ...item, status: "completed" } : item))
      );
      setMessage(
        failures.length > 0
          ? `${completeResult.count ?? completedUploads.length} album oldalpár feltöltve, ${failures.length} hibás.`
          : `${completeResult.count ?? completedUploads.length} album oldalpár feltöltve.`
      );
      if (failures.length > 0) {
        setError(failures[0]);
      }
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Az album oldalpár feltöltés nem sikerült.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-ink/10 bg-white p-3">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">Oldalpár képek feltöltése</span>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={isUploading}
          onChange={handleFilesChange}
          className="block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-60"
        />
      </label>

      {selectedCount > 0 ? (
        <div className="mt-3 space-y-2 rounded-md bg-paper p-3">
          <div className="flex items-center justify-between gap-3 text-xs text-graphite/70">
            <span>
              {completedCount}/{selectedCount} kész · {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="max-h-32 space-y-1 overflow-auto pr-1">
            {files.map((item) => (
              <div key={item.clientId} className="flex items-center justify-between gap-2 text-xs text-graphite">
                <span className="min-w-0 truncate">{item.file.name}</span>
                <span className="shrink-0">
                  {item.status === "failed" ? "hibás" : item.status === "completed" ? "kész" : item.status === "uploading" ? "feltöltés" : "vár"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 flex items-center gap-2 rounded-md bg-sage/10 px-3 py-2 text-sm font-medium text-sage">
          <CheckCircle2 size={15} />
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          <AlertCircle size={15} />
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={!canUpload} className="mt-3 w-full">
        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        {isUploading ? "Feltöltés..." : "Feltöltés"}
      </Button>
    </form>
  );
}
