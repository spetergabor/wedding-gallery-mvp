import { ArrowLeft, CalendarClock, CheckCircle2, ChevronDown, Download, ExternalLink, ImageIcon, Mail, MapPin, Phone, PlusCircle, Settings2, Trash2, UploadCloud, Users, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
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
  deleteMiniSessionAction,
  deleteMiniSessionCoverAction,
  updateMiniSessionAction,
  updateMiniSessionCoverAction
} from "@/lib/mini-session-actions";
import {
  createMiniSessionSlots,
  formatMiniSessionDate,
  formatMiniSessionSlot,
  formatMiniSessionTime,
  miniSessionDateInput,
  miniSessionLanguageLabel,
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_SOURCE_MANUAL,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  MINI_SESSION_LANGUAGES,
  miniSessionTimeInput
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

type MiniSessionTab = "overview" | "bookings" | "slots" | "settings";

const fieldClass =
  "h-12 w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";
const fileInputClass =
  "block w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-paper px-3 py-2.5 text-sm text-ink outline-none transition file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-graphite focus:border-ink/50";
const textAreaClass =
  "min-h-24 w-full min-w-0 rounded-md border border-ink/15 bg-paper px-3 py-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";
const headerActionLinkClass =
  "inline-flex h-9 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-ink/10 px-2.5 text-xs font-medium text-ink transition hover:bg-ink/5 sm:px-3 sm:text-sm md:w-auto";
const headerActionButtonClass =
  "h-9 w-full min-w-0 whitespace-nowrap px-2.5 text-xs sm:px-3 sm:text-sm md:w-auto";

function activeTab(value: string | undefined): MiniSessionTab {
  if (value === "bookings" || value === "slots" || value === "settings") {
    return value;
  }

  return "overview";
}

function sourceLabel(source: string) {
  if (source === MINI_SESSION_BOOKING_SOURCE_BLOCKED) {
    return "Blokkolt";
  }

  if (source === MINI_SESSION_BOOKING_SOURCE_MANUAL) {
    return "Kézi";
  }

  return "Ügyfél";
}

function sourceBadgeClass(source: string) {
  if (source === MINI_SESSION_BOOKING_SOURCE_BLOCKED) {
    return "bg-red-50 text-red-700";
  }

  if (source === MINI_SESSION_BOOKING_SOURCE_MANUAL) {
    return "bg-brass/10 text-brass";
  }

  return "bg-sage/10 text-sage";
}

function tabHref(id: string, tab: MiniSessionTab) {
  return `/admin/mini-sessions/${id}${tab === "overview" ? "" : `?tab=${tab}`}`;
}

export default async function AdminMiniSessionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    error?: string;
    created?: string;
    updated?: string;
    bookingCancelled?: string;
    adminBooking?: string;
    coverUpdated?: string;
    coverDeleted?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;
  const currentTab = activeTab(flags.tab);
  const session = await prisma.miniSession.findFirst({
    where: { id, ...adminOwnedWhere(admin) },
    include: {
      bookings: {
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!session) {
    notFound();
  }

  const booked = session.bookings.filter((booking) => booking.status === MINI_SESSION_BOOKING_STATUS_BOOKED);
  const cancelled = session.bookings.filter((booking) => booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED);
  const contactBookings = booked.filter((booking) => booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED);
  const blockedBookings = booked.filter((booking) => booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED);
  const slots = createMiniSessionSlots(session);
  const bookedBySlot = new Map(booked.map((booking) => [booking.startsAt.toISOString(), booking]));
  const freeSlots = slots.filter((slot) => !bookedBySlot.has(slot.token));
  const freeSlotCount = freeSlots.length;
  const publicUrl = miniSessionPublicUrl(session.slug);
  const tabs: Array<{ id: MiniSessionTab; label: string; icon: ComponentType<{ size?: number; className?: string }> }> = [
    { id: "overview", label: "Áttekintés", icon: CalendarClock },
    { id: "bookings", label: "Foglalók", icon: Users },
    { id: "slots", label: "Idősávok", icon: CheckCircle2 },
    { id: "settings", label: "Beállítások", icon: Settings2 }
  ];

  return (
    <AdminShell>
      <div className="mb-5">
        <Link href="/admin/mini-sessions" className="inline-flex items-center gap-2 text-sm font-medium text-graphite hover:text-ink">
          <ArrowLeft size={15} />
          Vissza a mini sessionökhöz
        </Link>
      </div>

      <div className="mb-5 space-y-3">
        {flags.error === "missing" ? <Alert title="Hiányzó vagy hibás adat." variant="error" /> : null}
        {flags.error === "slug" ? <Alert title="Ez a publikus link már foglalt." variant="error">Adj meg egy egyedi slugot.</Alert> : null}
        {flags.error === "cover" ? <Alert title="A borítóképnek képfájlnak kell lennie." variant="error" /> : null}
        {flags.error === "cover_missing" ? <Alert title="Válassz ki egy borítóképet a feltöltéshez." variant="error" /> : null}
        {flags.error === "cover_size" ? <Alert title="A borítókép túl nagy." variant="error">Maximum 12 MB-os képet tölts fel.</Alert> : null}
        {flags.error === "cover_upload" ? <Alert title="A borítókép feltöltése nem sikerült." variant="error">Próbáld újra egy kisebb JPG, PNG vagy WebP képpel.</Alert> : null}
        {flags.error === "slot" ? <Alert title="Érvénytelen idősáv." variant="error">Válassz egy szabad idősávot.</Alert> : null}
        {flags.error === "taken" ? <Alert title="Ez az idősáv már foglalt." variant="error">Frissítsd a listát vagy válassz másik idősávot.</Alert> : null}
        {flags.created ? <Alert title="Mini session létrehozva." variant="success" /> : null}
        {flags.updated ? <Alert title="Mini session frissítve." variant="success" /> : null}
        {flags.bookingCancelled ? <Alert title="Idősáv törölve, újra foglalható." variant="success" /> : null}
        {flags.adminBooking ? <Alert title="Idősáv rögzítve." variant="success" /> : null}
        {flags.coverUpdated ? <Alert title="Borítókép frissítve." variant="success" /> : null}
        {flags.coverDeleted ? <Alert title="Borítókép törölve." variant="success" /> : null}
      </div>

      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-ink">{session.title}</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${session.isActive ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"}`}>
                {session.isActive ? "Aktív" : "Rejtett"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-graphite/70">
              <span className="inline-flex items-center gap-1.5"><CalendarClock size={15} /> {formatMiniSessionDate(session.sessionDate)} · {formatMiniSessionTime(session.startsAt)}-{formatMiniSessionTime(session.endsAt)}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> {session.location}</span>
              <span>LP nyelv: {miniSessionLanguageLabel(session.language)}</span>
            </div>
            <p className="mt-2 text-sm text-graphite/60">/mini-session/{session.slug}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto xl:flex xl:flex-nowrap">
            <Link className={headerActionLinkClass} href={publicUrl} target="_blank">
              <ExternalLink size={14} />
              Megnyitás
            </Link>
            <CopyLinkButton url={publicUrl} label="Link másolása" className={headerActionButtonClass} />
            <Link className={headerActionLinkClass} href={`/admin/mini-sessions/${session.id}/export`}>
              <Download size={14} />
              CSV export
            </Link>
            <Link className={headerActionLinkClass} href={tabHref(session.id, "settings")}>
              <Settings2 size={14} />
              Szerkesztés
            </Link>
          </div>
        </div>
      </section>

      <nav className="mt-5 flex gap-2 overflow-x-auto border-b border-ink/10 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tabHref(session.id, tab.id)}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                isActive ? "bg-ink text-white" : "text-graphite hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {currentTab === "overview" ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <Link href={tabHref(session.id, "slots")} className="rounded-md bg-white px-4 py-4 shadow-soft transition hover:bg-ink/5">
                <p className="text-2xl font-semibold text-ink">{slots.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Összes idősáv</p>
              </Link>
              <Link href={tabHref(session.id, "slots")} className="rounded-md bg-white px-4 py-4 shadow-soft transition hover:bg-ink/5">
                <p className="text-2xl font-semibold text-sage">{freeSlotCount}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Szabad</p>
              </Link>
              <Link href={tabHref(session.id, "bookings")} className="rounded-md bg-white px-4 py-4 shadow-soft transition hover:bg-ink/5">
                <p className="text-2xl font-semibold text-ink">{contactBookings.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Foglaló</p>
              </Link>
              <Link href={tabHref(session.id, "slots")} className="rounded-md bg-white px-4 py-4 shadow-soft transition hover:bg-ink/5">
                <p className="text-2xl font-semibold text-graphite">{blockedBookings.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Blokkolt</p>
              </Link>
            </div>

            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Legutóbbi foglalók</h2>
                  <p className="mt-1 text-sm text-graphite/65">A teljes kontaktlistát a Foglalók fülön látod.</p>
                </div>
                <Link href={tabHref(session.id, "bookings")} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5">
                  <Users size={15} />
                  Foglalók megnyitása
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {contactBookings.length === 0 ? (
                  <p className="rounded-md border border-dashed border-ink/15 bg-paper px-3 py-4 text-sm text-graphite/70">Még nincs ügyfélfoglalás ennél az eseménynél.</p>
                ) : (
                  contactBookings.slice(0, 5).map((booking) => (
                    <div key={booking.id} className="flex flex-col justify-between gap-2 rounded-md border border-ink/10 bg-paper px-3 py-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-ink">{booking.name}</p>
                        <p className="mt-1 text-xs text-graphite/60">{formatMiniSessionSlot(booking.startsAt, booking.endsAt)} · {booking.email}</p>
                      </div>
                      <span className={`w-fit rounded-full px-2 py-1 text-[11px] font-medium ${sourceBadgeClass(booking.source)}`}>{sourceLabel(booking.source)}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">Publikus oldal</h2>
              <p className="mt-2 break-all text-sm text-graphite/70">{publicUrl}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link className={headerActionLinkClass} href={publicUrl} target="_blank">
                  <ExternalLink size={14} />
                  Megnyitás
                </Link>
                <CopyLinkButton url={publicUrl} label="Másolás" className={headerActionButtonClass} />
              </div>
            </section>

            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">Borítókép</h2>
              {session.coverImageUrl ? (
                <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-md bg-paper">
                  <Image src={session.coverImageUrl} alt={`${session.title} borítókép`} fill unoptimized className="object-cover" sizes="360px" />
                </div>
              ) : (
                <p className="mt-4 rounded-md border border-dashed border-ink/15 bg-paper px-3 py-4 text-sm text-graphite/70">Nincs borítókép beállítva.</p>
              )}
            </section>
          </aside>
        </div>
      ) : null}

      {currentTab === "bookings" ? (
        <section className="mt-6 rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-ink">Foglalók</h2>
              <p className="mt-1 text-sm text-graphite/65">Kontaktlista azokkal, akik időpontot foglaltak vagy kézzel lettek rögzítve.</p>
            </div>
            <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5" href={`/admin/mini-sessions/${session.id}/export`}>
              <Download size={15} />
              CSV export
            </Link>
          </div>

          {contactBookings.length === 0 ? (
            <div className="mt-5">
              <EmptyState icon={<Users size={22} />} title="Még nincs foglaló" description="Ha valaki foglal, itt kontaktlistaként fog megjelenni." />
            </div>
          ) : (
            <>
              <div className="mt-5 space-y-3 md:hidden">
                {contactBookings.map((booking) => (
                  <div key={booking.id} className="rounded-md border border-ink/10 bg-paper p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{booking.name}</p>
                        <p className="mt-1 text-sm text-graphite/65">{formatMiniSessionSlot(booking.startsAt, booking.endsAt)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${sourceBadgeClass(booking.source)}`}>{sourceLabel(booking.source)}</span>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-graphite/70">
                      <p className="flex items-center gap-2"><Mail size={14} /> {booking.email}</p>
                      <p className="flex items-center gap-2"><Phone size={14} /> {booking.phone}</p>
                      <p className="flex items-center gap-2"><Users size={14} /> {booking.attendeeCount} fő</p>
                    </div>
                    {booking.adminNote ? <p className="mt-3 text-xs text-graphite/60">Megjegyzés: {booking.adminNote}</p> : null}
                    <form action={cancelMiniSessionBookingByAdminAction.bind(null, booking.id)} className="mt-4">
                      <input type="hidden" name="returnTab" value="bookings" />
                      <ConfirmSubmitButton variant="danger" message="Biztosan törlöd ezt a foglalást? Az időpont újra foglalható lesz." className="h-9 px-3 text-xs">
                        <XCircle size={14} />
                        Foglalás törlése
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                ))}
              </div>

              <div className="mt-5 hidden overflow-hidden rounded-md border border-ink/10 md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-paper text-xs uppercase tracking-[0.12em] text-graphite/55">
                    <tr>
                      <th className="px-4 py-3 font-medium">Idősáv</th>
                      <th className="px-4 py-3 font-medium">Név</th>
                      <th className="px-4 py-3 font-medium">Elérhetőség</th>
                      <th className="px-4 py-3 font-medium">Létszám</th>
                      <th className="px-4 py-3 font-medium">Típus</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {contactBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td className="px-4 py-3 font-medium text-ink">{formatMiniSessionSlot(booking.startsAt, booking.endsAt)}</td>
                        <td className="px-4 py-3 text-ink">
                          {booking.name}
                          {booking.adminNote ? <p className="mt-1 text-xs text-graphite/55">{booking.adminNote}</p> : null}
                        </td>
                        <td className="px-4 py-3 text-graphite/70">
                          <p>{booking.email}</p>
                          <p className="mt-1">{booking.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-graphite/70">{booking.attendeeCount} fő</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${sourceBadgeClass(booking.source)}`}>{sourceLabel(booking.source)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <form action={cancelMiniSessionBookingByAdminAction.bind(null, booking.id)}>
                            <input type="hidden" name="returnTab" value="bookings" />
                            <ConfirmSubmitButton variant="danger" message="Biztosan törlöd ezt a foglalást? Az időpont újra foglalható lesz." className="h-8 px-2 text-xs">
                              <XCircle size={13} />
                              Törlés
                            </ConfirmSubmitButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {cancelled.length > 0 ? (
            <details className="group mt-6 border-t border-ink/10 pt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md bg-paper px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-graphite/60 transition hover:bg-ink/5 [&::-webkit-details-marker]:hidden">
                <span>Törölt foglalások ({cancelled.length})</span>
                <ChevronDown size={15} className="shrink-0 transition group-open:rotate-180" />
              </summary>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {cancelled.map((booking) => (
                  <div key={booking.id} className="rounded-md border border-ink/10 bg-paper p-3">
                    <p className="text-sm font-medium text-graphite">{formatMiniSessionSlot(booking.startsAt, booking.endsAt)} · {booking.name}</p>
                    {booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED ? <p className="mt-1 text-xs text-graphite/55">{booking.email} · {booking.phone}</p> : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {currentTab === "slots" ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <PlusCircle size={18} />
              Idősáv rögzítése
            </h2>
            {freeSlots.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-ink/15 bg-paper px-3 py-4 text-sm text-graphite/70">Nincs szabad idősáv kézi foglaláshoz vagy blokkoláshoz.</p>
            ) : (
              <form action={createAdminMiniSessionBookingAction.bind(null, session.id)} className="mt-4 grid gap-3">
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
                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Név</span>
                  <input name="name" className={fieldClass} placeholder="Ügyfél neve" />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">E-mail</span>
                  <input name="email" type="email" className={fieldClass} placeholder="opcionális" />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Telefon</span>
                  <input name="phone" type="tel" className={fieldClass} placeholder="opcionális" />
                </label>
                <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)] xl:grid-cols-1">
                  <label className="block space-y-2">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Létszám</span>
                    <input name="attendeeCount" type="number" min="1" defaultValue="1" className={fieldClass} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Megjegyzés</span>
                    <input name="adminNote" className={fieldClass} placeholder="pl. ebédszünet" />
                  </label>
                </div>
                <p className="text-xs leading-5 text-graphite/60">Blokkolt idősávnál elég a megjegyzés; az ügyfelek ezt az időpontot már nem látják szabadként.</p>
                <FormSubmitButton pendingLabel="Rögzítés...">Idősáv rögzítése</FormSubmitButton>
              </form>
            )}
          </section>

          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold text-ink">Idősávok</h2>
                <p className="mt-1 text-sm text-graphite/65">{freeSlotCount}/{slots.length} szabad időpont</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:w-[330px]">
                <div className="rounded-md bg-paper px-2 py-2">
                  <p className="text-lg font-semibold text-ink">{slots.length}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-graphite/55">Összes</p>
                </div>
                <div className="rounded-md bg-paper px-2 py-2">
                  <p className="text-lg font-semibold text-sage">{freeSlotCount}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-graphite/55">Szabad</p>
                </div>
                <div className="rounded-md bg-paper px-2 py-2">
                  <p className="text-lg font-semibold text-graphite">{blockedBookings.length}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-graphite/55">Blokkolt</p>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {slots.map((slot) => {
                const booking = bookedBySlot.get(slot.token);
                return (
                  <div key={slot.token} className={`rounded-md border p-3 ${booking ? "border-ink/10 bg-paper" : "border-sage/20 bg-sage/5"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{formatMiniSessionSlot(slot.startsAt, slot.endsAt)}</p>
                        {booking ? (
                          <p className="mt-1 text-xs text-graphite/60">{booking.name}</p>
                        ) : (
                          <p className="mt-1 text-xs text-sage">Szabad</p>
                        )}
                      </div>
                      {booking ? (
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${sourceBadgeClass(booking.source)}`}>{sourceLabel(booking.source)}</span>
                      ) : (
                        <span className="rounded-full bg-sage/10 px-2 py-1 text-[11px] font-medium text-sage">Szabad</span>
                      )}
                    </div>
                    {booking?.adminNote ? <p className="mt-2 text-xs text-graphite/60">Megjegyzés: {booking.adminNote}</p> : null}
                    {booking ? (
                      <form action={cancelMiniSessionBookingByAdminAction.bind(null, booking.id)} className="mt-3">
                        <input type="hidden" name="returnTab" value="slots" />
                        <ConfirmSubmitButton
                          variant="danger"
                          message="Biztosan törlöd ezt az idősávot? Az időpont újra foglalható lesz."
                          className="h-8 px-2 text-xs"
                        >
                          <XCircle size={13} />
                          {booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED ? "Blokkolás törlése" : "Foglalás törlése"}
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === "settings" ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
            <h2 className="text-lg font-semibold text-ink">Esemény beállításai</h2>
            <form action={updateMiniSessionAction.bind(null, session.id)} className="mt-5 grid content-start gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Session neve</span>
                <input name="title" defaultValue={session.title} required className={fieldClass} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Publikus slug</span>
                <input name="slug" defaultValue={session.slug} required className={fieldClass} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Landing page nyelve</span>
                <select name="language" defaultValue={session.language} className={fieldClass}>
                  {MINI_SESSION_LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </select>
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
          </section>

          <aside className="space-y-5">
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <ImageIcon size={18} />
                Borítókép
              </h2>
              <form action={updateMiniSessionCoverAction.bind(null, session.id)} encType="multipart/form-data" className="mt-4 grid gap-3">
                <label className="block min-w-0 space-y-2">
                  <span className="text-sm font-medium text-graphite">Új borítókép</span>
                  <input name="coverImage" type="file" accept="image/*" required className={fileInputClass} />
                </label>
                <FormSubmitButton pendingLabel="Feltöltés..." className="h-12 px-4">
                  <UploadCloud size={16} />
                  Feltöltés
                </FormSubmitButton>
              </form>
              {session.coverImageUrl ? (
                <div className="mt-4">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-paper">
                    <Image src={session.coverImageUrl} alt={`${session.title} borítókép`} fill unoptimized className="object-cover" sizes="380px" />
                  </div>
                  <form action={deleteMiniSessionCoverAction.bind(null, session.id)} className="mt-3">
                    <ConfirmSubmitButton
                      variant="danger"
                      message="Biztosan törlöd a borítóképet? A publikus oldalon nem lesz hero kép."
                      className="h-10 px-3"
                    >
                      <Trash2 size={15} />
                      Borítókép törlése
                    </ConfirmSubmitButton>
                  </form>
                </div>
              ) : (
                <p className="mt-4 rounded-md border border-dashed border-ink/15 bg-paper px-3 py-4 text-sm text-graphite/70">Még nincs borítókép beállítva.</p>
              )}
            </section>

            <section className="rounded-lg border border-red-200 bg-red-50 p-5">
              <h2 className="text-lg font-semibold text-red-800">Veszély zóna</h2>
              <p className="mt-2 text-sm leading-6 text-red-700">Az esemény törlése a hozzá tartozó foglalásokat is törli.</p>
              <form action={deleteMiniSessionAction.bind(null, session.id)} className="mt-4">
                <ConfirmSubmitButton
                  variant="danger"
                  message={`Biztosan törlöd ezt a mini sessiont? A hozzá tartozó ${booked.length} foglalás is törlődik.`}
                  className="h-10 px-3"
                >
                  <Trash2 size={15} />
                  Esemény törlése
                </ConfirmSubmitButton>
              </form>
            </section>
          </aside>
        </div>
      ) : null}
    </AdminShell>
  );
}
