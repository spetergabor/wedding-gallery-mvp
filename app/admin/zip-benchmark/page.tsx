import Link from "next/link";
import { Archive, Clock3, HardDrive, Play, RefreshCw, Zap } from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requireSuperAdmin } from "@/lib/auth";
import { galleryDeliveryAllowsDownloads, galleryDeliveryLabel } from "@/lib/gallery-delivery";
import { ZIP_GENERATION_JOB } from "@/lib/jobs";
import { PHOTO_DELIVERY_STAGE_FINAL } from "@/lib/proofing";
import { prisma } from "@/lib/prisma";
import { startZipBenchmarkAction } from "@/lib/zip-benchmark-actions";

const GIB = 1024 ** 3;
const RECENT_JOB_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type SearchParams = {
  gallery?: string;
  status?: string;
  error?: string;
};

type Candidate = {
  id: string;
  title: string;
  slug: string;
  adminName: string;
  deliveryMode: string;
  photoCount: number;
  totalBytes: number;
};

type ZipPayload = {
  galleryId?: unknown;
  packageId?: unknown;
};

function formatBytes(bytes: number | bigint | null | undefined) {
  const value = typeof bytes === "bigint" ? Number(bytes) : Number(bytes ?? 0);

  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toLocaleString("hu-HU", {
    minimumFractionDigits: size >= 10 || unitIndex === 0 ? 0 : 2,
    maximumFractionDigits: size >= 10 || unitIndex === 0 ? 0 : 2
  })} ${units[unitIndex]}`;
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) {
    return "-";
  }

  return date.toLocaleString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Vienna"
  });
}

function formatDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms) || ms < 0) {
    return "-";
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours} ó ${minutes % 60} p ${seconds} mp`;
  }

  return `${minutes} p ${seconds} mp`;
}

function payloadPackageId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = payload as ZipPayload;
  return typeof value.packageId === "string" ? value.packageId : null;
}

async function getBenchmarkCandidates() {
  const groups = await prisma.photo.groupBy({
    by: ["galleryId"],
    where: {
      isClientHidden: false,
      deliveryStage: PHOTO_DELIVERY_STAGE_FINAL
    },
    _sum: { fileSize: true },
    _count: { id: true },
    orderBy: { _sum: { fileSize: "desc" } },
    take: 50
  });

  const galleryIds = groups.map((group) => group.galleryId);
  const galleries = await prisma.gallery.findMany({
    where: { id: { in: galleryIds } },
    select: {
      id: true,
      title: true,
      slug: true,
      isActive: true,
      downloadsEnabled: true,
      deliveryMode: true,
      admin: {
        select: {
          name: true,
          email: true
        }
      }
    }
  });
  const galleriesById = new Map(galleries.map((gallery) => [gallery.id, gallery]));

  return groups
    .map((group): Candidate | null => {
      const gallery = galleriesById.get(group.galleryId);

      if (!gallery || !gallery.isActive || !gallery.downloadsEnabled || !galleryDeliveryAllowsDownloads(gallery.deliveryMode)) {
        return null;
      }

      return {
        id: gallery.id,
        title: gallery.title,
        slug: gallery.slug,
        adminName: gallery.admin.name || gallery.admin.email,
        deliveryMode: gallery.deliveryMode,
        photoCount: group._count.id,
        totalBytes: group._sum.fileSize ?? 0
      };
    })
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .sort((left, right) => right.totalBytes - left.totalBytes)
    .slice(0, 20);
}

