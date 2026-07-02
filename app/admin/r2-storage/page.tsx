import Link from "next/link";
import { AlertTriangle, Clock3, Database, HardDrive, PackageX, Search, Trash2 } from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";
import { requireSuperAdmin } from "@/lib/auth";
import { abortAllR2MultipartUploadsAction, abortR2MultipartUploadAction } from "@/lib/r2-maintenance-actions";
import { getLatestR2CleanupRun, getR2StorageAudit, type R2CleanupRunSummary } from "@/lib/r2-maintenance";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
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

function formatDate(date: Date | null) {
  if (!date) {
    return "nincs dátum";
  }

  return date.toLocaleString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vienna"
  });
}

function StatCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/60">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-sm text-graphite/65">{detail}</p>
    </div>
  );
}

function cleanupStatus(run: R2CleanupRunSummary | null) {
  if (!run) {
    return {
      value: "még nincs",
      detail: "az első automata futásra vár"
    };
  }

  const statusLabels: Record<string, string> = {
    completed: "sikeres",
    failed: "hibás",
    processing: "fut"
  };
  const timestamp = run.completedAt ?? run.startedAt ?? run.createdAt;
  const aborted = run.abortedUploads ?? 0;
  const scanned = run.scannedUploads ?? 0;

  return {
    value: statusLabels[run.status] ?? run.status,
    detail: `${formatDate(timestamp)} · ${aborted.toLocaleString("hu-HU")} abort · ${scanned.toLocaleString("hu-HU")} vizsgált`
  };
}

