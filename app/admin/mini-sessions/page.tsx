import {
  ArrowRight,
  Ban,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ListChecks,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  PlugZap,
  Plus,
  Repeat2,
  Settings2,
  Users,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";
import { Alert } from "@/components/alert";
import { AdminCalendarBlockPicker } from "@/components/admin-calendar-block-picker";
import { AdminCalendarBlockScopeForm } from "@/components/admin-calendar-block-scope-form";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MiniSessionCoverUploadBox } from "@/components/mini-session-cover-upload-box";
import { MiniSessionEventDaysField } from "@/components/mini-session-event-days-field";
import { MiniSessionBookingFilters } from "@/components/mini-session-booking-filters";
import { adminOwnedWhere, ownerAdminId } from "@/lib/admin-scope";
import { adminCalendarBlockAppliesToSession, adminCalendarBlockScopeLabel } from "@/lib/admin-calendar-blocks";
import { requireAdmin } from "@/lib/auth";
import { getAvailableMiniSessionSlots } from "@/lib/mini-session-availability";
import {
  createMiniSessionAction,
  deleteAdminCalendarBlockAction,
  updateMiniSessionBookingStatusAction
} from "@/lib/mini-session-actions";
import {
  formatMiniSessionDate,
  formatMiniSessionEventSchedule,
  formatMiniSessionTime,
  MINI_SESSION_BOOKING_MODE_RECURRING,
  MINI_SESSION_BOOKING_MODE_SINGLE_DAY,
  formatMiniSessionSlotWithDate,
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_SOURCE_CLIENT,
  MINI_SESSION_BOOKING_SOURCE_MANUAL,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_COMPLETED,
  MINI_SESSION_BOOKING_STATUS_NO_SHOW,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  MINI_SESSION_LANGUAGES,
  MINI_SESSION_THEMES,
  MINI_SESSION_MIN_BOOKING_NOTICE_OPTIONS,
  MINI_SESSION_WEEKDAYS,
  miniSessionDateKey,
  miniSessionTimeInput
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";
import { IRIS_FULFILLMENT_MODE } from "@/lib/iris-retouch-auth";
import { deriveMiniSessionWorkflowStage, miniSessionWorkflowStageLabel } from "@/lib/mini-session-workflow";

type BookingHubTab = "overview" | "create" | "services" | "mini" | "bookings" | "calendar";
type BookingCreateMode = "service" | "mini";
type BookingCategory = "iris" | "services" | "mini";

const fieldClass =
  "h-12 w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";
const textAreaClass =
  "min-h-24 w-full min-w-0 rounded-md border border-ink/15 bg-paper px-3 py-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";

function activeTab(value: string | undefined): BookingHubTab {
  if (value === "create" || value === "services" || value === "mini" || value === "bookings" || value === "calendar") {
    return value;
  }

  return "overview";
}

function activeCreateMode(value: string | undefined): BookingCreateMode {
  return value === "mini" ? "mini" : "service";
}

function activeCategory(value: string | undefined): BookingCategory | null {
  if (value === "iris" || value === "services" || value === "mini") {
    return value;
  }

  return null;
}

function categoryHref(category: BookingCategory) {
  return `/admin/mini-sessions?category=${category}`;
}

function isIrisSession(session: { fulfillmentMode: string | null; title: string; slug: string }) {
  const searchable = `${session.title} ${session.slug}`.toLocaleLowerCase("de-AT");

  return session.fulfillmentMode === IRIS_FULFILLMENT_MODE || searchable.includes("iris");
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


function miniSessionBookingStatusLabel(status: string) {
  if (status === MINI_SESSION_BOOKING_STATUS_CANCELLED) {
    return "Törölt";
  }

  if (status === MINI_SESSION_BOOKING_STATUS_COMPLETED) {
    return "Kész";
  }

  if (status === MINI_SESSION_BOOKING_STATUS_NO_SHOW) {
    return "Nem jelent meg";
  }

  return "Aktív";
}

function miniSessionBookingStatusClass(status: string) {
  if (status === MINI_SESSION_BOOKING_STATUS_CANCELLED) {
    return "bg-red-50 text-red-700";
  }

  if (status === MINI_SESSION_BOOKING_STATUS_COMPLETED) {
    return "bg-sage/10 text-sage";
  }

  if (status === MINI_SESSION_BOOKING_STATUS_NO_SHOW) {
    return "bg-brass/10 text-brass";
  }

  return "bg-ink/5 text-graphite";
}

function calendarBlockStatus(block: { startsAt: Date; endsAt: Date }, now: Date) {
  if (block.endsAt < now) {
    return "Lejárt";
  }

  if (block.startsAt <= now && block.endsAt >= now) {
    return "Most aktív";
  }

  return "Jövőbeni";
}

function calendarBlockStatusClass(block: { startsAt: Date; endsAt: Date }, now: Date) {
  if (block.endsAt < now) {
    return "bg-ink/5 text-graphite";
  }

  if (block.startsAt <= now && block.endsAt >= now) {
    return "bg-red-50 text-red-700";
  }

  return "bg-sage/10 text-sage";
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

function MinBookingNoticeSelect({ defaultValue = 0 }: { defaultValue?: number }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-graphite">Minimum előfoglalás</span>
      <select name="minBookingNoticeMinutes" defaultValue={defaultValue} className={fieldClass}>
        {MINI_SESSION_MIN_BOOKING_NOTICE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.labelHu}
          </option>
        ))}
      </select>
      <span className="block text-xs leading-5 text-graphite/60">
        Ennyivel a kívánt időpont előtt lehet legkésőbb foglalni.
      </span>
    </label>
  );
}

