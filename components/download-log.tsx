import { AlertCircle, Archive, CheckCircle2, Clock3, Mail, Send } from "lucide-react";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { publicDownloadQualityFromScope } from "@/lib/download-packages";
import { galleryDownloadQualityLabel } from "@/lib/download-quality";
import { queueGalleryZipPackageAction, resendGalleryDownloadEmailsAction } from "@/lib/gallery-actions";
import { FormSubmitButton } from "@/components/form-submit-button";

type DownloadEntry = {
  id: string;
  packageId: string | null;
  email: string;
  status: string;
  downloadLinkSentAt: Date | null;
  downloadLinkEmailError: string | null;
  createdAt: Date;
  package: {
    id: string;
    groupId: string | null;
    scope: string;
    status: string;
    partIndex: number;
    partCount: number;
    fileSize: number | bigint;
    downloadUrl: string | null;
    errorMessage: string | null;
    generatedAt: Date | null;
    updatedAt: Date;
  } | null;
};

type DownloadPackage = {
  id: string;
  scope: string;
  status: string;
  photoCount: number;
  processedCount: number;
  processedBytes: number | bigint;
  partIndex: number;
  partCount: number;
  fileSize: number | bigint;
  downloadUrl: string | null;
  errorMessage: string | null;
  generatedAt: Date | null;
  createdAt: Date;
};

