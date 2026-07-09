import Link from "next/link";
import { ArrowLeft, CalendarClock, FolderKanban } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { UpcomingWorkCardGrid, type UpcomingWorkCard } from "@/components/upcoming-work-card-grid";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { getAdminLanguage, type AdminLanguage } from "@/lib/admin-language";
import { requireAdmin } from "@/lib/auth";
import { customerMeetingStatusLabel, customerMeetingTypeLabel } from "@/lib/customer-meeting-options";
import { customerProjectStatusLabel, customerProjectTypeLabel } from "@/lib/customer-project-options";
import { customerTaskPriorityLabel, customerTaskStatusLabel, customerTaskTypeLabel } from "@/lib/customer-task-options";
import { formatMiniSessionSlot, MINI_SESSION_BOOKING_SOURCE_BLOCKED, MINI_SESSION_BOOKING_STATUS_BOOKED } from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

const WORK_PAGE_COPY = {
  hu: {
    area: "Munkák",
    title: "Elkövetkező munkák",
    description: "Ügyfélprojektek, meetingek és egyszerű időpontfoglalások teljes időrendi listája.",
    back: "Vissza a dashboardra",
    total: (count: number) => `${count} munka`,
    simpleBooking: "Egyszerű foglalás",
    booked: "Foglalva",
    gallery: "galéria",
    project: "Projekt",
    clientMeeting: "Ügyfélmeeting",
    task: "Feladat",
    meeting: "Meeting",
    miniSessionBooking: "Mini session foglalás",
    attendees: (count: number) => `${count} fő`,
    missingVenue: "Nincs helyszín",
    missingTime: "Nincs időpont",
    emptyTitle: "Nincs elkövetkező munka",
    emptyDescription: "A jövőbeli ügyfélprojektek és egyszerű foglalások itt jelennek majd meg."
  },
  de: {
    area: "Arbeiten",
    title: "Anstehende Arbeiten",
    description: "Vollständige chronologische Liste der Kundenprojekte, Meetings und einfachen Terminbuchungen.",
    back: "Zurück zum Dashboard",
    total: (count: number) => `${count} Arbeiten`,
    simpleBooking: "Einfache Buchung",
    booked: "Gebucht",
    gallery: "Galerie",
    project: "Projekt",
    clientMeeting: "Kundenmeeting",
    task: "Aufgabe",
    meeting: "Meeting",
    miniSessionBooking: "Mini-Session-Buchung",
    attendees: (count: number) => `${count} ${count === 1 ? "Person" : "Personen"}`,
    missingVenue: "Kein Ort",
    missingTime: "Keine Uhrzeit",
    emptyTitle: "Keine anstehenden Arbeiten",
    emptyDescription: "Zukünftige Kundenprojekte und einfache Buchungen erscheinen hier."
  },
  en: {
    area: "Work",
    title: "Upcoming work",
    description: "Full chronological list of client projects, meetings and simple appointment bookings.",
    back: "Back to dashboard",
    total: (count: number) => `${count} work items`,
    simpleBooking: "Simple booking",
    booked: "Booked",
    gallery: "gallery",
    project: "Project",
    clientMeeting: "Client meeting",
    task: "Task",
    meeting: "Meeting",
    miniSessionBooking: "Mini session booking",
    attendees: (count: number) => `${count} attendee${count === 1 ? "" : "s"}`,
    missingVenue: "No location",
    missingTime: "No time",
    emptyTitle: "No upcoming work",
    emptyDescription: "Future client projects and simple bookings will appear here."
  }
} as const;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function miniSessionLanguageForAdmin(language: AdminLanguage) {
  return language === "hu" ? "hu" : "de";
}

function formatProjectTimeText(project: { startTime: string | null; endTime: string | null }) {
  if (!project.startTime || !project.endTime) {
    return null;
  }

  return `${project.startTime} - ${project.endTime}`;
}

