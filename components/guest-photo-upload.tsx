"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  UploadCloud,
  UserRound,
  WifiOff,
  X
} from "lucide-react";
import { Button } from "@/components/button";
import {
  completeGuestUploadsAction,
  createGuestUploadTargetsAction,
  getGuestGalleryPhotosAction
} from "@/lib/guest-upload-actions";
import type { CustomerLanguage } from "@/lib/customer-language";
import {
  clearGuestUploadQueue,
  loadGuestUploadQueue,
  saveGuestUploadQueue
} from "@/lib/guest-upload-queue";

type GuestPhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  imageWidth: number;
  imageHeight: number;
  guestName: string | null;
  processingStatus: string;
  createdAt: string;
};

type GuestUploadStatus = "hashing" | "queued" | "waiting" | "uploading" | "done" | "failed" | "duplicate";

type GuestUploadFile = {
  clientId: string;
  file: File;
  contentType: string;
  contentHash: string;
  imageWidth: number;
  imageHeight: number;
  status: GuestUploadStatus;
  progress: number;
  error?: string;
};

type UploadTarget = {
  clientId: string;
  filename: string;
  r2Key: string;
  uploadUrl: string;
};

const MAX_FILES = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const PARALLEL_UPLOADS = 4;
const MAX_AUTOMATIC_UPLOAD_ATTEMPTS = 3;
const QUEUE_PERSIST_DEBOUNCE_MS = 350;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const OPEN_GUEST_UPLOAD_EVENT = "spetly:open-guest-photo-upload";