function formatBytes(bytes: number | bigint) {
  const value = Number(bytes);

  if (value <= 0) {
    return "0 MB";
  }

  if (value >= 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function packageStatusLabel(status: string) {
  if (status === "completed") {
    return "Kész";
  }

  if (status === "failed") {
    return "Hibás";
  }

  if (status === "stale") {
    return "Elavult";
  }

  if (status === "expired") {
    return "Takarítva";
  }

  return "Készül";
}

function packageQualityLabel(scope: string | null | undefined) {
  return galleryDownloadQualityLabel(publicDownloadQualityFromScope(scope), "hu");
}

function packageStatusClass(status: string) {
  if (status === "completed") {
    return "bg-sage/15 text-sage";
  }

  if (status === "failed") {
    return "bg-red-50 text-red-700";
  }

  if (status === "stale") {
    return "bg-graphite/10 text-graphite";
  }

  if (status === "expired") {
    return "bg-ink/5 text-graphite";
  }

  return "bg-brass/15 text-brass";
}

type DownloadRequestGroup = {
  key: string;
  email: string;
  createdAt: Date;
  downloads: DownloadEntry[];
  packages: NonNullable<DownloadEntry["package"]>[];
};

function groupDownloadRequests(downloads: DownloadEntry[]) {
  const groups = new Map<string, DownloadRequestGroup>();

  for (const download of downloads) {
    const packageGroupKey = download.package?.groupId ?? download.package?.id ?? download.packageId ?? download.id;
    const createdBucket = Math.floor(download.createdAt.getTime() / 1000);
    const key = `${download.email}:${packageGroupKey}:${createdBucket}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        email: download.email,
        createdAt: download.createdAt,
        downloads: [download],
        packages: download.package ? [download.package] : []
      });
      continue;
    }

    existing.downloads.push(download);
    if (download.package && !existing.packages.some((downloadPackage) => downloadPackage.id === download.package?.id)) {
      existing.packages.push(download.package);
    }
    if (download.createdAt < existing.createdAt) {
      existing.createdAt = download.createdAt;
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function requestStatusMeta(request: DownloadRequestGroup) {
  const hasEmailFailure = request.downloads.some((download) => download.status === "email_failed");
  const allEmailed = request.downloads.length > 0 && request.downloads.every((download) => download.status === "emailed");
  const hasFailedPackage = request.packages.some((downloadPackage) => downloadPackage.status === "failed" || downloadPackage.errorMessage);
  const hasProcessingPackage = request.packages.some((downloadPackage) => downloadPackage.status === "processing");
  const hasPendingPackage = request.packages.some((downloadPackage) => downloadPackage.status === "pending");
  const allPackagesReady = request.packages.length > 0 && request.packages.every((downloadPackage) => downloadPackage.status === "completed" && downloadPackage.downloadUrl);
  const hasWaitingEmail = request.downloads.some((download) => download.status === "waiting");

  if (hasEmailFailure) {
    return { label: "E-mail hiba", className: "bg-red-50 text-red-700", icon: AlertCircle };
  }

  if (hasFailedPackage) {
    return { label: "ZIP hiba", className: "bg-red-50 text-red-700", icon: AlertCircle };
  }

  if (allEmailed) {
    return { label: "Link elküldve", className: "bg-sage/15 text-sage", icon: CheckCircle2 };
  }

  if (allPackagesReady && hasWaitingEmail) {
    return { label: "E-mailre vár", className: "bg-brass/15 text-brass", icon: Send };
  }

  if (hasProcessingPackage || hasPendingPackage || hasWaitingEmail) {
    return { label: hasProcessingPackage ? "ZIP készül" : "Várakozik", className: "bg-brass/15 text-brass", icon: Clock3 };
  }

  return { label: "Rögzítve", className: "bg-ink/5 text-graphite", icon: Clock3 };
}

function requestPackageSummary(request: DownloadRequestGroup) {
  if (request.packages.length === 0) {
    return "Nincs csomag kapcsolva";
  }

  const firstPackage = request.packages[0];
  const expectedPartCount = Math.max(...request.packages.map((downloadPackage) => downloadPackage.partCount), request.packages.length, 1);
  const readyCount = request.packages.filter((downloadPackage) => downloadPackage.status === "completed" && downloadPackage.downloadUrl).length;

  return `${packageQualityLabel(firstPackage.scope)} · ${readyCount}/${expectedPartCount} ZIP rész`;
}

export function DownloadLog({ galleryId, downloads, packages }: { galleryId: string; downloads: DownloadEntry[]; packages: DownloadPackage[] }) {
  const requestGroups = groupDownloadRequests(downloads);
  const hasExpiredPackages = packages.some((downloadPackage) => downloadPackage.status === "expired");
  const hasActivePackages = packages.some((downloadPackage) => downloadPackage.status === "pending" || downloadPackage.status === "processing");

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Album letöltések</h2>
          <p className="mt-1 text-sm text-graphite/70">Email címek a ZIP letöltésekhez.</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
          <Mail size={18} />
        </div>
      </div>

      <div className="mt-5 rounded-md border border-ink/10 bg-paper p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Archive size={16} />
            ZIP csomagok
          </div>
          {hasExpiredPackages && !hasActivePackages ? (
            <form action={queueGalleryZipPackageAction.bind(null, galleryId)}>
              <FormSubmitButton pendingLabel="Indítás..." className="h-8 px-2.5 text-xs">
                <Archive size={13} />
                Új ZIP készítése
              </FormSubmitButton>
            </form>
          ) : null}
        </div>
        {packages.length === 0 ? (
          <p className="mt-2 text-sm text-graphite/70">Még nincs előre generált ZIP csomag.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {packages.map((downloadPackage) => (
              <div key={downloadPackage.id} className="rounded-md bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {packageQualityLabel(downloadPackage.scope)} · {downloadPackage.photoCount} fotó ·{" "}
                      {downloadPackage.status === "completed" ? formatBytes(downloadPackage.fileSize) : formatBytes(downloadPackage.processedBytes)}
                    </p>
                    <p className="text-xs text-graphite/70">
                      Rész {downloadPackage.partIndex + 1}/{downloadPackage.partCount} ·{" "}
                      {downloadPackage.generatedAt
                        ? downloadPackage.generatedAt.toLocaleString("hu-HU", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: APP_TIME_ZONE
                          })
                        : downloadPackage.createdAt.toLocaleString("hu-HU", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: APP_TIME_ZONE
                          })}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${packageStatusClass(downloadPackage.status)}`}>
                    {packageStatusLabel(downloadPackage.status)}
                  </span>
                </div>
                {downloadPackage.errorMessage ? (
                  <p className="mt-2 text-xs text-red-700">{downloadPackage.errorMessage}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {requestGroups.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-3">
          <p className="text-sm font-medium text-ink">Még nincs letöltés</p>
          <p className="mt-1 text-sm text-graphite/70">A ZIP letöltések itt jelennek meg.</p>
        </div>
      ) : (
        <div className="mt-5 max-h-72 divide-y divide-ink/10 overflow-auto rounded-md border border-ink/10">
          {requestGroups.map((request) => {
            const status = requestStatusMeta(request);
            const StatusIcon = status.icon;
            const sentAt = request.downloads
              .map((download) => download.downloadLinkSentAt)
              .filter((date): date is Date => Boolean(date))
              .sort((a, b) => b.getTime() - a.getTime())[0];
            const error = request.downloads.find((download) => download.downloadLinkEmailError)?.downloadLinkEmailError ??
              request.packages.find((downloadPackage) => downloadPackage.errorMessage)?.errorMessage;
            const retryDownloadIds = request.downloads
              .filter((download) => download.status === "email_failed" || download.status === "waiting")
              .map((download) => download.id);
            const canRetryEmail =
              retryDownloadIds.length > 0 &&
              request.packages.length > 0 &&
              request.packages.every((downloadPackage) => downloadPackage.status === "completed" && downloadPackage.downloadUrl);

            return (
              <div key={request.key} className="grid gap-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{request.email}</p>
                    <p className="mt-1 text-sm text-graphite/70">{requestPackageSummary(request)}</p>
                    <time className="mt-1 block text-xs text-graphite/60" dateTime={request.createdAt.toISOString()}>
                      Kérve:{" "}
                      {request.createdAt.toLocaleString("hu-HU", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: APP_TIME_ZONE
                      })}
                    </time>
                    {sentAt ? (
                      <time className="mt-1 block text-xs text-sage" dateTime={sentAt.toISOString()}>
                        E-mail elküldve:{" "}
                        {sentAt.toLocaleString("hu-HU", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: APP_TIME_ZONE
                        })}
                      </time>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                      <StatusIcon size={13} />
                      {status.label}
                    </span>
                    {canRetryEmail ? (
                      <form action={resendGalleryDownloadEmailsAction.bind(null, galleryId, retryDownloadIds)}>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-md border border-ink/10 bg-white px-2.5 py-1 text-xs font-medium text-ink transition hover:border-ink/25 hover:bg-paper"
                        >
                          <Send size={13} />
                          Újraküldés
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
                {error ? <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p> : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