export default async function AdminWorkPage() {
  const [admin, language] = await Promise.all([requireAdmin(), getAdminLanguage()]);
  const copy = WORK_PAGE_COPY[language];
  const today = startOfToday();
  const projectWhere = { customer: adminOwnedWhere(admin) };

  const [projects, bookings, meetings, tasks] = await Promise.all([
    prisma.customerProject.findMany({
      where: {
        ...projectWhere,
        eventDate: { gte: today },
        status: { not: "archived" }
      },
      orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        projectType: true,
        status: true,
        eventDate: true,
        startTime: true,
        endTime: true,
        venue: true,
        customer: {
          select: {
            id: true,
            coupleName: true
          }
        },
        _count: {
          select: {
            galleries: true
          }
        }
      }
    }),
    prisma.miniSessionBooking.findMany({
      where: {
        status: MINI_SESSION_BOOKING_STATUS_BOOKED,
        source: { not: MINI_SESSION_BOOKING_SOURCE_BLOCKED },
        startsAt: { gte: today },
        customerId: null,
        projectId: null,
        miniSession: adminOwnedWhere(admin)
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        attendeeCount: true,
        startsAt: true,
        endsAt: true,
        miniSession: {
          select: {
            id: true,
            title: true,
            location: true
          }
        }
      }
    }),
    prisma.customerMeeting.findMany({
      where: {
        customer: adminOwnedWhere(admin),
        eventDate: { gte: today },
        status: { not: "cancelled" }
      },
      orderBy: [{ eventDate: "asc" }, { startTime: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        meetingType: true,
        status: true,
        eventDate: true,
        startTime: true,
        endTime: true,
        location: true,
        customer: {
          select: {
            id: true,
            coupleName: true
          }
        }
      }
    }),
    prisma.customerTask.findMany({
      where: {
        customer: adminOwnedWhere(admin),
        dueDate: { not: null },
        status: { notIn: ["done", "cancelled"] }
      },
      orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        taskType: true,
        status: true,
        priority: true,
        dueDate: true,
        dueTime: true,
        customer: {
          select: {
            id: true,
            coupleName: true
          }
        },
        project: {
          select: {
            title: true
          }
        }
      }
    })
  ]);

  const works: UpcomingWorkCard[] = [
    ...projects
      .filter((project): project is typeof project & { eventDate: Date } => project.eventDate instanceof Date)
      .map((project) => ({
        key: `project-${project.id}`,
        date: project.eventDate,
        href: `/admin/clients/${project.customer.id}?tab=projects`,
        title: project.title,
        subtitle: project.customer.coupleName,
        time: formatProjectTimeText(project),
        venue: project.venue,
        badges: [customerProjectTypeLabel(project.projectType), customerProjectStatusLabel(project.status)] as [string, string],
        footer: `${project._count.galleries} ${copy.gallery}`,
        footerLabel: copy.project
      })),
    ...bookings.map((booking) => ({
      key: `booking-${booking.id}`,
      date: booking.startsAt,
      href: `/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`,
      title: booking.miniSession.title,
      subtitle: booking.name,
      time: formatMiniSessionSlot(booking.startsAt, booking.endsAt, miniSessionLanguageForAdmin(language)),
      venue: booking.miniSession.location,
      badges: [copy.simpleBooking, copy.booked] as [string, string],
      footer: `${copy.attendees(booking.attendeeCount)} · ${booking.email}`,
      footerLabel: copy.miniSessionBooking
    })),
    ...meetings.map((meeting) => ({
      key: `meeting-${meeting.id}`,
      date: meeting.eventDate,
      href: `/admin/clients/${meeting.customer.id}?tab=meetings`,
      title: meeting.title,
      subtitle: meeting.customer.coupleName,
      time: formatProjectTimeText(meeting),
      venue: meeting.location,
      badges: [copy.clientMeeting, customerMeetingStatusLabel(meeting.status)] as [string, string],
      footer: customerMeetingTypeLabel(meeting.meetingType),
      footerLabel: copy.meeting
    })),
    ...tasks
      .filter((task): task is typeof task & { dueDate: Date } => task.dueDate instanceof Date)
      .map((task) => ({
        key: `task-${task.id}`,
        date: task.dueDate,
        href: `/admin/clients/${task.customer.id}?tab=tasks`,
        title: task.title,
        subtitle: task.customer.coupleName,
        time: task.dueTime,
        venue: task.project?.title ?? null,
        badges: [customerTaskTypeLabel(task.taskType), customerTaskStatusLabel(task.status)] as [string, string],
        footer: customerTaskPriorityLabel(task.priority),
        footerLabel: copy.task
    }))
  ].sort((left, right) => left.date.getTime() - right.date.getTime());

  return (
    <AdminShell>
      <div className="mb-6 rounded-md border border-brass/15 bg-white px-4 py-4 shadow-[0_1px_0_rgba(178,139,78,0.08)] md:px-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-brass">
              <FolderKanban size={15} />
              {copy.area}
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-ink">{copy.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">{copy.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center rounded-full bg-brass/10 px-3 text-xs font-medium text-brass">
              {copy.total(works.length)}
            </span>
            <Link
              href="/admin/dashboard"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/12 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/25 hover:bg-paper"
            >
              <ArrowLeft size={15} />
              {copy.back}
            </Link>
          </div>
        </div>
      </div>

      <section className="rounded-md border border-ink/12 bg-white">
        {works.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<CalendarClock size={18} className="text-ink" />}
              title={copy.emptyTitle}
              description={copy.emptyDescription}
            />
          </div>
        ) : (
          <UpcomingWorkCardGrid
            works={works}
            language={language}
            missingTime={copy.missingTime}
            missingVenue={copy.missingVenue}
          />
        )}
      </section>
    </AdminShell>
  );
}
