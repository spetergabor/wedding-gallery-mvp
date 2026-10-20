import { CalendarClock, CalendarPlus, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/alert";
import { MiniSessionBookingConfirmationModal } from "@/components/mini-session-booking-confirmation-modal";
import { MiniSessionEmbedBookingForm } from "@/components/mini-session-embed-booking-form";
import { MiniSessionEmbedAutoResize } from "@/components/mini-session-embed-auto-resize";
import { MiniSessionEmbedConfirmationPopup } from "@/components/mini-session-embed-confirmation-popup";
import { MiniSessionEmbedBookingWizard } from "@/components/mini-session-embed-booking-wizard";
import { miniSessionBookingCalendarUrl } from "@/lib/email";
import { getAvailableMiniSessionSlots } from "@/lib/mini-session-availability";
import { bookMiniSessionAction } from "@/lib/mini-session-actions";
import {
  formatMiniSessionEventDates,
  formatMiniSessionSlot,
  groupMiniSessionSlotsByDate,
  MINI_SESSION_BOOKING_MODE_RECURRING,
  normalizeMiniSessionLanguage,
  normalizeMiniSessionTheme
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

const EMBED_COPY = {
  hu: {
    title: "Időpont választása",
    text: "Válassz egy szabad időpontot, majd add meg az adataidat a foglalás véglegesítéséhez.",
    recurringMeta: "Folyamatosan foglalható",
    bookedTitle: "Köszönöm, a foglalásod rögzítve lett.",
    bookedText: "A foglalás sikeres és érvényes. A visszaigazolást e-mailben is elküldtük; ha nem találod, nézd meg a spam vagy promóciók mappát is.",
    addCalendar: "Naptárhoz adás",
    inactive: "Ez a foglaló jelenleg nem elérhető.",
    soldOut: "Minden időpont betelt.",
    missing: "Kérlek tölts ki minden kötelező mezőt.",
    takenTitle: "Ez az időpont közben betelt.",
    takenText: "Válassz egy másik szabad idősávot.",
    noticeTitle: "Ez az időpont már nem foglalható.",
    noticeText: "Válassz egy későbbi szabad időpontot.",
    invalidSlot: "Érvénytelen időpont.",
    rateLimited: "Túl sok próbálkozás. Várj pár percet, majd próbáld újra."
  },
  de: {
    title: "Termin auswählen",
    text: "Wähle einen freien Termin und gib deine Daten ein, um die Buchung abzuschließen.",
    recurringMeta: "Laufend buchbar",
    bookedTitle: "Danke, deine Buchung wurde gespeichert.",
    bookedText: "Die Buchung ist erfolgreich und verbindlich. Wir haben die Bestätigung per E-Mail geschickt; falls du sie nicht findest, prüfe bitte auch den Spam- oder Werbeordner.",
    addCalendar: "Zum Kalender hinzufügen",
    inactive: "Diese Buchung ist derzeit nicht verfügbar.",
    soldOut: "Alle Termine sind ausgebucht.",
    missing: "Bitte fülle alle Pflichtfelder aus.",
    takenTitle: "Dieser Termin wurde inzwischen gebucht.",
    takenText: "Bitte wähle einen anderen freien Zeitslot.",
    noticeTitle: "Dieser Termin ist nicht mehr buchbar.",
    noticeText: "Bitte wähle einen späteren freien Termin.",
    invalidSlot: "Ungültiger Termin.",
    rateLimited: "Zu viele Versuche. Bitte warte kurz und versuche es erneut."
  }
} as const;

export default async function MiniSessionEmbedPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ booked?: string; error?: string; calendar?: string }>;
}) {
  const { slug } = await params;
  const flags = await searchParams;
  const session = await prisma.miniSession.findUnique({
    where: { slug },
    include: {
      availabilityRules: true,
      eventDays: {
        orderBy: { date: "asc" }
      },
      admin: {
        select: {
          siteSettings: {
            select: {
              businessName: true,
              publicSubdomain: true
            }
          }
        }
      }
    }
  });

  if (!session) {
    notFound();
  }

  const language = normalizeMiniSessionLanguage(session.language);
  const publicTheme = normalizeMiniSessionTheme(session.publicTheme);
  const copy = EMBED_COPY[language];
  const availableSlots = await getAvailableMiniSessionSlots(session);
  const availableSlotGroups = groupMiniSessionSlotsByDate(availableSlots, language);
  const bookingDays = availableSlotGroups.map((group) => ({
    key: group.key,
    label: group.label,
    slots: group.slots.map((slot) => ({
      token: slot.token,
      label: formatMiniSessionSlot(slot.startsAt, slot.endsAt, language)
    }))
  }));
  const isRecurring = session.bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING;
  const brandName = session.admin.siteSettings?.businessName || "Spetly";
  const dateLabel = isRecurring
    ? copy.recurringMeta
    : formatMiniSessionEventDates(session.eventDays, session.startsAt, session.endsAt, language);
  const publicSubdomain = session.admin.siteSettings?.publicSubdomain ?? null;
  const calendarHref = flags.calendar ? miniSessionBookingCalendarUrl(session.slug, flags.calendar, publicSubdomain) : null;

  return (
    <main className={`mini-session-embed-root mini-session-theme-${publicTheme} min-h-0 bg-transparent text-ink`}>
      <MiniSessionEmbedAutoResize />
      <MiniSessionEmbedConfirmationPopup hasError={Boolean(flags.error)} />
      {flags.booked ? (
        <MiniSessionBookingConfirmationModal language={language} calendarHref={calendarHref} theme={publicTheme} />
      ) : null}
      <section className="mini-session-embed-frame mx-auto max-w-2xl p-4 sm:p-5">
        <div className="mini-session-embed-card overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
          <header className="mini-session-embed-header border-b border-ink/10 bg-white p-5 text-center">
            <p className="mini-session-embed-kicker text-[11px] font-semibold uppercase tracking-[0.18em] text-brass">{brandName}</p>
            <h1 className="mini-session-embed-title mt-2 text-2xl font-semibold tracking-normal text-ink sm:text-3xl">{session.title}</h1>
            <div className="mini-session-embed-meta mt-4 flex flex-wrap justify-center gap-2 text-sm text-graphite/70">
              <span className="mini-session-embed-pill inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-3 py-2">
                <CalendarClock size={15} />
                {dateLabel}
              </span>
              <span className="mini-session-embed-pill inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-3 py-2">
                <MapPin size={15} />
                {session.location}
              </span>
            </div>
            {session.notes ? <p className="mini-session-embed-note mx-auto mt-4 max-w-xl whitespace-pre-line text-sm leading-6 text-graphite/70">{session.notes}</p> : null}
            {session.stylingNotes ? <p className="mini-session-embed-styling mx-auto mt-3 max-w-xl whitespace-pre-line rounded-md bg-paper px-3 py-3 text-sm leading-6 text-graphite/70">{session.stylingNotes}</p> : null}
          </header>

          <div className="mini-session-embed-content p-4 sm:p-5">
            <div className="mini-session-embed-intro mb-4 text-center">
              <h2 className="mini-session-embed-intro-title text-lg font-semibold text-ink">{copy.title}</h2>
              <p className="mini-session-embed-intro-text mt-1 text-sm leading-6 text-graphite/65">{copy.text}</p>
            </div>

            <div className="mb-4 space-y-3">
              {flags.booked ? (
                <Alert title={copy.bookedTitle} variant="success">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>{copy.bookedText}</span>
                    {calendarHref ? (
                      <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink shadow-sm transition hover:bg-paper" href={calendarHref} target="_blank">
                        <CalendarPlus size={15} />
                        {copy.addCalendar}
                      </Link>
                    ) : null}
                  </div>
                </Alert>
              ) : null}
              {flags.error === "missing" ? <Alert title={copy.missing} variant="error" /> : null}
              {flags.error === "taken" ? <Alert title={copy.takenTitle} variant="error">{copy.takenText}</Alert> : null}
              {flags.error === "notice" ? <Alert title={copy.noticeTitle} variant="error">{copy.noticeText}</Alert> : null}
              {flags.error === "slot" ? <Alert title={copy.invalidSlot} variant="error" /> : null}
              {flags.error === "rate_limit" ? <Alert title={copy.rateLimited} variant="error" /> : null}
              {flags.error === "inactive" ? <Alert title={copy.inactive} variant="error" /> : null}
            </div>

            {flags.booked ? null : !session.isActive ? (
              <Alert title={copy.inactive} />
            ) : availableSlots.length === 0 ? (
              <Alert title={copy.soldOut} />
            ) : (
              <MiniSessionEmbedBookingForm action={bookMiniSessionAction.bind(null, session.slug)} language={language} theme={publicTheme}>
                <input type="hidden" name="returnTo" value="embed" />
                <MiniSessionEmbedBookingWizard days={bookingDays} language={language} theme={publicTheme} />
              </MiniSessionEmbedBookingForm>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
