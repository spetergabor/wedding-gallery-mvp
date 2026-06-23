import { AlertCircle, CheckCircle2, Clock3, ImageIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/button";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { requeueGalleryMediaProcessingAction } from "@/lib/gallery-actions";

const STALE_JOB_PROCESSING_MS = 30 * 60 * 1000;
const ACTIVE_PENDING_JOB_MS = 2 * 60 * 60 * 1000;

type MediaProcessingPhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  mediaType: string;
  processingStatus: string;
  processingError: string | null;
  processingRequestedAt: Date | null;
  processingCompletedAt: Date | null;
};

type MediaProcessingJob = {
  id: string;
  photoId: string;
  status: string;
  attempts: number;
  errorMessage: string | null;
  claimedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
};

function hasLightweightVariant(photo: MediaProcessingPhoto) {
  return (
    photo.mediaType !== "video" &&
    ((photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl) ||
      (photo.previewUrl && photo.previewUrl !== photo.imageUrl))
  );
}

function isJobProcessingStale(job: MediaProcessingJob, now: number) {
  return job.status === "processing" && Boolean(job.claimedAt) && now - job.claimedAt!.getTime() > STALE_JOB_PROCESSING_MS;
}

function isPendingJobActive(job: MediaProcessingJob, now: number) {
  return job.status === "pending" && now - job.updatedAt.getTime() <= ACTIVE_PENDING_JOB_MS;
}