function IrisMomentTagField({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-brass/30 bg-brass/10 px-4 py-4 text-sm text-graphite md:col-span-2">
      <input
        name="irisRetouchTag"
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 rounded border-ink/20"
      />
      <span>
        <span className="flex flex-wrap items-center gap-2 font-medium text-ink">
          irismoment
          <span className="rounded-full bg-brass px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">Írisz</span>
        </span>
        <span className="mt-1 block leading-5 text-graphite/65">
          A címkével ez a foglaló megjelenik az irismoment alkalmazásban. Nem készül hozzá Spetly-ügyfél, válogatás vagy galéria.
        </span>
      </span>
    </label>
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
            <span className="text-sm font-medium text-graphite">Foglaló sablon</span>
            <select name="publicTheme" defaultValue="default" className={fieldClass}>
              {MINI_SESSION_THEMES.map((theme) => (
                <option key={theme.value} value={theme.value}>
                  {theme.label}
                </option>
              ))}
            </select>
          </label>
          <IrisMomentTagField defaultChecked />
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
          <div className="grid gap-4 md:grid-cols-5">
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
            <MinBookingNoticeSelect />
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
        title="Utómunka-folyamat"
        description="Kapcsold be, ha a foglalást válogatás, utómunka és kész galéria követi. Egyszerű szolgáltatásnál, például íriszfotózásnál hagyd kikapcsolva."
      >
        <label className="flex items-start gap-3 rounded-md border border-ink/10 bg-paper px-4 py-4 text-sm text-graphite">
          <input name="postProductionWorkflowEnabled" type="checkbox" className="mt-0.5 size-4 rounded border-ink/20" />
          <span>
            <span className="block font-medium text-ink">Válogatás és galériaátadás használata</span>
            <span className="mt-1 block leading-5 text-graphite/65">Bekapcsolva ügyfél és projekt is készül, és megjelenik a teljes folyamatvonal. Kikapcsolva csak az időpontfoglalás marad.</span>
          </span>
        </label>
      </CreateSettingsSection>

      <CreateSettingsSection
        title="Publikus oldal"
        description="A borítókép és a szövegek a vendégeknek látható landing page-re kerülnek."
      >
        <div className="grid gap-4">
          <MiniSessionCoverUploadBox helperText="Válassz képet, töltsd fel, és az előnézet után a szolgáltatás ezzel a borítóval jön létre." />
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
        description="A név, a külön kiválasztott foglalható napok és a helyszín alapján készül a publikus mini session oldal."
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
            <span className="text-sm font-medium text-graphite">Foglaló sablon</span>
            <select name="publicTheme" defaultValue="default" className={fieldClass}>
              {MINI_SESSION_THEMES.map((theme) => (
                <option key={theme.value} value={theme.value}>
                  {theme.label}
                </option>
              ))}
            </select>
          </label>
          <IrisMomentTagField />
          <MiniSessionEventDaysField />
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-graphite">Helyszín</span>
            <input name="location" required className={fieldClass} placeholder="Helyszín" />
          </label>
        </div>
      </CreateSettingsSection>

      <CreateSettingsSection
        title="Idősávok"
        description="A napoknál megadott egyedi kezdés és zárás, valamint az időtartam alapján generálódnak a foglalható időpontok."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Időtartam / foglalás</span>
            <input name="durationMinutes" type="number" min="5" step="5" defaultValue="20" required className={fieldClass} />
          </label>
          <MinBookingNoticeSelect />
        </div>
      </CreateSettingsSection>

      <CreateSettingsSection
        title="Utómunka-folyamat"
        description="Mini shootingnál kapcsold be: a foglalás után ügyfél, válogatás, utómunka és kész galéria következik."
      >
        <label className="flex items-start gap-3 rounded-md border border-ink/10 bg-paper px-4 py-4 text-sm text-graphite">
          <input name="postProductionWorkflowEnabled" type="checkbox" defaultChecked className="mt-0.5 size-4 rounded border-ink/20" />
          <span>
            <span className="block font-medium text-ink">Válogatás és galériaátadás használata</span>
            <span className="mt-1 block leading-5 text-graphite/65">Bekapcsolva automatikusan ügyfél és projekt készül. Kikapcsolva a foglalás nem kerül az ügyféllistába, és nem kap utómunka-folyamatot.</span>
          </span>
        </label>
      </CreateSettingsSection>

      <CreateSettingsSection
        title="Publikus oldal"
        description="Itt állíthatod be, mit lásson a vendég a foglalási landing page-en."
      >
        <div className="grid gap-4">
          <MiniSessionCoverUploadBox helperText="Válassz képet, töltsd fel, és az előnézet után a mini session ezzel a borítóval jön létre." />
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
    category?: string;
    create?: string;
    calendarBlocked?: string;
    calendarDeleted?: string;
    calendarError?: string;
    calendarUpdated?: string;
    bookingStatusUpdated?: string;
    bookingStatusError?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const workspaceAdminId = ownerAdminId(admin);
  const flags = await searchParams;
  const currentTab = activeTab(flags.tab);
  const selectedCategory = activeCategory(flags.category)
    ?? (currentTab === "services" ? "services" : currentTab === "mini" ? "mini" : null);
  const createMode = activeCreateMode(flags.create);
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const [sessions, calendarBlocks] = await Promise.all([
    prisma.miniSession.findMany({
      where: adminOwnedWhere(admin),
      orderBy: [{ startsAt: "desc" }],
      include: {
        availabilityRules: {
          orderBy: [{ weekday: "asc" }, { startsAt: "asc" }]
        },
        eventDays: {
          orderBy: { date: "asc" }
        },
        bookings: {
          orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
          include: {
            proofingGallery: {
              select: { proofingInviteSentAt: true, proofingStatus: true }
            },
            finalGallery: {
              select: { finalDeliveryEmailSentAt: true }
            }
          }
        }
      }
    }),
    prisma.adminCalendarBlock.findMany({
      where: { adminId: workspaceAdminId },
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      include: {
        targets: {
          include: {
            miniSession: { select: { id: true, title: true, bookingMode: true } }
          }
        }
      }
    })
  ]);
  const irisSessions = sessions.filter(isIrisSession);
  const recurringServices = sessions.filter(
    (session) => !isIrisSession(session) && session.bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING
  );
  const miniSessionDays = sessions.filter(
    (session) => !isIrisSession(session) && session.bookingMode !== MINI_SESSION_BOOKING_MODE_RECURRING
  );
  const sessionsForMetrics = selectedCategory === "iris"
    ? irisSessions
    : selectedCategory === "services"
      ? recurringServices
      : selectedCategory === "mini"
        ? miniSessionDays
        : [];
  const sessionMetricEntries = await Promise.all(
    sessionsForMetrics.map(async (session) => {
      const availableSlots = await getAvailableMiniSessionSlots(session);

      return [session.id, { freeSlotCount: availableSlots.length }] as const;
    })
  );
  const sessionMetrics = new Map(sessionMetricEntries);
  const contactBookings = sessions
    .flatMap((session) =>
      session.bookings
        .filter((booking) => booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED)
        .map((booking) => ({ session, booking }))
    )
    .sort((a, b) => b.booking.startsAt.getTime() - a.booking.startsAt.getTime());
  const activeBookings = contactBookings.filter((item) => item.booking.status === MINI_SESSION_BOOKING_STATUS_BOOKED);
  const completedBookings = contactBookings.filter((item) => item.booking.status === MINI_SESSION_BOOKING_STATUS_COMPLETED);
  const noShowBookings = contactBookings.filter((item) => item.booking.status === MINI_SESSION_BOOKING_STATUS_NO_SHOW);
  const cancelledBookings = contactBookings.filter((item) => item.booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED);
  const clientBookings = contactBookings.filter((item) => item.booking.source === MINI_SESSION_BOOKING_SOURCE_CLIENT);
  const manualBookings = contactBookings.filter((item) => item.booking.source === MINI_SESSION_BOOKING_SOURCE_MANUAL);
  const activeAttendeeCount = activeBookings.reduce((total, item) => total + item.booking.attendeeCount, 0);
  const uniqueContactCount = new Set(contactBookings.map((item) => item.booking.email.toLowerCase())).size;
  const activeCalendarBlocks = calendarBlocks.filter((block) => block.endsAt >= now);
  const todayCalendarBlocks = calendarBlocks.filter((block) => block.startsAt < tomorrow && block.endsAt > today);
  const expiredCalendarBlocks = calendarBlocks.filter((block) => block.endsAt < now);
  const nextCalendarBlock = activeCalendarBlocks.find((block) => block.startsAt >= today) ?? activeCalendarBlocks[0] ?? null;
  const affectedSessionCount = new Set(activeCalendarBlocks.flatMap((block) =>
    sessions
      .filter((session) => adminCalendarBlockAppliesToSession(block, session))
      .map((session) => session.id)
  )).size;
  const categoryDefinitions: Array<{
    key: BookingCategory;
    title: string;
    description: string;
    icon: LucideIcon;
    sessions: typeof sessions;
    createMode: BookingCreateMode;
  }> = [
    {
      key: "iris",
      title: "Íriszfotózás városonként",
      description: "A grazi állandó szolgáltatás és az íriszfotós roadshow-helyszínek egy helyen.",
      icon: MapPinned,
      sessions: irisSessions,
      createMode: "service"
    },
    {
      key: "services",
      title: "Állandó szolgáltatások",
      description: "Hetente ismétlődő, folyamatosan foglalható egyéb szolgáltatások.",
      icon: Repeat2,
      sessions: recurringServices,
      createMode: "service"
    },
    {
      key: "mini",
      title: "Mini fotózás napok",
      description: "Egyszeri, dátumhoz kötött fotózási események az íriszroadshow-kon kívül.",
      icon: CalendarDays,
      sessions: miniSessionDays,
      createMode: "mini"
    }
  ];
  const selectedCategoryDefinition = selectedCategory
    ? categoryDefinitions.find((category) => category.key === selectedCategory) ?? null
    : null;
  const SelectedCategoryIcon = selectedCategoryDefinition?.icon ?? CalendarClock;
  const nextEventSession = sessions
    .filter((session) => session.bookingMode !== MINI_SESSION_BOOKING_MODE_RECURRING && session.endsAt >= now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null;
  const showBookings = currentTab === "bookings";

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Időpontfoglaló</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Foglalási központ</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">
            Válassz kategóriát, majd kezeld annak foglalóit, időpontjait és beállításait.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={hubHref("bookings", createMode)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5">
            <Users size={15} /> Összes foglalás
          </Link>
          <Link href={hubHref("calendar", createMode)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5">
            <CalendarDays size={15} /> Naptár
          </Link>
          <Link href={hubHref("create", "service")} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite">
            <Plus size={15} /> Új foglaló
          </Link>
        </div>
      </div>

      <div className="mb-5 space-y-3">
        {flags.error === "missing" ? <Alert title="Hiányzó vagy hibás adat." variant="error" /> : null}
        {flags.error === "slug" ? <Alert title="Ez a publikus link már foglalt." variant="error">Adj meg egy egyedi slugot.</Alert> : null}
        {flags.error === "cover" ? <Alert title="A borítóképnek képfájlnak kell lennie." variant="error" /> : null}
        {flags.error === "cover_size" ? <Alert title="A borítókép túl nagy." variant="error">Maximum 12 MB-os képet tölts fel.</Alert> : null}
        {flags.error === "cover_upload" ? <Alert title="A borítókép feltöltése nem sikerült." variant="error">Próbáld újra egy kisebb JPG, PNG vagy WebP képpel.</Alert> : null}
        {flags.calendarError === "missing" ? <Alert title="Hibás naptár tiltás." variant="error">Jelölj ki legalább egy jövőbeni napot a naptárban.</Alert> : null}
        {flags.calendarError === "already-blocked" ? <Alert title="Ez az időszak már tiltva van." variant="error">Válassz másik napot vagy idősávot, illetve töröld a meglévő tiltást a listából.</Alert> : null}
        {flags.calendarError === "invalid-time" ? <Alert title="Hibás idősáv." variant="error">A záró időpontnak később kell lennie a kezdő időpontnál.</Alert> : null}
        {flags.calendarError === "targets" ? <Alert title="Nincs kiválasztott foglaló." variant="error">Jelölj ki legalább egy olyan foglalót, amelyre a tiltás vonatkozzon.</Alert> : null}
        {flags.bookingStatusError ? <Alert title="A foglalás állapota nem módosítható." variant="error">Törölt vagy blokkolt időpontnál nem lehet ezt az állapotot beállítani.</Alert> : null}
        {flags.bookingStatusUpdated ? <Alert title="Foglalás állapota frissítve." variant="success" /> : null}
        {flags.deleted ? <Alert title="Foglaló törölve." variant="success" /> : null}
        {flags.calendarBlocked ? <Alert title="Naptár tiltás hozzáadva." variant="success">Az érintett idősávok egyik foglalóban sem lesznek elérhetők.</Alert> : null}
        {flags.calendarDeleted ? <Alert title="Naptár tiltás törölve." variant="success" /> : null}
        {flags.calendarUpdated ? <Alert title="A naptártiltás hatóköre frissítve." variant="success" /> : null}
      </div>

      {currentTab === "overview" && !selectedCategoryDefinition ? (
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-brass">Foglalható kategóriák</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Mit szeretnél kezelni?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
              Először válassz kategóriát. A foglalók, időpontok és beállítások csak a kiválasztott területen jelennek meg.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {categoryDefinitions.map((category) => {
              const CategoryIcon = category.icon;
              const bookingCount = category.sessions.reduce(
                (total, session) => total + session.bookings.filter((booking) => booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED).length,
                0
              );
              const activeCount = category.sessions.filter((session) => session.isActive).length;

              return (
                <Link
                  key={category.key}
                  href={categoryHref(category.key)}
                  className="group relative flex min-h-64 flex-col rounded-lg border border-ink/10 bg-white p-5 shadow-soft transition hover:border-brass/50 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-11 items-center justify-center rounded-md bg-brass/10 text-brass">
                      <CategoryIcon size={20} />
                    </span>
                    <ArrowRight size={18} className="text-graphite/40 transition group-hover:translate-x-1 group-hover:text-brass" />
                  </div>
                  <div className="mt-auto pt-8">
                    <h3 className="text-lg font-semibold text-ink">{category.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-graphite/65">{category.description}</p>
                    <p className="mt-4 text-xs font-medium text-graphite/60">
                      {category.sessions.length} foglaló · {activeCount} aktív · {bookingCount} ügyfélfoglalás
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {nextEventSession ? (
            <section className="grid gap-4 rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center">
              <div className="rounded-md bg-paper px-3 py-3 text-center">
                <p className="text-sm font-semibold text-ink">{formatMiniSessionDate(nextEventSession.startsAt)}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-graphite/55">Következő esemény</p>
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-ink">{nextEventSession.title}</h3>
                <p className="mt-1 text-sm text-graphite/65">
                  {formatMiniSessionEventSchedule(nextEventSession.eventDays, nextEventSession.startsAt, nextEventSession.endsAt)} · {nextEventSession.location}
                </p>
              </div>
              <Link href={`/admin/mini-sessions/${nextEventSession.id}?tab=bookings`} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 px-4 text-sm font-medium text-ink transition hover:bg-ink/5">
                Megnyitás <ArrowRight size={14} />
              </Link>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-5">
            <Link href="/admin/mini-sessions/irismoment" className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5">
              <PlugZap size={14} /> irismoment kapcsolat
            </Link>
            <Link href={hubHref("calendar", createMode)} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5">
              <Ban size={14} /> Globális naptárblokkolások
            </Link>
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
        {selectedCategoryDefinition && (currentTab === "overview" || currentTab === "services" || currentTab === "mini") ? (
          <section className="space-y-5">
            <Link href="/admin/mini-sessions" className="inline-flex h-9 items-center gap-2 text-sm font-medium text-graphite transition hover:text-ink">
              <ArrowRight size={14} className="rotate-180" /> Vissza a kategóriákhoz
            </Link>

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-brass">
                  <SelectedCategoryIcon size={15} /> Kiválasztott kategória
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-ink">{selectedCategoryDefinition.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">{selectedCategoryDefinition.description}</p>
              </div>
              <Link href={hubHref("create", selectedCategoryDefinition.createMode)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite">
                <Plus size={15} /> Új foglaló ebben a kategóriában
              </Link>
            </div>

            {selectedCategoryDefinition.sessions.length === 0 ? (
              <EmptyState
                icon={<SelectedCategoryIcon size={22} />}
                title="Ebben a kategóriában még nincs foglaló"
                description="Hozz létre egy új foglalási oldalt. A többi kategória adatai változatlanok maradnak."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
                {selectedCategoryDefinition.sessions.map((session) => {
                  const metrics = sessionMetrics.get(session.id);
                  const activeSessionBookings = session.bookings.filter(
                    (booking) => booking.status === MINI_SESSION_BOOKING_STATUS_BOOKED && booking.source !== MINI_SESSION_BOOKING_SOURCE_BLOCKED
                  );
                  const isRecurring = session.bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING;

                  return (
                    <article key={session.id} className="grid gap-4 border-b border-ink/10 p-4 last:border-b-0 lg:grid-cols-[minmax(240px,1.4fr)_minmax(180px,.9fr)_130px_auto] lg:items-center">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-brass">
                          {isRecurring ? <Repeat2 size={17} /> : <MapPin size={17} />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-ink">{session.title}</h3>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${session.isActive ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"}`}>
                              {session.isActive ? "Aktív" : "Rejtett"}
                            </span>
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-graphite/65"><MapPin size={13} /> {session.location}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-[0.1em] text-graphite/50">Elérhetőség</p>
                        <p className="mt-1 text-sm text-ink">
                          {isRecurring
                            ? `${session.bookingWindowDays} napra előre foglalható`
                            : formatMiniSessionEventSchedule(session.eventDays, session.startsAt, session.endsAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-[0.1em] text-graphite/50">Foglalások</p>
                        <p className="mt-1 text-sm font-medium text-ink">{activeSessionBookings.length} aktív</p>
                        <p className="mt-1 text-xs text-graphite/55">{metrics?.freeSlotCount ?? 0} szabad idősáv</p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 lg:flex lg:justify-end">
                        <Link href={`/admin/mini-sessions/${session.id}?tab=bookings`} className="inline-flex h-9 items-center justify-center rounded-md border border-ink/10 px-3 text-xs font-medium text-ink transition hover:bg-ink/5">
                          Foglalók
                        </Link>
                        <Link href={`/admin/mini-sessions/${session.id}?tab=slots`} className="inline-flex h-9 items-center justify-center rounded-md border border-ink/10 px-3 text-xs font-medium text-ink transition hover:bg-ink/5">
                          Időpontok
                        </Link>
                        <Link href={`/admin/mini-sessions/${session.id}?tab=settings`} className="inline-flex h-9 items-center justify-center rounded-md bg-ink px-3 text-xs font-medium text-white transition hover:bg-graphite">
                          Beállítások
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

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

            <MiniSessionBookingFilters
              totalCount={contactBookings.length}
              activeCount={activeBookings.length}
              completedCount={completedBookings.length}
              noShowCount={noShowBookings.length}
              cancelledCount={cancelledBookings.length}
              clientCount={clientBookings.length}
              manualCount={manualBookings.length}
            />

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
                {contactBookings.map(({ session, booking }) => {
                  const slotLabel = formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt);
                  const isBooked = booking.status === MINI_SESSION_BOOKING_STATUS_BOOKED;
                  const isClosedStatus =
                    booking.status === MINI_SESSION_BOOKING_STATUS_COMPLETED ||
                    booking.status === MINI_SESSION_BOOKING_STATUS_NO_SHOW;
                  const canCloseBooking = isBooked && booking.endsAt <= now;
                  const searchText = [
                    booking.name,
                    booking.email,
                    booking.phone,
                    session.title,
                    session.slug,
                    slotLabel,
                    miniSessionBookingStatusLabel(booking.status)
                  ].join(" ").toLowerCase();

                  return (
                    <div
                      key={booking.id}
                      hidden={!isBooked}
                      data-mini-session-booking-item
                      data-mini-session-booking-record={booking.id}
                      data-mini-session-booking-status={booking.status}
                      data-mini-session-booking-source={booking.source}
                      data-mini-session-booking-search={searchText}
                      className={`${!isBooked ? "hidden" : ""} grid gap-3 bg-white px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.05fr)_minmax(0,1.1fr)_auto] md:items-center`}
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
                        <p className="text-sm text-graphite/75">{slotLabel}</p>
                        <p className="mt-1 truncate text-xs text-graphite/55">/mini-session/{session.slug}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {session.postProductionWorkflowEnabled ? (
                          <Link
                            href={`/admin/mini-sessions/${session.id}/bookings/${booking.id}`}
                            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-ink px-3 text-sm font-medium text-white transition hover:bg-graphite md:w-auto"
                          >
                            {miniSessionWorkflowStageLabel(deriveMiniSessionWorkflowStage(booking))}
                            <ArrowRight size={14} />
                          </Link>
                        ) : (
                          <span className="inline-flex h-9 w-full items-center justify-center rounded-md border border-ink/10 bg-paper px-3 text-sm font-medium text-graphite md:w-auto">
                            Egyszerű foglalás
                          </span>
                        )}
                        {canCloseBooking ? (
                          <>
                            <form action={updateMiniSessionBookingStatusAction.bind(null, booking.id)}>
                              <input type="hidden" name="returnScope" value="hub" />
                              <input type="hidden" name="status" value={MINI_SESSION_BOOKING_STATUS_COMPLETED} />
                              <FormSubmitButton variant="secondary" pendingLabel="..." className="h-9 px-3 text-sm">
                                <CheckCircle2 size={14} />
                                Kész
                              </FormSubmitButton>
                            </form>
                            <form action={updateMiniSessionBookingStatusAction.bind(null, booking.id)}>
                              <input type="hidden" name="returnScope" value="hub" />
                              <input type="hidden" name="status" value={MINI_SESSION_BOOKING_STATUS_NO_SHOW} />
                              <FormSubmitButton variant="secondary" pendingLabel="..." className="h-9 px-3 text-sm">
                                <Ban size={14} />
                                Nem jelent meg
                              </FormSubmitButton>
                            </form>
                          </>
                        ) : null}
                        {isClosedStatus ? (
                          <form action={updateMiniSessionBookingStatusAction.bind(null, booking.id)}>
                            <input type="hidden" name="returnScope" value="hub" />
                            <input type="hidden" name="status" value={MINI_SESSION_BOOKING_STATUS_BOOKED} />
                            <FormSubmitButton variant="secondary" pendingLabel="..." className="h-9 px-3 text-sm">
                              Aktívra
                            </FormSubmitButton>
                          </form>
                        ) : null}
                        <Link
                          href={`/admin/mini-sessions/${session.id}?tab=bookings`}
                          prefetch={false}
                          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink transition hover:bg-ink/5 md:w-auto"
                        >
                          <Settings2 size={14} />
                          Kezelés
                        </Link>
                      </div>
                    </div>
                  );
                })}
                <p
                  data-mini-session-booking-empty
                  hidden={activeBookings.length > 0}
                  className="bg-white px-4 py-5 text-sm text-graphite/70"
                >
                  Nincs a szűrésnek megfelelő foglalás.
                </p>
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
                <h2 className="mt-2 text-lg font-semibold text-ink">Foglalási tiltások</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
                  Tilts le egy napot vagy időszakot minden foglalóban, csak az állandó szolgáltatásokban vagy az általad kiválasztott oldalakon.
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
                {activeCalendarBlocks.length} aktív tiltás
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-md bg-paper px-3 py-3">
                <p className="text-lg font-semibold text-ink">{activeCalendarBlocks.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Aktív / jövőbeni</p>
              </div>
              <div className="rounded-md bg-paper px-3 py-3">
                <p className="text-lg font-semibold text-ink">{todayCalendarBlocks.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Ma érintett</p>
              </div>
              <div className="rounded-md bg-paper px-3 py-3">
                <p className="text-lg font-semibold text-ink">{affectedSessionCount}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Érintett foglaló</p>
              </div>
              <div className="rounded-md bg-paper px-3 py-3">
                <p className="truncate text-lg font-semibold text-ink">{nextCalendarBlock ? formatMiniSessionDate(nextCalendarBlock.startsAt) : "Nincs"}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-graphite/55">Következő tiltás</p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
              <AdminCalendarBlockPicker
                todayDate={miniSessionDateKey(now)}
                existingBlocks={calendarBlocks.map((block) => ({
                  id: block.id,
                  title: block.title,
                  startDate: miniSessionDateKey(block.startsAt),
                  endDate: miniSessionDateKey(block.endsAt),
                  startTime: miniSessionTimeInput(block.startsAt),
                  endTime: miniSessionTimeInput(block.endsAt),
                  scope: block.scope,
                  audienceLabel: adminCalendarBlockScopeLabel(block, block.targets.map((target) => target.miniSession.title))
                }))}
                sessions={sessions.map((session) => ({
                  id: session.id,
                  title: session.title,
                  bookingMode: session.bookingMode,
                  isActive: session.isActive
                }))}
              />

              <div>
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Tiltások listája</h3>
                    <p className="mt-1 text-xs leading-5 text-graphite/60">
                      {expiredCalendarBlocks.length > 0 ? `${expiredCalendarBlocks.length} lejárt tiltás is látszik, hogy visszakövethető maradjon.` : "Csak aktuális és jövőbeni tiltások vannak."}
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
                    {calendarBlocks.length} összesen
                  </span>
                </div>
                {calendarBlocks.length === 0 ? (
                  <p className="mt-3 rounded-md border border-dashed border-ink/15 bg-paper px-4 py-5 text-sm text-graphite/70">
                    Nincs globálisan blokkolt időszak.
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-md border border-ink/10">
                    {calendarBlocks.map((block) => (
                      <div key={block.id} className="grid gap-3 bg-white px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink">{block.title}</p>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${calendarBlockStatusClass(block, now)}`}>
                              {calendarBlockStatus(block, now)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-graphite/70">{formatCalendarBlockRange(block.startsAt, block.endsAt)}</p>
                          <p className="mt-1 text-xs font-medium text-brass">
                            {adminCalendarBlockScopeLabel(block, block.targets.map((target) => target.miniSession.title))}
                          </p>
                          {block.notes ? <p className="mt-1 text-xs leading-5 text-graphite/60">{block.notes}</p> : null}
                          {block.endsAt >= now ? (
                            <AdminCalendarBlockScopeForm
                              blockId={block.id}
                              currentScope={block.scope}
                              currentTargetIds={block.targets.map((target) => target.miniSessionId)}
                              sessions={sessions.map((session) => ({
                                id: session.id,
                                title: session.title,
                                bookingMode: session.bookingMode
                              }))}
                            />
                          ) : null}
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
            </div>
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
