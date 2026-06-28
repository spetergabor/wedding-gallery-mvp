import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Film,
  FolderKanban,
  Heart,
  ImagePlus,
  ListChecks,
  Mail,
  MessageSquare,
  ReceiptText
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { ButtonLink } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { LeadPipelineBoard } from "@/components/lead-pipeline-board";
import { ViewLocationMap } from "@/components/view-location-map";
import { adminOwnedWhere, notificationWhere } from "@/lib/admin-scope";
import { dateLocaleForAdmin, getAdminLanguage, type AdminLanguage } from "@/lib/admin-language";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createViewLocationPoints } from "@/lib/view-location-points";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { customerProjectStatusLabel, customerProjectTypeLabel } from "@/lib/customer-project-options";
import { ensureLeadPipelineSchema, leadEventTypeLabel, leadStatusLabel, normalizeLeadStatus } from "@/lib/leads";
import {
  GALLERY_MODE_PROOFING,
  PHOTO_DELIVERY_STAGE_FINAL,
  PROOFING_STATUS_DELIVERED,
  PROOFING_STATUS_IN_PROGRESS,
  PROOFING_STATUS_NOT_OPENED,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED,
  proofingStatusLabel
} from "@/lib/proofing";

type DashboardTaskPriority = "high" | "medium" | "low";
type DashboardCalendarKind = "task" | "event" | "activity";
type DashboardCalendarTone = "danger" | "brass" | "sage" | "ink";

type DashboardTask = {
  key: string;
  title: string;
  detail: string;
  href: string;
  label: string;
  priority: DashboardTaskPriority;
  icon: LucideIcon;
  createdAt: Date;
};

type DashboardCalendarEvent = {
  key: string;
  date: Date;
  title: string;
  detail: string;
  href: string;
  label: string;
  kind: DashboardCalendarKind;
  tone: DashboardCalendarTone;
  icon: LucideIcon;
};

type DashboardAlbumComment = {
  text: string;
  createdAt: Date;
  spread: {
    review: {
      id: string;
      title: string;
      customer: {
        id: string;
        coupleName: string;
      };
    };
  };
};

type DashboardAlbumSpreadApproval = {
  id: string;
  approvedAt: Date | null;
  review: {
    id: string;
    title: string;
    customer: {
      id: string;
      coupleName: string;
    };
  };
};

type DashboardStat = {
  label: string;
  value: string | number;
  detail: string;
};

const sectionMetaClass = "flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-brass";
const sectionTitleClass = "text-base font-semibold text-ink";

