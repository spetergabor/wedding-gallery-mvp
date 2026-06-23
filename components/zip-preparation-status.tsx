import { Archive, AlertCircle, CheckCircle2, Clock3 } from "lucide-react";
import { APP_TIME_ZONE } from "@/lib/date-format";

const STALE_PROCESSING_MS = 15 * 60 * 1000;

type DownloadPackage = {
  id: string;
  groupId: string | null;
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
  updatedAt: Date;
};

type ZipGroupSummary = {
  key: string;
  packages: DownloadPackage[];
  expectedPartCount: number;
  completedCount: number;
  downloadableCount: number;
  pendingCount: number;
  processingCount: number;
  staleProcessingCount: number;
  staleCount: number;
  failedCount: number;
  processedCount: number;
  processedBytes: bigint;
  fileSize: bigint;
  latestAt: Date;
  isComplete: boolean;
  hasActiveWork: boolean;
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

function formatDate(date: Date) {
  return date.toLocaleString("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  });
}

function summarizeGroup(key: string, packages: DownloadPackage[]): ZipGroupSummary {
  const now = Date.now();
  const expectedPartCount = Math.max(...packages.map((downloadPackage) => downloadPackage.partCount), packages.length, 1);
  const completedPackages = packages.filter((downloadPackage) => downloadPackage.status === "completed");
  const downloadablePackages = completedPackages.filter((downloadPackage) => downloadPackage.downloadUrl);
  const staleProcessingCount = packages.filter(
    (downloadPackage) => downloadPackage.status === "processing" && now - downloadPackage.updatedAt.getTime() > STALE_PROCESSING_MS
  ).length;
  const processingCount = packages.filter(
    (downloadPackage) => downloadPackage.status === "processing" && now - downloadPackage.updatedAt.getTime() <= STALE_PROCESSING_MS
  ).length;
  const pendingCount = packages.filter((downloadPackage) => downloadPackage.status === "pending").length;
  const staleCount = packages.filter((downloadPackage) => downloadPackage.status === "stale").length;
  const failedCount = packages.filter((downloadPackage) => downloadPackage.status === "failed").length + staleProcessingCount;
  const processedCount = packages.reduce((sum, downloadPackage) => sum + downloadPackage.processedCount, 0);
  const partIndexes = new Set(downloadablePackages.map((downloadPackage) => downloadPackage.partIndex));
  const hasEveryPart = Array.from({ length: expectedPartCount }, (_, index) => partIndexes.has(index)).every(Boolean);
  const latestAt = packages.reduce((latest, downloadPackage) => {
    const candidates = [downloadPackage.updatedAt, downloadPackage.generatedAt, downloadPackage.createdAt].filter(Boolean) as Date[];
    const packageLatest = candidates.reduce((innerLatest, date) => (date > innerLatest ? date : innerLatest), candidates[0] ?? downloadPackage.createdAt);
    return packageLatest > latest ? packageLatest : latest;
  }, packages[0]?.createdAt ?? new Date(0));

  return {
    key,
    packages,
    expectedPartCount,
    completedCount: completedPackages.length,
    downloadableCount: downloadablePackages.length,
    pendingCount,
    processingCount,
    staleProcessingCount,
    staleCount,
    failedCount,
    processedCount,
    processedBytes: packages.reduce((sum, downloadPackage) => sum + BigInt(downloadPackage.processedBytes), BigInt(0)),
    fileSize: downloadablePackages.reduce((sum, downloadPackage) => sum + BigInt(downloadPackage.fileSize), BigInt(0)),
    latestAt,
    isComplete: downloadablePackages.length === expectedPartCount && hasEveryPart,
    hasActiveWork: pendingCount > 0 || processingCount > 0 || staleProcessingCount > 0
  };
}

function getPrimaryGroup(packages: DownloadPackage[]) {
  const groups = new Map<string, DownloadPackage[]>();

  for (const downloadPackage of packages) {
    const key = downloadPackage.groupId ?? downloadPackage.id;
    groups.set(key, [...(groups.get(key) ?? []), downloadPackage]);
  }

  const summaries = Array.from(groups.entries()).map(([key, groupPackages]) => summarizeGroup(key, groupPackages));

  summaries.sort((a, b) => {
    if (a.isComplete !== b.isComplete) {
      return a.isComplete ? -1 : 1;
    }

    if (a.hasActiveWork !== b.hasActiveWork) {
      return a.hasActiveWork ? -1 : 1;
    }

    return b.latestAt.getTime() - a.latestAt.getTime();
  });

  return {
    primaryGroup: summaries[0] ?? null,
    groupCount: summaries.length,
    oldFailedCount: summaries.slice(1).reduce((sum, group) => sum + group.failedCount + group.staleCount, 0),
    totalStaleCount: summaries.reduce((sum, group) => sum + group.staleCount, 0)
  };
}

function statusMeta(group: ZipGroupSummary | null, photoCount: number) {
  if (!group) {
    return {
      label: "Nincs elindítva",
      description: photoCount > 0 ? "A ZIP még nem lett előkészítve ehhez a galériához." : "A galériában még nincs letölthető média.",
      className: "bg-ink/5 text-graphite",
      icon: Clock3
    };
  }

  if (group.isComplete) {
    return {
      label: "Kész",
      description: "A vendég ZIP elkészült, a link emailben küldhető.",
      className: "bg-sage/15 text-sage",
      icon: CheckCircle2
    };
  }

  if (group.staleCount > 0 && !group.hasActiveWork) {
    return {
      label: "Új ZIP szükséges",
      description: "A publikus képlista változott, ezért a vendégeknek új ZIP részeket kell készíteni.",
      className: "bg-brass/15 text-brass",
      icon: AlertCircle
    };
  }

  if (group.failedCount > 0 && !group.hasActiveWork) {
    return {
      label: "Hibás",
      description: "A ZIP előkészítés hibára futott, újrapróbálás kell.",
      className: "bg-red-50 text-red-700",
      icon: AlertCircle
    };
  }

  return {
    label: "Készül",
    description: "A háttérfeldolgozó még dolgozik a letöltési csomagon.",
    className: "bg-brass/15 text-brass",
    icon: Clock3
  };
}

export function ZipPreparationStatus({ packages, photoCount }: { packages: DownloadPackage[]; photoCount: number }) {
  const { primaryGroup, groupCount, oldFailedCount, totalStaleCount } = getPrimaryGroup(packages);
  const meta = statusMeta(primaryGroup, photoCount);
  const Icon = meta.icon;
  const expectedPartCount = primaryGroup?.expectedPartCount ?? Math.max(photoCount > 0 ? 1 : 0, 0);
  const completedCount = primaryGroup?.downloadableCount ?? 0;
  const displayedProcessedCount = primaryGroup?.isComplete ? photoCount : primaryGroup?.processedCount ?? 0;
  const progress =
    primaryGroup && primaryGroup.expectedPartCount === 1 && !primaryGroup.isComplete && photoCount > 0
      ? Math.round((Math.min(primaryGroup.processedCount, photoCount) / photoCount) * 100)
      : expectedPartCount > 0
        ? Math.round((completedCount / expectedPartCount) * 100)
        : 0;
  const failedPackages =
    primaryGroup?.packages.filter((downloadPackage) => downloadPackage.status !== "stale" && (downloadPackage.status === "failed" || downloadPackage.errorMessage)).slice(0, 3) ?? [];

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
            <Archive size={15} />
            ZIP előkészítés
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">{meta.label}</h2>
          <p className="mt-1 text-sm text-graphite/70">{meta.description}</p>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${meta.className}`}>
          <Icon size={16} />
          {meta.label}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Részek</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {completedCount}/{expectedPartCount}
          </p>
        </div>
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Képek</p>
          <p className="mt-1 text-lg font-semibold text-ink">{photoCount}</p>
        </div>
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">{primaryGroup?.isComplete ? "Méret" : "Feltöltve"}</p>
          <p className="mt-1 text-lg font-semibold text-ink">{formatBytes(primaryGroup?.isComplete ? primaryGroup.fileSize : primaryGroup?.processedBytes ?? 0)}</p>
        </div>
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Frissítve</p>
          <p className="mt-1 text-sm font-semibold text-ink">{primaryGroup ? formatDate(primaryGroup.latestAt) : "-"}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-graphite/70">
          <span>{progress}% kész</span>
          {primaryGroup ? (
            <span>
              {displayedProcessedCount}/{photoCount} média · {primaryGroup.pendingCount} várakozik · {primaryGroup.processingCount} fut ·{" "}
              {primaryGroup.staleCount} elavult · {primaryGroup.failedCount} hibás
            </span>
          ) : null}
        </div>
      </div>

      {totalStaleCount > 0 ? (
        <div className="mt-4 rounded-md border border-brass/25 bg-brass/10 p-3">
          <p className="text-sm font-semibold text-ink">A publikus képlista változott</p>
          <div className="mt-2 space-y-1 text-sm text-graphite/75">
            <p>Új ZIP részek szükségesek.</p>
            <p>Régi linkek már nem ideálisak, mert nem biztos, hogy a vendégeknek szánt aktuális listát tartalmazzák.</p>
            {primaryGroup?.hasActiveWork ? <p>Az új ZIP részek előkészítése már folyamatban van.</p> : null}
          </div>
        </div>
      ) : null}

      {primaryGroup?.staleProcessingCount ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {primaryGroup.staleProcessingCount} ZIP-rész régóta feldolgozás alatt van, valószínűleg újrapróbálás kell.
        </p>
      ) : null}

      {failedPackages.length > 0 ? (
        <div className="mt-4 rounded-md bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">Hibás ZIP-részek</p>
          <div className="mt-2 space-y-1 text-xs text-red-800">
            {failedPackages.map((downloadPackage) => (
              <p key={downloadPackage.id}>
                Rész {downloadPackage.partIndex + 1}/{downloadPackage.partCount}: {downloadPackage.errorMessage ?? "Ismeretlen hiba"}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {oldFailedCount > 0 || groupCount > 1 ? (
        <p className="mt-4 text-xs text-graphite/60">
          Korábbi próbálkozások: {Math.max(groupCount - 1, 0)} csoport, {oldFailedCount} hibás rész naplózva.
        </p>
      ) : null}
    </section>
  );
}
