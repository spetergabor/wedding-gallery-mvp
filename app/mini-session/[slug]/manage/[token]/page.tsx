import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  Images,
  MapPin,
  Settings2,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MiniSessionClientProgress } from "@/components/mini-session-client-progress";
import { getAdminSession } from "@/lib/auth";
import { clientGalleryUrl, miniSessionBookingCalendarUrl } from "@/lib/email";
import {
  MINI_SESSION_WORKFLOW_CLIENT_SELECTION,
  MINI_SESSION_WORKFLOW_DELIVERED,
  MINI_SESSION_WORKFLOW_FINAL_UPLOAD,
  MINI_SESSION_WORKFLOW_RAW_UPLOAD,
  deriveMiniSessionWorkflowStage
} from "@/lib/mini-session-workflow";
import {
  formatMiniSessionSlotWithDate,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  MINI_SESSION_BOOKING_STATUS_NO_SHOW,
  normalizeMiniSessionLanguage
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

const COPY = {
  hu: {
    eyebrow: "Mini fotózás",
    progress: ["Időpont", "Fotózás", "Válogatás", "Utómunka", "Kész galéria"],
    appointment: "Időpont lefoglalva",
    appointmentText: "Itt találod a fotózás adatait. Az időpont előtt innen tudod módosítani vagy lemondani a foglalást.",
    waiting: "Hamarosan érkezik a válogatás",
    waitingText: "Köszönjük, hogy itt voltál! A fotós előkészíti a nyers előnézeteket, és e-mailben jelez, amint válogathatsz.",
    selection: "Válaszd ki a kedvenceidet",
    selectionText: "A válogatás elkészült. Jelöld meg a kedvenceidet, majd a galériában zárd le és küldd el a választásodat.",
    selectionButton: "Válogatás megnyitása",
    editing: "A képeid utómunkán vannak",
    editingText: "A választásod megérkezett. A fotós most a kiválasztott képeiden dolgozik; e-mailt kapsz, amikor elkészültek.",
    ready: "Elkészült a galériád",
    readyText: "A kidolgozott képeid megtekinthetők és letölthetők a kész galériából.",
    readyButton: "Kész galéria megnyitása",
    reschedule: "Időpont módosítása",
    cancel: "Időpont lemondása",
    calendar: "Naptárhoz adás",
    admin: "Admin munkatér megnyitása",
    cancelled: "A foglalás lemondva",
    cancelledText: "Ez az időpont már nem aktív.",
    noShow: "A fotózás nem valósult meg",
    noShowText: "A foglalás lezárult. Ha kérdésed van, válaszolj a kapott e-mailre.",
    photos: "kép"
  },
  de: {
    eyebrow: "Mini-Shooting",
    progress: ["Termin", "Shooting", "Auswahl", "Bearbeitung", "Fertige Galerie"],
    appointment: "Termin gebucht",
    appointmentText: "Hier findest du alle Angaben zum Shooting. Vor dem Termin kannst du deine Buchung hier ändern oder stornieren.",
    waiting: "Deine Auswahl wird vorbereitet",
    waitingText: "Danke, dass du da warst! Dein Fotograf bereitet die Vorschauen vor und informiert dich per E-Mail, sobald du auswählen kannst.",
    selection: "Wähle deine Lieblingsbilder",
    selectionText: "Deine Auswahlgalerie ist bereit. Markiere deine Favoriten und schließe die Auswahl anschließend in der Galerie ab.",
    selectionButton: "Bildauswahl öffnen",
    editing: "Deine Bilder werden bearbeitet",
    editingText: "Deine Auswahl ist angekommen. Dein Fotograf bearbeitet jetzt deine gewählten Bilder; du erhältst eine E-Mail, sobald sie fertig sind.",
    ready: "Deine Galerie ist fertig",
    readyText: "Deine fertig bearbeiteten Bilder kannst du jetzt in der Galerie ansehen und herunterladen.",
    readyButton: "Fertige Galerie öffnen",
    reschedule: "Termin ändern",
    cancel: "Termin stornieren",
    calendar: "Zum Kalender hinzufügen",
    admin: "Admin-Arbeitsbereich öffnen",
    cancelled: "Buchung storniert",
    cancelledText: "Dieser Termin ist nicht mehr aktiv.",
    noShow: "Das Shooting hat nicht stattgefunden",
    noShowText: "Die Buchung wurde abgeschlossen. Bei Fragen antworte bitte auf die erhaltene E-Mail.",
    photos: "Bilder"
  }
} as const;

function workflowIndex(booking: {
  startsAt: Date;
  workflowStatus: string;
  shootCompletedAt: Date | null;
  selectionSentAt: Date | null;
  selectionSubmittedAt: Date | null;
  finalDeliveredAt: Date | null;
  proofingGallery: { proofingInviteSentAt: Date | null; proofingStatus: string } | null;
  finalGallery: { finalDeliveryEmailSentAt: Date | null } | null;
}) {
  const stage = deriveMiniSessionWorkflowStage(booking);

  if (stage === MINI_SESSION_WORKFLOW_DELIVERED) return 4;
  if (stage === MINI_SESSION_WORKFLOW_FINAL_UPLOAD) return 3;
  if (stage === MINI_SESSION_WORKFLOW_CLIENT_SELECTION) return 2;
  if (stage === MINI_SESSION_WORKFLOW_RAW_UPLOAD || booking.startsAt.getTime() <= Date.now()) return 1;
  return 0;
}

export default async function MiniSessionManagePage({
  params
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const [{ slug, token }, admin] = await Promise.all([params, getAdminSession()]);
  const booking = await prisma.miniSessionBooking.findUnique({
    where: { cancelToken: token },
    include: {
      miniSession: {
        select: {
          id: true,
          adminId: true,
          slug: true,
          title: true,
          location: true,
          language: true,
          admin: {
            select: {
              siteSettings: { select: { businessName: true, publicSubdomain: true } }
            }
          }
        }
      },
      proofingGallery: {
        select: {
          slug: true,
          clientAccessToken: true,
          proofingInviteSentAt: true,
          proofingStatus: true,
          _count: { select: { photos: true } }
        }
      },
      finalGallery: {
        select: {
          slug: true,
          finalDeliveryEmailSentAt: true,
          _count: { select: { photos: true } }
        }
      }
    }
  });

  if (!booking || booking.miniSession.slug !== slug) notFound();

  const language = normalizeMiniSessionLanguage(booking.miniSession.language);
  const copy = COPY[language];
  const currentIndex = workflowIndex(booking);
  const publicSubdomain = booking.miniSession.admin.siteSettings?.publicSubdomain ?? null;
  const adminHref = `/admin/mini-sessions/${booking.miniSession.id}/bookings/${booking.id}`;
  const canAdminister = admin?.workspaceAdminId === booking.miniSession.adminId;
  const canManageAppointment = booking.status === MINI_SESSION_BOOKING_STATUS_BOOKED && booking.startsAt.getTime() > Date.now();
  const proofingHref = booking.proofingGallery?.clientAccessToken
    ? clientGalleryUrl(booking.proofingGallery.slug, booking.proofingGallery.clientAccessToken, publicSubdomain)
    : null;
  const finalHref = booking.finalGallery ? `/g/${booking.finalGallery.slug}` : null;
  const brandName = booking.miniSession.admin.siteSettings?.businessName || "Spetly";

  let title: string = copy.appointment;
  let description: string = copy.appointmentText;
  let icon: ReactNode = <CalendarClock size={23} />;
  let action: ReactNode = null;

  if (booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED) {
    title = copy.cancelled;
    description = copy.cancelledText;
  } else if (booking.status === MINI_SESSION_BOOKING_STATUS_NO_SHOW) {
    title = copy.noShow;
    description = copy.noShowText;
  } else if (currentIndex === 1) {
    title = copy.waiting;
    description = copy.waitingText;
    icon = <Sparkles size={23} />;
  } else if (currentIndex === 2) {
    title = copy.selection;
    description = copy.selectionText;
    icon = <Images size={23} />;
    action = proofingHref ? <a href={proofingHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white"><ExternalLink size={16} />{copy.selectionButton}</a> : null;
  } else if (currentIndex === 3) {
    title = copy.editing;
    description = copy.editingText;
    icon = <Settings2 size={23} />;
  } else if (currentIndex === 4) {
    title = copy.ready;
    description = copy.readyText;
    icon = <CheckCircle2 size={23} />;
    action = finalHref ? <Link href={finalHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white"><ExternalLink size={16} />{copy.readyButton}</Link> : null;
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">{copy.eyebrow}</p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{booking.miniSession.title}</h1>
              <p className="mt-2 text-sm text-graphite/65">{brandName}</p>
            </div>
            {canAdminister ? <Link href={adminHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/15 px-3 text-sm font-medium"><Settings2 size={15} />{copy.admin}</Link> : null}
          </div>
          <div className="mt-6"><MiniSessionClientProgress items={copy.progress.map((label) => ({ label }))} currentIndex={currentIndex} /></div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-8">
            <div className="flex size-12 items-center justify-center rounded-full bg-ink text-white">{icon}</div>
            <h2 className="mt-5 text-2xl font-semibold">{title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-graphite/70">{description}</p>
            {action ? <div className="mt-6">{action}</div> : null}

            {currentIndex === 0 && canManageAppointment ? (
              <div className="mt-7 flex flex-col gap-3 border-t border-ink/10 pt-6 sm:flex-row sm:flex-wrap">
                <Link href={`/mini-session/${slug}/reschedule/${token}`} className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white">{copy.reschedule}</Link>
                <Link href={miniSessionBookingCalendarUrl(slug, token, publicSubdomain)} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 px-4 text-sm font-medium"><CalendarPlus size={16} />{copy.calendar}</Link>
                <Link href={`/mini-session/${slug}/cancel/${token}`} className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-red-700">{copy.cancel}</Link>
              </div>
            ) : null}
          </section>

          <aside className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
            <h2 className="text-base font-semibold">{booking.name}</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="text-xs uppercase tracking-[0.14em] text-graphite/50">{copy.progress[0]}</dt><dd className="mt-1 flex items-start gap-2 font-medium"><CalendarClock className="mt-0.5 shrink-0" size={15} />{formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt, language)}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.14em] text-graphite/50">{language === "de" ? "Ort" : "Helyszín"}</dt><dd className="mt-1 flex items-start gap-2 font-medium"><MapPin className="mt-0.5 shrink-0" size={15} />{booking.miniSession.location}</dd></div>
              {currentIndex === 2 && booking.proofingGallery ? <div><dt className="text-xs uppercase tracking-[0.14em] text-graphite/50">{language === "de" ? "Auswahlgalerie" : "Válogatógaléria"}</dt><dd className="mt-1 font-medium">{booking.proofingGallery._count.photos} {copy.photos}</dd></div> : null}
              {currentIndex === 4 && booking.finalGallery ? <div><dt className="text-xs uppercase tracking-[0.14em] text-graphite/50">{language === "de" ? "Fertige Galerie" : "Kész galéria"}</dt><dd className="mt-1 font-medium">{booking.finalGallery._count.photos} {copy.photos}</dd></div> : null}
            </dl>
          </aside>
        </div>
      </div>
    </main>
  );
}
