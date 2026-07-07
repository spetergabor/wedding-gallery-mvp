import { ArrowLeft, CalendarClock, CalendarPlus, CheckCircle2, Download, ExternalLink, Eye, ImageIcon, Mail, MapPin, Phone, PlusCircle, Send, Settings2, Trash2, UploadCloud, Users, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EmptyState } from "@/components/empty-state";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MiniSessionBookingFilters } from "@/components/mini-session-booking-filters";
import { MiniSessionTabController } from "@/components/mini-session-tab-controller";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { miniSessionBookingCalendarUrl, miniSessionBookingCancelUrl, miniSessionBookingRescheduleUrl, miniSessionPublicUrl } from "@/lib/email";
import { getAvailableMiniSessionSlots } from "@/lib/mini-session-availability";
import {
  cancelMiniSessionBookingByAdminAction,
  createAdminMiniSessionBookingAction,
  deleteMiniSessionAction,
  deleteMiniSessionCoverAction,
  resendMiniSessionBookingConfirmationAction,
  rescheduleMiniSessionBookingByAdminAction,
  updateMiniSessionAction,
  updateMiniSessionCoverAction
} from "@/lib/mini-session-actions";
import {
  createMiniSessionSlots,
  formatMiniSessionDate,
  formatMiniSessionDateRange,
  formatMiniSessionSlot,
  formatMiniSessionSlotWithDate,
  formatMiniSessionTime,
  miniSessionDateInput,
  miniSessionEndDateInput,
  miniSessionLanguageLabel,
  miniSessionModeLabel,
  MINI_SESSION_BOOKING_MODE_RECURRING,
  MINI_SESSION_BOOKING_MODE_SINGLE_DAY,
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_SOURCE_MANUAL,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  MINI_SESSION_LANGUAGES,
  MINI_SESSION_WEEKDAYS,
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
const smallActionLinkClass =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-ink/10 bg-white px-2.5 text-xs font-medium text-ink transition hover:bg-ink/5";
const smallActionButtonClass =
  "h-8 whitespace-nowrap px-2.5 text-xs";

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

function statusLabel(status: string) {
  return status === MINI_SESSION_BOOKING_STATUS_CANCELLED ? "Törölt" : "Aktív";
}

function statusBadgeClass(status: string) {
  return status === MINI_SESSION_BOOKING_STATUS_CANCELLED
    ? "bg-red-50 text-red-700"
    : "bg-sage/10 text-sage";
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
    bookingRescheduled?: string;
    adminBooking?: string;
    confirmationSent?: string;
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
      availabilityRules: {
        orderBy: [{ weekday: "asc" }, { startsAt: "asc" }]
      },
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
  const activeContactBookings = booked.filter((booking) => booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED);
  const cancelledContactBookings = cancelled.filter((booking) => booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED);
  const contactBookings = [...activeContactBookings, ...cancelledContactBookings];
  const blockedBookings = booked.filter((booking) => booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED);
  const slots = createMiniSessionSlots(session);
  const freeSlots = await getAvailableMiniSessionSlots(session);
  const freeSlotTokens = new Set(freeSlots.map((slot) => slot.token));
  const bookedBySlot = new Map(booked.map((booking) => [booking.startsAt.toISOString(), booking]));
  const freeSlotCount = freeSlots.length;
  const externalConflictCount = slots.filter((slot) => !freeSlotTokens.has(slot.token) && !bookedBySlot.has(slot.token)).length;
  const publicUrl = miniSessionPublicUrl(session.slug);
  const isRecurring = session.bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING;
  const showSlotDates = isRecurring || miniSessionDateInput(session) !== miniSessionEndDateInput(session);
  const sessionDateLabel = formatMiniSessionDateRange(session.startsAt, session.endsAt);
  const availabilityRulesByWeekday = new Map(session.availabilityRules.map((rule) => [rule.weekday, rule]));
  const publicChecklist = [
    { label: "Publikusan aktív", ok: session.isActive },
    { label: "Van szabad idősáv", ok: freeSlotCount > 0 },
    { label: "Borítókép beállítva", ok: Boolean(session.coverImageUrl) },
    { label: "Publikus megjegyzés", ok: Boolean(session.notes?.trim()) },
    { label: "Styling infó", ok: Boolean(session.stylingNotes?.trim()) }
  ];
  const clientContactCount = contactBookings.filter((booking) => booking.source !== MINI_SESSION_BOOKING_SOURCE_MANUAL).length;
  const manualContactCount = contactBookings.filter((booking) => booking.source === MINI_SESSION_BOOKING_SOURCE_MANUAL).length;
  const tabs: Array<{ key: MiniSessionTab; label: string; icon: "CalendarClock" | "Users" | "CheckCircle2" | "Settings2" }> = [
    { key: "overview", label: "Áttekintés", icon: "CalendarClock" },
    { key: "bookings", label: "Foglalók", icon: "Users" },
    { key: "slots", label: "Idősávok", icon: "CheckCircle2" },
    { key: "settings", label: "Beállítások", icon: "Settings2" }
  ];

  return (
    <AdminShell>
      <div className="mb-5">
        <Link href="/admin/mini-sessions" className="inline-flex items-center gap-2 text-sm font-medium text-graphite hover:text-ink">
          <ArrowLeft size={15} />
          Vissza az időpontfoglalóhoz
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
        {flags.created ? <Alert title="Foglaló létrehozva." variant="success" /> : null}
        {flags.updated ? <Alert title="Foglaló frissítve." variant="success" /> : null}
        {flags.bookingCancelled ? <Alert title="Idősáv törölve, újra foglalható." variant="success" /> : null}
        {flags.bookingRescheduled ? <Alert title="Időpont módosítva." variant="success" /> : null}
        {flags.adminBooking ? <Alert title="Idősáv rögzítve." variant="success" /> : null}
        {flags.confirmationSent ? <Alert title="Megerősítő e-mail újraküldve." variant="success" /> : null}
        {flags.coverUpdated ? <Alert title="Borítókép frissítve." variant="success" /> : null}
        {flags.coverDeleted ? <Alert title="Borítókép törölve." variant="success" /> : null}
        {flags.error === "email_send" ? (
          <Alert title="Az e-mail küldése nem sikerült." variant="error">
            Ellenőrizd a Resend beállítást és az ügyfél e-mail címét, majd próbáld újra.
          </Alert>
        ) : null}
        {flags.error === "email_unavailable" ? <Alert title="Ehhez a foglaláshoz nem küldhető ügyfél visszaigazolás." variant="error" /> : null}
      </div>

      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-ink">{session.title}</h1>
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
                  : `${sessionDateLabel} · ${formatMiniSessionTime(session.startsAt)}-${formatMiniSessionTime(session.endsAt)}`}
              </span>
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
            <Link className={headerActionLinkClass} href={tabHref(session.id, "settings")} data-mini-session-tab-target="settings">
              <Settings2 size={14} />
              Szerkesztés
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-5">
        <MiniSessionTabController tabs={tabs} initialTab={currentTab} />
      </div>

      <div data-mini-session-tab-panel="overview" hidden={currentTab !== "overview"}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <Link href={tabHref(session.id, "slots")} data-mini-session-tab-target="slots" className="rounded-md bg-white px-4 py-4 shadow-soft transition hover:bg-ink/5">
                <p className="text-2xl font-semibold text-ink">{slots.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Összes idősáv</p>
              </Link>
              <Link href={tabHref(session.id, "slots")} data-mini-session-tab-target="slots" className="rounded-md bg-white px-4 py-4 shadow-soft transition hover:bg-ink/5">
                <p className="text-2xl font-semibold text-sage">{freeSlotCount}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Szabad</p>
              </Link>
              <Link href={tabHref(session.id, "bookings")} data-mini-session-tab-target="bookings" className="rounded-md bg-white px-4 py-4 shadow-soft transition hover:bg-ink/5">
                <p className="text-2xl font-semibold text-ink">{activeContactBookings.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Foglaló</p>
              </Link>
              <Link href={tabHref(session.id, "slots")} data-mini-session-tab-target="slots" className="rounded-md bg-white px-4 py-4 shadow-soft transition hover:bg-ink/5">
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
                <Link href={tabHref(session.id, "bookings")} data-mini-session-tab-target="bookings" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5">
                  <Users size={15} />
                  Foglalók megnyitása
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {activeContactBookings.length === 0 ? (
                  <p className="rounded-md border border-dashed border-ink/15 bg-paper px-3 py-4 text-sm text-graphite/70">Még nincs ügyfélfoglalás ennél az eseménynél.</p>
                ) : (
                  activeContactBookings.slice(0, 5).map((booking) => (
                    <div key={booking.id} className="flex flex-col justify-between gap-2 rounded-md border border-ink/10 bg-paper px-3 py-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-ink">{booking.name}</p>
                        <p className="mt-1 text-xs text-graphite/60">
                          {showSlotDates
                            ? formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt)
                            : formatMiniSessionSlot(booking.startsAt, booking.endsAt)} · {booking.email}
                        </p>
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Landing page ellenőrzés</h2>
                  <p className="mt-1 text-sm text-graphite/65">Gyors előnézet és publikálási checklist.</p>
                </div>
                <Link href={publicUrl} target="_blank" className="inline-flex size-9 items-center justify-center rounded-md border border-ink/10 text-ink transition hover:bg-ink/5" aria-label="Publikus oldal megnyitása">
                  <Eye size={15} />
                </Link>
              </div>
              <div className={`relative mt-4 min-h-40 overflow-hidden rounded-md border ${session.coverImageUrl ? "border-ink/10 bg-ink text-white" : "border-ink/10 bg-paper text-ink"}`}>
                {session.coverImageUrl ? (
                  <>
                    <Image src={session.coverImageUrl} alt={`${session.title} borítókép`} fill unoptimized className="object-cover" sizes="360px" />
                    <div className="absolute inset-0 bg-ink/45" />
                  </>
                ) : null}
                <div className="relative flex min-h-40 flex-col justify-end p-4">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${session.coverImageUrl ? "text-white/75" : "text-brass"}`}>{miniSessionLanguageLabel(session.language)}</p>
                  <p className="mt-2 text-xl font-semibold">{session.title}</p>
                  <p className={`mt-2 text-xs ${session.coverImageUrl ? "text-white/80" : "text-graphite/70"}`}>
                    {isRecurring ? `Állandó szolgáltatás · ${session.bookingWindowDays} nap` : sessionDateLabel} · {session.location}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {publicChecklist.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-md bg-paper px-3 py-2 text-sm">
                    <span className="text-graphite/75">{item.label}</span>
                    <span className={`inline-flex items-center gap-1.5 font-medium ${item.ok ? "text-sage" : "text-red-700"}`}>
                      {item.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {item.ok ? "OK" : "Hiányzik"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <div data-mini-session-tab-panel="bookings" hidden={currentTab !== "bookings"}>
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
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
              <MiniSessionBookingFilters
                totalCount={contactBookings.length}
                activeCount={activeContactBookings.length}
                cancelledCount={cancelledContactBookings.length}
                clientCount={clientContactCount}
                manualCount={manualContactCount}
              />
              <div data-mini-session-booking-empty hidden={activeContactBookings.length > 0} className="mt-5 rounded-md border border-dashed border-ink/15 bg-paper px-4 py-5 text-sm text-graphite/70">
                Nincs találat a jelenlegi szűrésre.
              </div>

              <div className="mt-5 space-y-3 md:hidden">
                {contactBookings.map((booking) => {
                  const slotLabel = showSlotDates
                    ? formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt)
                    : formatMiniSessionSlot(booking.startsAt, booking.endsAt);
                  const cancelUrl = miniSessionBookingCancelUrl(session.slug, booking.cancelToken);
                  const rescheduleUrl = miniSessionBookingRescheduleUrl(session.slug, booking.cancelToken);
                  const calendarUrl = miniSessionBookingCalendarUrl(session.slug, booking.cancelToken);
                  const isActive = booking.status === MINI_SESSION_BOOKING_STATUS_BOOKED;
                  const searchText = [booking.name, booking.email, booking.phone, booking.adminNote ?? "", slotLabel].join(" ").toLowerCase();
                  const currentSlot = { token: booking.startsAt.toISOString(), startsAt: booking.startsAt, endsAt: booking.endsAt };
                  const rescheduleSlots = [currentSlot, ...freeSlots.filter((slot) => slot.token !== currentSlot.token)];

                  return (
                    <div
                      key={booking.id}
                      data-mini-session-booking-item
                      data-mini-session-booking-record={booking.id}
                      data-mini-session-booking-status={booking.status}
                      data-mini-session-booking-source={booking.source === MINI_SESSION_BOOKING_SOURCE_MANUAL ? "manual" : "client"}
                      data-mini-session-booking-search={searchText}
                      hidden={!isActive}
                      className="rounded-md border border-ink/10 bg-paper p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{booking.name}</p>
                          <p className="mt-1 text-sm text-graphite/65">{slotLabel}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClass(booking.status)}`}>{statusLabel(booking.status)}</span>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${sourceBadgeClass(booking.source)}`}>{sourceLabel(booking.source)}</span>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-graphite/70">
                        <a className="flex items-center gap-2 hover:text-ink" href={`mailto:${booking.email}`}><Mail size={14} /> {booking.email}</a>
                        <a className="flex items-center gap-2 hover:text-ink" href={`tel:${booking.phone}`}><Phone size={14} /> {booking.phone}</a>
                        <p className="flex items-center gap-2"><Users size={14} /> {booking.attendeeCount} fő</p>
                      </div>
                      {booking.adminNote ? <p className="mt-3 text-xs text-graphite/60">Megjegyzés: {booking.adminNote}</p> : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a className={smallActionLinkClass} href={`mailto:${booking.email}`}>
                          <Mail size={13} />
                          E-mail
                        </a>
                        <a className={smallActionLinkClass} href={`tel:${booking.phone}`}>
                          <Phone size={13} />
                          Telefon
                        </a>
                        <Link className={smallActionLinkClass} href={calendarUrl} target="_blank">
                          <CalendarPlus size={13} />
                          Naptár
                        </Link>
                        <CopyLinkButton url={rescheduleUrl} label="Módosító link" className={smallActionButtonClass} />
                        <CopyLinkButton url={cancelUrl} label="Törlő link" className={smallActionButtonClass} />
                        {isActive ? (
                          <form action={rescheduleMiniSessionBookingByAdminAction.bind(null, booking.id)} className="flex w-full flex-col gap-2 rounded-md border border-ink/10 bg-white p-2">
                            <input type="hidden" name="returnTab" value="bookings" />
                            <select name="slot" required defaultValue={currentSlot.token} className="h-9 rounded-md border border-ink/15 bg-paper px-2 text-xs text-ink outline-none">
                              {rescheduleSlots.map((slot) => (
                                <option key={slot.token} value={slot.token}>
                                  {showSlotDates
                                    ? formatMiniSessionSlotWithDate(slot.startsAt, slot.endsAt)
                                    : formatMiniSessionSlot(slot.startsAt, slot.endsAt)}
                                </option>
                              ))}
                            </select>
                            <FormSubmitButton variant="secondary" pendingLabel="Mentés..." className="h-9 px-2 text-xs">
                              Áthelyezés
                            </FormSubmitButton>
                          </form>
                        ) : null}
                        {isActive ? (
                          <form action={resendMiniSessionBookingConfirmationAction.bind(null, booking.id)}>
                            <FormSubmitButton variant="secondary" pendingLabel="Küldés..." className={smallActionButtonClass}>
                              <Send size={13} />
                              Újraküldés
                            </FormSubmitButton>
                          </form>
                        ) : null}
                        {isActive ? (
                          <form action={cancelMiniSessionBookingByAdminAction.bind(null, booking.id)}>
                            <input type="hidden" name="returnTab" value="bookings" />
                            <ConfirmSubmitButton variant="danger" message="Biztosan törlöd ezt a foglalást? Az időpont újra foglalható lesz." className={smallActionButtonClass}>
                              <XCircle size={13} />
                              Törlés
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 hidden overflow-hidden rounded-md border border-ink/10 md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-paper text-xs uppercase tracking-[0.12em] text-graphite/55">
                    <tr>
                      <th className="px-4 py-3 font-medium">Idősáv</th>
                      <th className="px-4 py-3 font-medium">Név</th>
                      <th className="px-4 py-3 font-medium">Elérhetőség</th>
                      <th className="px-4 py-3 font-medium">Állapot</th>
                      <th className="px-4 py-3 font-medium">Műveletek</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {contactBookings.map((booking) => {
                      const slotLabel = showSlotDates
                        ? formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt)
                        : formatMiniSessionSlot(booking.startsAt, booking.endsAt);
                      const cancelUrl = miniSessionBookingCancelUrl(session.slug, booking.cancelToken);
                      const rescheduleUrl = miniSessionBookingRescheduleUrl(session.slug, booking.cancelToken);
                      const calendarUrl = miniSessionBookingCalendarUrl(session.slug, booking.cancelToken);
                      const isActive = booking.status === MINI_SESSION_BOOKING_STATUS_BOOKED;
                      const searchText = [booking.name, booking.email, booking.phone, booking.adminNote ?? "", slotLabel].join(" ").toLowerCase();
                      const currentSlot = { token: booking.startsAt.toISOString(), startsAt: booking.startsAt, endsAt: booking.endsAt };
                      const rescheduleSlots = [currentSlot, ...freeSlots.filter((slot) => slot.token !== currentSlot.token)];

                      return (
                        <tr
                          key={booking.id}
                          data-mini-session-booking-item
                          data-mini-session-booking-record={booking.id}
                          data-mini-session-booking-status={booking.status}
                          data-mini-session-booking-source={booking.source === MINI_SESSION_BOOKING_SOURCE_MANUAL ? "manual" : "client"}
                          data-mini-session-booking-search={searchText}
                          hidden={!isActive}
                        >
                          <td className="px-4 py-3 font-medium text-ink">{slotLabel}</td>
                          <td className="px-4 py-3 text-ink">
                            {booking.name}
                            {booking.adminNote ? <p className="mt-1 text-xs text-graphite/55">{booking.adminNote}</p> : null}
                          </td>
                          <td className="px-4 py-3 text-graphite/70">
                            <a className="block hover:text-ink" href={`mailto:${booking.email}`}>{booking.email}</a>
                            <a className="mt-1 block hover:text-ink" href={`tel:${booking.phone}`}>{booking.phone}</a>
                            <p className="mt-1 text-xs">{booking.attendeeCount} fő</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start gap-1">
                              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClass(booking.status)}`}>{statusLabel(booking.status)}</span>
                              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${sourceBadgeClass(booking.source)}`}>{sourceLabel(booking.source)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap justify-end gap-2">
                              <a className={smallActionLinkClass} href={`mailto:${booking.email}`}>
                                <Mail size={13} />
                                E-mail
                              </a>
                              <a className={smallActionLinkClass} href={`tel:${booking.phone}`}>
                                <Phone size={13} />
                                Telefon
                              </a>
                              <Link className={smallActionLinkClass} href={calendarUrl} target="_blank">
                                <CalendarPlus size={13} />
                                Naptár
                              </Link>
                              <CopyLinkButton url={rescheduleUrl} label="Módosító link" className={smallActionButtonClass} />
                              <CopyLinkButton url={cancelUrl} label="Törlő link" className={smallActionButtonClass} />
                              {isActive ? (
                                <form action={rescheduleMiniSessionBookingByAdminAction.bind(null, booking.id)} className="flex items-center gap-1">
                                  <input type="hidden" name="returnTab" value="bookings" />
                                  <select name="slot" required defaultValue={currentSlot.token} className="h-8 max-w-44 rounded-md border border-ink/15 bg-white px-2 text-xs text-ink outline-none">
                                    {rescheduleSlots.map((slot) => (
                                      <option key={slot.token} value={slot.token}>
                                        {showSlotDates
                                          ? formatMiniSessionSlotWithDate(slot.startsAt, slot.endsAt)
                                          : formatMiniSessionSlot(slot.startsAt, slot.endsAt)}
                                      </option>
                                    ))}
                                  </select>
                                  <FormSubmitButton variant="secondary" pendingLabel="..." className="h-8 px-2 text-xs">
                                    Áthelyezés
                                  </FormSubmitButton>
                                </form>
                              ) : null}
                              {isActive ? (
                                <form action={resendMiniSessionBookingConfirmationAction.bind(null, booking.id)}>
                                  <FormSubmitButton variant="secondary" pendingLabel="Küldés..." className={smallActionButtonClass}>
                                    <Send size={13} />
                                    Újraküldés
                                  </FormSubmitButton>
                                </form>
                              ) : null}
                              {isActive ? (
                                <form action={cancelMiniSessionBookingByAdminAction.bind(null, booking.id)}>
                                  <input type="hidden" name="returnTab" value="bookings" />
                                  <ConfirmSubmitButton variant="danger" message="Biztosan törlöd ezt a foglalást? Az időpont újra foglalható lesz." className={smallActionButtonClass}>
                                    <XCircle size={13} />
                                    Törlés
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      <div data-mini-session-tab-panel="slots" hidden={currentTab !== "slots"}>
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
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
                        {showSlotDates
                          ? formatMiniSessionSlotWithDate(slot.startsAt, slot.endsAt)
                          : formatMiniSessionSlot(slot.startsAt, slot.endsAt)}
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
            {externalConflictCount > 0 ? (
              <p className="mt-4 rounded-md border border-brass/20 bg-brass/5 px-3 py-3 text-sm text-graphite/70">
                {externalConflictCount} idősáv másik projekt vagy foglalás miatt nem foglalható.
              </p>
            ) : null}
            <div className="mt-5 space-y-3">
              {slots.map((slot, index) => {
                const booking = bookedBySlot.get(slot.token);
                const hasExternalConflict = !booking && !freeSlotTokens.has(slot.token);
                const isBlocked = booking?.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED;
                const isManual = booking?.source === MINI_SESSION_BOOKING_SOURCE_MANUAL;
                const stateLabel = booking ? sourceLabel(booking.source) : hasExternalConflict ? "Naptárban foglalt" : "Szabad";
                const lineClass = !booking
                  ? hasExternalConflict
                    ? "bg-brass"
                    : "bg-sage"
                  : isBlocked
                    ? "bg-red-500"
                    : isManual
                      ? "bg-brass"
                      : "bg-ink";
                const cardClass = !booking
                  ? hasExternalConflict
                    ? "border-brass/20 bg-brass/5"
                    : "border-sage/25 bg-sage/5"
                  : isBlocked
                    ? "border-red-200 bg-red-50"
                    : isManual
                      ? "border-brass/20 bg-brass/5"
                      : "border-ink/10 bg-paper";

                return (
                  <div key={slot.token} className="grid gap-3 sm:grid-cols-[120px_24px_minmax(0,1fr)]">
                    <div className="text-sm font-semibold text-ink sm:pt-3">
                      {showSlotDates ? (
                        <>
                          <span className="block text-xs font-medium text-graphite/60">{formatMiniSessionDate(slot.startsAt)}</span>
                          <span>{formatMiniSessionSlot(slot.startsAt, slot.endsAt)}</span>
                        </>
                      ) : (
                        formatMiniSessionSlot(slot.startsAt, slot.endsAt)
                      )}
                    </div>
                    <div className="relative hidden justify-center sm:flex">
                      <span className={`mt-4 size-3 rounded-full ${lineClass}`} />
                      {index < slots.length - 1 ? <span className="absolute bottom-[-18px] top-8 w-px bg-ink/10" /> : null}
                    </div>
                    <div className={`rounded-md border p-3 ${cardClass}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{booking ? booking.name : "Szabad idősáv"}</p>
                          <p className={`mt-1 text-xs ${booking ? "text-graphite/60" : "text-sage"}`}>{stateLabel}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${booking ? sourceBadgeClass(booking.source) : hasExternalConflict ? "bg-brass/10 text-brass" : "bg-sage/10 text-sage"}`}>
                          {stateLabel}
                        </span>
                      </div>
                      {booking && booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED ? (
                        <p className="mt-2 text-xs text-graphite/60">{booking.email} · {booking.phone} · {booking.attendeeCount} fő</p>
                      ) : null}
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
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <div data-mini-session-tab-panel="settings" hidden={currentTab !== "settings"}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
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
                <span className="text-sm font-medium text-graphite">Foglaló típusa</span>
                <select name="bookingMode" defaultValue={session.bookingMode} className={fieldClass}>
                  <option value={MINI_SESSION_BOOKING_MODE_SINGLE_DAY}>Mini session nap</option>
                  <option value={MINI_SESSION_BOOKING_MODE_RECURRING}>Állandó szolgáltatás</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Kezdő dátum</span>
                <input name="date" type="date" defaultValue={miniSessionDateInput(session)} required className={fieldClass} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Záró dátum (mini sessionnél)</span>
                <input name="endDate" type="date" defaultValue={miniSessionEndDateInput(session)} className={fieldClass} />
              </label>
              <label className="block space-y-2 sm:col-span-2">
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
              <section className="rounded-md border border-ink/10 bg-paper p-4 sm:col-span-2">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Állandó szolgáltatás elérhetősége</h3>
                    <p className="mt-1 text-xs leading-5 text-graphite/65">
                      Ezek a napok és időablakok csak állandó foglaló módban kerülnek ki a publikus naptárba.
                    </p>
                  </div>
                  <label className="block w-full space-y-2 sm:w-44">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Foglalási ablak</span>
                    <input
                      name="bookingWindowDays"
                      type="number"
                      min="7"
                      max="180"
                      step="1"
                      defaultValue={session.bookingWindowDays}
                      className={fieldClass}
                    />
                  </label>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {MINI_SESSION_WEEKDAYS.map((weekday) => {
                    const rule = availabilityRulesByWeekday.get(weekday.value);

                    return (
                      <div key={weekday.value} className="rounded-md border border-ink/10 bg-white p-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-ink">
                          <input
                            name="availabilityWeekday"
                            type="checkbox"
                            value={weekday.value}
                            defaultChecked={isRecurring ? Boolean(rule?.isActive) : weekday.value >= 1 && weekday.value <= 5}
                            className="size-4 rounded border-ink/20"
                          />
                          {weekday.label}
                        </label>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <label className="block space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.1em] text-graphite/55">Mettől</span>
                            <input
                              name={`availabilityStart-${weekday.value}`}
                              type="time"
                              defaultValue={rule?.startsAt ?? miniSessionTimeInput(session.startsAt)}
                              className={fieldClass}
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.1em] text-graphite/55">Meddig</span>
                            <input
                              name={`availabilityEnd-${weekday.value}`}
                              type="time"
                              defaultValue={rule?.endsAt ?? miniSessionTimeInput(session.endsAt)}
                              className={fieldClass}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-graphite">Megjegyzés</span>
                <textarea name="notes" defaultValue={session.notes ?? ""} className={textAreaClass} />
              </label>
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-graphite">Styling / előkészület a landing page-re</span>
                <textarea
                  name="stylingNotes"
                  defaultValue={session.stylingNotes ?? ""}
                  className={textAreaClass}
                  placeholder="pl. világos ruhák, natúr színek, réteges öltözet, kényelmes cipő..."
                />
                <span className="block text-xs text-graphite/60">Külön információs blokkban jelenik meg a publikus foglaló oldalon.</span>
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
                  message={`Biztosan törlöd ezt a foglalót? A hozzá tartozó ${booked.length} foglalás is törlődik.`}
                  className="h-10 px-3"
                >
                  <Trash2 size={15} />
                  Esemény törlése
                </ConfirmSubmitButton>
              </form>
            </section>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}
