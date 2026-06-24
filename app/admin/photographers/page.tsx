import { Check, Clock, UserCheck, UserRound, X } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { EmptyState } from "@/components/empty-state";
import { requireSuperAdmin } from "@/lib/auth";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { approvePhotographerAction, rejectPhotographerAction } from "@/lib/photographer-actions";
import { prisma } from "@/lib/prisma";

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

export default async function AdminPhotographersPage({
  searchParams
}: {
  searchParams: Promise<{ approved?: string; rejected?: string }>;
}) {
  await requireSuperAdmin();
  const flags = await searchParams;
  const photographers = await prisma.admin.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: { galleries: true }
      }
    }
  });

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
            {photographers.map((photographer) => (
              <article
                key={photographer.id}
                className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_auto] md:items-center"
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
                    <p className="mt-1 text-xs text-graphite/55">
                      Regisztrált: {formatDate(photographer.createdAt)} · {photographer._count.galleries} galéria
                    </p>
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
              </article>
            ))}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
