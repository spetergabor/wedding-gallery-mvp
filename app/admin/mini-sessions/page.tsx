import {
  Ban,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  ImageIcon,
  ListChecks,
  MapPin,
  Plus,
  Settings2,
  Users,
  XCircle,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EmptyState } from "@/components/empty-state";
import { FormSubmitButton } from "@/components/form-submit-button";
import { adminOwnedWhere, ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { miniSessionPublicUrl } from "@/lib/email";
import { getAvailableMiniSessionSlots } from "@/lib/mini-session-availability";
import {
  createAdminCalendarBlockAction,
  createMiniSessionAction,
  deleteAdminCalendarBlockAction
} from "@/lib/mini-session-actions";
import {
  createMiniSessionSlots,
  formatMiniSessionDate,
  formatMiniSessionTime,
  miniSessionModeLabel,
  MINI_SESSION_BOOKING_MODE_RECURRING,
  MINI_SESSION_BOOKING_MODE_SINGLE_DAY,
  formatMiniSessionSlotWithDate,
  miniSessionLanguageLabel,
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  MINI_SESSION_LANGUAGES,
  MINI_SESSION_WEEKDAYS
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

type BookingHubTab = "overview" | "services" | "mini" | "bookings" | "calendar";
type BookingCreateMode = "service" | "mini";

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

const bookingHubTabs: Array<{ key: BookingHubTab; label: string; icon: LucideIcon }> = [
  { key: "overview", label: "Áttekintés", icon: CheckCircle2 },
  { key: "services", label: "Állandó szolgáltatások", icon: BriefcaseBusiness },
  { key: "mini", label: "Mini session napok", icon: CalendarClock },
  { key: "bookings", label: "Foglalások", icon: Users },
  { key: "calendar", label: "Naptár beállítások", icon: CalendarDays }
];

function activeTab(value: string | undefined): BookingHubTab {
  if (value === "services" || value === "mini" || value === "bookings" || value === "calendar") {
    return value;
  }

  return "overview";
}

function activeCreateMode(value: string | undefined): BookingCreateMode {
  return value === "mini" ? "mini" : "service";
}

function hubHref(tab: BookingHubTab, createMode: BookingCreateMode, hash?: string) {
  const params = new URLSearchParams();

  if (tab !== "overview") {
    params.set("tab", tab);
  }

  if (createMode !== "service") {
    params.set("create", createMode);
  }

  const query = params.toString();

  return `/admin/mini-sessions${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

function formatCalendarBlockRange(startsAt: Date, endsAt: Date) {
  const startDate = formatMiniSessionDate(startsAt);
  const endDate = formatMiniSessionDate(endsAt);
  const startTime = formatMiniSessionTime(startsAt);
  const endTime = formatMiniSessionTime(endsAt);

  if (startDate === endDate) {
    return `${startDate} · ${startTime}-${endTime}`;
  }

  return `${startDate} ${startTime} - ${endDate} ${endTime}`;
}

function CreateModeSwitch({
  currentTab,
  createMode
}: {
  currentTab: BookingHubTab;
  createMode: BookingCreateMode;
}) {
  return (
    <div className="rounded-md border border-ink/10 bg-white p-1 shadow-soft">
      <div className="grid grid-cols-2 gap-1">
        <Link
          href={hubHref(currentTab, "service", "new-booking")}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
            createMode === "service" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
          }`}
        >
          <BriefcaseBusiness size={15} />
          Állandó
        </Link>
        <Link
          href={hubHref(currentTab, "mini", "new-booking")}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
            createMode === "mini" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
          }`}
        >
          <CalendarClock size={15} />
          Mini nap
        </Link>
      </div>
    </div>
  );
}

function BookingHubTabs({
  currentTab,
  createMode
}: {
  currentTab: BookingHubTab;
  createMode: BookingCreateMode;
}) {
  return (
    <div className="mt-8 overflow-hidden rounded-md border border-ink/12 bg-white">
      <nav className="grid grid-cols-1 gap-0 border-b border-ink/10 bg-white sm:grid-cols-2 xl:grid-cols-5" aria-label="Időpontfoglaló fülek">
        {bookingHubTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.key;

          return (
            <Link
              key={tab.key}
              href={hubHref(tab.key, createMode)}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center gap-2 border-b border-ink/10 px-3 text-sm font-medium transition last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0 ${
                isActive
                  ? "border-b-2 border-b-ink/50 bg-paper text-ink ring-1 ring-ink/5 sm:border-b sm:border-r"
                  : "text-graphite hover:bg-ink/[0.04] hover:text-ink"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function ServiceCreateForm() {
  return (
    <form action={createMiniSessionAction} encType="multipart/form-data" className="mt-6 grid gap-5">
      <input type="hidden" name="bookingMode" value={MINI_SESSION_BOOKING_MODE_RECURRING} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-graphite">Szolgáltatás neve</span>
          <input name="title" required className={fieldClass} placeholder="pl. Íriszfotózás" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-graphite">Publikus slug</span>
          <input name="slug" className={fieldClass} placeholder="iriszfotozas" />
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
          <span className="text-sm font-medium text-graphite">Foglalható ettől</span>
          <input name="date" type="date" required className={fieldClass} />
        </label>
        <label className="block space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-graphite">Helyszín</span>
          <input name="location" required className={fieldClass} placeholder="Stúdió / cím" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-graphite">Alap kezdés</span>
          <input name="startTime" type="time" required defaultValue="10:00" className={fieldClass} />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-graphite">Alap zárás</span>
          <input name="endTime" type="time" required defaultValue="18:00" className={fieldClass} />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-graphite">Időtartam</span>
          <input name="durationMinutes" type="number" min="5" step="5" defaultValue="30" required className={fieldClass} />
        </label>
      </div>

      <section className="rounded-md border border-ink/10 bg-paper p-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h3 className="text-sm font-semibold text-ink">Heti elérhetőség</h3>
            <p className="mt-1 text-xs leading-5 text-graphite/65">
              Ezekből készül a publikus foglalási naptár. A globális naptárblokkolás minden napból automatikusan levonódik.
            </p>
          </div>
          <label className="block w-full space-y-2 md:w-48">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">Foglalási ablak</span>
            <input name="bookingWindowDays" type="number" min="7" max="180" step="1" defaultValue="60" className={fieldClass} />
          </label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

      <label className="block space-y-2">
        <span className="flex items-center gap-2 text-sm font-medium text-graphite">
          <ImageIcon size={15} />
          Borítókép az érkező oldalra
        </span>
        <input name="coverImage" type="file" accept="image/*" className={fileInputClass} />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">Megjegyzés a publikus oldalra</span>
        <textarea name="notes" className={textAreaClass} placeholder="Rövid leírás az ügyfeleknek." />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">Styling / előkészület</span>
        <textarea name="stylingNotes" className={textAreaClass} placeholder="pl. milyen ruhát, sminket, hangulatot javasolsz..." />
      </label>
      <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input name="isActive" type="checkbox" defaultChecked className="size-4 rounded border-ink/20" />
          Publikusan foglalható
        </label>
        <FormSubmitButton>Szolgáltatás létrehozása</FormSubmitButton>
      </div>
    </form>
  );
}

function MiniSessionCreateForm() {
  return (
    <form action={createMiniSessionAction} encType="multipart/form-data" className="mt-6 grid gap-5">
      <input type="hidden" name="bookingMode" value={MINI_SESSION_BOOKING_MODE_SINGLE_DAY} />
      <input type="hidden" name="bookingWindowDays" value="60" />
      <div className="grid gap-4 md:grid-cols-2">
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
          <span className="text-sm font-medium text-graphite">Dátum</span>
          <input name="date" type="date" required className={fieldClass} />
        </label>
        <label className="block space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-graphite">Helyszín</span>
          <input name="location" required className={fieldClass} placeholder="Helyszín" />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
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
      <label className="block space-y-2">
        <span className="flex items-center gap-2 text-sm font-medium text-graphite">
          <ImageIcon size={15} />
          Borítókép az érkező oldalra
        </span>
        <input name="coverImage" type="file" accept="image/*" className={fileInputClass} />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">Megjegyzés a publikus oldalra</span>
        <textarea name="notes" className={textAreaClass} placeholder="Opcionális rövid infó az ügyfeleknek." />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">Styling / előkészület</span>
        <textarea name="stylingNotes" className={textAreaClass} placeholder="pl. világos ruhák, natúr színek, kényelmes cipő..." />
      </label>
      <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input name="isActive" type="checkbox" defaultChecked className="size-4 rounded border-ink/20" />
          Publikusan foglalható
        </label>
        <FormSubmitButton>Mini session nap létrehozása</FormSubmitButton>
      </div>
    </form>
  );
}

export default async function AdminMiniSessionsPage({
  searchParams
}: {
  searchParams: Promise<{
    error?: string;
    deleted?: string;
    tab?: string;
    create?: string;
    calendarBlocked?: string;
    calendarDeleted?: string;
    calendarError?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const workspaceAdminId = ownerAdminId(admin);
  const flags = await searchParams;
  const currentTab = activeTab(flags.tab);
  const createMode = activeCreateMode(flags.create);
  const [sessions, calendarBlocks] = await Promise.all([
    prisma.miniSession.findMany({
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
    }),
    prisma.adminCalendarBlock.findMany({
      where: { adminId: workspaceAdminId },
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }]
    })
  ]);
  const sessionMetrics = new Map(
    await Promise.all(
      sessions.map(async (session) => {
        const slots = createMiniSessionSlots(session);
        const availableSlots = await getAvailableMiniSessionSlots(session);

        return [session.id, { slots, freeSlotCount: availableSlots.length }] as const;
      })
    )
  );
  const recurringServices = sessions.filter((session) => session.bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING);
  const miniSessionDays = sessions.filter((session) => session.bookingMode !== MINI_SESSION_BOOKING_MODE_RECURRING);
  const contactBookings = sessions
    .flatMap((session) =>
      session.bookings
        .filter((booking) => booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED)
        .map((booking) => ({ session, booking }))
    )
    .sort((a, b) => b.booking.startsAt.getTime() - a.booking.startsAt.getTime());
  const activeBookingCount = contactBookings.filter((item) => item.booking.status === MINI_SESSION_BOOKING_STATUS_BOOKED).length;
  const freeSlotCount = [...sessionMetrics.values()].reduce((total, metrics) => total + metrics.freeSlotCount, 0);
  const showServices = currentTab === "overview" || currentTab === "services";
  const showMiniDays = currentTab === "overview" || currentTab === "mini";
  const showBookings = currentTab === "overview" || currentTab === "bookings";

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Időpontfoglaló</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Foglalási központ</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">
            Állandó szolgáltatások, mini session napok, foglalások és globális naptárblokkolások egy helyen.
          </p>
        </div>
        <div className="w-full lg:w-[360px]">
          <p className="mb-2 text-xs uppercase tracking-[0.14em] text-graphite/55">Új foglaló típusa</p>
          <CreateModeSwitch currentTab={currentTab} createMode={createMode} />
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Link href={hubHref("services", createMode)} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft transition hover:border-ink/20">
          <p className="text-2xl font-semibold text-ink">{recurringServices.length}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55">
            <BriefcaseBusiness size={13} />
            Állandó szolgáltatás
          </p>
        </Link>
        <Link href={hubHref("mini", createMode)} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft transition hover:border-ink/20">
          <p className="text-2xl font-semibold text-ink">{miniSessionDays.length}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55">
            <CalendarClock size={13} />
            Mini session nap
          </p>
        </Link>
        <Link href={hubHref("bookings", createMode)} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft transition hover:border-ink/20">
          <p className="text-2xl font-semibold text-ink">{activeBookingCount}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55">
            <Users size={13} />
            Aktív foglalás
          </p>
        </Link>
        <Link href={hubHref("calendar", createMode)} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft transition hover:border-ink/20">
          <p className="text-2xl font-semibold text-ink">{calendarBlocks.length}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55">
            <Ban size={13} />
            Naptár tiltás
          </p>
        </Link>
        <Link href={hubHref("overview", createMode)} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft transition hover:border-ink/20">
          <p className="text-2xl font-semibold text-sage">{freeSlotCount}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55">
            <CheckCircle2 size={13} />
            Szabad idősáv
          </p>
        </Link>
      </div>

      <div className="mb-5 space-y-3">
        {flags.error === "missing" ? <Alert title="Hiányzó vagy hibás adat." variant="error" /> : null}
        {flags.error === "slug" ? <Alert title="Ez a publikus link már foglalt." variant="error">Adj meg egy egyedi slugot.</Alert> : null}
        {flags.error === "cover" ? <Alert title="A borítóképnek képfájlnak kell lennie." variant="error" /> : null}
        {flags.error === "cover_size" ? <Alert title="A borítókép túl nagy." variant="error">Maximum 12 MB-os képet tölts fel.</Alert> : null}
        {flags.error === "cover_upload" ? <Alert title="A borítókép feltöltése nem sikerült." variant="error">Próbáld újra egy kisebb JPG, PNG vagy WebP képpel.</Alert> : null}
        {flags.calendarError === "missing" ? <Alert title="Hibás naptár tiltás." variant="error">Adj meg érvényes kezdő és záró időpontot.</Alert> : null}
        {flags.deleted ? <Alert title="Foglaló törölve." variant="success" /> : null}
        {flags.calendarBlocked ? <Alert title="Naptár tiltás hozzáadva." variant="success">Az érintett idősávok egyik foglalóban sem lesznek elérhetők.</Alert> : null}
        {flags.calendarDeleted ? <Alert title="Naptár tiltás törölve." variant="success" /> : null}
      </div>

      <section id="new-booking" className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink text-white">
              {createMode === "service" ? <BriefcaseBusiness size={18} /> : <CalendarClock size={18} />}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-graphite/55">Új foglalási oldal</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                {createMode === "service" ? "Állandó szolgáltatás létrehozása" : "Mini session nap létrehozása"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-graphite/70">
                {createMode === "service"
                  ? "Mindig foglalható szolgáltatás heti elérhetőséggel, például íriszfotózás vagy portré."
                  : "Egyszeri, kampányszerű fotózási nap fix dátummal és idősávokkal."}
              </p>
            </div>
          </div>
          <Link
            href={hubHref("calendar", createMode)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5 sm:w-auto"
          >
            <CalendarDays size={15} />
            Naptár beállítások
          </Link>
        </div>

        {createMode === "service" ? <ServiceCreateForm /> : <MiniSessionCreateForm />}
      </section>

      <BookingHubTabs currentTab={currentTab} createMode={createMode} />

      <div className="mt-6 space-y-8">
        {sessions.length === 0 && currentTab !== "calendar" ? (
          <EmptyState
            icon={<CalendarClock size={22} />}
            title="Még nincs foglaló"
            description="Hozz létre állandó szolgáltatást vagy mini session napot, majd oszd meg a publikus linket."
          />
        ) : null}

        {[
          {
            id: "recurring-services",
            title: "Állandó szolgáltatások",
            description: "Mindig foglalható fotózások, saját heti elérhetőséggel.",
            icon: BriefcaseBusiness,
            items: recurringServices,
            visible: showServices
          },
          {
            id: "mini-session-days",
            title: "Mini session napok",
            description: "Egyszeri fotózási napok fix dátummal és idősávokkal.",
            icon: CalendarClock,
            items: miniSessionDays,
            visible: showMiniDays
          }
        ].map((group) => {
          const GroupIcon = group.icon;

          if (!group.visible) {
            return null;
          }

          if (group.items.length === 0) {
            return currentTab === "services" || currentTab === "mini" ? (
              <EmptyState
                key={group.id}
                icon={<GroupIcon size={22} />}
                title={`Még nincs ${group.title.toLowerCase()}`}
                description="A fenti teljes szélességű létrehozó panelből tudsz újat indítani."
              />
            ) : null;
          }

          return (
            <section key={group.id} id={group.id} className="space-y-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/60">
                    <GroupIcon size={15} />
                    {group.title}
                  </div>
                  <p className="mt-2 text-sm text-graphite/70">{group.description}</p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
                  {group.items.length} elem
                </span>
              </div>

              {group.items.map((session) => {
                const booked = session.bookings.filter((booking) => booking.status === MINI_SESSION_BOOKING_STATUS_BOOKED);
                const cancelled = session.bookings.filter((booking) => booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED);
                const metrics = sessionMetrics.get(session.id);
                const slots = metrics?.slots ?? [];
                const freeSessionSlotCount = metrics?.freeSlotCount ?? 0;
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
                        <p className="text-lg font-semibold text-sage">{freeSessionSlotCount}</p>
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
              })}
            </section>
          );
        })}

        {showBookings ? (
          <section id="bookings" className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/60">
                  <ListChecks size={15} />
                  Foglalások
                </div>
                <h2 className="mt-2 text-lg font-semibold text-ink">Legutóbbi foglalások</h2>
              </div>
              <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
                {contactBookings.length} összesen
              </span>
            </div>

            {contactBookings.length === 0 ? (
              <p className="mt-5 rounded-md border border-dashed border-ink/15 bg-paper px-4 py-5 text-sm text-graphite/70">Még nincs ügyfélfoglalás.</p>
            ) : (
              <div className="mt-5 divide-y divide-ink/10 overflow-hidden rounded-md border border-ink/10">
                {contactBookings.slice(0, currentTab === "bookings" ? 50 : 8).map(({ session, booking }) => (
                  <Link
                    key={booking.id}
                    href={`/admin/mini-sessions/${session.id}?tab=bookings`}
                    className="grid gap-2 bg-white px-4 py-3 transition hover:bg-paper sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{booking.name}</p>
                      <p className="mt-1 truncate text-xs text-graphite/60">{session.title}</p>
                    </div>
                    <p className="text-sm text-graphite/75">{formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt)}</p>
                    <span className={`w-fit rounded-full px-2 py-1 text-[11px] font-medium ${
                      booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED ? "bg-red-50 text-red-700" : "bg-sage/10 text-sage"
                    }`}>
                      {booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED ? "Törölt" : "Aktív"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {currentTab === "calendar" ? (
          <section id="calendar-settings" className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/60">
                  <CalendarDays size={15} />
                  Naptár beállítások
                </div>
                <h2 className="mt-2 text-lg font-semibold text-ink">Globális blokkolt időszakok</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
                  Ha itt kiveszel egy napot, hetet vagy időszakot, az minden állandó szolgáltatásból és mini session foglalóból kiesik.
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
                {calendarBlocks.length} aktív szabály
              </span>
            </div>

            <form action={createAdminCalendarBlockAction} className="mt-6 grid gap-4 rounded-md border border-ink/10 bg-paper p-4 lg:grid-cols-2">
              <label className="block space-y-2 lg:col-span-2">
                <span className="text-sm font-medium text-graphite">Megnevezés</span>
                <input name="title" className={fieldClass} placeholder="pl. Nyaralás, esküvő, zárt nap" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Kezdő dátum</span>
                <input name="startDate" type="date" required className={fieldClass} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Záró dátum</span>
                <input name="endDate" type="date" className={fieldClass} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Mettől</span>
                <input name="startTime" type="time" defaultValue="00:00" className={fieldClass} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Meddig</span>
                <input name="endTime" type="time" defaultValue="23:59" className={fieldClass} />
              </label>
              <label className="block space-y-2 lg:col-span-2">
                <span className="text-sm font-medium text-graphite">Megjegyzés</span>
                <textarea name="notes" className={textAreaClass} placeholder="Belső megjegyzés, például miért nem foglalható ez az időszak." />
              </label>
              <div className="flex flex-col gap-3 border-t border-ink/10 pt-4 sm:flex-row sm:items-center lg:col-span-2">
                <FormSubmitButton>
                  <Plus size={15} />
                  Tiltás hozzáadása
                </FormSubmitButton>
                <p className="text-xs leading-5 text-graphite/60">Többnapos tiltásnál elég a kezdő és záró dátumot megadni.</p>
              </div>
            </form>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-ink">Jelenlegi tiltások</h3>
              {calendarBlocks.length === 0 ? (
                <p className="mt-3 rounded-md border border-dashed border-ink/15 bg-paper px-4 py-5 text-sm text-graphite/70">
                  Nincs globálisan blokkolt időszak.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-md border border-ink/10">
                  {calendarBlocks.map((block) => (
                    <div key={block.id} className="grid gap-3 bg-white px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{block.title}</p>
                        <p className="mt-1 text-sm text-graphite/70">{formatCalendarBlockRange(block.startsAt, block.endsAt)}</p>
                        {block.notes ? <p className="mt-1 text-xs leading-5 text-graphite/60">{block.notes}</p> : null}
                      </div>
                      <form action={deleteAdminCalendarBlockAction.bind(null, block.id)}>
                        <ConfirmSubmitButton
                          variant="danger"
                          message="Biztosan törlöd ezt a naptár tiltást? Az érintett időpontok újra foglalhatók lesznek."
                          className="h-9 w-full px-3 text-xs md:w-auto"
                        >
                          Törlés
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {currentTab === "overview" ? (
          <section id="availability" className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/60">
              <CheckCircle2 size={15} />
              Elérhetőség
            </div>
            <h2 className="mt-2 text-lg font-semibold text-ink">Naptár és szabad idősávok</h2>
            <p className="mt-2 text-sm leading-6 text-graphite/70">
              A szabad idősávok automatikusan levonják a már foglalt mini session időpontokat, az állandó szolgáltatás foglalásait, az ügyfélprojektek időpontjait és a globális naptár beállításokban tiltott időszakokat.
            </p>
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
