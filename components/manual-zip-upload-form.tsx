"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  abortManualGalleryZipMultipartUploadAction,
  completeManualGalleryZipUploadAction,
  completeManualGalleryZipMultipartUploadAction,
  createManualGalleryZipMultipartPartUploadUrlAction,
  createManualGalleryZipUploadTargetAction
} from "@/lib/gallery-actions";

type UploadStatus = "idle" | "preparing" | "uploading" | "saving" | "completed" | "failed";

type ManualZipMultipartUploadTarget = {
  ok: true;
  uploadType: "multipart";
  r2Key: string;
  downloadUrl: string;
  uploadId: string;
  partSize: number;
  partCount: number;
};

type ManualZipUploadTarget =
  | {
      ok: true;
      uploadType?: "single";
      r2Key: string;
      downloadUrl: string;
      uploadUrl: string;
    }
  | ManualZipMultipartUploadTarget;

type UploadedPart = {
  etag: string | null;
  partNumber: number;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isZipFile(file: File) {
  return file.name.toLowerCase().endsWith(".zip");
}

function statusLabel(status: UploadStatus) {
  switch (status) {
    case "preparing":
      return "Feltöltés előkészítése";
    case "uploading":
      return "ZIP feltöltése";
    case "saving":
      return "Csomag mentése";
    case "completed":
      return "ZIP feltöltve";
    case "failed":
      return "Feltöltés sikertelen";
    default:
      return "Készen áll";
  }
}

function uploadRequest({
  body,
  contentType,
  uploadUrl,
  totalBytes,
  onProgress
}: {
  body: Blob | File;
  contentType?: string;
  uploadUrl: string;
  totalBytes: number;
  onProgress: (bytesSent: number) => void;
}) {
  return new Promise<{ etag: string | null }>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", uploadUrl);
    if (contentType) {
      request.setRequestHeader("Content-Type", contentType);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(totalBytes);
        resolve({ etag: request.getResponseHeader("ETag") });
        return;
      }

      reject(new Error(`A ZIP feltöltése nem sikerült. (${request.status})`));
    };
    request.onerror = () => reject(new Error("Hálózati hiba történt feltöltés közben."));
    request.onabort = () => reject(new Error("A feltöltés megszakadt."));
    request.send(body);
  });
}

function uploadFile({
  file,
  uploadUrl,
  onProgress
}: {
  file: File;
  uploadUrl: string;
  onProgress: (bytesSent: number) => void;
}) {
  return uploadRequest({
    body: file,
    contentType: file.type || "application/zip",
    uploadUrl,
    totalBytes: file.size,
    onProgress
  }).then(() => undefined);
}

async function uploadMultipartFile({
  file,
  galleryId,
  target,
  onProgress
}: {
  file: File;
  galleryId: string;
  target: ManualZipMultipartUploadTarget;
  onProgress: (bytesSent: number) => void;
}) {
  const uploadedParts: UploadedPart[] = [];
  let completedBytes = 0;

  for (let partNumber = 1; partNumber <= target.partCount; partNumber += 1) {
    const start = (partNumber - 1) * target.partSize;
    const end = Math.min(start + target.partSize, file.size);
    const blob = file.slice(start, end);
    const partTarget = await createManualGalleryZipMultipartPartUploadUrlAction(galleryId, {
      r2Key: target.r2Key,
      uploadId: target.uploadId,
      partNumber
    });

    if (!partTarget.ok || !partTarget.uploadUrl) {
      throw new Error(partTarget.message ?? "Nem sikerült előkészíteni a ZIP rész feltöltését.");
    }

    const uploaded = await uploadRequest({
      body: blob,
      uploadUrl: partTarget.uploadUrl,
      totalBytes: blob.size,
      onProgress: (partBytesSent) => onProgress(completedBytes + partBytesSent)
    });

    completedBytes += blob.size;
    onProgress(completedBytes);
    uploadedParts.push({
      etag: uploaded.etag,
      partNumber
    });
  }

  return uploadedParts;
}

