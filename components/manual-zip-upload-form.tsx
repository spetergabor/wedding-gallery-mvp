"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, AlertCircle, ArrowLeft, CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/button";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  abortManualGalleryZipMultipartUploadAction,
  completeManualGalleryZipUploadAction,
  completeManualGalleryZipMultipartUploadAction,
  createManualGalleryZipMultipartPartUploadUrlAction,
  createManualGalleryZipUploadTargetAction,
  queueGalleryZipPackageAction
} from "@/lib/gallery-actions";

type UploadStatus = "idle" | "preparing" | "uploading" | "saving" | "completed" | "failed";
type ZipHandoffState = "none" | "manual_ready" | "online_ready" | "processing" | "stale";

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
  disabled = false,
  variant = "card",
  handoffState = "none",
  handoffDetail = null
}: {
  galleryId: string;
  disabled?: boolean;
  variant?: "card" | "compact";
  handoffState?: ZipHandoffState;
  handoffDetail?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [bytesSent, setBytesSent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<"choice" | "manual">("choice");

  const isWorking = status === "preparing" || status === "uploading" || status === "saving";
  const progress = selectedFile && selectedFile.size > 0 ? Math.round((Math.min(bytesSent, selectedFile.size) / selectedFile.size) * 100) : 0;
  const isSolved = handoffState === "manual_ready" || handoffState === "online_ready";
  const isPreparingOnline = handoffState === "processing";
  const isStale = handoffState === "stale";
  const StatusIcon = isSolved
    ? CheckCircle2
    : isPreparingOnline
      ? Loader2
      : isStale
        ? AlertCircle
        : step === "choice"
          ? Archive
          : status === "completed"
            ? CheckCircle2
            : status === "failed"
              ? AlertCircle
              : isWorking
                ? Loader2
                : UploadCloud;
  const compact = variant === "compact";
  const statusText = isSolved ? "Megoldva" : isPreparingOnline ? "Folyamatban" : isStale ? "Új ZIP kell" : step === "choice" ? "Választás kell" : statusLabel(status);

  function setZipFile(file: File | null) {
    setSelectedFile(file);
    setErrorMessage("");
    setBytesSent(0);
    setStatus("idle");

    if (file && !isZipFile(file)) {
      setStatus("failed");
      setErrorMessage("Csak .zip fájlt válassz ki.");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setZipFile(event.target.files?.[0] ?? null);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();

    if (!disabled && !isWorking) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (disabled || isWorking) {
      return;
    }

    setZipFile(event.dataTransfer.files?.[0] ?? null);
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

  const content = (
    <div className="space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className={`flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass ${compact ? "text-xs" : ""}`}>
              <UploadCloud size={15} />
              Letöltési átadás
            </div>
            <h2 className={`${compact ? "mt-1 text-lg" : "mt-2 text-xl"} font-semibold text-ink`}>ZIP átadás előkészítése</h2>
            <p className={`mt-1 max-w-3xl text-sm leading-6 text-graphite/70 ${compact ? "max-w-2xl" : ""}`}>
              Döntsd el, hogy a rendszer készítsen teljes méretű ZIP-et online, vagy te töltesz fel egy saját, kész ZIP csomagot.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink/5 px-3 py-1.5 text-sm font-medium text-graphite">
            <StatusIcon size={16} className={isWorking || isPreparingOnline ? "animate-spin" : ""} />
            {statusText}
          </span>
        </div>

        {disabled && !isSolved && !isPreparingOnline ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            Ehhez a galériához most nem készíthető vagy tölthető fel ZIP csomag.
          </p>
        ) : null}

        {isSolved ? (
          <div className="rounded-md border border-sage/25 bg-sage/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-sage">
                  <CheckCircle2 size={17} />
                  A ZIP átadás megoldva
                </div>
                <p className="mt-2 text-sm leading-6 text-graphite/75">
                  {handoffState === "manual_ready"
                    ? "Saját ZIP van feltöltve ehhez a galériához. A vendég ezt a kész csomagot tudja letölteni."
                    : "Az online ZIP elkészült ehhez a galériához. A vendégnek már küldhető a letöltési link."}
                </p>
                {handoffDetail ? <p className="mt-1 text-xs text-graphite/60">{handoffDetail}</p> : null}
              </div>
              <a
                href={`/admin/galleries/${galleryId}?tab=downloads`}
                className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-sage/25 bg-white px-3 text-xs font-medium text-sage hover:border-sage/40"
              >
                Letöltések megnyitása
              </a>
            </div>
          </div>
        ) : null}

        {isPreparingOnline ? (
          <div className="rounded-md border border-brass/25 bg-brass/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-brass">
                  <Loader2 size={17} className="animate-spin" />
                  Online ZIP készül
                </div>
                <p className="mt-2 text-sm leading-6 text-graphite/75">
                  A rendszer már dolgozik a ZIP csomagon. Nem kell újra elindítani.
                </p>
                {handoffDetail ? <p className="mt-1 text-xs text-graphite/60">{handoffDetail}</p> : null}
              </div>
              <a
                href={`/admin/galleries/${galleryId}?tab=downloads`}
                className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-brass/25 bg-white px-3 text-xs font-medium text-brass hover:border-brass/40"
              >
                Állapot megnyitása
              </a>
            </div>
          </div>
        ) : null}

        {isStale ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                  <AlertCircle size={17} />
                  A korábbi ZIP már nem aktuális
                </div>
                <p className="mt-2 text-sm leading-6 text-red-800/80">
                  A galéria tartalma megváltozott, ezért új ZIP csomagot kell készíteni vagy feltölteni.
                </p>
                {handoffDetail ? <p className="mt-1 text-xs text-red-700/75">{handoffDetail}</p> : null}
              </div>
              <a
                href={`/admin/galleries/${galleryId}?tab=downloads`}
                className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:border-red-300"
              >
                Előzmények
              </a>
            </div>
          </div>
        ) : null}

        {!isSolved && !isPreparingOnline && step === "choice" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col justify-between rounded-md border border-ink/10 bg-paper p-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Archive size={17} />
                  Online konvertálás
                </div>
                <p className="mt-2 text-sm leading-6 text-graphite/70">
                  A Spetly a feltöltött teljes felbontású képekből készít ZIP-et. Indítás után automatikusan a Letöltések fülön látod az állapotot.
                </p>
              </div>
              <form action={queueGalleryZipPackageAction.bind(null, galleryId)} className="mt-4">
                <FormSubmitButton disabled={disabled} pendingLabel="Indítás..." className={disabled ? "opacity-60" : ""}>
                  <Archive size={16} />
                  Indítás és státusz
                </FormSubmitButton>
              </form>
            </div>

            <div className="flex flex-col justify-between rounded-md border border-ink/10 bg-paper p-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <UploadCloud size={17} />
                  Saját ZIP feltöltése
                </div>
                <p className="mt-2 text-sm leading-6 text-graphite/70">
                  Ha a gépeden már elkészítetted a ZIP-et, itt töltheted fel közvetlenül. A vendég ezt a kész csomagot kapja.
                </p>
              </div>
              <Button type="button" variant="secondary" className="mt-4 w-fit" disabled={disabled} onClick={() => setStep("manual")}>
                <UploadCloud size={16} />
                Saját ZIP választása
              </Button>
            </div>
          </div>
        ) : null}

        {!isSolved && !isPreparingOnline && step === "manual" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-md bg-paper px-4 py-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-ink">Saját ZIP feltöltése</p>
                <p className="mt-1 text-xs text-graphite/65">Válaszd ki a kész .zip fájlt, majd töltsd fel.</p>
              </div>
              <button
                type="button"
                className="inline-flex w-fit items-center gap-2 text-sm font-medium text-graphite hover:text-ink"
                disabled={isWorking}
                onClick={() => {
                  setZipFile(null);
                  setStep("choice");
                  if (inputRef.current) {
                    inputRef.current.value = "";
                  }
                }}
              >
                <ArrowLeft size={15} />
                Másik út választása
              </button>
            </div>

            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col rounded-md border border-dashed px-4 py-4 transition sm:flex-row sm:items-center sm:gap-4 ${
                isDragging ? "border-ink bg-ink/[0.03]" : "border-ink/20 bg-paper hover:border-ink/35"
              } ${disabled || isWorking ? "pointer-events-none opacity-60" : ""}`}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-ink shadow-sm">
                <UploadCloud size={22} />
              </span>
              <span className="mt-3 min-w-0 flex-1 sm:mt-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {selectedFile ? selectedFile.name : "Kattints a ZIP fájl kiválasztásához"}
                </span>
                <span className="mt-1 block text-xs leading-5 text-graphite/65">
                  {selectedFile ? `${formatBytes(selectedFile.size)} · közvetlen R2 feltöltés` : "Vagy húzd ide a kész .zip fájlt."}
                </span>
              </span>
              <span className="mt-3 inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-ink px-3 text-sm font-medium text-white sm:mt-0">
                Fájl kiválasztása
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
                    setZipFile(null);
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
        ) : null}
      </div>
  );

  if (compact) {
    return (
      <div className="mt-6 border-t border-ink/10 pt-6">
        {content}
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      {content}
    </section>
  );
}
