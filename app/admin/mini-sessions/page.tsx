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
  Mail,
  MapPin,
  Phone,
  Plus,
  Settings2,
  Users,
  XCircle,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EmptyState } from "@/components/empty-state";
import { FormSubmitButton } from "@/components/form-submit-button";
import { adminOwnedWhere, ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { customerProjectTypeLabel } from "@/lib/customer-project-options";
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

type BookingHubTab = "overview" | "create" | "services" | "mini" | "bookings" | "calendar";
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
  { key: "create", label: "Létrehozás", icon: Plus },
  { key: "services", label: "Állandó szolgáltatások", icon: BriefcaseBusiness },
  { key: "mini", label: "Mini session napok", icon: CalendarClock },
  { key: "bookings", label: "Foglalások", icon: Users },
  { key: "calendar", label: "Naptár beállítások", icon: CalendarDays }
];

function activeTab(value: string | undefined): BookingHubTab {
  if (value === "create" || value === "services" || value === "mini" || value === "bookings" || value === "calendar") {
    return value;
  }

  return "overview";
}

function activeCreateMode(value: string | undefined): BookingCreateMode {
  return value === "mini" ? "mini" : "service";
}

function hubHref(tab: BookingHubTab, createMode: BookingCreateMode) {
  const params = new URLSearchParams();

  if (tab !== "overview") {
    params.set("tab", tab);
  }

  if (tab === "create" && createMode !== "service") {
    params.set("create", createMode);
  }

  const query = params.toString();

  return `/admin/mini-sessions${query ? `?${query}` : ""}`;
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

function startOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isInRange(date: Date, startsAt: Date, endsAt: Date) {
  return date >= startsAt && date < endsAt;
}

function formatProjectTime(project: { startTime: string | null; endTime: string | null }) {
  if (!project.startTime || !project.endTime) {
    return null;
  }

  return `${project.startTime}-${project.endTime}`;
}

function miniSessionBookingStatusLabel(status: string) {
  return status === MINI_SESSION_BOOKING_STATUS_CANCELLED ? "Törölt" : "Aktív";
}

function miniSessionBookingStatusClass(status: string) {
  return status === MINI_SESSION_BOOKING_STATUS_CANCELLED
    ? "bg-red-50 text-red-700"
    : "bg-sage/10 text-sage";
}

function CreateModeSwitch({ createMode }: { createMode: BookingCreateMode }) {
  return (
    <div className="rounded-md border border-ink/10 bg-white p-1 shadow-soft">
      <div className="grid grid-cols-2 gap-1">
        <Link
          href={hubHref("create", "service")}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
            createMode === "service" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
          }`}
        >
          <BriefcaseBusiness size={15} />
          Állandó
        </Link>
        <Link
          href={hubHref("create", "mini")}
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
    <div className="mb-6 overflow-hidden rounded-md border border-ink/12 bg-white">
      <nav className="grid grid-cols-1 gap-0 border-b border-ink/10 bg-white sm:grid-cols-2 xl:grid-cols-6" aria-label="Időpontfoglaló fülek">
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

function CreateSettingsSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-ink/10 pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4">
        <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-graphite/60">{title}</h4>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/70">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ServiceCreateForm() {
  return (
    <form action={createMiniSessionAction} encType="multipart/form-data" className="mt-6 space-y-6">
      <input type="hidden" name="bookingMode" value={MINI_SESSION_BOOKING_MODE_RECURRING} />
      <CreateSettingsSection
        title="Alapadatok"
        description="Ezek jelennek meg a publikus foglalási oldalon és az admin listákban."
      >
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
      </CreateSettingsSection>

      <CreateSettingsSection
        title="Foglalható időpontok"
        description="Az alap idősávokból és a heti elérhetőségből készül a vendégoldali naptár."
      >
        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-4">
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
            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Foglalási ablak</span>
              <input name="bookingWindowDays" type="number" min="7" max="180" step="1" defaultValue="60" className={fieldClass} />
            </label>
          </div>

          <section className="rounded-md border border-ink/10 bg-paper p-4">
            <h3 className="text-sm font-semibold text-ink">Heti elérhetőség</h3>
            <p className="mt-1 text-xs leading-5 text-graphite/65">
              A globális naptárblokkolás minden napból automatikusan levonódik.
            </p>
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
        </div>
      </CreateSettingsSection>

      <CreateSettingsSection
        title="Publikus oldal"
        description="A borítókép és a szövegek a vendégeknek látható landing page-re kerülnek."
      >
        <div className="grid gap-4">
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
        </div>
      </CreateSettingsSection>

      <CreateSettingsSection title="Publikálás">
        <div className="flex flex-col justify-between gap-4 rounded-md bg-paper px-4 py-4 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-graphite">
            <input name="isActive" type="checkbox" defaultChecked className="size-4 rounded border-ink/20" />
            Publikusan foglalható
          </label>
          <FormSubmitButton pendingLabel="Létrehozás...">Szolgáltatás létrehozása</FormSubmitButton>
        </div>
      </CreateSettingsSection>
    </form>
  );
}

function MiniSessionCreateForm() {
  return (
    <form action={createMiniSessionAction} encType="multipart/form-data" className="mt-6 space-y-6">
      <input type="hidden" name="bookingMode" value={MINI_SESSION_BOOKING_MODE_SINGLE_DAY} />
      <input type="hidden" name="bookingWindowDays" value="60" />
      <CreateSettingsSection
        title="Alapadatok"
        description="A név, dátum és helyszín alapján készül a publikus mini session oldal."
      >
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
      </CreateSettingsSection>

      <CreateSettingsSection
        title="Idősávok"
        description="A kezdés, zárás és időtartam alapján generálódnak a foglalható időpontok."
      >
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
      </CreateSettingsSection>

      <CreateSettingsSection
        title="Publikus oldal"
        description="Itt állíthatod be, mit lásson a vendég a foglalási landing page-en."
      >
        <div className="grid gap-4">
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
        </div>
      </CreateSettingsSection>

      <CreateSettingsSection title="Publikálás">
        <div className="flex flex-col justify-between gap-4 rounded-md bg-paper px-4 py-4 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-graphite">
            <input name="isActive" type="checkbox" defaultChecked className="size-4 rounded border-ink/20" />
            Publikusan foglalható
          </label>
          <FormSubmitButton pendingLabel="Létrehozás...">Mini session nap létrehozása</FormSubmitButton>
        </div>
      </CreateSettingsSection>
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
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const [sessions, calendarBlocks, weekProjects] = await Promise.all([
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
    }),
    prisma.customerProject.findMany({
      where: {
        eventDate: {
          gte: today,
          lt: weekEnd
        },
        status: { not: "archived" },
        customer: adminOwnedWhere(admin)
      },
      orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
      take: 12,
      select: {
        id: true,
        title: true,
        projectType: true,
        eventDate: true,
        startTime: true,
        endTime: true,
        venue: true,
        customer: {
          select: {
            id: true,
            coupleName: true
          }
        }
      }
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
  const freeSlotCount = [...sessionMetrics.values()].reduce((total, metrics) => total + metrics.freeSlotCount, 0);
  const activeBookings = contactBookings.filter((item) => item.booking.status === MINI_SESSION_BOOKING_STATUS_BOOKED);
  const cancelledBookings = contactBookings.filter((item) => item.booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED);
  const activeAttendeeCount = activeBookings.reduce((total, item) => total + item.booking.attendeeCount, 0);
  const uniqueContactCount = new Set(contactBookings.map((item) => item.booking.email.toLowerCase())).size;
  const upcomingBookings = activeBookings
    .filter((item) => item.booking.startsAt >= now)
    .sort((a, b) => a.booking.startsAt.getTime() - b.booking.startsAt.getTime());
  const todayBookingCount = activeBookings.filter((item) => isInRange(item.booking.startsAt, today, tomorrow)).length;
  const weekBookingCount = activeBookings.filter((item) => isInRange(item.booking.startsAt, today, weekEnd)).length;
  const todayProjectCount = weekProjects.filter((project) => project.eventDate && isInRange(project.eventDate, today, tomorrow)).length;
  const activeCalendarBlocks = calendarBlocks.filter((block) => block.endsAt >= now);
  const nextCalendarBlock = activeCalendarBlocks.find((block) => block.startsAt >= today) ?? activeCalendarBlocks[0] ?? null;
  const hasInactivePublicPages = sessions.some((session) => !session.isActive);
  const dashboardIssues = [
    freeSlotCount === 0 ? "Nincs szabad idősáv a jelenlegi foglalóknál." : null,
    nextCalendarBlock ? `Következő naptár tiltás: ${nextCalendarBlock.title} (${formatCalendarBlockRange(nextCalendarBlock.startsAt, nextCalendarBlock.endsAt)})` : null,
    hasInactivePublicPages ? "Van rejtett foglalási oldal, amit érdemes ellenőrizni." : null
  ].filter((issue): issue is string => Boolean(issue));
  const showServices = currentTab === "services";
  const showMiniDays = currentTab === "mini";
  const showBookings = currentTab === "bookings";

  return (
    <AdminShell>
      <div className="mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Időpontfoglaló</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Foglalási központ</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">
            Állandó szolgáltatások, mini session napok, foglalások és globális naptárblokkolások egy helyen.
          </p>
        </div>
      </div>

      <BookingHubTabs currentTab={currentTab} createMode={createMode} />

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

      {currentTab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Link href={hubHref("bookings", createMode)} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft transition hover:border-ink/20">
              <p className="truncate text-lg font-semibold text-ink">
                {upcomingBookings[0] ? formatMiniSessionDate(upcomingBookings[0].booking.startsAt) : "Nincs"}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55">
                <CalendarClock size={13} />
                Következő foglalás
              </p>
            </Link>
            <Link href={hubHref("bookings", createMode)} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft transition hover:border-ink/20">
              <p className="text-2xl font-semibold text-ink">{todayBookingCount + todayProjectCount}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55">
                <Users size={13} />
                Fotózás ma
              </p>
            </Link>
            <Link href={hubHref("bookings", createMode)} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft transition hover:border-ink/20">
              <p className="text-2xl font-semibold text-ink">{weekBookingCount + weekProjects.length}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55">
                <CalendarDays size={13} />
                Következő 7 nap
              </p>
            </Link>
            <Link href={hubHref("calendar", createMode)} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft transition hover:border-ink/20">
              <p className="text-2xl font-semibold text-ink">{activeCalendarBlocks.length}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55">
                <Ban size={13} />
                Aktív tiltás
              </p>
            </Link>
            <Link href={hubHref("services", createMode)} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft transition hover:border-ink/20">
              <p className="text-2xl font-semibold text-sage">{freeSlotCount}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-graphite/55">
                <CheckCircle2 size={13} />
                Szabad idősáv
              </p>
            </Link>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/60">
                    <ListChecks size={15} />
                    Mai fókusz
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-ink">Következő foglalások</h2>
                </div>
                <Link href={hubHref("bookings", createMode)} className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5">
                  <Users size={14} />
                  Összes foglalás
                </Link>
              </div>

              {upcomingBookings.length === 0 ? (
                <p className="mt-5 rounded-md border border-dashed border-ink/15 bg-paper px-4 py-5 text-sm text-graphite/70">
                  Nincs közelgő ügyfélfoglalás.
                </p>
              ) : (
                <div className="mt-5 divide-y divide-ink/10 overflow-hidden rounded-md border border-ink/10">
                  {upcomingBookings.slice(0, 5).map(({ session, booking }) => (
                    <Link
                      key={booking.id}
                      href={`/admin/mini-sessions/${session.id}?tab=bookings`}
                      className="grid gap-2 bg-white px-4 py-3 transition hover:bg-paper sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{booking.name}</p>
                        <p className="mt-1 truncate text-xs text-graphite/60">{session.title} · {booking.attendeeCount} fő</p>
                      </div>
                      <p className="text-sm text-graphite/75 sm:text-right">{formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-5">
              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/60">
                  <Plus size={15} />
                  Gyors műveletek
                </div>
                <div className="mt-4 grid gap-2">
                  <Link href={hubHref("create", "service")} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white transition hover:bg-graphite">
                    <BriefcaseBusiness size={15} />
                    Állandó fotózás
                  </Link>
                  <Link href={hubHref("create", "mini")} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5">
                    <CalendarClock size={15} />
                    Mini session nap
                  </Link>
                  <Link href={hubHref("calendar", createMode)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5">
                    <Ban size={15} />
                    Naptár tiltása
                  </Link>
                </div>
              </section>

              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/60">
                  <CheckCircle2 size={15} />
                  Állapot
                </div>
                {dashboardIssues.length === 0 ? (
                  <p className="mt-4 rounded-md bg-sage/10 px-3 py-3 text-sm leading-6 text-sage">
                    Minden rendben: van szabad idősáv, és nincs sürgős naptár figyelmeztetés.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {dashboardIssues.map((issue) => (
                      <p key={issue} className="rounded-md bg-paper px-3 py-3 text-sm leading-6 text-graphite/75">
                        {issue}
                      </p>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/60">
                  <CalendarDays size={15} />
                  Normál projektek
                </div>
                {weekProjects.length === 0 ? (
                  <p className="mt-4 text-sm leading-6 text-graphite/70">A következő 7 napban nincs ügyfélprojekt.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {weekProjects.slice(0, 4).map((project) => (
                      <Link key={project.id} href={`/admin/clients/${project.customer.id}?tab=projects`} className="block rounded-md border border-ink/10 px-3 py-3 transition hover:bg-paper">
                        <p className="truncate text-sm font-semibold text-ink">{project.title}</p>
                        <p className="mt-1 text-xs leading-5 text-graphite/65">
                          {project.eventDate ? formatMiniSessionDate(project.eventDate) : "Nincs dátum"} · {customerProjectTypeLabel(project.projectType)}
                          {formatProjectTime(project) ? ` · ${formatProjectTime(project)}` : ""}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      ) : null}

      {currentTab === "create" ? (
        <section id="new-booking" className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink text-white">
                {createMode === "service" ? <BriefcaseBusiness size={18} /> : <CalendarClock size={18} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-graphite/55">Új foglalási oldal</p>
                <h2 className="mt-1 text-xl font-semibold text-ink">Mit szeretnél létrehozni?</h2>
                <p className="mt-1 text-sm leading-6 text-graphite/70">
                  Válaszd ki, hogy egyszeri mini session napot vagy folyamatosan foglalható állandó fotózást indítasz.
                </p>
              </div>
            </div>
            <CreateModeSwitch createMode={createMode} />
          </div>

          <div className="mt-6 border-t border-ink/10 pt-5">
            <h3 className="text-lg font-semibold text-ink">
              {createMode === "service" ? "Állandó fotózás létrehozása" : "Mini session nap létrehozása"}
            </h3>
            <p className="mt-1 text-sm leading-6 text-graphite/70">
              {createMode === "service"
                ? "Mindig foglalható szolgáltatás heti elérhetőséggel, például íriszfotózás vagy portré."
                : "Egyszeri, kampányszerű fotózási nap fix dátummal és idősávokkal."}
            </p>
            {createMode === "service" ? <ServiceCreateForm /> : <MiniSessionCreateForm />}
          </div>
        </section>
      ) : null}

      <div className="mt-6 space-y-8">
        {sessions.length === 0 && currentTab !== "overview" && currentTab !== "calendar" && currentTab !== "create" ? (
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
                <h2 className="mt-2 text-lg font-semibold text-ink">Kontaktlista</h2>
                <p className="mt-1 text-sm leading-6 text-graphite/70">
                  Az összes mini session és állandó fotózás foglalója egy helyen, közvetlen elérhetőségekkel.
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
                {contactBookings.length} összesen
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-md bg-paper px-3 py-3">
                <p className="text-lg font-semibold text-ink">{activeBookings.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Aktív foglalás</p>
              </div>
              <div className="rounded-md bg-paper px-3 py-3">
                <p className="text-lg font-semibold text-ink">{uniqueContactCount}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Kapcsolat</p>
              </div>
              <div className="rounded-md bg-paper px-3 py-3">
                <p className="text-lg font-semibold text-ink">{activeAttendeeCount}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Érkező fő</p>
              </div>
              <div className="rounded-md bg-paper px-3 py-3">
                <p className="text-lg font-semibold text-graphite">{cancelledBookings.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Törölt</p>
              </div>
            </div>

            {contactBookings.length === 0 ? (
              <p className="mt-5 rounded-md border border-dashed border-ink/15 bg-paper px-4 py-5 text-sm text-graphite/70">Még nincs ügyfélfoglalás.</p>
            ) : (
              <div className="mt-5 divide-y divide-ink/10 overflow-hidden rounded-md border border-ink/10">
                <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.05fr)_minmax(0,1.1fr)_auto] gap-3 bg-paper px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-graphite/55 md:grid">
                  <span>Ügyfél</span>
                  <span>Elérhetőség</span>
                  <span>Időpont</span>
                  <span className="text-right">Művelet</span>
                </div>
                {contactBookings.map(({ session, booking }) => (
                  <div
                    key={booking.id}
                    className="grid gap-3 bg-white px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.05fr)_minmax(0,1.1fr)_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{booking.name}</p>
                        <span className={`w-fit rounded-full px-2 py-1 text-[11px] font-medium ${miniSessionBookingStatusClass(booking.status)}`}>
                          {miniSessionBookingStatusLabel(booking.status)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-graphite/60">{session.title}</p>
                      <p className="mt-1 text-xs text-graphite/60">{booking.attendeeCount} fő</p>
                    </div>
                    <div className="min-w-0 space-y-1 text-sm text-graphite/75">
                      <a className="flex min-w-0 items-center gap-2 hover:text-ink" href={`mailto:${booking.email}`}>
                        <Mail size={14} className="shrink-0" />
                        <span className="truncate">{booking.email}</span>
                      </a>
                      <a className="flex min-w-0 items-center gap-2 hover:text-ink" href={`tel:${booking.phone}`}>
                        <Phone size={14} className="shrink-0" />
                        <span className="truncate">{booking.phone}</span>
                      </a>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-graphite/75">{formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt)}</p>
                      <p className="mt-1 truncate text-xs text-graphite/55">/mini-session/{session.slug}</p>
                    </div>
                    <div className="flex gap-2 md:justify-end">
                      <Link
                        href={`/admin/mini-sessions/${session.id}?tab=bookings`}
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5 md:w-auto"
                      >
                        <Settings2 size={14} />
                        Kezelés
                      </Link>
                    </div>
                  </div>
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
      </div>
    </AdminShell>
  );
}