async function getLatestZipRun(galleryId: string | null) {
  if (!galleryId) {
    return null;
  }

  const latestPackage = await prisma.galleryDownloadPackage.findFirst({
    where: { galleryId, scope: "public" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      groupId: true,
      partCount: true
    }
  });

  if (!latestPackage) {
    return null;
  }

  const packages = await prisma.galleryDownloadPackage.findMany({
    where: latestPackage.groupId ? { groupId: latestPackage.groupId } : { id: latestPackage.id },
    orderBy: { partIndex: "asc" },
    select: {
      id: true,
      status: true,
      partIndex: true,
      partCount: true,
      photoCount: true,
      processedCount: true,
      processedBytes: true,
      fileSize: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      generatedAt: true
    }
  });
  const packageIds = new Set(packages.map((downloadPackage) => downloadPackage.id));
  const recentJobs = await prisma.backgroundJob.findMany({
    where: {
      type: ZIP_GENERATION_JOB,
      createdAt: { gte: new Date(Date.now() - RECENT_JOB_WINDOW_MS) }
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      status: true,
      payload: true,
      attempts: true,
      errorMessage: true,
      createdAt: true,
      startedAt: true,
      completedAt: true
    }
  });
  const jobs = recentJobs.filter((job) => {
    const packageId = payloadPackageId(job.payload);
    return packageId ? packageIds.has(packageId) : false;
  });
  const expectedPartCount = Math.max(...packages.map((downloadPackage) => downloadPackage.partCount), packages.length, 1);
  const completedPartCount = packages.filter((downloadPackage) => downloadPackage.status === "completed").length;
  const failedPartCount = packages.filter((downloadPackage) => downloadPackage.status === "failed").length;
  const processingPartCount = packages.filter((downloadPackage) => downloadPackage.status === "processing").length;
  const pendingPartCount = packages.filter((downloadPackage) => downloadPackage.status === "pending").length;
  const startedAt = jobs
    .map((job) => job.startedAt)
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
  const completedAt = completedPartCount === expectedPartCount
    ? jobs
        .map((job) => job.completedAt)
        .filter((date): date is Date => Boolean(date))
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? packages.map((downloadPackage) => downloadPackage.generatedAt).filter((date): date is Date => Boolean(date)).sort((left, right) => right.getTime() - left.getTime())[0] ?? null
    : null;
  const createdAt = packages
    .map((downloadPackage) => downloadPackage.createdAt)
    .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
  const durationMs = startedAt ? (completedAt ?? new Date()).getTime() - startedAt.getTime() : null;
  const processedBytes = packages.reduce((sum, downloadPackage) => sum + downloadPackage.processedBytes, BigInt(0));
  const fileSize = packages.reduce((sum, downloadPackage) => sum + downloadPackage.fileSize, BigInt(0));
  const totalPhotoCount = Math.max(...packages.map((downloadPackage) => downloadPackage.photoCount), 0);
  const processedCount = packages.reduce((sum, downloadPackage) => sum + downloadPackage.processedCount, 0);
  const status =
    failedPartCount > 0
      ? "failed"
      : completedPartCount === expectedPartCount
        ? "completed"
        : processingPartCount > 0
          ? "processing"
          : pendingPartCount > 0
            ? "pending"
            : packages[0]?.status ?? "unknown";

  return {
    status,
    expectedPartCount,
    completedPartCount,
    failedPartCount,
    processingPartCount,
    pendingPartCount,
    createdAt,
    startedAt,
    completedAt,
    durationMs,
    processedBytes,
    fileSize,
    totalPhotoCount,
    processedCount,
    packages,
    jobs
  };
}

function statusLabel(status: string | undefined) {
  const labels: Record<string, string> = {
    cached: "Már volt kész csomag",
    queued: "Trigger indítva",
    pending: "Várakozik",
    processing: "Fut",
    completed: "Kész",
    failed: "Hibás",
    "not-active": "Nem aktív",
    "downloads-disabled": "Letöltés kikapcsolva",
    "proofing-pending": "Válogatás még nincs átadva",
    "no-photos": "Nincs fotó"
  };

  return status ? labels[status] ?? status : null;
}

