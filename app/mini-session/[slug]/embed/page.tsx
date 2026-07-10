import { CalendarClock, CalendarPlus, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/alert";
import { MiniSessionEmbedBookingWizard } from "@/components/mini-session-embed-booking-wizard";
import { getAvailableMiniSessionSlots } from "@/lib/mini-session-availability";
import { bookMiniSessionAction } from "@/lib/mini-session-actions";
import {
  formatMiniSessionDateRange,
  formatMiniSessionSlot,
  groupMiniSessionSlotsByDate,
  MINI_SESSION_BOOKING_MODE_RECURRING,
  normalizeMiniSessionLanguage
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
    bookedText: "A megerősítő e-mail hamarosan megérkezik.",
    addCalendar: "Naptárhoz adás",
    inactive: "Ez a foglaló jelenleg nem elérhető.",
    soldOut: "Minden időpont betelt.",
    missing: "Kérlek tölts ki minden kötelező mezőt.",
    takenTitle: "Ez az időpont közben betelt.",
    takenText: "Válassz egy másik szabad idősávot.",
    noticeTitle: "Ez az időpont már nem foglalható.",
    noticeText: "Válassz egy későbbi szabad időpontot.",
    invalidSlot: "Érvénytelen időpont."
  },
  de: {
    title: "Termin auswählen",
    text: "Wähle einen freien Termin und gib deine Daten ein, um die Buchung abzuschließen.",
    recurringMeta: "Laufend buchbar",
    bookedTitle: "Danke, deine Buchung wurde gespeichert.",
    bookedText: "Die Bestätigung per E-Mail kommt in Kürze.",
    addCalendar: "Zum Kalender hinzufügen",
    inactive: "Diese Buchung ist derzeit nicht verfügbar.",
    soldOut: "Alle Termine sind ausgebucht.",
    missing: "Bitte fülle alle Pflichtfelder aus.",
    takenTitle: "Dieser Termin wurde inzwischen gebucht.",
    takenText: "Bitte wähle einen anderen freien Zeitslot.",
    noticeTitle: "Dieser Termin ist nicht mehr buchbar.",
    noticeText: "Bitte wähle einen späteren freien Termin.",
    invalidSlot: "Ungültiger Termin."
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
      admin: {
        select: {
          siteSettings: {
            select: {
              businessName: true
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
  const dateLabel = isRecurring ? copy.recurringMeta : formatMiniSessionDateRange(session.startsAt, session.endsAt, language);
  const calendarHref = flags.calendar ? `/mini-session/${session.slug}/calendar/${encodeURIComponent(flags.calendar)}` : null;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="mx-auto max-w-2xl p-4 sm:p-5">
        <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
          <header className="border-b border-ink/10 bg-white p-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass">{brandName}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-ink sm:text-3xl">{session.title}</h1>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm text-graphite/70">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-3 py-2">
                <CalendarClock size={15} />
                {dateLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-3 py-2">
                <MapPin size={15} />
                {session.location}
              </span>
            </div>
            {session.notes ? <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-sm leading-6 text-graphite/70">{session.notes}</p> : null}
            {session.stylingNotes ? <p className="mx-auto mt-3 max-w-xl whitespace-pre-line rounded-md bg-paper px-3 py-3 text-sm leading-6 text-graphite/70">{session.stylingNotes}</p> : null}
          </header>

          <div className="p-4 sm:p-5">
            <div className="mb-4 text-center">
              <h2 className="text-lg font-semibold text-ink">{copy.title}</h2>
              <p className="mt-1 text-sm leading-6 text-graphite/65">{copy.text}</p>
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
              {flags.error === "inactive" ? <Alert title={copy.inactive} variant="error" /> : null}
            </div>

            {flags.booked ? null : !session.isActive ? (
              <Alert title={copy.inactive} />
            ) : availableSlots.length === 0 ? (
              <Alert title={copy.soldOut} />
            ) : (
              <form action={bookMiniSessionAction.bind(null, session.slug)}>
                <input type="hidden" name="returnTo" value="embed" />
                <MiniSessionEmbedBookingWizard days={bookingDays} language={language} />
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