export function ManualZipUploadForm({
  galleryId,
  disabled = false
}: {
  galleryId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [bytesSent, setBytesSent] = useState(0);

  const isWorking = status === "preparing" || status === "uploading" || status === "saving";
  const progress = selectedFile && selectedFile.size > 0 ? Math.round((Math.min(bytesSent, selectedFile.size) / selectedFile.size) * 100) : 0;
  const StatusIcon = status === "completed" ? CheckCircle2 : status === "failed" ? AlertCircle : isWorking ? Loader2 : UploadCloud;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setErrorMessage("");
    setBytesSent(0);
    setStatus("idle");

    if (file && !isZipFile(file)) {
      setStatus("failed");
      setErrorMessage("Csak .zip fájlt válassz ki.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile || disabled || isWorking) {
      return;
    }

    if (!isZipFile(selectedFile)) {
      setStatus("failed");
      setErrorMessage("Csak .zip fájlt válassz ki.");
      return;
    }

    const multipartTargetRef: { current: ManualZipMultipartUploadTarget | null } = { current: null };

    try {
      setStatus("preparing");
      setErrorMessage("");
      setBytesSent(0);

      const target = await createManualGalleryZipUploadTargetAction(galleryId, {
        filename: selectedFile.name,
        contentType: selectedFile.type || "application/zip",
        fileSize: selectedFile.size
      });

      if (!target.ok || !target.r2Key || !target.downloadUrl) {
        throw new Error(target.message ?? "Nem sikerült előkészíteni a ZIP feltöltést.");
      }

      if (target.uploadType === "multipart" && (!target.uploadId || !target.partSize || !target.partCount)) {
        throw new Error("Nem sikerült előkészíteni a nagy ZIP feltöltést.");
      }

      if (target.uploadType !== "multipart" && !target.uploadUrl) {
        throw new Error("Nem sikerült előkészíteni a ZIP feltöltést.");
      }

      setStatus("uploading");
      const completed =
        target.uploadType === "multipart"
          ? await (async () => {
              const multipartUploadTarget: ManualZipMultipartUploadTarget = {
                ok: true,
                uploadType: "multipart",
                r2Key: target.r2Key,
                downloadUrl: target.downloadUrl,
                uploadId: target.uploadId!,
                partSize: target.partSize!,
                partCount: target.partCount!
              };
              multipartTargetRef.current = multipartUploadTarget;
              const parts = await uploadMultipartFile({
                file: selectedFile,
                galleryId,
                target: multipartUploadTarget,
                onProgress: setBytesSent
              });

              setStatus("saving");
              return completeManualGalleryZipMultipartUploadAction(galleryId, {
                r2Key: multipartUploadTarget.r2Key,
                downloadUrl: multipartUploadTarget.downloadUrl,
                uploadId: multipartUploadTarget.uploadId,
                fileSize: selectedFile.size,
                parts
              });
            })()
          : await (async () => {
              await uploadFile({
                file: selectedFile,
                uploadUrl: target.uploadUrl!,
                onProgress: setBytesSent
              });

              setStatus("saving");
              return completeManualGalleryZipUploadAction(galleryId, {
                r2Key: target.r2Key,
                downloadUrl: target.downloadUrl,
                fileSize: selectedFile.size
              });
            })();

      if (!completed.ok) {
        throw new Error(completed.message);
      }

      setStatus("completed");
      router.replace(`/admin/galleries/${galleryId}?tab=downloads&zip=manual-uploaded`);
      router.refresh();
    } catch (error) {
      const multipartTarget = multipartTargetRef.current;

      if (multipartTarget) {
        await abortManualGalleryZipMultipartUploadAction(galleryId, {
          r2Key: multipartTarget.r2Key,
          uploadId: multipartTarget.uploadId
        }).catch(() => undefined);
      }

      setStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : "A ZIP feltöltése nem sikerült.");
    }
  }

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
              <UploadCloud size={15} />
              Letöltési átadás
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">Kész ZIP feltöltése</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/70">
              Ha a Macen elkészített ZIP-et töltöd fel, a pár azonnal letöltheti a kész csomagot. A rendszer közben automatikusan elkészíti a
              kompakt, webes méretű vendég ZIP-et is.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink/5 px-3 py-1.5 text-sm font-medium text-graphite">
            <StatusIcon size={16} className={isWorking ? "animate-spin" : ""} />
            {statusLabel(status)}
          </span>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-ink/20 bg-paper px-4 py-4 text-center transition hover:border-ink/35 sm:flex-row sm:gap-3 sm:text-left">
          <UploadCloud size={22} className="text-graphite/70" />
          <span className="mt-2 text-sm font-medium text-ink sm:mt-0">
            {selectedFile ? selectedFile.name : "ZIP fájl kiválasztása"}
          </span>
          <span className="mt-1 text-xs text-graphite/60 sm:ml-auto sm:mt-0">
            {selectedFile ? formatBytes(selectedFile.size) : ".zip fájl, közvetlen R2 feltöltéssel"}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="sr-only"
            disabled={disabled || isWorking}
            onChange={handleFileChange}
          />
        </label>

        {selectedFile && (status === "uploading" || status === "saving" || status === "completed") ? (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <p className="mt-2 text-sm text-graphite/70">
              {progress}% · {formatBytes(bytesSent)} / {formatBytes(selectedFile.size)}
            </p>
          </div>
        ) : null}

        {errorMessage ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{errorMessage}</p>
        ) : null}

        {disabled ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            Ehhez a galériához most nem tölthető fel ZIP csomag.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <FormSubmitButton
            type="submit"
            disabled={!selectedFile || disabled || isWorking || status === "completed"}
            className={(!selectedFile || disabled || isWorking) ? "opacity-60" : ""}
            busy={isWorking}
            pendingLabel={statusLabel(status)}
          >
            <UploadCloud size={16} />
            {status === "idle" ? "ZIP feltöltése" : statusLabel(status)}
          </FormSubmitButton>
          {selectedFile ? (
            <button
              type="button"
              className="text-sm font-medium text-graphite hover:text-ink"
              disabled={isWorking}
              onClick={() => {
                setSelectedFile(null);
                setErrorMessage("");
                setBytesSent(0);
                setStatus("idle");
                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }}
            >
              Másik fájl
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