export default async function ZipBenchmarkPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const candidates = await getBenchmarkCandidates();
  const selectedGalleryId = params.gallery ?? candidates.find((candidate) => candidate.totalBytes >= 7 * GIB && candidate.totalBytes <= 8.5 * GIB)?.id ?? candidates[0]?.id ?? null;
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedGalleryId) ?? null;
  const latestRun = await getLatestZipRun(selectedGalleryId);
  const progress =
    latestRun && latestRun.expectedPartCount > 0
      ? Math.round((latestRun.completedPartCount / latestRun.expectedPartCount) * 100)
      : 0;

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Főadmin</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Trigger ZIP benchmark</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-graphite/70">
            Éles production környezetben méri, mennyi idő alatt készül el egy nagy, eredeti méretű galéria ZIP csomagja Triggerrel és R2 multipart feltöltéssel.
          </p>
        </div>
        <Link
          href="/admin/r2-storage"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper"
        >
          <HardDrive size={16} />
          R2 tárhely
        </Link>
      </div>

      <div className="mb-5 space-y-3">
        {params.error === "missing-gallery" ? <Alert title="Hiányzó galéria azonosító." variant="error" /> : null}
        {params.status ? (
          <Alert title={`Benchmark státusz: ${statusLabel(params.status) ?? params.status}`} variant={params.status === "queued" ? "success" : "info"}>
            {params.status === "cached"
              ? "A galériához már volt friss kész ZIP. Valódi benchmarkhoz indíts friss tesztet."
              : "Frissítsd az oldalt, amíg a futás elkészül."}
          </Alert>
        ) : null}
        <Alert title="Fontos mérési megjegyzés">
          A friss teszt az aktuális publikus ZIP csomagot stale-re jelöli, hogy ne cache-t mérjünk. A korábbi R2 fájlt nem törli azonnal, de új vendég letöltésnél az új csomag lesz az aktuális.
        </Alert>
      </div>

      {selectedCandidate ? (
        <section className="mb-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-brass">
                <Zap size={15} />
                Kiválasztott tesztgaléria
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">{selectedCandidate.title}</h2>
              <p className="mt-2 text-sm text-graphite/70">
                {selectedCandidate.adminName} · /g/{selectedCandidate.slug} · {galleryDeliveryLabel(selectedCandidate.deliveryMode)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <div className="rounded-md bg-paper px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-graphite/55">Forrásméret</p>
                <p className="mt-1 text-xl font-semibold text-ink">{formatBytes(selectedCandidate.totalBytes)}</p>
              </div>
              <div className="rounded-md bg-paper px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-graphite/55">Média</p>
                <p className="mt-1 text-xl font-semibold text-ink">{selectedCandidate.photoCount.toLocaleString("hu-HU")}</p>
              </div>
              <div className="rounded-md bg-paper px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-graphite/55">Cél</p>
                <p className="mt-1 text-xl font-semibold text-ink">7-8 GB</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <form action={startZipBenchmarkAction}>
              <input type="hidden" name="galleryId" value={selectedCandidate.id} />
              <FormSubmitButton pendingLabel="Indítás...">
                <Play size={16} />
                Indítás, ha nincs kész ZIP
              </FormSubmitButton>
            </form>
            <form action={startZipBenchmarkAction}>
              <input type="hidden" name="galleryId" value={selectedCandidate.id} />
              <input type="hidden" name="forceFresh" value="1" />
              <ConfirmSubmitButton
                message="Biztosan friss benchmarkot indítasz? Ez stale-re állítja az aktuális publikus ZIP csomagot, majd új Trigger ZIP-et készít."
                variant="danger"
              >
                <RefreshCw size={16} />
                Friss Trigger teszt
              </ConfirmSubmitButton>
            </form>
            <Link
              href={`/admin/zip-benchmark?gallery=${selectedCandidate.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper"
            >
              <RefreshCw size={16} />
              Frissítés
            </Link>
          </div>
        </section>
      ) : null}

      {latestRun ? (
        <section className="mb-6 rounded-md border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-brass">
                <Clock3 size={15} />
                Legutóbbi ZIP futás
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">{statusLabel(latestRun.status)}</h2>
              <p className="mt-2 text-sm text-graphite/70">
                {latestRun.completedPartCount}/{latestRun.expectedPartCount} rész kész · {latestRun.jobs.length} background job · {formatDuration(latestRun.durationMs)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[680px]">
              <div className="rounded-md bg-paper px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-graphite/55">Kezdés</p>
                <p className="mt-1 text-sm font-semibold text-ink">{formatDateTime(latestRun.startedAt ?? latestRun.createdAt)}</p>
              </div>
              <div className="rounded-md bg-paper px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-graphite/55">Befejezés</p>
                <p className="mt-1 text-sm font-semibold text-ink">{formatDateTime(latestRun.completedAt)}</p>
              </div>
              <div className="rounded-md bg-paper px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-graphite/55">Feltöltve</p>
                <p className="mt-1 text-sm font-semibold text-ink">{formatBytes(latestRun.status === "completed" ? latestRun.fileSize : latestRun.processedBytes)}</p>
              </div>
              <div className="rounded-md bg-paper px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-graphite/55">Média</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {latestRun.processedCount.toLocaleString("hu-HU")}/{latestRun.totalPhotoCount.toLocaleString("hu-HU")}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="mt-4 overflow-hidden rounded-md border border-ink/10">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-paper text-xs uppercase tracking-[0.16em] text-graphite/55">
                <tr>
                  <th className="px-4 py-3">Rész</th>
                  <th className="px-4 py-3">Állapot</th>
                  <th className="px-4 py-3">Média</th>
                  <th className="px-4 py-3">Méret</th>
                  <th className="px-4 py-3">Frissítve</th>
                  <th className="px-4 py-3">Hiba</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10 bg-white">
                {latestRun.packages.map((downloadPackage) => (
                  <tr key={downloadPackage.id}>
                    <td className="px-4 py-3 font-semibold text-ink">
                      {downloadPackage.partIndex + 1}/{downloadPackage.partCount}
                    </td>
                    <td className="px-4 py-3 text-graphite">{downloadPackage.status}</td>
                    <td className="px-4 py-3 text-graphite">
                      {downloadPackage.processedCount}/{downloadPackage.photoCount}
                    </td>
                    <td className="px-4 py-3 text-graphite">{formatBytes(downloadPackage.fileSize || downloadPackage.processedBytes)}</td>
                    <td className="px-4 py-3 text-graphite">{formatDateTime(downloadPackage.updatedAt)}</td>
                    <td className="px-4 py-3 text-red-700">{downloadPackage.errorMessage ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-brass">
              <Archive size={15} />
              Legnagyobb letölthető galériák
            </p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Benchmark jelöltek</h2>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-ink/10">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-[0.16em] text-graphite/55">
              <tr>
                <th className="px-4 py-3">Galéria</th>
                <th className="px-4 py-3">Fotós</th>
                <th className="px-4 py-3">Média</th>
                <th className="px-4 py-3">Méret</th>
                <th className="px-4 py-3">Művelet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10 bg-white">
              {candidates.map((candidate) => (
                <tr key={candidate.id} className={candidate.id === selectedGalleryId ? "bg-brass/5" : undefined}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{candidate.title}</p>
                    <p className="mt-1 text-xs text-graphite/60">/g/{candidate.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-graphite">{candidate.adminName}</td>
                  <td className="px-4 py-3 text-graphite">{candidate.photoCount.toLocaleString("hu-HU")}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{formatBytes(candidate.totalBytes)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/zip-benchmark?gallery=${candidate.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-paper"
                    >
                      Kiválasztás
                    </Link>
                  </td>
                </tr>
              ))}
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-graphite/70">
                    Nincs aktív, letölthető galéria mérhető médiaállománnyal.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
