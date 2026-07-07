import { CalendarClock, CheckCircle2, ChevronDown, Download, ExternalLink, ImageIcon, MapPin, Plus, Settings2, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EmptyState } from "@/components/empty-state";
import { FormSubmitButton } from "@/components/form-submit-button";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { miniSessionPublicUrl } from "@/lib/email";
import { getAvailableMiniSessionSlots } from "@/lib/mini-session-availability";
import { createMiniSessionAction } from "@/lib/mini-session-actions";
import {
  createMiniSessionSlots,
  formatMiniSessionDate,
  formatMiniSessionTime,
  miniSessionModeLabel,
  MINI_SESSION_BOOKING_MODE_RECURRING,
  MINI_SESSION_BOOKING_MODE_SINGLE_DAY,
  miniSessionLanguageLabel,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  MINI_SESSION_LANGUAGES,
  MINI_SESSION_WEEKDAYS
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

const fieldClass =
  "h-12 w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";
const fileInputClass =
  "block w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-paper px-3 py-2.5 text-sm text-ink outline-none transition file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-graphite focus:border-ink/50";
const textAreaClass =
  "min-h-24 w-full min-w-0 rounded-md border border-ink/15 bg-paper px-3 py-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";
const sessionActionLinkClass =
  "inline-flex h-9 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-ink/10 px-2.5 text-xs font-medium text-ink transition hover:bg-ink/5 sm:px-3 sm:text-sm md:w-auto";
const sessionActionButtonClass =
  "h-9 w-full min-w-0 whitespace-nowrap px-2.5 text-xs sm:px-3 sm:text-sm md:w-auto";

export default async function AdminMiniSessionsPage({
  searchParams
}: {
  searchParams: Promise<{
    error?: string;
    deleted?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const flags = await searchParams;
  const sessions = await prisma.miniSession.findMany({
    where: adminOwnedWhere(admin),
    orderBy: [{ startsAt: "desc" }],
    include: {
      availabilityRules: {
        orderBy: [{ weekday: "asc" }, { startsAt: "asc" }]
      },
      bookings: {
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  const sessionMetrics = new Map(
    await Promise.all(
      sessions.map(async (session) => {
        const slots = createMiniSessionSlots(session);
        const availableSlots = await getAvailableMiniSessionSlots(session);

        return [session.id, { slots, freeSlotCount: availableSlots.length }] as const;
      })
    )
  );

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Mini session</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Időpont foglaló</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">
            A mini sessionök áttekintése. Az esemény részleteinél külön füleken kezeled a foglalókat, idősávokat és beállításokat.
          </p>
        </div>
      </div>

      <div className="mb-5 space-y-3">
        {flags.error === "missing" ? <Alert title="Hiányzó vagy hibás adat." variant="error" /> : null}
        {flags.error === "slug" ? <Alert title="Ez a publikus link már foglalt." variant="error">Adj meg egy egyedi slugot.</Alert> : null}
        {flags.error === "cover" ? <Alert title="A borítóképnek képfájlnak kell lennie." variant="error" /> : null}
        {flags.error === "cover_size" ? <Alert title="A borítókép túl nagy." variant="error">Maximum 12 MB-os képet tölts fel.</Alert> : null}
        {flags.error === "cover_upload" ? <Alert title="A borítókép feltöltése nem sikerült." variant="error">Próbáld újra egy kisebb JPG, PNG vagy WebP képpel.</Alert> : null}
        {flags.deleted ? <Alert title="Mini session törölve." variant="success" /> : null}
      </div>

      <details className="group rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink text-white">
              <Plus size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink">Új foglaló létrehozása</h2>
              <p className="mt-1 text-sm text-graphite/70">Egynapos mini session vagy állandó szolgáltatás</p>
            </div>
          </div>
          <ChevronDown size={18} className="shrink-0 text-graphite/60 transition group-open:rotate-180" />
        </summary>
        <form action={createMiniSessionAction} encType="multipart/form-data" className="mt-6 grid gap-5 lg:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Session neve</span>
            <input name="title" required className={fieldClass} placeholder="pl. Őszi mini session" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Publikus slug</span>
            <input name="slug" className={fieldClass} placeholder="oszi-mini-session" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Landing page nyelve</span>
            <select name="language" defaultValue="hu" className={fieldClass}>
              {MINI_SESSION_LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Foglaló típusa</span>
            <select name="bookingMode" defaultValue={MINI_SESSION_BOOKING_MODE_SINGLE_DAY} className={fieldClass}>
              <option value={MINI_SESSION_BOOKING_MODE_SINGLE_DAY}>Egynapos mini session</option>
              <option value={MINI_SESSION_BOOKING_MODE_RECURRING}>Állandó foglaló</option>
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Mikor / foglalás kezdete</span>
            <input name="date" type="date" required className={fieldClass} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Hol</span>
            <input name="location" required className={fieldClass} placeholder="Helyszín" />
          </label>
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Fotózás mettől</span>
              <input name="startTime" type="time" required className={fieldClass} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Meddig</span>
              <input name="endTime" type="time" required className={fieldClass} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Időtartam / foglalás</span>
              <input name="durationMinutes" type="number" min="5" step="5" defaultValue="20" required className={fieldClass} />
            </label>
          </div>
          <section className="rounded-md border border-ink/10 bg-paper p-4 lg:col-span-2">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h3 className="text-sm font-semibold text-ink">Állandó foglaló elérhetősége</h3>
                <p className="mt-1 text-xs leading-5 text-graphite/65">
                  Csak állandó foglalónál számít. A publikus oldalon ezekből készül a naptár.
                </p>
              </div>
              <label className="block w-full space-y-2 sm:w-44">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Foglalási ablak</span>
                <input name="bookingWindowDays" type="number" min="7" max="180" step="1" defaultValue="60" className={fieldClass} />
              </label>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {MINI_SESSION_WEEKDAYS.map((weekday) => (
                <div key={weekday.value} className="rounded-md border border-ink/10 bg-white p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink">
                    <input
                      name="availabilityWeekday"
                      type="checkbox"
                      value={weekday.value}
                      defaultChecked={weekday.value >= 1 && weekday.value <= 5}
                      className="size-4 rounded border-ink/20"
                    />
                    {weekday.label}
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-[11px] uppercase tracking-[0.1em] text-graphite/55">Mettől</span>
                      <input name={`availabilityStart-${weekday.value}`} type="time" defaultValue="10:00" className={fieldClass} />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] uppercase tracking-[0.1em] text-graphite/55">Meddig</span>
                      <input name={`availabilityEnd-${weekday.value}`} type="time" defaultValue="18:00" className={fieldClass} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <label className="block space-y-2 lg:col-span-2">
            <span className="flex items-center gap-2 text-sm font-medium text-graphite">
              <ImageIcon size={15} />
              Borítókép az érkező oldalra
            </span>
            <input name="coverImage" type="file" accept="image/*" className={fileInputClass} />
            <span className="block text-xs text-graphite/60">Opcionális, JPG/PNG/WebP kép. Maximum 12 MB.</span>
          </label>
          <label className="block space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-graphite">Megjegyzés a publikus oldalra</span>
            <textarea name="notes" className={textAreaClass} placeholder="Opcionális rövid infó az ügyfeleknek." />
          </label>
          <label className="block space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-graphite">Styling / előkészület a landing page-re</span>
            <textarea
              name="stylingNotes"
              className={textAreaClass}
              placeholder="pl. világos ruhák, natúr színek, réteges öltözet, kényelmes cipő..."
            />
            <span className="block text-xs text-graphite/60">Ez külön információs blokkban jelenik meg a publikus foglaló oldalon.</span>
          </label>
          <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center lg:col-span-2">
            <label className="flex items-center gap-2 text-sm text-graphite">
              <input name="isActive" type="checkbox" defaultChecked className="size-4 rounded border-ink/20" />
              Publikusan foglalható
            </label>
            <FormSubmitButton>Mini session létrehozása</FormSubmitButton>
          </div>
        </form>
      </details>

      <div className="mt-8 space-y-4">
        {sessions.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={22} />}
            title="Még nincs mini session"
            description="Hozz létre egy foglalható napot, majd küldd el a publikus linket az ügyfeleknek."
          />
        ) : (
          sessions.map((session) => {
            const booked = session.bookings.filter((booking) => booking.status === MINI_SESSION_BOOKING_STATUS_BOOKED);
            const cancelled = session.bookings.filter((booking) => booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED);
            const metrics = sessionMetrics.get(session.id);
            const slots = metrics?.slots ?? [];
            const freeSlotCount = metrics?.freeSlotCount ?? 0;
            const publicUrl = miniSessionPublicUrl(session.slug);
            const isRecurring = session.bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING;
            return (
              <section id={`mini-session-${session.id}`} key={session.id} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-ink">{session.title}</h2>
                      <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
                        {miniSessionModeLabel(session.bookingMode)}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${session.isActive ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"}`}>
                        {session.isActive ? "Aktív" : "Rejtett"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-graphite/70">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock size={15} />
                        {isRecurring
                          ? `Foglalható ${session.bookingWindowDays} napra előre`
                          : `${formatMiniSessionDate(session.sessionDate)} · ${formatMiniSessionTime(session.startsAt)}-${formatMiniSessionTime(session.endsAt)}`}
                      </span>
                      <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> {session.location}</span>
                      <span>LP nyelv: {miniSessionLanguageLabel(session.language)}</span>
                    </div>
                    <p className="mt-2 text-sm text-graphite/60">/mini-session/{session.slug}</p>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto xl:flex xl:flex-nowrap">
                    <Link className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-ink px-2.5 text-xs font-medium text-white transition hover:bg-graphite sm:px-3 sm:text-sm xl:w-auto" href={`/admin/mini-sessions/${session.id}`}>
                      <Settings2 size={14} />
                      Kezelés
                    </Link>
                    <Link className={sessionActionLinkClass} href={publicUrl} target="_blank">
                      <ExternalLink size={14} />
                      Megnyitás
                    </Link>
                    <CopyLinkButton url={publicUrl} label="Link másolása" className={sessionActionButtonClass} />
                    <Link className={sessionActionLinkClass} href={`/admin/mini-sessions/${session.id}/export`}>
                      <Download size={14} />
                      CSV export
                    </Link>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <Link href={`/admin/mini-sessions/${session.id}?tab=slots`} className="rounded-md bg-paper px-3 py-3 transition hover:bg-ink/5">
                    <p className="text-lg font-semibold text-ink">{slots.length}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55"><CalendarClock size={13} /> Összes idősáv</p>
                  </Link>
                  <Link href={`/admin/mini-sessions/${session.id}?tab=slots`} className="rounded-md bg-paper px-3 py-3 transition hover:bg-ink/5">
                    <p className="text-lg font-semibold text-sage">{freeSlotCount}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55"><CheckCircle2 size={13} /> Szabad</p>
                  </Link>
                  <Link href={`/admin/mini-sessions/${session.id}?tab=bookings`} className="rounded-md bg-paper px-3 py-3 transition hover:bg-ink/5">
                    <p className="text-lg font-semibold text-ink">{booked.length}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55"><Users size={13} /> Foglalt</p>
                  </Link>
                  <Link href={`/admin/mini-sessions/${session.id}?tab=bookings`} className="rounded-md bg-paper px-3 py-3 transition hover:bg-ink/5">
                    <p className="text-lg font-semibold text-graphite">{cancelled.length}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55"><XCircle size={13} /> Törölt</p>
                  </Link>
                </div>
              </section>
            );
          })
        )}
      </div>
    </AdminShell>
  );
}
