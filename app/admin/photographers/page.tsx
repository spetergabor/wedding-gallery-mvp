import { Check, Clock, HardDrive, Infinity as InfinityIcon, PackageCheck, Save, UserCheck, UserRound, X } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { EmptyState } from "@/components/empty-state";
import { requireSuperAdmin } from "@/lib/auth";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { updatePhotographerPlanAction } from "@/lib/monetization-actions";
import { formatPlanPrice, formatStorageLimit, MONETIZATION_FEATURES, resolveFeatureAccess } from "@/lib/monetization";
import { approvePhotographerAction, rejectPhotographerAction } from "@/lib/photographer-actions";
import { prisma } from "@/lib/prisma";
import { getAdminStorageUsageRows } from "@/lib/storage-usage";

const statusLabels: Record<string, string> = {
  approved: "Jóváhagyva",
  pending: "Jóváhagyásra vár",
  rejected: "Elutasítva"
};

function formatDate(date: Date | null) {
  if (!date) {
    return "nincs adat";
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function formatStorageGb(bytes: bigint | number) {
  const value = typeof bytes === "bigint" ? Number(bytes) : bytes;

  if (!Number.isFinite(value) || value <= 0) {
    return "0 GB";
  }

  return `${(value / 1024 ** 3).toLocaleString("hu-HU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} GB`;
}

function booleanValue(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "boolean" ? value : null;
}

function formOverrideValue(source: Record<string, unknown> | null | undefined, key: string) {
  const value = booleanValue(source, key);

  if (value == null) {
    return "";
  }

  return value ? "true" : "false";
}

export default async function AdminPhotographersPage({
  searchParams
}: {
  searchParams: Promise<{ approved?: string; rejected?: string; plan?: string }>;
}) {
  await requireSuperAdmin();
  const flags = await searchParams;
  const [photographers, plans, storageRows] = await Promise.all([
    prisma.admin.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: { galleries: true }
        },
        planOverride: {
          include: {
            plan: true
          }
        }
      }
    }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    getAdminStorageUsageRows()
  ]);
  const storageByAdminId = new Map(
    storageRows.map((row) => [
      row.adminId,
      {
        storageBytes: row.storageBytes ?? BigInt(0),
        photoCount: row.photoCount ?? BigInt(0)
      }
    ])
  );

  const pendingCount = photographers.filter((photographer) => photographer.status === "pending").length;

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Főadmin</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Fotós regisztrációk</h1>
          <p className="mt-3 max-w-2xl text-sm text-graphite/70">
            Itt tudod jóváhagyni azokat a fotósokat, akik saját galériákat szeretnének létrehozni.
          </p>
        </div>
        <div className="rounded-md border border-ink/10 bg-white px-4 py-3 text-sm font-medium text-graphite">
          {pendingCount} függő regisztráció
        </div>
      </div>

      <div className="mb-5 space-y-3">
        {flags.approved ? <Alert title="Fotós jóváhagyva." variant="success" /> : null}
        {flags.rejected ? <Alert title="Fotós elutasítva." variant="info" /> : null}
        {flags.plan === "updated" ? <Alert title="Fotós csomagbeállítás mentve." variant="success" /> : null}
        {flags.plan === "error" ? <Alert title="A csomagbeállítás mentése nem sikerült." variant="error" /> : null}
      </div>

      {photographers.length === 0 ? (
        <EmptyState
          icon={<UserRound size={22} />}
          title="Még nincs fotós"
          description="Ha valaki regisztrál, itt fog megjelenni jóváhagyásra."
        />
      ) : (
        <section className="overflow-hidden rounded-md border border-ink/10 bg-white">
          <div className="divide-y divide-ink/10">
            {photographers.map((photographer) => {
              const storage = storageByAdminId.get(photographer.id) ?? {
                storageBytes: BigInt(0),
                photoCount: BigInt(0)
              };
              const override = photographer.planOverride;
              const assignedPlan = override?.plan ?? null;
              const freeAccess = Boolean(override?.freeAccess);
              const effectivePlanLabel = freeAccess
                ? "Teljes ingyenes hozzáférés"
                : assignedPlan
                  ? assignedPlan.name
                  : "Nincs csomag";
              const effectiveStorageLabel = freeAccess
                ? "Korlátlan"
                : formatStorageLimit(override?.storageLimitGbOverride ?? assignedPlan?.storageLimitGb ?? null);
              const overrideRecord = override as Record<string, unknown> | null;
              const planRecord = assignedPlan as Record<string, unknown> | null;

              return (
                <article
                  key={photographer.id}
                  className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_auto] md:items-start"
                >
                  <div className="flex gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
                      {photographer.status === "pending" ? <Clock size={18} /> : <UserCheck size={18} />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-ink">{photographer.name}</p>
                        <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                          {statusLabels[photographer.status] ?? photographer.status}
                        </span>
                        {photographer.role === "super_admin" ? (
                          <span className="rounded-full bg-brass/15 px-2.5 py-1 text-xs font-medium text-brass">
                            Főadmin
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-graphite/70">{photographer.email}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-graphite/55">
                        <span>Regisztrált: {formatDate(photographer.createdAt)}</span>
                        <span>{photographer._count.galleries} galéria</span>
                        <span className="inline-flex items-center gap-1">
                          <HardDrive size={13} />
                          {formatStorageGb(storage.storageBytes)} feltöltve
                        </span>
                        <span>{storage.photoCount.toLocaleString("hu-HU")} média</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                            freeAccess
                              ? "bg-sage/12 text-sage"
                              : assignedPlan
                                ? "bg-brass/12 text-brass"
                                : "bg-ink/5 text-graphite"
                          }`}
                        >
                          {freeAccess ? <InfinityIcon size={13} /> : <PackageCheck size={13} />}
                          {effectivePlanLabel}
                        </span>
                        <span className="rounded-full bg-ink/5 px-2.5 py-1 font-medium text-graphite">
                          {effectiveStorageLabel} tárhelykeret
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {MONETIZATION_FEATURES.map((feature) => {
                          const enabled = resolveFeatureAccess({
                            planValue: booleanValue(planRecord, feature.key),
                            overrideValue: booleanValue(overrideRecord, feature.overrideKey),
                            freeAccess
                          });

                          return (
                            <span
                              key={feature.key}
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                enabled ? "bg-sage/12 text-sage" : "bg-ink/5 text-graphite/55"
                              }`}
                            >
                              {feature.shortLabel}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {photographer.role !== "super_admin" ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {photographer.status !== "approved" ? (
                        <form action={approvePhotographerAction.bind(null, photographer.id)}>
                          <FormSubmitButton type="submit" variant="secondary" className="w-full sm:w-auto" pendingLabel="Jóváhagyás...">
                            <Check size={16} />
                            Jóváhagyás
                          </FormSubmitButton>
                        </form>
                      ) : null}
                      {photographer.status !== "rejected" ? (
                        <form action={rejectPhotographerAction.bind(null, photographer.id)}>
                          <ConfirmSubmitButton
                            variant="danger"
                            message={`Biztosan elutasítod ezt a fotóst: ${photographer.name}?`}
                            className="w-full sm:w-auto"
                          >
                            <X size={16} />
                            Elutasítás
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  ) : null}

                  {photographer.role !== "super_admin" ? (
                    <details className="rounded-md border border-ink/10 bg-paper/40 p-4 md:col-span-2">
                      <summary className="cursor-pointer text-sm font-semibold text-ink">
                        Csomag és feature hozzáférés
                      </summary>
                      <form action={updatePhotographerPlanAction.bind(null, photographer.id)} className="mt-4 grid gap-4">
                        <div className="grid gap-4 lg:grid-cols-[1fr_0.5fr]">
                          <label className="grid gap-2 text-sm font-medium text-ink">
                            Csomag
                            <select
                              name="planId"
                              defaultValue={override?.planId ?? ""}
                              className="h-11 rounded-md border border-ink/12 bg-white px-3 text-sm outline-none transition focus:border-ink/35"
                            >
                              <option value="">Nincs csomag</option>
                              {plans.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.name} · {formatPlanPrice(plan.monthlyPriceCents, plan.currency)} ·{" "}
                                  {formatStorageLimit(plan.storageLimitGb)} tárhely
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="grid gap-2 text-sm font-medium text-ink">
                            Tárhely override (GB)
                            <input
                              name="storageLimitGbOverride"
                              inputMode="numeric"
                              defaultValue={override?.storageLimitGbOverride ?? ""}
                              placeholder="üres = csomag szerint"
                              className="h-11 rounded-md border border-ink/12 bg-white px-3 text-sm outline-none transition focus:border-ink/35"
                            />
                          </label>
                        </div>
                        <label className="flex items-start gap-3 rounded-md border border-sage/20 bg-sage/[0.06] px-3 py-3 text-sm text-ink">
                          <input
                            type="checkbox"
                            name="freeAccess"
                            defaultChecked={freeAccess}
                            className="mt-1 size-4 accent-ink"
                          />
                          <span className="grid gap-1">
                            <span className="font-semibold">Ingyenes teljes hozzáférés</span>
                            <span className="text-graphite/65">
                              Felülírja a csomagot, a tárhelykeretet és minden feature flag-et.
                            </span>
                          </span>
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                          {MONETIZATION_FEATURES.map((feature) => (
                            <label
                              key={feature.overrideKey}
                              className="grid gap-2 rounded-md border border-ink/10 bg-white px-3 py-3 text-xs font-medium uppercase tracking-[0.12em] text-graphite/60"
                            >
                              {feature.shortLabel}
                              <select
                                name={feature.overrideKey}
                                defaultValue={formOverrideValue(overrideRecord, feature.overrideKey)}
                                className="h-10 rounded-md border border-ink/12 bg-white px-2 text-sm normal-case tracking-normal text-ink outline-none transition focus:border-ink/35"
                              >
                                <option value="">Csomag szerint</option>
                                <option value="true">Engedélyezve</option>
                                <option value="false">Tiltva</option>
                              </select>
                            </label>
                          ))}
                        </div>
                        <label className="grid gap-2 text-sm font-medium text-ink">
                          Megjegyzés
                          <textarea
                            name="notes"
                            defaultValue={override?.notes ?? ""}
                            rows={2}
                            placeholder="Belső megjegyzés, pl. beta partner vagy egyedi megállapodás."
                            className="rounded-md border border-ink/12 bg-white px-3 py-2 text-sm outline-none transition focus:border-ink/35"
                          />
                        </label>
                        <div className="flex justify-end">
                          <FormSubmitButton type="submit" pendingLabel="Mentés..." className="w-full sm:w-auto">
                            <Save size={16} />
                            Csomag mentése
                          </FormSubmitButton>
                        </div>
                      </form>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