const COPY = {
  de: {
    title: "Gästefotos",
    count: (count: number) => `${count} ${count === 1 ? "Foto" : "Fotos"}`,
    empty: "Noch keine Gästefotos hochgeladen.",
    openUpload: "Fotos hochladen",
    uploadTitle: "Eigene Fotos hochladen",
    uploadText: "Teile deine Lieblingsmomente mit dem Paar. Name und E-Mail-Adresse sind freiwillig.",
    name: "Dein Name (optional)",
    email: "E-Mail-Adresse (optional)",
    library: "Fotomediathek",
    camera: "Kamera",
    dropTitle: "Fotos hierher ziehen",
    dropText: "Bis zu 20 Fotos, vier werden gleichzeitig hochgeladen",
    upload: "Hochladen",
    continueUpload: "Upload fortsetzen",
    uploading: "Wird hochgeladen...",
    cancel: "Schließen",
    selected: (count: number) => `${count} ${count === 1 ? "Foto" : "Fotos"} ausgewählt`,
    success: (count: number) => `${count} ${count === 1 ? "Foto wurde" : "Fotos wurden"} hochgeladen.`,
    approvalSuccess: (count: number) => `${count} ${count === 1 ? "Foto wartet" : "Fotos warten"} auf Freigabe.`,
    duplicateSuccess: (count: number) => `${count} ${count === 1 ? "Duplikat wurde" : "Duplikate wurden"} übersprungen.`,
    partialError: (count: number) => `${count} ${count === 1 ? "Foto konnte" : "Fotos konnten"} nicht hochgeladen werden. Versuche nur diese erneut.`,
    live: "Wird automatisch aktualisiert",
    processing: "Vorschau wird erstellt",
    hashing: "Wird geprüft",
    queued: "Bereit",
    fileUploading: "Wird hochgeladen",
    waiting: "Wartet auf Verbindung",
    done: "Fertig",
    failed: "Fehlgeschlagen",
    duplicate: "Bereits vorhanden",
    retry: "Erneut versuchen",
    remove: "Entfernen",
    emailError: "Bitte gib eine gültige E-Mail-Adresse ein.",
    fileError: "Bitte wähle JPG, PNG, WebP, HEIC oder HEIF Bilder bis 25 MB aus.",
    hashError: "Dieses Foto konnte nicht geprüft werden.",
    uploadError: "Der Upload ist fehlgeschlagen. Bitte versuche es erneut.",
    offlineTitle: "Keine Internetverbindung",
    offlineText: "Die Warteschlange bleibt auf diesem Gerät gespeichert und wird automatisch fortgesetzt, sobald die Verbindung wieder da ist.",
    restoredQueue: "Der unterbrochene Upload wurde wiederhergestellt und wird automatisch fortgesetzt.",
    queueStorageError: "Die Upload-Warteschlange kann auf diesem Gerät nicht dauerhaft gespeichert werden.",
    openPhoto: "Foto im Vollbild öffnen",
    previousPhoto: "Vorheriges Foto",
    nextPhoto: "Nächstes Foto",
    closeViewer: "Vollbild schließen"
  },
  hu: {
    title: "Vendégfotók",
    count: (count: number) => `${count} kép`,
    empty: "Még nincs feltöltött vendégfotó.",
    openUpload: "Képek feltöltése",
    uploadTitle: "Saját képek feltöltése",
    uploadText: "Oszd meg a kedvenc pillanataidat a párral. A név és az e-mail cím megadása nem kötelező.",
    name: "Neved (opcionális)",
    email: "E-mail cím (opcionális)",
    library: "Fotótár",
    camera: "Kamera",
    dropTitle: "Húzd ide a képeket",
    dropText: "Legfeljebb 20 kép, egyszerre négy töltődik fel",
    upload: "Feltöltés",
    continueUpload: "Feltöltés folytatása",
    uploading: "Feltöltés...",
    cancel: "Bezárás",
    selected: (count: number) => `${count} kép kiválasztva`,
    success: (count: number) => `${count} kép feltöltve.`,
    approvalSuccess: (count: number) => `${count} kép jóváhagyásra vár.`,
    duplicateSuccess: (count: number) => `${count} duplikált kép kihagyva.`,
    partialError: (count: number) => `${count} kép feltöltése megszakadt. Csak ezeket próbáld újra.`,
    live: "Automatikusan frissül",
    processing: "Előnézet készül",
    hashing: "Ellenőrzés",
    queued: "Feltöltésre kész",
    fileUploading: "Feltöltés",
    waiting: "Kapcsolatra vár",
    done: "Kész",
    failed: "Megszakadt",
    duplicate: "Már szerepel",
    retry: "Újrapróbálás",
    remove: "Eltávolítás",
    emailError: "Adj meg egy érvényes email címet.",
    fileError: "JPG, PNG, WebP, HEIC vagy HEIF képeket válassz, maximum 25 MB méretben.",
    hashError: "A kép ellenőrzése nem sikerült.",
    uploadError: "A feltöltés nem sikerült. Próbáld újra.",
    offlineTitle: "Nincs internetkapcsolat",
    offlineText: "A feltöltési sor ezen az eszközön megmarad, és a kapcsolat visszatérésekor automatikusan folytatódik.",
    restoredQueue: "A félbemaradt feltöltési sort visszaállítottuk, és automatikusan folytatjuk.",
    queueStorageError: "A feltöltési sor ezen az eszközön nem tárolható tartósan.",
    openPhoto: "Kép megnyitása teljes képernyőn",
    previousPhoto: "Előző kép",
    nextPhoto: "Következő kép",
    closeViewer: "Teljes képernyő bezárása"
  }
} as const;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function createClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function previewUrl(photo: GuestPhoto) {
  return photo.thumbnailUrl || photo.previewUrl || photo.imageUrl;
}

function fullscreenUrl(photo: GuestPhoto) {
  return photo.previewUrl || photo.imageUrl || photo.thumbnailUrl;
}

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function getContentType(file: File) {
  if (ALLOWED_TYPES.has(file.type)) {
    return file.type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "jpg" || extension === "jpeg"
    ? "image/jpeg"
    : extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : extension === "heic"
          ? "image/heic"
          : extension === "heif"
            ? "image/heif"
            : "";
}

async function hashFile(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readImageSize(file: File, contentType: string) {
  if (contentType === "image/heic" || contentType === "image/heif") {
    return Promise.resolve({ width: 0, height: 0 });
  }

  return new Promise<{ width: number; height: number }>((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    image.src = url;
  });
}

class GuestUploadRequestError extends Error {
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "GuestUploadRequestError";
    this.retryable = retryable;
  }
}

function browserIsOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function isConnectionError(error: unknown) {
  if (!browserIsOnline()) {
    return true;
  }

  if (error instanceof GuestUploadRequestError) {
    return error.retryable;
  }

  return error instanceof Error && /failed to fetch|networkerror|load failed|network request failed/i.test(error.message);
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function uploadFileWithProgress(
  file: File,
  contentType: string,
  target: UploadTarget,
  onProgress: (progress: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", target.uploadUrl);
    request.timeout = 5 * 60 * 1000;
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new GuestUploadRequestError(`HTTP ${request.status}`, request.status >= 500 || request.status === 408 || request.status === 429));
      }
    };
    request.onerror = () => reject(new GuestUploadRequestError("network-error", true));
    request.ontimeout = () => reject(new GuestUploadRequestError("timeout", true));
    request.onabort = () => reject(new GuestUploadRequestError("aborted", false));
    request.send(file);
  });
}