function formatDate(date: Date | null) {
  if (!date) {
    return "-";
  }

  return date.toLocaleString("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  });
}

function getStatusMeta({
  imageCount,
  missingVariantCount,
  pendingCount,
  processingCount,
  staleCount,
  failedCount
}: {
  imageCount: number;
  missingVariantCount: number;
  pendingCount: number;
  processingCount: number;
  staleCount: number;
  failedCount: number;
}) {
  if (imageCount === 0) {
    return {
      label: "Nincs kép",
      description: "Ebben a galériában nincs előnézetet igénylő kép.",
      className: "bg-ink/5 text-graphite",
      icon: ImageIcon
    };
  }

  if (staleCount > 0) {
    return {
      label: "Beragadt",
      description: "Van olyan előnézet-feldolgozás, ami már túl régóta vár vagy fut.",
      className: "bg-red-50 text-red-700",
      icon: AlertCircle
    };
  }

  if (failedCount > 0) {
    return {
      label: "Hibás",
      description: "Néhány előnézet feldolgozása hibára futott.",
      className: "bg-red-50 text-red-700",
      icon: AlertCircle
    };
  }

  if (pendingCount > 0 || processingCount > 0) {
    return {
      label: "Készül",
      description: "A könnyített előnézetek feldolgozása folyamatban van.",
      className: "bg-brass/15 text-brass",
      icon: Clock3
    };
  }

  if (missingVariantCount > 0) {
    return {
      label: "Teljes képpel működik",
      description: "A galéria betölt, csak nincs külön könnyített admin előnézet. Újragenerálással gyorsabb lesz az admin nézet.",
      className: "bg-ink/5 text-graphite",
      icon: ImageIcon
    };
  }

  return {
    label: "Rendben",
    description: "Minden képhez van könnyített admin előnézet.",
    className: "bg-sage/15 text-sage",
    icon: CheckCircle2
  };
}

export function MediaProcessingStatus({
  galleryId,
  photos,
  jobs
}: {
  galleryId: string;
  photos: MediaProcessingPhoto[];
  jobs: MediaProcessingJob[];
}) {
  const now = Date.now();
  const imagePhotos = photos.filter((photo) => photo.mediaType !== "video");
  const imagePhotoIds = new Set(imagePhotos.map((photo) => photo.id));
  const imageJobs = jobs.filter((job) => imagePhotoIds.has(job.photoId));
  const latestJobByPhotoId = new Map<string, MediaProcessingJob>();

  for (const job of imageJobs) {
    const current = latestJobByPhotoId.get(job.photoId);

    if (!current || job.updatedAt > current.updatedAt) {
      latestJobByPhotoId.set(job.photoId, job);
    }
  }

  const readyVariantCount = imagePhotos.filter(hasLightweightVariant).length;
  const missingVariantPhotos = imagePhotos.filter((photo) => !hasLightweightVariant(photo));
  const pendingCount = imageJobs.filter((job) => isPendingJobActive(job, now)).length;
  const processingCount = imageJobs.filter((job) => job.status === "processing" && !isJobProcessingStale(job, now)).length;
  const stalePhotoIds = new Set(imageJobs.filter((job) => isJobProcessingStale(job, now)).map((job) => job.photoId));
  const staleCount = stalePhotoIds.size;
  const failedPhotos = imagePhotos.filter((photo) => photo.processingStatus === "failed" || Boolean(photo.processingError));
  const failedPhotoIds = new Set([
    ...failedPhotos.map((photo) => photo.id),
    ...imageJobs.filter((job) => job.status === "failed" || Boolean(job.errorMessage)).map((job) => job.photoId)
  ]);
  const failedCount = failedPhotoIds.size;
  const requeueableCount = new Set([
    ...missingVariantPhotos.map((photo) => photo.id),
    ...failedPhotoIds,
    ...stalePhotoIds
  ]).size;
  const meta = getStatusMeta({
    imageCount: imagePhotos.length,
    missingVariantCount: missingVariantPhotos.length,
    pendingCount,
    processingCount,
    staleCount,
    failedCount
  });
  const Icon = meta.icon;
  const latestJob = imageJobs[0] ?? null;
  const sampleProblems = imagePhotos
    .filter((photo) => !hasLightweightVariant(photo) || photo.processingStatus === "failed" || stalePhotoIds.has(photo.id))
    .slice(0, 3);

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
            <ImageIcon size={15} />
            Előnézet feldolgozás
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">{meta.label}</h2>
          <p className="mt-1 max-w-2xl text-sm text-graphite/70">{meta.description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:items-center">
          <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${meta.className}`}>
            <Icon size={16} />
            {meta.label}
          </span>
          <form action={requeueGalleryMediaProcessingAction.bind(null, galleryId)}>
            <Button
              type="submit"
              variant="secondary"
              disabled={requeueableCount === 0}
              className={requeueableCount === 0 ? "opacity-60" : ""}
            >
              <RefreshCw size={16} />
              Hiányzó előnézetek újragenerálása
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Könnyített</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {readyVariantCount}/{imagePhotos.length}
          </p>
        </div>
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Eredetivel</p>
          <p className="mt-1 text-lg font-semibold text-ink">{missingVariantPhotos.length}</p>
        </div>
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Sorban</p>
          <p className="mt-1 text-lg font-semibold text-ink">{pendingCount}</p>
        </div>
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Fut</p>
          <p className="mt-1 text-lg font-semibold text-ink">{processingCount}</p>
        </div>
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Hibás/beragadt</p>
          <p className="mt-1 text-lg font-semibold text-ink">{failedCount + staleCount}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-sm text-graphite/70 md:flex-row md:items-center md:justify-between">
        <p>Utolsó feldolgozási frissítés: {formatDate(latestJob?.updatedAt ?? null)}</p>
        <p>Optimalizálható képek: {requeueableCount}</p>
      </div>

      {sampleProblems.length > 0 ? (
        <div className="mt-4 rounded-md border border-ink/10 bg-paper px-4 py-3 text-sm text-graphite">
          <p className="font-medium text-ink">Példák optimalizálható képekre</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sampleProblems.map((photo) => {
              const latestJobForPhoto = latestJobByPhotoId.get(photo.id);

              return (
                <span key={photo.id} className="rounded-md bg-white px-2.5 py-1 text-xs text-graphite">
                  {photo.filename}
                  {latestJobForPhoto?.errorMessage ? ` · ${latestJobForPhoto.errorMessage.slice(0, 80)}` : ""}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
