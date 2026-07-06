import { Mail, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { addTeamMemberAction, removeTeamMemberAction } from "@/lib/team-actions";
import { prisma } from "@/lib/prisma";

const errorMessages: Record<string, { title: string; body: string }> = {
  email: {
    title: "Adj meg érvényes e-mail címet.",
    body: "A csapattagot azzal az e-mail címmel tudod hozzáadni, amivel fotósként regisztrált."
  },
  not_found: {
    title: "Nem találok ilyen fotóst.",
    body: "Előbb regisztrálnia kell fotósként, és utána tudod a csapatodhoz adni."
  },
  self: {
    title: "Saját magadat nem kell hozzáadni.",
    body: "Te vagy ennek a munkaterületnek a tulajdonosa."
  },
  super_admin: {
    title: "Szuperadmint nem lehet csapattagként hozzáadni.",
    body: "A szuperadmin jogosultság külön platformszintű szerep."
  },
  not_approved: {
    title: "Ez a fotós még nincs jóváhagyva.",
    body: "Csak jóváhagyott fotós tud csapattagként dolgozni."
  },
  already_member: {
    title: "Ez a fotós már egy csapat tagja.",
    body: "Egy fotós egyszerre csak egy fő fotós munkaterületéhez lehet hozzárendelve."
  },
  owns_team: {
    title: "Ez a fotós már saját csapatot kezel.",
    body: "Csapat-tulajdonost nem lehet másik csapat alá rendelni."
  },
  team_member: {
    title: "Csapattagként nem kezelhetsz csapatot.",
    body: "A csapattagok ügyfeleket, galériákat és mini sessionöket kezelhetnek, de új tagot a fő fotós tud hozzáadni."
  },
  missing: {
    title: "A csapattag már nem található.",
    body: "Frissítsd az oldalt, és próbáld újra."
  }
};

function formatDate(date: Date) {
  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

export default async function AdminTeamPage({
  searchParams
}: {
  searchParams: Promise<{ added?: string; removed?: string; error?: string }>;
}) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const workspaceAdminId = ownerAdminId(admin);
  const [owner, members] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: admin.isTeamMember ? admin.workspaceAdminId : workspaceAdminId },
      select: {
        id: true,
        name: true,
        email: true
      }
    }),
    admin.isTeamMember
      ? Promise.resolve([])
      : prisma.adminTeamMembership.findMany({
          where: { ownerAdminId: workspaceAdminId },
          orderBy: { createdAt: "desc" },
          include: {
            member: {
              select: {
                id: true,
                name: true,
                email: true,
                status: true,
                role: true
              }
            }
          }
        })
  ]);
  const error = params.error ? errorMessages[params.error] : null;

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Csapat</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">
            Adj hozzá olyan regisztrált fotóst, aki a te munkaterületedben tud ügyfeleket, galériákat, mini sessionöket és napi feladatokat kezelni. Szuperadmin funkciókat nem kap.
          </p>
        </div>
        <div className="rounded-md border border-ink/10 bg-white px-4 py-3 text-sm text-graphite">
          <span className="font-medium text-ink">{members.length}</span> csapattag
        </div>
      </div>

      <div className="mb-6 space-y-3">
        {params.added ? <Alert title="Csapattag hozzáadva." variant="success" /> : null}
        {params.removed ? <Alert title="Csapattag eltávolítva." variant="info" /> : null}
        {error ? (
          <Alert title={error.title} variant="error">
            {error.body}
          </Alert>
        ) : null}
      </div>

      {admin.isTeamMember ? (
        <section className="mb-6 rounded-md border border-brass/20 bg-brass/[0.06] p-5">
          <div className="flex gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-brass">
              <ShieldCheck size={19} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Csapattagként dolgozol</h2>
              <p className="mt-2 text-sm leading-6 text-graphite/75">
                Csapat workspace: <span className="font-medium text-ink">{admin.teamOwnerName ?? owner?.name ?? "Fő fotós"}</span>
                {admin.teamOwnerEmail ? ` · ${admin.teamOwnerEmail}` : owner?.email ? ` · ${owner.email}` : ""}. A bal oldali munkaterület-váltóval tudsz a saját bizniszed és a csapatmunka között váltani.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-6 rounded-md border border-ink/10 bg-white p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-lg font-semibold text-ink">Új csapattag hozzáadása</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
                A fotósnak előtte regisztrálnia kell, és jóváhagyott státuszban kell lennie. Hozzáadás után a saját belépésével a te munkaterületedet fogja kezelni.
              </p>
            </div>
          </div>
          <form action={addTeamMemberAction} className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-2 text-sm font-medium text-graphite">
              Fotós e-mail címe
              <input
                name="email"
                type="email"
                required
                placeholder="fotos@email.com"
                className="h-11 rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <FormSubmitButton type="submit" className="self-end">
              <UserPlus size={16} />
              Hozzáadás
            </FormSubmitButton>
          </form>
        </section>
      )}

      {!admin.isTeamMember && members.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="Még nincs csapattag"
          description="Ha hozzáadsz valakit, itt fog megjelenni a csapat listában."
        />
      ) : !admin.isTeamMember ? (
        <section className="overflow-hidden rounded-md border border-ink/10 bg-white">
          <div className="divide-y divide-ink/10">
            {members.map((membership) => (
              <article key={membership.id} className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
                    <Users size={18} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{membership.member.name}</p>
                      <span className="rounded-full bg-sage/10 px-2.5 py-1 text-xs font-medium text-sage">
                        Aktív csapattag
                      </span>
                    </div>
                    <a href={`mailto:${membership.member.email}`} className="mt-1 flex items-center gap-2 text-sm text-graphite/70 hover:text-ink">
                      <Mail size={14} />
                      {membership.member.email}
                    </a>
                    <p className="mt-1 text-xs text-graphite/55">Hozzáadva: {formatDate(membership.createdAt)}</p>
                  </div>
                </div>
                {!admin.isTeamMember ? (
                  <form action={removeTeamMemberAction.bind(null, membership.id)}>
                    <ConfirmSubmitButton
                      variant="danger"
                      message={`Biztosan eltávolítod a csapatból: ${membership.member.name}?`}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 size={16} />
                      Eltávolítás
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
