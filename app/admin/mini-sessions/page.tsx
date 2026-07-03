import { CalendarClock, CheckCircle2, ChevronDown, ExternalLink, ImageIcon, MapPin, Plus, Trash2, Users, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EmptyState } from "@/components/empty-state";
import { FormSubmitButton } from "@/components/form-submit-button";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { miniSessionPublicUrl } from "@/lib/email";
import {
  cancelMiniSessionBookingByAdminAction,
  createAdminMiniSessionBookingAction,
  createMiniSessionAction,
  deleteMiniSessionAction,
  updateMiniSessionAction
} from "@/lib/mini-session-actions";
import {
  createMiniSessionSlots,
  formatMiniSessionDate,
  formatMiniSessionSlot,
  formatMiniSessionTime,
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_SOURCE_MANUAL,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  miniSessionDateInput,
  miniSessionTimeInput
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

const fieldClass =
  "h-12 w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";
const fileInputClass =
  "block w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-paper px-3 py-2.5 text-sm text-ink outline-none transition file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-graphite focus:border-ink/50";
const textAreaClass =
  "min-h-24 w-full min-w-0 rounded-md border border-ink/15 bg-paper px-3 py-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";

export default async function AdminMiniSessionsPage({
  searchParams
}: {
  searchParams: Promise<{
    error?: string;
    created?: string;
    updated?: string;
    deleted?: string;
    bookingCancelled?: string;
    adminBooking?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const flags = await searchParams;
  const sessions = await prisma.miniSession.findMany({
    where: adminOwnedWhere(admin),
    orderBy: [{ startsAt: "desc" }],
    include: {
      bookings: {
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Mini session</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Időpont foglaló</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">
            Hozz létre egy mini session napot, oszd meg a publikus linket, és a vendégek a szabad idősávokból foglalnak.
          </p>
        </div>
      </div>

      <div className="mb-5 space-y-3">
        {flags.error === "missing" ? <Alert title="Hiányzó vagy hibás adat." variant="error" /> : null}
        {flags.error === "slug" ? <Alert title="Ez a publikus link már foglalt." variant="error">Adj meg egy egyedi slugot.</Alert> : null}
        {flags.error === "cover" ? <Alert title="A borítóképnek képfájlnak kell lennie." variant="error" /> : null}
        {flags.error === "cover_size" ? <Alert title="A borítókép túl nagy." variant="error">Maximum 12 MB-os képet tölts fel.</Alert> : null}
        {flags.error === "cover_upload" ? <Alert title="A borítókép feltöltése nem sikerült." variant="error">Próbáld újra egy kisebb JPG, PNG vagy WebP képpel.</Alert> : null}
        {flags.error === "slot" ? <Alert title="Érvénytelen idősáv." variant="error">Válassz egy szabad idősávot.</Alert> : null}
        {flags.error === "taken" ? <Alert title="Ez az idősáv már foglalt." variant="error">Frissítsd a listát vagy válassz másik idősávot.</Alert> : null}
        {flags.created ? <Alert title="Mini session létrehozva." variant="success" /> : null}
        {flags.updated ? <Alert title="Mini session frissítve." variant="success" /> : null}
        {flags.deleted ? <Alert title="Mini session törölve." variant="success" /> : null}
        {flags.bookingCancelled ? <Alert title="Foglalás törölve, az idősáv újra szabad." variant="success" /> : null}
        {flags.adminBooking ? <Alert title="Idősáv rögzítve." variant="success" /> : null}
      </div>

      <details className="group rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink text-white">
              <Plus size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink">Új mini session</h2>
              <p className="mt-1 text-sm text-graphite/70">Új foglalható nap létrehozása</p>
            </div>
          </div>
          <ChevronDown size={18} className="shrink-0 text-graphite/60 transition group-open:rotate-180" />
        </summary>
        <form action={createMiniSessionAction} className="mt-6 grid gap-5 lg:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Session neve</span>
            <input name="title" required className={fieldClass} placeholder="pl. Őszi mini session" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Publikus slug</span>
            <input name="slug" className={fieldClass} placeholder="oszi-mini-session" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Mikor</span>
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
          <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center lg:col-span-2">
            <label className="flex items-center gap-2 text-sm text-graphite">
              <input name="isActive" type="checkbox" defaultChecked className="size-4 rounded border-ink/20" />
              Publikusan foglalható
            </label>
            <FormSubmitButton>Mini session létrehozása</FormSubmitButton>
          </div>
        </form>
      </details>

      <div className="mt-8 space-y-5">
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
            const slots = createMiniSessionSlots(session);
            const bookedSlotTokens = new Set(booked.map((booking) => booking.startsAt.toISOString()));
            const freeSlots = slots.filter((slot) => !bookedSlotTokens.has(slot.token));
            const freeSlotCount = freeSlots.length;
            const publicUrl = miniSessionPublicUrl(session.slug);
            return (
              <section id={`mini-session-${session.id}`} key={session.id} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
                <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-ink">{session.title}</h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${session.isActive ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"}`}>
                        {session.isActive ? "Aktív" : "Rejtett"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-graphite/70">
                      <span className="inline-flex items-center gap-1.5"><CalendarClock size={15} /> {formatMiniSessionDate(session.sessionDate)} · {formatMiniSessionTime(session.startsAt)}-{formatMiniSessionTime(session.endsAt)}</span>
                      <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> {session.location}</span>
                      <span className="inline-flex items-center gap-1.5"><Users size={15} /> {booked.length} foglalás</span>
                      <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={15} /> {freeSlotCount}/{slots.length} szabad</span>
                      {cancelled.length > 0 ? <span className="inline-flex items-center gap-1.5"><XCircle size={15} /> {cancelled.length} törölt</span> : null}
                    </div>
                    <p className="mt-2 text-sm text-graphite/60">Publikus oldal: /mini-session/{session.slug}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink hover:bg-ink/5" href={publicUrl} target="_blank">
                      <ExternalLink size={15} />
                      Megnyitás
                    </Link>
                    <CopyLinkButton url={publicUrl} label="Link másolása" className="h-10 px-3" />
                    <form action={deleteMiniSessionAction.bind(null, session.id)}>
                      <ConfirmSubmitButton
                        variant="danger"
                        message={`Biztosan törlöd ezt a mini sessiont? A hozzá tartozó ${booked.length} foglalás is törlődik.`}
                        className="h-10 px-3"
                      >
                        <Trash2 size={15} />
                        Törlés
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>

                <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
                  <form action={updateMiniSessionAction.bind(null, session.id)} className="grid content-start gap-4 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-graphite">Session neve</span>
                      <input name="title" defaultValue={session.title} required className={fieldClass} />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-graphite">Publikus slug</span>
                      <input name="slug" defaultValue={session.slug} required className={fieldClass} />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-graphite">Mikor</span>
                      <input name="date" type="date" defaultValue={miniSessionDateInput(session)} required className={fieldClass} />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-graphite">Hol</span>
                      <input name="location" defaultValue={session.location} required className={fieldClass} />
                    </label>
                    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-graphite">Mettől</span>
                        <input name="startTime" type="time" defaultValue={miniSessionTimeInput(session.startsAt)} required className={fieldClass} />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-graphite">Meddig</span>
                        <input name="endTime" type="time" defaultValue={miniSessionTimeInput(session.endsAt)} required className={fieldClass} />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-graphite">Időtartam</span>
                        <input name="durationMinutes" type="number" min="5" step="5" defaultValue={session.durationMinutes} required className={fieldClass} />
                      </label>
                    </div>
                    <div className="space-y-3 sm:col-span-2">
                      <label className="block space-y-2">
                        <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                          <ImageIcon size={15} />
                          Borítókép az érkező oldalra
                        </span>
                        <input name="coverImage" type="file" accept="image/*" className={fileInputClass} />
                        <span className="block text-xs text-graphite/60">Új kép feltöltése lecseréli a jelenlegi borítót.</span>
                      </label>
                      {session.coverImageUrl ? (
                        <div className="grid gap-3 rounded-md border border-ink/10 bg-paper p-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-white">
                            <Image
                              src={session.coverImageUrl}
                              alt={`${session.title} borítókép`}
                              fill
                              unoptimized
                              className="object-cover"
                              sizes="150px"
                            />
                          </div>
                          <div className="flex min-w-0 flex-col justify-center gap-3">
                            <p className="truncate text-sm font-medium text-ink">Jelenlegi borítókép</p>
                            <label className="flex items-center gap-2 text-sm text-graphite">
                              <input name="removeCoverImage" type="checkbox" className="size-4 rounded border-ink/20" />
                              Borítókép törlése
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <label className="block space-y-2 sm:col-span-2">
                      <span className="text-sm font-medium text-graphite">Megjegyzés</span>
                      <textarea name="notes" defaultValue={session.notes ?? ""} className={textAreaClass} />
                    </label>
                    <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:col-span-2 sm:flex-row sm:items-center">
                      <label className="flex items-center gap-2 text-sm text-graphite">
                        <input name="isActive" type="checkbox" defaultChecked={session.isActive} className="size-4 rounded border-ink/20" />
                        Publikusan foglalható
                      </label>
                      <FormSubmitButton>Módosítások mentése</FormSubmitButton>
                    </div>
                  </form>

                  <div className="rounded-md border border-ink/10 bg-paper p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-brass">
                      <CheckCircle2 size={15} />
                      Foglalt időpontok
                    </h3>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-white px-2 py-3">
                        <p className="text-lg font-semibold text-ink">{slots.length}</p>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-graphite/55">Összes</p>
                      </div>
                      <div className="rounded-md bg-white px-2 py-3">
                        <p className="text-lg font-semibold text-sage">{freeSlotCount}</p>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-graphite/55">Szabad</p>
                      </div>
                      <div className="rounded-md bg-white px-2 py-3">
                        <p className="text-lg font-semibold text-ink">{booked.length}</p>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-graphite/55">Foglalt</p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-md border border-ink/10 bg-white p-3">
                      <p className="text-sm font-semibold text-ink">Idősáv rögzítése</p>
                      {freeSlots.length === 0 ? (
                        <p className="mt-2 text-sm text-graphite/70">Nincs szabad idősáv kézi foglaláshoz vagy blokkoláshoz.</p>
                      ) : (
                        <form action={createAdminMiniSessionBookingAction.bind(null, session.id)} className="mt-3 grid gap-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-2">
                              <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Idősáv</span>
                              <select name="slot" required className={fieldClass}>
                                {freeSlots.map((slot) => (
                                  <option key={slot.token} value={slot.token}>
                                    {formatMiniSessionSlot(slot.startsAt, slot.endsAt)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block space-y-2">
                              <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Típus</span>
                              <select name="source" required className={fieldClass} defaultValue={MINI_SESSION_BOOKING_SOURCE_MANUAL}>
                                <option value={MINI_SESSION_BOOKING_SOURCE_MANUAL}>Kézi foglalás</option>
                                <option value={MINI_SESSION_BOOKING_SOURCE_BLOCKED}>Blokkolt idősáv</option>
                              </select>
                            </label>
                          </div>
                          <label className="block space-y-2">
                            <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Név</span>
                            <input name="name" className={fieldClass} placeholder="Ügyfél neve" />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-2">
                              <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">E-mail</span>
                              <input name="email" type="email" className={fieldClass} placeholder="opcionális" />
                            </label>
                            <label className="block space-y-2">
                              <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Telefon</span>
                              <input name="phone" type="tel" className={fieldClass} placeholder="opcionális" />
                            </label>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                            <label className="block space-y-2">
                              <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Létszám</span>
                              <input name="attendeeCount" type="number" min="1" defaultValue="1" className={fieldClass} />
                            </label>
                            <label className="block space-y-2">
                              <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Megjegyzés</span>
                              <input name="adminNote" className={fieldClass} placeholder="pl. ebédszünet, Instagram foglalás" />
                            </label>
                          </div>
                          <p className="text-xs leading-5 text-graphite/60">Blokkolt idősávnál elég a megjegyzés; az ügyfelek ezt az idősávot már nem látják szabadként.</p>
                          <FormSubmitButton pendingLabel="Rögzítés...">Idősáv rögzítése</FormSubmitButton>
                        </form>
                      )}
                    </div>
                    <div className="mt-4 space-y-3">
                      {booked.length === 0 ? (
                        <p className="text-sm text-graphite/70">Még nincs foglalás erre a mini sessionre.</p>
                      ) : (
                        booked.map((booking) => (
                          <div key={booking.id} className="rounded-md border border-ink/10 bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-ink">{formatMiniSessionSlot(booking.startsAt, booking.endsAt)} · {booking.name}</p>
                              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                                booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED
                                  ? "bg-red-50 text-red-700"
                                  : booking.source === MINI_SESSION_BOOKING_SOURCE_MANUAL
                                    ? "bg-brass/10 text-brass"
                                    : "bg-sage/10 text-sage"
                              }`}>
                                {booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED
                                  ? "Blokkolt"
                                  : booking.source === MINI_SESSION_BOOKING_SOURCE_MANUAL
                                    ? "Kézi"
                                    : "Ügyfél"}
                              </span>
                            </div>
                            {booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED ? (
                              <>
                                <p className="mt-1 text-sm text-graphite/70">{booking.email} · {booking.phone}</p>
                                <p className="mt-1 text-xs text-graphite/60">Létszám: {booking.attendeeCount}</p>
                              </>
                            ) : null}
                            {booking.adminNote ? <p className="mt-2 text-xs text-graphite/60">Megjegyzés: {booking.adminNote}</p> : null}
                            <form action={cancelMiniSessionBookingByAdminAction.bind(null, booking.id)} className="mt-3">
                              <ConfirmSubmitButton
                                variant="danger"
                                message="Biztosan törlöd ezt az idősávot? Az időpont újra foglalható lesz."
                                className="h-9 px-3 text-xs"
                              >
                                <XCircle size={14} />
                                {booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED ? "Blokkolás törlése" : "Foglalás törlése"}
                              </ConfirmSubmitButton>
                            </form>
                          </div>
                        ))
                      )}
                    </div>
                    {cancelled.length > 0 ? (
                      <details className="group mt-5 border-t border-ink/10 pt-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-graphite/60 transition hover:bg-white [&::-webkit-details-marker]:hidden">
                          <span>Törölt foglalások ({cancelled.length})</span>
                          <ChevronDown size={15} className="shrink-0 transition group-open:rotate-180" />
                        </summary>
                        <div className="mt-3 space-y-2">
                          {cancelled.map((booking) => (
                            <div key={booking.id} className="rounded-md border border-ink/10 bg-white/70 p-3">
                              <p className="text-sm font-medium text-graphite">{formatMiniSessionSlot(booking.startsAt, booking.endsAt)} · {booking.name}</p>
                              {booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED ? <p className="mt-1 text-xs text-graphite/55">{booking.email} · {booking.phone}</p> : null}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </div>
              </section>
            );
          })
        )}
      </div>
    </AdminShell>
  );
}