export default async function AdminR2StoragePage({
  searchParams
}: {
  searchParams: Promise<{ aborted?: string; objects?: string }>;
}) {
  await requireSuperAdmin();
  const flags = await searchParams;
  const includeObjects = flags.objects === "1";
  const [audit, latestCleanupRun] = await Promise.all([getR2StorageAudit({ includeObjects }), getLatestR2CleanupRun()]);
  const latestCleanupStatus = cleanupStatus(latestCleanupRun);

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Főadmin</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">R2 tárhely</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">
            Itt tudod ellenőrizni és megszakítani a Cloudflare R2 bucketben lévő félbemaradt multipart feltöltéseket.
          </p>
        </div>
        <Link
          href={includeObjects ? "/admin/r2-storage" : "/admin/r2-storage?objects=1"}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper"
        >
          <Search size={16} />
          {includeObjects ? "Gyors nézet" : "Teljes objektumaudit"}
        </Link>
      </div>

      <div className="mb-5 space-y-3">
        <Alert title="Automata R2 cleanup aktív.">
          Naponta lefut, és megszakítja a 24 óránál régebbi félbemaradt multipart feltöltéseket.
        </Alert>
        {flags.aborted ? <Alert title={`${flags.aborted} félbemaradt feltöltés megszakítva.`} variant="success" /> : null}
        {!audit.configured ? (
          <Alert title="Hiányos R2 konfiguráció." variant="error">
            Hiányzik: {audit.missingConfig.join(", ")}
          </Alert>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={<HardDrive size={15} />}
          label="R2 objektumok"
          value={audit.objects ? formatBytes(audit.objects.total.bytes) : "külön audit"}
          detail={audit.objects ? `${audit.objects.total.count.toLocaleString("hu-HU")} objektum listázva` : `${audit.bucket} · gyors nézet`}
        />
        <StatCard
          icon={<PackageX size={15} />}
          label="Félbemaradt upload"
          value={audit.multipartUploads.length.toLocaleString("hu-HU")}
          detail="ongoing multipart upload · gyors cleanup nézet"
        />
        <StatCard
          icon={<Database size={15} />}
          label="DB fotók"
          value={formatBytes(audit.database.photoBytes)}
          detail={`${audit.database.photoCount.toLocaleString("hu-HU")} média az adatbázisban`}
        />
        <StatCard
          icon={<Database size={15} />}
          label="DB ZIP-ek"
          value={formatBytes(audit.database.downloadPackageBytes)}
          detail={`${audit.database.staleDownloadPackageCount.toLocaleString("hu-HU")} stale ZIP sor`}
        />
        <StatCard
          icon={<Clock3 size={15} />}
          label="Automata cleanup"
          value={latestCleanupStatus.value}
          detail={latestCleanupRun?.errorMessage ?? latestCleanupStatus.detail}
        />
      </section>

      <section className="mt-6 rounded-md border border-red-200 bg-red-50 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-red-800">
              <AlertTriangle size={18} />
              Félbemaradt multipart feltöltések
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-red-700/85">
              Ezek a feltöltések nincsenek kész objektumként lezárva, de a feltöltött részek tárhelyet foglalhatnak. Abortálás után az érintett részek felszabadulnak.
            </p>
          </div>
          {audit.multipartUploads.length > 0 ? (
            <form action={abortAllR2MultipartUploadsAction}>
              <ConfirmSubmitButton
                variant="danger"
                message={`Biztosan megszakítod mind a(z) ${audit.multipartUploads.length} félbemaradt R2 feltöltést? Ez nem törli a kész galériákat, csak a befejezetlen multipart upload részeket.`}
                className="w-full md:w-auto"
              >
                <Trash2 size={16} />
                Összes megszakítása
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {audit.multipartUploads.length === 0 ? (
            <p className="text-sm text-red-700/80">Nincs félbemaradt multipart upload.</p>
          ) : (
            audit.multipartUploads.map((upload) => (
              <div key={`${upload.key}:${upload.uploadId}`} className="rounded-md border border-red-200 bg-white p-4">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-semibold text-ink">{upload.key}</p>
                    <p className="mt-2 text-xs text-graphite/65">
                      Partméret nincs számolva a gyors nézetben · indítva: {formatDate(upload.initiated)}
                    </p>
                  </div>
                  <form action={abortR2MultipartUploadAction.bind(null, upload.key, upload.uploadId)}>
                    <ConfirmSubmitButton
                      variant="danger"
                      message={`Biztosan megszakítod ezt a félbemaradt R2 feltöltést? ${upload.key}`}
                      className="w-full shrink-0 lg:w-auto"
                    >
                      <Trash2 size={16} />
                      Megszakítás
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-md border border-ink/10 bg-white p-5">
          <h2 className="text-base font-semibold text-ink">Legnagyobb prefixek</h2>
          <div className="mt-4 space-y-3">
            {audit.objects?.topPrefixes.length ? (
              audit.objects.topPrefixes.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 rounded-md bg-paper px-3 py-2 text-sm">
                  <span className="font-medium text-ink">{row.key}</span>
                  <span className="text-graphite/70">{formatBytes(row.bytes)} · {row.count.toLocaleString("hu-HU")} objektum</span>
                </div>
              ))
            ) : (
              <EmptyState icon={<HardDrive size={22} />} title="Gyors nézet aktív" description="A teljes objektumaudithoz kattints fent a Teljes objektumaudit gombra." />
            )}
          </div>
        </div>

        <div className="rounded-md border border-ink/10 bg-white p-5">
          <h2 className="text-base font-semibold text-ink">Legnagyobb objektumok</h2>
          <div className="mt-4 space-y-3">
            {audit.objects?.largestObjects.length ? (
              audit.objects.largestObjects.map((object) => (
                <div key={object.key} className="rounded-md bg-paper px-3 py-2 text-sm">
                  <p className="break-all font-medium text-ink">{object.key}</p>
                  <p className="mt-1 text-xs text-graphite/70">{formatBytes(object.bytes)}</p>
                </div>
              ))
            ) : (
              <EmptyState icon={<HardDrive size={22} />} title="Gyors nézet aktív" description="A teljes objektumaudithoz kattints fent a Teljes objektumaudit gombra." />
            )}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