function formatStorageSize(bytes: number) {
  if (bytes <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function formatDate(date: Date | null, language: AdminLanguage) {
  if (!date) {
    return language === "de" ? "Kein Datum" : "Nincs dátum";
  }

  return date.toLocaleDateString(dateLocaleForAdmin(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatShortCalendarDate(date: Date, language: AdminLanguage) {
  return date.toLocaleDateString(dateLocaleForAdmin(language), {
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function formatWeekday(date: Date, language: AdminLanguage) {
  return date.toLocaleDateString(dateLocaleForAdmin(language), {
    weekday: "short",
    timeZone: APP_TIME_ZONE
  });
}

function taskPriorityClass(priority: DashboardTaskPriority) {
  if (priority === "high") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (priority === "medium") {
    return "bg-brass/10 text-brass ring-brass/25";
  }

  return "bg-ink/[0.05] text-graphite ring-ink/10";
}

function taskIconClass(priority: DashboardTaskPriority) {
  if (priority === "high") {
    return "bg-red-50 text-red-700";
  }

  if (priority === "medium") {
    return "bg-brass/10 text-brass";
  }

  return "bg-paper text-graphite";
}

function calendarToneClass(tone: DashboardCalendarTone) {
  if (tone === "danger") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (tone === "brass") {
    return "bg-brass/10 text-brass ring-brass/25";
  }

  if (tone === "sage") {
    return "bg-sage/12 text-sage ring-sage/25";
  }

  return "bg-ink/[0.05] text-graphite ring-ink/10";
}

function calendarDotClass(tone: DashboardCalendarTone) {
  if (tone === "danger") {
    return "bg-red-500";
  }

  if (tone === "brass") {
    return "bg-brass";
  }

  if (tone === "sage") {
    return "bg-sage";
  }

  return "bg-graphite/55";
}

function sortDashboardTasks(tasks: DashboardTask[]) {
  const priorityWeight: Record<DashboardTaskPriority, number> = {
    high: 0,
    medium: 1,
    low: 2
  };

  return tasks.sort((left, right) => {
    const priorityDelta = priorityWeight[left.priority] - priorityWeight[right.priority];

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

function sortCalendarEvents(events: DashboardCalendarEvent[], today: Date) {
  const kindWeight: Record<DashboardCalendarKind, number> = {
    task: 0,
    event: 1,
    activity: 2
  };

  const futureEvents = events
    .filter((event) => event.date.getTime() >= today.getTime())
    .sort((left, right) => left.date.getTime() - right.date.getTime() || kindWeight[left.kind] - kindWeight[right.kind]);
  const recentEvents = events
    .filter((event) => event.date.getTime() < today.getTime())
    .sort((left, right) => right.date.getTime() - left.date.getTime() || kindWeight[left.kind] - kindWeight[right.kind]);

  return [...futureEvents, ...recentEvents];
}

function groupAlbumCommentsByReview(comments: DashboardAlbumComment[]) {
  const groups = new Map<
    string,
    {
      reviewId: string;
      reviewTitle: string;
      customerId: string;
      customerName: string;
      count: number;
      latestText: string;
      latestAt: Date;
    }
  >();

  for (const comment of comments) {
    const review = comment.spread.review;
    const existing = groups.get(review.id);

    if (!existing) {
      groups.set(review.id, {
        reviewId: review.id,
        reviewTitle: review.title,
        customerId: review.customer.id,
        customerName: review.customer.coupleName,
        count: 1,
        latestText: comment.text,
        latestAt: comment.createdAt
      });
      continue;
    }

    existing.count += 1;

    if (comment.createdAt.getTime() > existing.latestAt.getTime()) {
      existing.latestText = comment.text;
      existing.latestAt = comment.createdAt;
    }
  }

  return Array.from(groups.values()).sort((left, right) => right.latestAt.getTime() - left.latestAt.getTime());
}

function groupAlbumApprovalsByReview(spreads: DashboardAlbumSpreadApproval[]) {
  const groups = new Map<
    string,
    {
      reviewId: string;
      reviewTitle: string;
      customerId: string;
      customerName: string;
      count: number;
      latestAt: Date;
    }
  >();

  for (const spread of spreads) {
    if (!spread.approvedAt) {
      continue;
    }

    const existing = groups.get(spread.review.id);

    if (!existing) {
      groups.set(spread.review.id, {
        reviewId: spread.review.id,
        reviewTitle: spread.review.title,
        customerId: spread.review.customer.id,
        customerName: spread.review.customer.coupleName,
        count: 1,
        latestAt: spread.approvedAt
      });
      continue;
    }

    existing.count += 1;

    if (spread.approvedAt.getTime() > existing.latestAt.getTime()) {
      existing.latestAt = spread.approvedAt;
    }
  }

  return Array.from(groups.values()).sort((left, right) => right.latestAt.getTime() - left.latestAt.getTime());
}

function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`rounded-md border border-brass/15 bg-white px-3 py-3 shadow-[0_1px_0_rgba(178,139,78,0.08)] transition hover:border-brass/30 sm:p-4 ${
            index === stats.length - 1 ? "col-span-2 md:col-span-1" : ""
          }`}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-graphite/65 sm:text-xs sm:tracking-[0.16em]">
            {stat.label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold leading-tight text-ink sm:mt-2">{stat.value}</p>
          <div className="mt-2 h-0.5 w-8 rounded-full bg-brass/45" />
          <p className="mt-1 hidden text-sm text-graphite/75 sm:block">{stat.detail}</p>
        </div>
      ))}
    </div>
  );
}

const DASHBOARD_COPY = {
  hu: {
    area: "Admin",
    title: "Dashboard",
    intro: "Áttekintés a galériákról, ügyfélfolyamatokról és a következő fontos lépésekről.",
    newClient: "Új ügyfél",
    newGallery: "Új galéria",
    stats: {
      galleries: ["Galériák", "Összes létrehozott galéria"],
      active: ["Aktív", "Publikusan elérhető galériák"],
      media: ["Médiák", "Adatbázisban rögzített képek és videók"],
      storage: ["R2 tárhely", "Feltöltött médiák összmérete"],
      notifications: ["Új értesítések", "Olvasatlan admin jelzések"]
    },
    tasks: {
      deliverFinal: "Kész képek átadása",
      uploadFinal: "Kész képek feltöltése",
      finalReady: (name: string) => `${name}: van kész anyag, az átadás email vár kiküldésre.`,
      finalMissing: (name: string, status: string) => `${name}: ${status.toLowerCase()}, a kidolgozott képek még hiányoznak.`,
      waitingDelivery: "Átadásra vár",
      processing: "Feldolgozás",
      sendDeliveryEmail: "Átadás email kiküldése",
      deliveryEmailMissing: (name: string) => `${name}: a kész képek átadva státuszban vannak, de az email még nincs kiküldve.`,
      emailMissing: "Email hiányzik",
      sendProofingInvite: "Válogató link kiküldése",
      noClientEmail: "nincs ügyfél email",
      inviteDetail: (name: string, count: number, email: string) => `${name}: ${count} kép feltöltve, címzett: ${email}.`,
      waitingSend: "Küldésre vár",
      contractWaiting: "Szerződés aláírásra vár",
      waitingClient: "Ügyfélre vár",
      sendInvoice: "Számla kiküldése",
      overdueInvoice: "Lejárt nyitott számla",
      followInvoice: "Nyitott számla követése",
      overdue: "Lejárt",
      open: "Nyitott",
      due: "határidő",
      answerAlbumComment: "Album megjegyzések megválaszolása",
      albumCommentCount: (count: number) => `${count} nyitott megjegyzés`,
      albumCommentDetail: (name: string, count: number, latestText: string) =>
        `${name}: ${count} nyitott album megjegyzés. Legutóbbi: ${latestText}`,
      albumReview: "Album ellenőrző",
      fixPreview: "Előnézet feldolgozás javítása",
      brokenPreview: "Hibás előnézet",
      fixZip: "ZIP előkészítés javítása",
      zipFallback: "a letöltési csomag beragadt vagy hibás.",
      stuck: "Beragadt",
      brokenZip: "Hibás ZIP"
    },
    focusEyebrow: "Mai fókusz",
    focusTitle: "Teendőközpont",
    focusDescription: "A legfontosabb ügyfél-, galéria- és háttérfolyamatok egy gyors listában.",
    urgent: "sürgős",
    noUrgentTitle: "Nincs sürgős admin teendő",
    noUrgentDescription: "A problémás feldolgozások, leadott válogatások és várakozó ügyfélfolyamatok itt jelennek meg, ha érkeznek.",
    calendar: {
      eyebrow: "Munkanaptár",
      title: "Következő 30 nap",
      description: "Fotózások, szerződések, számlák és ügyféloldali aktivitások egy olvasható idővonalon.",
      today: "ma",
      next7Days: "következő 7 nap",
      attention: "figyelmet kér",
      agendaTitle: "Agenda",
      noEventsTitle: "Nincs naptári esemény",
      noEventsDescription: "Ha projekt, szerződés, számla vagy ügyfélaktivitás érkezik, itt jelenik meg időrendben.",
      project: "Projekt",
      lead: "Érdeklődő",
      contractSent: "Szerződés kiküldve",
      contractSigned: "Szerződés aláírva",
      invoiceDue: "Számla határidő",
      invoiceSent: "Számla kiküldve",
      invoicePaid: "Számla fizetve",
      selectionSubmitted: "Válogatás leadva",
      albumComment: "Album megjegyzés",
      albumCommentCount: (count: number) => `${count} megjegyzés`,
      albumApproved: "Album oldal rendben",
      albumApprovedCount: (count: number) => `${count} oldal rendben`,
      albumApprovedDetail: (name: string, count: number) => `${name}: ${count} album oldalpár rendben jelölve.`,
      task: "Teendő",
      event: "Esemény",
      activity: "Aktivitás",
      recent: "nemrég"
    },
    projectsEyebrow: "Projektek",
    projectsTitle: "Következő projektek",
    openClients: "Ügyfelek megnyitása",
    noUpcomingTitle: "Nincs közelgő projekt",
    noUpcomingDescription: "Az ügyfél adatlapján létrehozott jövőbeli projektek itt jelennek majd meg időrendben.",
    gallery: "galéria",
    notificationsTitle: "Értesítések",
    all: "Összes",
    noNotificationsTitle: "Még nincs értesítés",
    noNotificationsDescription: "Egyelőre nincs nyitott üzenet vagy figyelmeztetés.",
    latestGalleriesTitle: "Legutóbbi galériák",
    media: "média",
    active: "Aktív",
    inactive: "Inaktív",
    noGalleriesTitle: "Még nincs galéria",
    noGalleriesDescription: "A frissen létrehozott galériáid itt fognak megjelenni."
  },
  de: {
    area: "Admin",
    title: "Dashboard",
    intro: "Überblick über Galerien, Kundenprozesse und die nächsten wichtigen Schritte.",
    newClient: "Neuer Kunde",
    newGallery: "Neue Galerie",
    stats: {
      galleries: ["Galerien", "Alle angelegten Galerien"],
      active: ["Aktiv", "Öffentlich erreichbare Galerien"],
      media: ["Medien", "Bilder und Videos in der Datenbank"],
      storage: ["R2 Speicher", "Gesamtgröße der hochgeladenen Medien"],
      notifications: ["Neue Hinweise", "Ungelesene Admin-Hinweise"]
    },
    tasks: {
      deliverFinal: "Fertige Bilder übergeben",
      uploadFinal: "Fertige Bilder hochladen",
      finalReady: (name: string) => `${name}: fertiges Material ist vorhanden, die Übergabe-E-Mail wartet noch.`,
      finalMissing: (name: string, status: string) => `${name}: ${status.toLowerCase()}, die fertig bearbeiteten Bilder fehlen noch.`,
      waitingDelivery: "Wartet auf Übergabe",
      processing: "In Bearbeitung",
      sendDeliveryEmail: "Übergabe-E-Mail senden",
      deliveryEmailMissing: (name: string) => `${name}: die fertigen Bilder sind übergeben, aber die E-Mail wurde noch nicht gesendet.`,
      emailMissing: "E-Mail fehlt",
      sendProofingInvite: "Auswahllink senden",
      noClientEmail: "keine Kunden-E-Mail",
      inviteDetail: (name: string, count: number, email: string) => `${name}: ${count} Bilder hochgeladen, Empfänger: ${email}.`,
      waitingSend: "Wartet auf Versand",
      contractWaiting: "Vertrag wartet auf Signatur",
      waitingClient: "Wartet auf Kunde",
      sendInvoice: "Rechnung senden",
      overdueInvoice: "Offene Rechnung überfällig",
      followInvoice: "Offene Rechnung verfolgen",
      overdue: "Überfällig",
      open: "Offen",
      due: "fällig",
      answerAlbumComment: "Albumkommentare beantworten",
      albumCommentCount: (count: number) => `${count} offene Kommentare`,
      albumCommentDetail: (name: string, count: number, latestText: string) =>
        `${name}: ${count} offene Albumkommentare. Neuester Kommentar: ${latestText}`,
      albumReview: "Albumfreigabe",
      fixPreview: "Vorschau-Verarbeitung prüfen",
      brokenPreview: "Vorschau fehlerhaft",
      fixZip: "ZIP-Vorbereitung prüfen",
      zipFallback: "das Download-Paket hängt oder ist fehlerhaft.",
      stuck: "Hängt",
      brokenZip: "ZIP fehlerhaft"
    },
    focusEyebrow: "Heute im Fokus",
    focusTitle: "Aufgabenzentrale",
    focusDescription: "Die wichtigsten Kunden-, Galerie- und Hintergrundprozesse in einer schnellen Liste.",
    urgent: "dringend",
    noUrgentTitle: "Keine dringenden Admin-Aufgaben",
    noUrgentDescription: "Problematische Verarbeitungen, abgegebene Auswahlen und wartende Kundenprozesse erscheinen hier.",
    calendar: {
      eyebrow: "Arbeitskalender",
      title: "Nächste 30 Tage",
      description: "Shootings, Verträge, Rechnungen und Kundenaktivitäten in einer gut lesbaren Zeitleiste.",
      today: "heute",
      next7Days: "nächste 7 Tage",
      attention: "braucht Aufmerksamkeit",
      agendaTitle: "Agenda",
      noEventsTitle: "Keine Kalendereinträge",
      noEventsDescription: "Projekte, Verträge, Rechnungen und Kundenaktivitäten erscheinen hier chronologisch.",
      project: "Projekt",
      lead: "Anfrage",
      contractSent: "Vertrag gesendet",
      contractSigned: "Vertrag unterzeichnet",
      invoiceDue: "Rechnung fällig",
      invoiceSent: "Rechnung gesendet",
      invoicePaid: "Rechnung bezahlt",
      selectionSubmitted: "Auswahl abgegeben",
      albumComment: "Albumkommentar",
      albumCommentCount: (count: number) => `${count} Kommentare`,
      albumApproved: "Albumseite freigegeben",
      albumApprovedCount: (count: number) => `${count} Seiten ok`,
      albumApprovedDetail: (name: string, count: number) => `${name}: ${count} Albumseiten wurden freigegeben.`,
      task: "Aufgabe",
      event: "Termin",
      activity: "Aktivität",
      recent: "kürzlich"
    },
    projectsEyebrow: "Projekte",
    projectsTitle: "Nächste Projekte",
    openClients: "Kunden öffnen",
    noUpcomingTitle: "Keine anstehenden Projekte",
    noUpcomingDescription: "Zukünftige Projekte aus den Kundendaten erscheinen hier chronologisch.",
    gallery: "Galerie",
    notificationsTitle: "Benachrichtigungen",
    all: "Alle",
    noNotificationsTitle: "Noch keine Benachrichtigungen",
    noNotificationsDescription: "Aktuell gibt es keine offenen Nachrichten oder Hinweise.",
    latestGalleriesTitle: "Letzte Galerien",
    media: "Medien",
    active: "Aktiv",
    inactive: "Inaktiv",
    noGalleriesTitle: "Noch keine Galerie",
    noGalleriesDescription: "Frisch angelegte Galerien erscheinen hier."
  }
} as const;

type DashboardCopy = (typeof DASHBOARD_COPY)[AdminLanguage];

function DashboardWorkCalendar({
  copy,
  events,
  language,
  today
}: {
  copy: DashboardCopy;
  events: DashboardCalendarEvent[];
  language: AdminLanguage;
  today: Date;
}) {
  const dayStrip = Array.from({ length: 14 }, (_, index) => addDays(today, index));
  const orderedEvents = sortCalendarEvents(events, today).slice(0, 14);
  const todayEventCount = events.filter((event) => isSameCalendarDay(event.date, today)).length;
  const nextWeekEnd = addDays(today, 7);
  const nextWeekEventCount = events.filter(
    (event) => event.date.getTime() >= today.getTime() && event.date.getTime() < nextWeekEnd.getTime()
  ).length;
  const attentionCount = events.filter(
    (event) => event.kind === "task" && event.date.getTime() < nextWeekEnd.getTime()
  ).length;

  return (
    <section className="mt-5 rounded-md border border-brass/20 bg-white shadow-[0_1px_0_rgba(178,139,78,0.08)] md:mt-8">
      <div className="flex flex-col justify-between gap-4 border-b border-brass/15 px-5 py-4 lg:flex-row lg:items-start">
        <div>
          <div className={sectionMetaClass}>
            <CalendarClock size={15} />
            {copy.calendar.eyebrow}
          </div>
          <h2 className={`mt-2 ${sectionTitleClass}`}>{copy.calendar.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/70">{copy.calendar.description}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
          {[
            { label: copy.calendar.today, value: todayEventCount },
            { label: copy.calendar.next7Days, value: nextWeekEventCount },
            { label: copy.calendar.attention, value: attentionCount }
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-ink/8 bg-paper px-3 py-2">
              <p className="text-lg font-semibold leading-tight text-ink">{item.value}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-graphite/60">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-2 2xl:grid-cols-7">
          {dayStrip.map((day) => {
            const dayEvents = events.filter((event) => isSameCalendarDay(event.date, day));
            const isToday = isSameCalendarDay(day, today);

            return (
              <div
                key={day.toISOString()}
                className={`min-h-24 rounded-md border px-3 py-3 ${
                  isToday ? "border-brass/45 bg-brass/[0.06]" : "border-ink/10 bg-paper"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-graphite/55">
                      {isToday ? copy.calendar.today : formatWeekday(day, language)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">{formatShortCalendarDate(day, language)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${dayEvents.length > 0 ? "bg-white text-ink" : "bg-ink/[0.04] text-graphite/50"}`}>
                    {dayEvents.length}
                  </span>
                </div>
                {dayEvents.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {dayEvents.slice(0, 5).map((event) => (
                      <span key={event.key} className={`size-2 rounded-full ${calendarDotClass(event.tone)}`} />
                    ))}
                    {dayEvents.length > 5 ? (
                      <span className="text-[11px] font-medium leading-none text-graphite/60">+{dayEvents.length - 5}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="rounded-md border border-ink/10 bg-paper">
          <div className="border-b border-ink/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">{copy.calendar.agendaTitle}</h3>
          </div>
          {orderedEvents.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CalendarClock size={18} className="text-ink" />}
                title={copy.calendar.noEventsTitle}
                description={copy.calendar.noEventsDescription}
              />
            </div>
          ) : (
            <div className="divide-y divide-ink/10">
              {orderedEvents.map((event) => {
                const Icon = event.icon;
                const kindLabel =
                  event.kind === "task" ? copy.calendar.task : event.kind === "event" ? copy.calendar.event : copy.calendar.activity;

                return (
                  <Link
                    key={event.key}
                    href={event.href}
                    className="group grid gap-3 px-4 py-3 transition hover:bg-brass/[0.04] sm:grid-cols-[112px_1fr_auto] sm:items-center"
                  >
                    <div className="text-sm">
                      <p className="font-semibold text-ink">{formatShortCalendarDate(event.date, language)}</p>
                      <p className="mt-0.5 text-xs text-graphite/60">
                        {event.date.getTime() < today.getTime() ? copy.calendar.recent : formatWeekday(event.date, language)}
                      </p>
                    </div>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md ring-1 ${calendarToneClass(event.tone)}`}>
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">{event.title}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${calendarToneClass(event.tone)}`}>
                            {event.label}
                          </span>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-sm text-graphite/70">{event.detail}</span>
                      </span>
                    </div>
                    <div className="hidden items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-graphite/50 sm:flex">
                      {kindLabel}
                      <ArrowRight size={16} className="transition group-hover:translate-x-0.5 group-hover:text-brass" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function isSupersededDownloadPackageMessage(message: string | null | undefined) {
  return message?.toLowerCase().includes("superseded by") ?? false;
}

export default async function AdminDashboardPage() {
  const [admin, language] = await Promise.all([requireAdmin(), getAdminLanguage()]);
  const copy = DASHBOARD_COPY[language];
  await ensureLeadPipelineSchema(prisma);
  const galleryWhere = adminOwnedWhere(admin);
  const photoWhere = { gallery: adminOwnedWhere(admin) };
  const projectWhere = { customer: adminOwnedWhere(admin) };
  const adminNotificationWhere = notificationWhere(admin);
  const today = startOfToday();
  const calendarStart = addDays(today, -7);
  const calendarEnd = addDays(today, 31);
  const staleZipCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const contractWhere = { customer: adminOwnedWhere(admin) };
  const invoiceWhere = { customer: adminOwnedWhere(admin) };
  const albumCommentWhere = { spread: { review: { customer: adminOwnedWhere(admin) } } };
  const downloadPackageWhere = { gallery: adminOwnedWhere(admin) };

  const [
    galleryCount,
    activeCount,
    photoCount,
    photoStorage,
    unreadNotifications,
    latestNotifications,
    upcomingProjects,
    calendarProjects,
    calendarLeads,
    calendarContracts,
    calendarInvoices,
    calendarFavoriteLists,
    calendarAlbumComments,
    calendarApprovedSpreads,
    proofingInviteGalleries,
    submittedProofingGalleries,
    finishedProofingGalleries,
    waitingContracts,
    openInvoices,
    openAlbumComments,
    failedProcessingPhotos,
    problemZipPackages,
    latestGalleries,
    viewLocations,
    leads
  ] = await Promise.all([
    prisma.gallery.count({ where: galleryWhere }),
    prisma.gallery.count({ where: { ...galleryWhere, isActive: true } }),
    prisma.photo.count({ where: photoWhere }),
    prisma.photo.aggregate({ where: photoWhere, _sum: { fileSize: true } }),
    prisma.adminNotification.count({ where: { ...adminNotificationWhere, readAt: null } }),
    prisma.adminNotification.findMany({
      where: adminNotificationWhere,
      orderBy: { createdAt: "desc" },
      take: 4
    }),
    prisma.customerProject.findMany({
      where: {
        ...projectWhere,
        eventDate: { gte: today },
        status: { not: "archived" }
      },
      orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        },
        _count: {
          select: {
            galleries: true,
            contracts: true,
            invoices: true,
            albumReviews: true,
            albumDesigns: true
          }
        }
      }
    }),
    prisma.customerProject.findMany({
      where: {
        ...projectWhere,
        eventDate: { gte: today, lt: calendarEnd },
        status: { not: "archived" }
      },
      orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
      take: 30,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        }
      }
    }),
    prisma.lead.findMany({
      where: {
        ...adminOwnedWhere(admin),
        eventDate: { gte: today, lt: calendarEnd }
      },
      orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
      take: 30,
      select: {
        id: true,
        name: true,
        email: true,
        eventType: true,
        eventDate: true,
        venue: true,
        status: true
      }
    }),
    prisma.contract.findMany({
      where: {
        ...contractWhere,
        OR: [
          { sentAt: { gte: calendarStart, lt: calendarEnd } },
          { signedAt: { gte: calendarStart, lt: calendarEnd } }
        ]
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 40,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        }
      }
    }),
    prisma.customerInvoice.findMany({
      where: {
        ...invoiceWhere,
        OR: [
          { dueDate: { gte: calendarStart, lt: calendarEnd } },
          { sentAt: { gte: calendarStart, lt: calendarEnd } },
          { paidAt: { gte: calendarStart, lt: calendarEnd } }
        ]
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 40,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        },
        project: {
          select: {
            title: true
          }
        }
      }
    }),
    prisma.galleryFavoriteList.findMany({
      where: {
        submittedAt: { gte: calendarStart, lt: calendarEnd },
        gallery: adminOwnedWhere(admin)
      },
      orderBy: { submittedAt: "desc" },
      take: 30,
      include: {
        gallery: {
          select: {
            id: true,
            title: true,
            customer: {
              select: {
                coupleName: true
              }
            }
          }
        },
        _count: {
          select: {
            items: true
          }
        }
      }
    }),
    prisma.albumReviewComment.findMany({
      where: {
        ...albumCommentWhere,
        createdAt: { gte: calendarStart, lt: calendarEnd }
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        spread: {
          select: {
            title: true,
            review: {
              select: {
                id: true,
                title: true,
                customer: {
                  select: {
                    id: true,
                    coupleName: true
                  }
                }
              }
            }
          }
        }
      }
    }),
    prisma.albumReviewSpread.findMany({
      where: {
        approvedAt: { gte: calendarStart, lt: calendarEnd },
        review: {
          customer: adminOwnedWhere(admin)
        }
      },
      orderBy: { approvedAt: "desc" },
      take: 30,
      include: {
        review: {
          select: {
            id: true,
            title: true,
            customer: {
              select: {
                id: true,
                coupleName: true
              }
            }
          }
        }
      }
    }),
    prisma.gallery.findMany({
      where: {
        ...galleryWhere,
        galleryMode: GALLERY_MODE_PROOFING,
        proofingStatus: { in: [PROOFING_STATUS_NOT_OPENED, PROOFING_STATUS_IN_PROGRESS] },
        proofingInviteSentAt: null,
        photos: { some: {} }
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        },
        _count: {
          select: {
            photos: true
          }
        }
      }
    }),
    prisma.gallery.findMany({
      where: {
        ...galleryWhere,
        galleryMode: GALLERY_MODE_PROOFING,
        proofingStatus: { in: [PROOFING_STATUS_SUBMITTED, PROOFING_STATUS_PROCESSING] }
      },
      orderBy: [{ proofingStatusUpdatedAt: "desc" }, { updatedAt: "desc" }],
      take: 6,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        },
        photos: {
          where: { deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
          select: { id: true },
          take: 1
        }
      }
    }),
    prisma.gallery.findMany({
      where: {
        ...galleryWhere,
        galleryMode: GALLERY_MODE_PROOFING,
        proofingStatus: PROOFING_STATUS_DELIVERED,
        finalDeliveryEmailSentAt: null
      },
      orderBy: [{ proofingStatusUpdatedAt: "desc" }, { updatedAt: "desc" }],
      take: 6,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        }
      }
    }),
    prisma.contract.findMany({
      where: {
        ...contractWhere,
        sentAt: { not: null },
        signedAt: null
      },
      orderBy: [{ sentAt: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        }
      }
    }),
    prisma.customerInvoice.findMany({
      where: {
        ...invoiceWhere,
        status: { not: "paid" }
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 8,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        },
        project: {
          select: {
            title: true
          }
        }
      }
    }),
    prisma.albumReviewComment.findMany({
      where: {
        ...albumCommentWhere,
        status: "open"
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        spread: {
          select: {
            title: true,
            review: {
              select: {
                id: true,
                title: true,
                customer: {
                  select: {
                    id: true,
                    coupleName: true
                  }
                }
              }
            }
          }
        }
      }
    }),
    prisma.photo.findMany({
      where: {
        ...photoWhere,
        OR: [{ processingStatus: "failed" }, { processingError: { not: null } }]
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        gallery: {
          select: {
            id: true,
            title: true
          }
        }
      }
    }),
    prisma.galleryDownloadPackage.findMany({
      where: {
        ...downloadPackageWhere,
        OR: [
          {
            status: "failed",
            NOT: {
              errorMessage: {
                startsWith: "Superseded by"
              }
            }
          },
          { status: "processing", updatedAt: { lt: staleZipCutoff } }
        ]
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: {
        gallery: {
          select: {
            id: true,
            title: true
          }
        }
      }
    }),
    prisma.gallery.findMany({
      where: galleryWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        _count: { select: { photos: true } },
        photos: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, imageUrl: true, thumbnailUrl: true, filename: true, mediaType: true }
        }
      }
    }),
    prisma.galleryView.findMany({
      where: { gallery: adminOwnedWhere(admin) },
      select: {
        city: true,
        country: true,
        latitude: true,
        longitude: true
      }
    }),
    prisma.lead.findMany({
      where: adminOwnedWhere(admin),
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        eventType: true,
        eventDate: true,
        venue: true,
        notes: true,
        status: true,
        sortOrder: true
      }
    })
  ]);
  const locationPoints = createViewLocationPoints(viewLocations);
  const totalStorageBytes = photoStorage._sum.fileSize ?? 0;
  const seenZipGalleryIds = new Set<string>();
  const actionableZipPackages = problemZipPackages.filter((downloadPackage) => {
    if (isSupersededDownloadPackageMessage(downloadPackage.errorMessage)) {
      return false;
    }

    if (seenZipGalleryIds.has(downloadPackage.galleryId)) {
      return false;
    }

    seenZipGalleryIds.add(downloadPackage.galleryId);
    return true;
  });
  const openAlbumCommentGroups = groupAlbumCommentsByReview(openAlbumComments);
  const calendarAlbumCommentGroups = groupAlbumCommentsByReview(calendarAlbumComments);
  const calendarApprovedSpreadGroups = groupAlbumApprovalsByReview(calendarApprovedSpreads);
  const dashboardTasks = sortDashboardTasks([
    ...submittedProofingGalleries.map((gallery): DashboardTask => {
      const hasFinalPhotos = gallery.photos.length > 0;
      const customerName = gallery.customer?.coupleName ?? gallery.title;

      return {
        key: `proofing-${gallery.id}`,
        title: hasFinalPhotos ? copy.tasks.deliverFinal : copy.tasks.uploadFinal,
        detail: hasFinalPhotos
          ? copy.tasks.finalReady(customerName)
          : copy.tasks.finalMissing(customerName, proofingStatusLabel(gallery.proofingStatus)),
        href: `/admin/galleries/${gallery.id}?tab=client`,
        label: hasFinalPhotos ? copy.tasks.waitingDelivery : copy.tasks.processing,
        priority: "high",
        icon: hasFinalPhotos ? CheckCircle2 : ImagePlus,
        createdAt: gallery.proofingStatusUpdatedAt ?? gallery.updatedAt
      };
    }),
    ...finishedProofingGalleries.map((gallery): DashboardTask => {
      const customerName = gallery.customer?.coupleName ?? gallery.title;

      return {
        key: `finished-proofing-${gallery.id}`,
        title: copy.tasks.sendDeliveryEmail,
        detail: copy.tasks.deliveryEmailMissing(customerName),
        href: `/admin/galleries/${gallery.id}?tab=client`,
        label: copy.tasks.emailMissing,
        priority: "high",
        icon: Mail,
        createdAt: gallery.proofingStatusUpdatedAt ?? gallery.updatedAt
      };
    }),
    ...proofingInviteGalleries.map((gallery): DashboardTask => {
      const customerName = gallery.customer?.coupleName ?? gallery.title;
      const emailText = gallery.customer?.primaryEmail ?? gallery.clientEmail ?? copy.tasks.noClientEmail;

      return {
        key: `invite-${gallery.id}`,
        title: copy.tasks.sendProofingInvite,
        detail: copy.tasks.inviteDetail(customerName, gallery._count.photos, emailText),
        href: `/admin/galleries/${gallery.id}?tab=client`,
        label: copy.tasks.waitingSend,
        priority: "medium",
        icon: Heart,
        createdAt: gallery.createdAt
      };
    }),
    ...waitingContracts.map((contract): DashboardTask => ({
      key: `contract-${contract.id}`,
      title: copy.tasks.contractWaiting,
      detail: `${contract.customer.coupleName}: ${contract.title}`,
      href: `/admin/clients/${contract.customer.id}?tab=contracts`,
      label: copy.tasks.waitingClient,
      priority: "medium",
      icon: FileText,
      createdAt: contract.sentAt ?? contract.createdAt
    })),
    ...openInvoices.map((invoice): DashboardTask => {
      const isOverdue = Boolean(invoice.dueDate && invoice.dueDate.getTime() < today.getTime());
      const isUnsent = !invoice.sentAt;
      const title = isUnsent ? copy.tasks.sendInvoice : isOverdue ? copy.tasks.overdueInvoice : copy.tasks.followInvoice;
      const label = isUnsent ? copy.tasks.waitingSend : isOverdue ? copy.tasks.overdue : copy.tasks.open;
      const projectText = invoice.project ? ` · ${invoice.project.title}` : "";
      const dueText = invoice.dueDate ? ` · ${copy.tasks.due}: ${formatDate(invoice.dueDate, language)}` : "";

      return {
        key: `invoice-${invoice.id}`,
        title,
        detail: `${invoice.customer.coupleName}${projectText}: ${invoice.title}${dueText}`,
        href: `/admin/clients/${invoice.customer.id}?tab=invoices`,
        label,
        priority: isUnsent || isOverdue ? "high" : "medium",
        icon: ReceiptText,
        createdAt: invoice.sentAt ?? invoice.createdAt
      };
    }),
    ...openAlbumCommentGroups.map((group): DashboardTask => ({
      key: `album-comments-${group.reviewId}`,
      title: copy.tasks.answerAlbumComment,
      detail: copy.tasks.albumCommentDetail(group.customerName, group.count, group.latestText),
      href: `/admin/clients/${group.customerId}?tab=album`,
      label: copy.tasks.albumCommentCount(group.count),
      priority: "medium",
      icon: MessageSquare,
      createdAt: group.latestAt
    })),
    ...failedProcessingPhotos.map((photo): DashboardTask => ({
      key: `processing-${photo.id}`,
      title: copy.tasks.fixPreview,
      detail: `${photo.gallery.title}: ${photo.filename}`,
      href: `/admin/galleries/${photo.gallery.id}?tab=photos`,
      label: copy.tasks.brokenPreview,
      priority: "high",
      icon: AlertCircle,
      createdAt: photo.createdAt
    })),
    ...actionableZipPackages.map((downloadPackage): DashboardTask => ({
      key: `zip-${downloadPackage.id}`,
      title: copy.tasks.fixZip,
      detail: `${downloadPackage.gallery.title}: ${downloadPackage.errorMessage ?? copy.tasks.zipFallback}`,
      href: `/admin/galleries/${downloadPackage.gallery.id}?tab=downloads`,
      label: downloadPackage.status === "processing" ? copy.tasks.stuck : copy.tasks.brokenZip,
      priority: "high",
      icon: AlertCircle,
      createdAt: downloadPackage.updatedAt
    }))
  ]).slice(0, 8);
  const calendarEvents: DashboardCalendarEvent[] = [
    ...calendarProjects.flatMap((project): DashboardCalendarEvent[] => {
      if (!project.eventDate) {
        return [];
      }

      const venueText = project.venue ? ` · ${project.venue}` : "";

      return [
        {
          key: `calendar-project-${project.id}`,
          date: project.eventDate,
          title: project.title,
          detail: `${project.customer.coupleName} · ${customerProjectTypeLabel(project.projectType)}${venueText}`,
          href: `/admin/clients/${project.customer.id}?tab=projects`,
          label: copy.calendar.project,
          kind: "event",
          tone: "brass",
          icon: Camera
        }
      ];
    }),
    ...calendarLeads.flatMap((lead): DashboardCalendarEvent[] => {
      if (!lead.eventDate) {
        return [];
      }

      const venueText = lead.venue ? ` · ${lead.venue}` : "";
      const emailText = lead.email ? ` · ${lead.email}` : "";

      return [
        {
          key: `calendar-lead-${lead.id}`,
          date: lead.eventDate,
          title: lead.name,
          detail: `${leadEventTypeLabel(lead.eventType, language)} · ${leadStatusLabel(lead.status, language)}${venueText}${emailText}`,
          href: "/admin/dashboard#lead-pipeline",
          label: copy.calendar.lead,
          kind: "event",
          tone: "ink",
          icon: FolderKanban
        }
      ];
    }),
    ...calendarContracts.flatMap((contract): DashboardCalendarEvent[] => {
      const events: DashboardCalendarEvent[] = [];

      if (contract.sentAt) {
        events.push({
          key: `calendar-contract-sent-${contract.id}`,
          date: contract.sentAt,
          title: contract.title,
          detail: contract.customer.coupleName,
          href: `/admin/clients/${contract.customer.id}?tab=contracts`,
          label: copy.calendar.contractSent,
          kind: contract.signedAt ? "activity" : "task",
          tone: contract.signedAt ? "ink" : "brass",
          icon: FileText
        });
      }

      if (contract.signedAt) {
        events.push({
          key: `calendar-contract-signed-${contract.id}`,
          date: contract.signedAt,
          title: contract.title,
          detail: contract.customer.coupleName,
          href: `/admin/clients/${contract.customer.id}?tab=contracts`,
          label: copy.calendar.contractSigned,
          kind: "activity",
          tone: "sage",
          icon: CheckCircle2
        });
      }

      return events;
    }),
    ...calendarInvoices.flatMap((invoice): DashboardCalendarEvent[] => {
      const events: DashboardCalendarEvent[] = [];
      const projectText = invoice.project ? ` · ${invoice.project.title}` : "";
      const detail = `${invoice.customer.coupleName}${projectText}`;

      if (invoice.dueDate && invoice.status !== "paid") {
        events.push({
          key: `calendar-invoice-due-${invoice.id}`,
          date: invoice.dueDate,
          title: invoice.title,
          detail,
          href: `/admin/clients/${invoice.customer.id}?tab=invoices`,
          label: copy.calendar.invoiceDue,
          kind: "task",
          tone: invoice.dueDate.getTime() < today.getTime() ? "danger" : "brass",
          icon: ReceiptText
        });
      }

      if (invoice.sentAt) {
        events.push({
          key: `calendar-invoice-sent-${invoice.id}`,
          date: invoice.sentAt,
          title: invoice.title,
          detail,
          href: `/admin/clients/${invoice.customer.id}?tab=invoices`,
          label: copy.calendar.invoiceSent,
          kind: "activity",
          tone: "ink",
          icon: ReceiptText
        });
      }

      if (invoice.paidAt) {
        events.push({
          key: `calendar-invoice-paid-${invoice.id}`,
          date: invoice.paidAt,
          title: invoice.title,
          detail,
          href: `/admin/clients/${invoice.customer.id}?tab=invoices`,
          label: copy.calendar.invoicePaid,
          kind: "activity",
          tone: "sage",
          icon: CheckCircle2
        });
      }

      return events;
    }),
    ...calendarFavoriteLists.flatMap((list): DashboardCalendarEvent[] => {
      if (!list.submittedAt) {
        return [];
      }

      const customerName = list.gallery.customer?.coupleName ?? list.email;

      return [
        {
          key: `calendar-favorite-list-${list.id}`,
          date: list.submittedAt,
          title: list.gallery.title,
          detail: `${customerName} · ${list._count.items} ${copy.media}`,
          href: `/admin/galleries/${list.gallery.id}?tab=client`,
          label: copy.calendar.selectionSubmitted,
          kind: "task",
          tone: "brass",
          icon: Heart
        }
      ];
    }),
    ...calendarAlbumCommentGroups.map((group): DashboardCalendarEvent => ({
      key: `calendar-album-comments-${group.reviewId}`,
      date: group.latestAt,
      title: group.reviewTitle,
      detail: copy.tasks.albumCommentDetail(group.customerName, group.count, group.latestText),
      href: `/admin/clients/${group.customerId}?tab=album`,
      label: copy.calendar.albumCommentCount(group.count),
      kind: "task",
      tone: "brass",
      icon: MessageSquare
    })),
    ...calendarApprovedSpreadGroups.map((group): DashboardCalendarEvent => ({
      key: `calendar-album-approved-${group.reviewId}`,
      date: group.latestAt,
      title: group.reviewTitle,
      detail: copy.calendar.albumApprovedDetail(group.customerName, group.count),
      href: `/admin/clients/${group.customerId}?tab=album`,
      label: copy.calendar.albumApprovedCount(group.count),
      kind: "activity",
      tone: "sage",
      icon: CheckCircle2
    }))
  ];
  const urgentTaskCount = dashboardTasks.filter((task) => task.priority === "high").length;

  return (
    <AdminShell>
      <div className="mb-5 rounded-md border border-brass/15 bg-white px-4 py-4 shadow-[0_1px_0_rgba(178,139,78,0.08)] md:mb-8 md:px-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className={sectionMetaClass}>{copy.area}</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{copy.title}</h1>
          <p className="mt-2 max-w-xl text-sm text-graphite/70">
            {copy.intro}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <ButtonLink href="/admin/clients/new" variant="secondary" className="h-10 px-3 md:h-11 md:px-4">
            {copy.newClient}
          </ButtonLink>
          <ButtonLink href="/admin/galleries/new" className="h-10 px-3 md:h-11 md:px-4">
            {copy.newGallery}
          </ButtonLink>
        </div>
        </div>
      </div>

      <DashboardStats
        stats={[
          { label: copy.stats.galleries[0], value: galleryCount, detail: copy.stats.galleries[1] },
          { label: copy.stats.active[0], value: activeCount, detail: copy.stats.active[1] },
          { label: copy.stats.media[0], value: photoCount, detail: copy.stats.media[1] },
          { label: copy.stats.storage[0], value: formatStorageSize(totalStorageBytes), detail: copy.stats.storage[1] },
          { label: copy.stats.notifications[0], value: unreadNotifications, detail: copy.stats.notifications[1] }
        ]}
      />

      <LeadPipelineBoard
        language={language}
        initialLeads={leads.map((lead) => ({
          ...lead,
          eventDate: lead.eventDate?.toISOString() ?? null,
          status: normalizeLeadStatus(lead.status)
        }))}
      />

      <DashboardWorkCalendar copy={copy} events={calendarEvents} language={language} today={today} />

      <div className="mt-5 grid gap-6 md:mt-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <section className="rounded-md border border-brass/20 bg-white shadow-[0_1px_0_rgba(178,139,78,0.08)]">
          <div className="flex flex-col justify-between gap-3 border-b border-brass/15 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <div className={sectionMetaClass}>
                <ListChecks size={15} />
                {copy.focusEyebrow}
              </div>
              <h2 className={`mt-2 ${sectionTitleClass}`}>{copy.focusTitle}</h2>
              <p className="mt-1 text-sm text-graphite/70">
                {copy.focusDescription}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brass/10 px-3 py-1.5 text-sm font-medium text-brass">
              <Clock3 size={15} />
              {urgentTaskCount} {copy.urgent}
            </span>
          </div>

          {dashboardTasks.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CheckCircle2 size={18} className="text-ink" />}
                title={copy.noUrgentTitle}
                description={copy.noUrgentDescription}
              />
            </div>
          ) : (
            <div className="divide-y divide-ink/10">
              {dashboardTasks.map((task) => {
                const Icon = task.icon;

                return (
                  <Link
                    key={task.key}
                    href={task.href}
                    className="group flex items-start gap-4 px-5 py-4 transition hover:bg-brass/[0.04]"
                  >
                    <span className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-md ${taskIconClass(task.priority)}`}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{task.title}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${taskPriorityClass(task.priority)}`}>
                          {task.label}
                        </span>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-sm text-graphite/70">{task.detail}</span>
                    </span>
                    <ArrowRight size={18} className="mt-2 shrink-0 text-graphite/35 transition group-hover:translate-x-0.5 group-hover:text-brass" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-md border border-brass/20 bg-white shadow-[0_1px_0_rgba(178,139,78,0.08)]">
          <div className="flex flex-col justify-between gap-3 border-b border-brass/15 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <div className={sectionMetaClass}>
                <FolderKanban size={15} />
                {copy.projectsEyebrow}
              </div>
              <h2 className={`mt-2 ${sectionTitleClass}`}>{copy.projectsTitle}</h2>
            </div>
            <ButtonLink href="/admin/clients" variant="secondary" className="h-10">
              {copy.openClients}
            </ButtonLink>
          </div>

          {upcomingProjects.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<FolderKanban size={18} className="text-ink" />}
                title={copy.noUpcomingTitle}
                description={copy.noUpcomingDescription}
              />
            </div>
          ) : (
            <div className="grid gap-3 p-5">
              {upcomingProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/admin/clients/${project.customer.id}?tab=projects`}
                  className="rounded-md border border-ink/10 bg-paper p-4 transition hover:border-brass/35 hover:bg-brass/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-ink">{project.title}</p>
                      <p className="mt-1 truncate text-sm text-graphite/70">{project.customer.coupleName}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                      {customerProjectStatusLabel(project.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-graphite/75 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock size={14} />
                      {formatDate(project.eventDate, language)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Camera size={14} />
                      {project._count.galleries} {copy.gallery}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-graphite">
                      {customerProjectTypeLabel(project.projectType)}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-graphite">
                      {project.customer.primaryEmail}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <section className="rounded-md border border-ink/12 bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-ink/10 px-5 py-4">
            <h2 className={sectionTitleClass}>{copy.notificationsTitle}</h2>
            <Link href="/admin/notifications" className="text-sm font-medium text-ink hover:underline">
              {copy.all}
            </Link>
          </div>
          <div className="divide-y divide-ink/10">
            {latestNotifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.href ?? "/admin/notifications"}
                className="flex items-start gap-4 px-5 py-4 hover:bg-ink/[0.03]"
              >
                <span className={`mt-1 flex size-9 shrink-0 items-center justify-center rounded-md ${notification.readAt ? "bg-paper text-graphite" : "bg-brass/15 text-brass"}`}>
                  <Bell size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{notification.title}</span>
                  <span className="mt-1 block text-sm text-graphite/70">{notification.message}</span>
                  <span className="mt-2 block text-xs text-graphite/60">
                    {notification.createdAt.toLocaleString(dateLocaleForAdmin(language), {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: APP_TIME_ZONE
                    })}
                  </span>
                </span>
              </Link>
            ))}
            {latestNotifications.length === 0 ? (
              <div className="px-5 py-4">
                <EmptyState
                  icon={<Bell size={18} className="text-ink" />}
                  title={copy.noNotificationsTitle}
                  description={copy.noNotificationsDescription}
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-md border border-ink/12 bg-white">
          <div className="border-b border-ink/10 px-5 py-4">
            <h2 className={sectionTitleClass}>{copy.latestGalleriesTitle}</h2>
          </div>
          <div className="divide-y divide-ink/10">
            {latestGalleries.map((gallery) => (
              <a
                key={gallery.id}
                href={`/admin/galleries/${gallery.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-ink/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-paper">
                    {(() => {
                      const cover =
                        gallery.photos.find((photo) => photo.id === gallery.coverPhotoId && photo.thumbnailUrl !== photo.imageUrl) ??
                        gallery.photos.find((photo) => photo.thumbnailUrl !== photo.imageUrl);

                      return cover ? (
                        cover.mediaType === "video" ? (
                          <div className="grid h-full place-items-center bg-ink text-white">
                            <Film size={18} />
                          </div>
                        ) : (
                          <Image
                            src={cover.thumbnailUrl}
                            alt={cover.filename}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="56px"
                            style={{ objectPosition: `${gallery.coverPositionX ?? 50}% ${gallery.coverPositionY ?? 50}%` }}
                          />
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center text-graphite/50">
                          <Camera size={18} />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{gallery.title}</p>
                    <p className="truncate text-sm text-graphite/70">/g/{gallery.slug}</p>
                  </div>
                </div>
                <div className="text-right text-sm text-graphite/70">
                  <p>{gallery._count.photos} {copy.media}</p>
                  <p>{gallery.isActive ? copy.active : copy.inactive}</p>
                </div>
              </a>
            ))}
            {latestGalleries.length === 0 ? (
              <div className="px-5 pb-4">
                <EmptyState
                  icon={<Camera size={18} className="text-ink" />}
                  title={copy.noGalleriesTitle}
                  description={copy.noGalleriesDescription}
                />
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <ViewLocationMap points={locationPoints} />
    </AdminShell>
  );
}