async function uploadFileWithAutomaticRetry(
  file: File,
  contentType: string,
  target: UploadTarget,
  onProgress: (progress: number) => void,
  onRetry: () => void,
  onAttempt: () => void
) {
  let attempt = 0;

  while (attempt < MAX_AUTOMATIC_UPLOAD_ATTEMPTS) {
    if (!browserIsOnline()) {
      throw new GuestUploadRequestError("offline", true);
    }

    try {
      onAttempt();
      await uploadFileWithProgress(file, contentType, target, onProgress);
      return;
    } catch (error) {
      attempt += 1;
      const canRetry = isConnectionError(error) && browserIsOnline() && attempt < MAX_AUTOMATIC_UPLOAD_ATTEMPTS;

      if (!canRetry) {
        throw error;
      }

      onRetry();
      await wait(750 * (2 ** (attempt - 1)));
    }
  }
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
}

export function GuestPhotoUpload({
  galleryId,
  language,
  initialPhotos,
  initialRevision,
  uploadsEnabled = true
}: {
  galleryId: string;
  language: CustomerLanguage;
  initialPhotos: GuestPhoto[];
  initialRevision: number;
  uploadsEnabled?: boolean;
}) {
  const copy = COPY[language];
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const guestKeyRef = useRef("");
  const revisionRef = useRef(initialRevision);
  const refreshInFlightRef = useRef(false);
  const prepareInFlightRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [files, setFiles] = useState<GuestUploadFile[]>([]);
  const [photos, setPhotos] = useState(initialPhotos);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [queueHydrated, setQueueHydrated] = useState(false);
  const [queuePersistenceAvailable, setQueuePersistenceAvailable] = useState(true);
  const [resumeRequest, setResumeRequest] = useState(0);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const selectedCount = files.length;
  const resolvedCount = files.filter((file) => file.status === "done" || file.status === "duplicate").length;
  const retryableCount = files.filter((file) => file.status === "failed" || file.status === "waiting").length;
  const actionableCount = files.filter((file) => file.status === "queued" || file.status === "failed" || file.status === "waiting").length;
  const visiblePhotos = useMemo(() => photos.filter((photo) => photo.imageUrl), [photos]);
  const activePhoto = activePhotoIndex === null ? null : visiblePhotos[activePhotoIndex] ?? null;

  const updateFile = useCallback((clientId: string, update: Partial<GuestUploadFile>) => {
    setFiles((items) => items.map((item) => item.clientId === clientId ? { ...item, ...update } : item));
  }, []);

  const refreshPhotos = useCallback(async () => {
    if (refreshInFlightRef.current || document.visibilityState === "hidden") {
      return;
    }

    refreshInFlightRef.current = true;

    try {
      const result = await getGuestGalleryPhotosAction(galleryId, revisionRef.current);

      if (result.ok && !result.unchanged) {
        revisionRef.current = result.revision;
        setPhotos(result.photos);
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [galleryId]);

  const getOrCreateGuestKey = useCallback(() => {
    if (guestKeyRef.current) {
      return guestKeyRef.current;
    }

    const storageKey = `spetly:guest-key:${galleryId}`;
    const generatedKey = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replaceAll("-", "")
      : `${createClientId()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      guestKeyRef.current = window.localStorage.getItem(storageKey) || generatedKey;
      window.localStorage.setItem(storageKey, guestKeyRef.current);
    } catch {
      guestKeyRef.current = generatedKey;
    }

    return guestKeyRef.current;
  }, [galleryId]);

  useEffect(() => {
    setPhotos(initialPhotos);
    revisionRef.current = initialRevision;
  }, [initialPhotos, initialRevision]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setResumeRequest((request) => request + 1);
    };
    const handleOffline = () => setIsOnline(false);

    setIsOnline(browserIsOnline());
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!uploadsEnabled) {
      setQueueHydrated(true);
      return;
    }

    let cancelled = false;

    void loadGuestUploadQueue(galleryId)
      .then((queue) => {
        if (cancelled || !queue || queue.files.length === 0) {
          return;
        }

        const restoredFiles = queue.files
          .filter((item) => item.contentHash && item.blob instanceof Blob)
          .slice(0, MAX_FILES)
          .map<GuestUploadFile>((item) => ({
            clientId: item.clientId || createClientId(),
            file: new File([item.blob], item.filename, {
              type: item.contentType,
              lastModified: item.lastModified
            }),
            contentType: item.contentType,
            contentHash: item.contentHash,
            imageWidth: item.imageWidth,
            imageHeight: item.imageHeight,
            status: "waiting",
            progress: 0
          }));

        if (restoredFiles.length === 0) {
          return;
        }

        setName((current) => current || queue.name);
        setEmail((current) => current || queue.email);
        setFiles((current) => current.length > 0 ? current : restoredFiles);
        setIsUploadOpen(true);
        setSuccess(copy.restoredQueue);
        setResumeRequest((request) => request + 1);
      })
      .catch(() => {
        if (!cancelled) {
          setQueuePersistenceAvailable(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQueueHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [copy.restoredQueue, galleryId, uploadsEnabled]);

  useEffect(() => {
    if (!queueHydrated || !queuePersistenceAvailable) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const pendingFiles = files.filter((file) =>
        Boolean(file.contentHash) &&
        file.status !== "done" &&
        file.status !== "duplicate"
      );
      const operation = pendingFiles.length === 0
        ? clearGuestUploadQueue(galleryId)
        : saveGuestUploadQueue({
            galleryId,
            name,
            email,
            updatedAt: Date.now(),
            files: pendingFiles.map((item) => ({
              clientId: item.clientId,
              blob: item.file,
              filename: item.file.name,
              lastModified: item.file.lastModified,
              contentType: item.contentType,
              contentHash: item.contentHash,
              imageWidth: item.imageWidth,
              imageHeight: item.imageHeight
            }))
          });

      void operation.catch(() => setQueuePersistenceAvailable(false));
    }, QUEUE_PERSIST_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [email, files, galleryId, name, queueHydrated, queuePersistenceAvailable]);

  useEffect(() => {
    getOrCreateGuestKey();
    const intervalId = window.setInterval(() => void refreshPhotos(), 8000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshPhotos();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [getOrCreateGuestKey, refreshPhotos]);

  useEffect(() => {
    if (!uploadsEnabled) {
      return;
    }

    function openUploadDialog() {
      setIsUploadOpen(true);
    }

    window.addEventListener(OPEN_GUEST_UPLOAD_EVENT, openUploadDialog);
    return () => window.removeEventListener(OPEN_GUEST_UPLOAD_EVENT, openUploadDialog);
  }, [uploadsEnabled]);

  useEffect(() => {
    if (activePhotoIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePhotoIndex(null);
      } else if (event.key === "ArrowLeft") {
        setActivePhotoIndex((index) => index === null ? null : (index - 1 + visiblePhotos.length) % visiblePhotos.length);
      } else if (event.key === "ArrowRight") {
        setActivePhotoIndex((index) => index === null ? null : (index + 1) % visiblePhotos.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePhotoIndex, visiblePhotos.length]);

  async function prepareFiles(selectedFiles: File[]) {
    if (prepareInFlightRef.current || isUploading) {
      return;
    }

    prepareInFlightRef.current = true;
    setIsPreparing(true);
    setError("");
    setSuccess("");

    const retainedFiles = files.filter((file) => file.status !== "done" && file.status !== "duplicate");
    const limitedFiles = selectedFiles.slice(0, Math.max(0, MAX_FILES - retainedFiles.length));
    const validFiles = limitedFiles
      .map((file) => ({ file, contentType: getContentType(file) }))
      .filter(({ file, contentType }) => Boolean(contentType) && file.size > 0 && file.size <= MAX_FILE_BYTES);

    if (validFiles.length !== selectedFiles.length) {
      setError(copy.fileError);
    }

    const pendingFiles: GuestUploadFile[] = validFiles.map(({ file, contentType }) => ({
      clientId: createClientId(),
      file,
      contentType,
      contentHash: "",
      imageWidth: 0,
      imageHeight: 0,
      status: "hashing",
      progress: 0
    }));
    setFiles([...retainedFiles, ...pendingFiles]);
    const knownHashes = new Set(retainedFiles.map((file) => file.contentHash).filter(Boolean));

    for (const pending of pendingFiles) {
      try {
        const [contentHash, dimensions] = await Promise.all([
          hashFile(pending.file),
          readImageSize(pending.file, pending.contentType)
        ]);
        const isDuplicate = knownHashes.has(contentHash);
        knownHashes.add(contentHash);
        updateFile(pending.clientId, {
          contentHash,
          imageWidth: dimensions.width,
          imageHeight: dimensions.height,
          status: isDuplicate ? "duplicate" : "queued",
          progress: isDuplicate ? 100 : 0
        });
      } catch {
        updateFile(pending.clientId, { status: "failed", error: copy.hashError });
      }
    }

    prepareInFlightRef.current = false;
    setIsPreparing(false);
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    void prepareFiles(selectedFiles);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void prepareFiles(Array.from(event.dataTransfer.files ?? []));
  }

  async function uploadFiles(onlyClientIds?: string[]) {
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      setError(copy.emailError);
      return;
    }

    const allowedIds = onlyClientIds ? new Set(onlyClientIds) : null;
    const uploadableFiles = files.filter((item) =>
      (!allowedIds || allowedIds.has(item.clientId)) &&
      (item.status === "queued" || item.status === "failed" || item.status === "waiting") &&
      Boolean(item.contentHash)
    );

    if (uploadableFiles.length === 0 || isUploading || isPreparing) {
      return;
    }

    if (!browserIsOnline()) {
      uploadableFiles.forEach((item) => updateFile(item.clientId, { status: "waiting", progress: 0, error: undefined }));
      setIsOnline(false);
      setError(copy.offlineText);
      return;
    }

    setIsUploading(true);
    setError("");
    setSuccess("");
    uploadableFiles.forEach((item) => updateFile(item.clientId, { status: "queued", progress: 0, error: undefined }));

    if (queuePersistenceAvailable) {
      const pendingFiles = files.filter((file) =>
        Boolean(file.contentHash) &&
        file.status !== "done" &&
        file.status !== "duplicate"
      );

      try {
        await saveGuestUploadQueue({
          galleryId,
          name,
          email,
          updatedAt: Date.now(),
          files: pendingFiles.map((item) => ({
            clientId: item.clientId,
            blob: item.file,
            filename: item.file.name,
            lastModified: item.file.lastModified,
            contentType: item.contentType,
            contentHash: item.contentHash,
            imageWidth: item.imageWidth,
            imageHeight: item.imageHeight
          }))
        });
      } catch {
        setQueuePersistenceAvailable(false);
      }
    }

    try {
      const identity = {
        guestKey: getOrCreateGuestKey(),
        name: name.trim(),
        email: normalizedEmail
      };
      const targetResult = await createGuestUploadTargetsAction(
        galleryId,
        identity,
        uploadableFiles.map((item) => ({
          clientId: item.clientId,
          filename: item.file.name,
          contentType: item.contentType,
          fileSize: item.file.size,
          contentHash: item.contentHash,
          imageWidth: item.imageWidth,
          imageHeight: item.imageHeight
        }))
      );

      if (!targetResult.ok || !targetResult.targets) {
        throw new Error(targetResult.message ?? copy.uploadError);
      }

      const duplicateIds = new Set((targetResult.duplicates ?? []).map((item) => item.clientId));
      duplicateIds.forEach((clientId) => updateFile(clientId, { status: "duplicate", progress: 100, error: undefined }));

      const fileById = new Map(uploadableFiles.map((item) => [item.clientId, item]));
      const completedTargets: UploadTarget[] = [];
      let failedCount = 0;

      await runWithConcurrency(targetResult.targets, PARALLEL_UPLOADS, async (target) => {
        const current = fileById.get(target.clientId);
        if (!current) {
          return;
        }

        try {
          await uploadFileWithAutomaticRetry(
            current.file,
            current.contentType,
            target,
            (progress) => updateFile(target.clientId, { progress }),
            () => updateFile(target.clientId, { status: "waiting", progress: 0, error: undefined }),
            () => updateFile(target.clientId, { status: "uploading", progress: 0, error: undefined })
          );
          completedTargets.push(target);
          updateFile(target.clientId, { status: "done", progress: 100 });
        } catch (uploadError) {
          failedCount += 1;
          const waitsForConnection = !browserIsOnline();
          updateFile(target.clientId, {
            status: waitsForConnection ? "waiting" : "failed",
            progress: 0,
            error: waitsForConnection ? undefined : copy.uploadError
          });
        }
      });

      let uploadedCount = 0;
      let awaitingApproval = false;

      if (completedTargets.length > 0) {
        const completeResult = await completeGuestUploadsAction(
          galleryId,
          identity,
          completedTargets.map((target) => target.r2Key)
        );

        if (!completeResult.ok) {
          completedTargets.forEach((target) => updateFile(target.clientId, { status: "failed", error: completeResult.message ?? copy.uploadError }));
          throw new Error(completeResult.message ?? copy.uploadError);
        }

        uploadedCount = completeResult.completedCount ?? completedTargets.length;
        awaitingApproval = Boolean(completeResult.awaitingApproval);
      }

      const messages: string[] = [];
      if (uploadedCount > 0) {
        messages.push(awaitingApproval ? copy.approvalSuccess(uploadedCount) : copy.success(uploadedCount));
      }
      if (duplicateIds.size > 0) {
        messages.push(copy.duplicateSuccess(duplicateIds.size));
      }
      setSuccess(messages.join(" "));

      if (failedCount > 0) {
        setError(browserIsOnline() ? copy.partialError(failedCount) : copy.offlineText);
      }
      if (uploadedCount > 0 && !awaitingApproval) {
        await refreshPhotos();
      }
    } catch (uploadError) {
      const waitsForConnection = !browserIsOnline();
      uploadableFiles.forEach((item) => updateFile(item.clientId, {
        status: waitsForConnection ? "waiting" : "failed",
        progress: 0,
        error: waitsForConnection ? undefined : copy.uploadError
      }));
      setError(waitsForConnection ? copy.offlineText : uploadError instanceof Error ? uploadError.message : copy.uploadError);
    } finally {
      setIsUploading(false);
    }
  }

  useEffect(() => {
    if (!queueHydrated || !isOnline || isUploading || isPreparing || resumeRequest === 0) {
      return;
    }

    const waitingIds = files.filter((file) => file.status === "waiting").map((file) => file.clientId);
    if (waitingIds.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setResumeRequest(0);
      void uploadFiles(waitingIds);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [files, isOnline, isPreparing, isUploading, queueHydrated, resumeRequest]);

  function statusLabel(status: GuestUploadStatus) {
    return status === "hashing"
      ? copy.hashing
      : status === "queued"
        ? copy.queued
        : status === "waiting"
          ? copy.waiting
        : status === "uploading"
          ? copy.fileUploading
          : status === "done"
            ? copy.done
            : status === "duplicate"
              ? copy.duplicate
              : copy.failed;
  }

  function moveLightbox(direction: -1 | 1) {
    setActivePhotoIndex((index) => index === null ? null : (index + direction + visiblePhotos.length) % visiblePhotos.length);
  }

  return (
    <section id="guest-photos" className="mt-14 scroll-mt-32 space-y-5" aria-labelledby="guest-photos-title">
      <div className="flex flex-col gap-4 border-b border-ink/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-graphite/55">
            {copy.count(visiblePhotos.length)}
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 normal-case tracking-normal"><RefreshCw size={11} /> {copy.live}</span>
          </p>
          <h2 id="guest-photos-title" className="font-playfair mt-1 text-3xl font-semibold text-ink md:text-4xl">
            {copy.title}
          </h2>
        </div>
        {uploadsEnabled ? (
          <Button type="button" onClick={() => setIsUploadOpen(true)} className="w-full sm:w-auto">
            <UploadCloud size={16} />
            {retryableCount > 0 ? copy.continueUpload : copy.openUpload}
          </Button>
        ) : null}
      </div>

      {visiblePhotos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visiblePhotos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActivePhotoIndex(index)}
              className="group relative overflow-hidden rounded-md bg-mist text-left outline-none ring-ink/30 transition focus-visible:ring-2"
              aria-label={`${copy.openPhoto}: ${photo.filename}`}
            >
              <div className="relative overflow-hidden">
                {photo.imageWidth > 0 && photo.imageHeight > 0 ? (
                  <Image
                    src={previewUrl(photo)}
                    alt={photo.filename}
                    width={photo.imageWidth}
                    height={photo.imageHeight}
                    unoptimized
                    className="block h-auto w-full transition duration-300 group-hover:scale-[1.02]"
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  />
                ) : (
                  <img src={previewUrl(photo)} alt={photo.filename} loading="lazy" className="block h-auto w-full transition duration-300 group-hover:scale-[1.02]" />
                )}
                {photo.processingStatus !== "ready" ? (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-ink/75 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                    <Loader2 size={11} className="animate-spin" /> {copy.processing}
                  </span>
                ) : null}
              </div>
              {photo.guestName ? <p className="truncate px-3 py-2 text-xs font-medium text-graphite">{photo.guestName}</p> : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-ink/10 bg-white px-5 py-8 text-center text-sm text-graphite/70 shadow-soft">{copy.empty}</p>
      )}

      {activePhoto ? (
        <div
          className="fixed inset-0 z-[70] flex touch-pan-y items-center justify-center bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={copy.openPhoto}
          onTouchStart={(event) => { touchStartXRef.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            const startX = touchStartXRef.current;
            const endX = event.changedTouches[0]?.clientX;
            touchStartXRef.current = null;
            if (startX !== null && endX !== undefined && Math.abs(endX - startX) > 50) {
              moveLightbox(endX < startX ? 1 : -1);
            }
          }}
        >
          <div className="absolute inset-4 sm:inset-8">
            <Image
              src={fullscreenUrl(activePhoto)}
              alt={activePhoto.filename}
              fill
              unoptimized
              priority
              className="object-contain"
              sizes="100vw"
            />
          </div>
          <button
            type="button"
            onClick={() => setActivePhotoIndex(null)}
            className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
            aria-label={copy.closeViewer}
          >
            <X size={22} />
          </button>
          {visiblePhotos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => moveLightbox(-1)}
                className="absolute left-3 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:left-6"
                aria-label={copy.previousPhoto}
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                onClick={() => moveLightbox(1)}
                className="absolute right-3 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:right-6"
                aria-label={copy.nextPhoto}
              >
                <ChevronRight size={28} />
              </button>
            </>
          ) : null}
          <div className="absolute bottom-4 left-1/2 z-10 max-w-[70vw] -translate-x-1/2 rounded-full bg-black/45 px-4 py-2 text-center text-xs text-white/85 backdrop-blur">
            {(activePhotoIndex ?? 0) + 1} / {visiblePhotos.length}{activePhoto.guestName ? ` · ${activePhoto.guestName}` : ""}
          </div>
        </div>
      ) : null}

      {uploadsEnabled && isUploadOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-upload-title"
        >
          <div className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">{copy.title}</p>
                <h3 id="guest-upload-title" className="mt-1 text-2xl font-semibold text-ink">{copy.uploadTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                disabled={isUploading}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-ink/10 text-graphite transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={copy.cancel}
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-graphite/70">{copy.uploadText}</p>

            {!isOnline ? (
              <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900">
                <WifiOff size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{copy.offlineTitle}</p>
                  <p className="mt-0.5 text-xs leading-5 text-amber-800">{copy.offlineText}</p>
                </div>
              </div>
            ) : null}

            {!queuePersistenceAvailable ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                {copy.queueStorageError}
              </p>
            ) : null}

            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-graphite"><UserRound size={15} />{copy.name}</span>
                  <input
                    type="text"
                    value={name}
                    maxLength={80}
                    onChange={(event) => setName(event.target.value)}
                    className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-ink outline-none transition focus:border-ink/50"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-graphite"><Mail size={15} />{copy.email}</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-ink outline-none transition focus:border-ink/50"
                  />
                </label>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                className="hidden"
                onChange={handleFiles}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFiles}
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isUploading || isPreparing}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-semibold text-ink transition hover:bg-paper disabled:opacity-50"
                >
                  <Camera size={18} /> {copy.camera}
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading || isPreparing}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-semibold text-ink transition hover:bg-paper disabled:opacity-50"
                >
                  <ImagePlus size={18} /> {copy.library}
                </button>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`hidden min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-5 py-6 text-center transition sm:flex ${
                  isDragging ? "border-ink bg-paper" : "border-ink/20 bg-paper/60 hover:border-ink/35 hover:bg-paper"
                }`}
              >
                <UploadCloud size={24} className="text-graphite" />
                <p className="mt-2 text-sm font-semibold text-ink">{copy.dropTitle}</p>
                <p className="mt-1 text-xs text-graphite/65">{copy.dropText}</p>
              </div>

              {selectedCount > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs font-medium text-graphite/70">
                    <span>{copy.selected(selectedCount)}</span>
                    <span>{resolvedCount}/{selectedCount}</span>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {files.map((item) => (
                      <div key={item.clientId} className="rounded-md border border-ink/10 bg-paper/55 px-3 py-2.5">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-xs font-semibold text-ink" title={item.file.name}>{item.file.name}</p>
                              <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
                                item.status === "failed"
                                  ? "text-red-600"
                                  : item.status === "done"
                                    ? "text-sage"
                                    : item.status === "waiting"
                                      ? "text-amber-700"
                                      : "text-graphite/65"
                              }`}>
                                {statusLabel(item.status)}{item.status === "uploading" ? ` ${item.progress}%` : ""}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] text-graphite/55">{formatFileSize(item.file.size)}</p>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
                              <div
                                className={`h-full rounded-full transition-[width] duration-200 ${
                                  item.status === "failed" ? "bg-red-500" : item.status === "duplicate" ? "bg-brass" : "bg-sage"
                                }`}
                                style={{ width: `${item.status === "hashing" ? 12 : item.progress}%` }}
                              />
                            </div>
                            {item.error ? <p className="mt-1.5 text-[11px] text-red-600">{item.error}</p> : null}
                          </div>
                          {item.status === "failed" && item.contentHash ? (
                            <button
                              type="button"
                              onClick={() => void uploadFiles([item.clientId])}
                              disabled={isUploading || isPreparing}
                              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-ink/15 bg-white px-2 text-[11px] font-semibold text-ink disabled:opacity-40"
                              aria-label={`${copy.retry}: ${item.file.name}`}
                            >
                              <RotateCcw size={12} /> {copy.retry}
                            </button>
                          ) : item.status === "queued" || (item.status === "failed" && !item.contentHash) ? (
                            <button
                              type="button"
                              onClick={() => setFiles((items) => items.filter((file) => file.clientId !== item.clientId))}
                              disabled={isUploading || isPreparing}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-white text-graphite disabled:opacity-40"
                              aria-label={`${copy.remove}: ${item.file.name}`}
                            >
                              <X size={13} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {success ? (
                <p className="flex items-center gap-2 rounded-md border border-sage/20 bg-sage/10 px-3 py-2 text-sm font-medium text-sage">
                  <CheckCircle2 size={16} /> {success}
                </p>
              ) : null}
              {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

              <div className="flex flex-col-reverse gap-2 border-t border-ink/10 pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setIsUploadOpen(false)} disabled={isUploading}>
                  {copy.cancel}
                </Button>
                <Button type="button" onClick={() => void uploadFiles()} disabled={isUploading || isPreparing || actionableCount === 0}>
                  {isUploading || isPreparing ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                  {isPreparing ? copy.hashing : isUploading ? copy.uploading : retryableCount > 0 ? copy.continueUpload : copy.upload}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function GuestPhotoUploadButton({
  label,
  className = ""
}: {
  label: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_GUEST_UPLOAD_EVENT))}
      className={className}
    >
      <UploadCloud size={16} />
      {label}
    </Button>
  );
}
