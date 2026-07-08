import { CalendarClock, CalendarPlus, CheckCircle2, MapPin, Sparkles, UserRound, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MiniSessionSlotCalendar } from "@/components/mini-session-slot-calendar";
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

const fieldClass =
  "h-12 w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-white px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";

const MINI_SESSION_PAGE_COPY = {
  hu: {
    availableTimes: "Foglalható időpontok",
    intro: "Válassz egy szabad idősávot, add meg az adataidat, és e-mailben küldjük a megerősítést.",
    recurringMeta: "Folyamatosan foglalható",
    bookedTitle: "Köszönöm, a foglalásod rögzítve lett.",
    bookedText: "A megerősítő e-mail hamarosan megérkezik.",
    addCalendar: "Naptárhoz adás",
    cancelledTitle: "A foglalás törölve lett.",
    removeCalendar: "Naptárból eltávolítás",
    missing: "Kérlek tölts ki minden kötelező mezőt.",
    takenTitle: "Ez az időpont közben betelt.",
    takenText: "Válassz egy másik szabad idősávot.",
    invalidSlot: "Érvénytelen időpont.",
    inactive: "Ez a foglaló jelenleg nem elérhető.",
    soldOut: "Minden időpont betelt.",
    stylingTitle: "Styling és előkészület",
    stylingIntro: "Pár praktikus infó a fotózás hangulatához.",
    chooseSlot: "Időpont kiválasztása",
    yourData: "Adataid",
    name: "Név",
    email: "E-mail",
    phone: "Telefonszám",
    attendeeCount: "Hányan jöttök a fotózásra?",
    book: "Időpont foglalása",
    booking: "Foglalás..."
  },
  de: {
    availableTimes: "Verfügbare Termine",
    intro: "Wähle einen freien Zeitslot, gib deine Daten ein und du erhältst die Bestätigung per E-Mail.",
    recurringMeta: "Laufend buchbar",
    bookedTitle: "Danke, deine Buchung wurde gespeichert.",
    bookedText: "Die Bestätigung per E-Mail kommt in Kürze.",
    addCalendar: "Zum Kalender hinzufügen",
    cancelledTitle: "Die Buchung wurde storniert.",
    removeCalendar: "Aus Kalender entfernen",
    missing: "Bitte fülle alle Pflichtfelder aus.",
    takenTitle: "Dieser Termin wurde inzwischen gebucht.",
    takenText: "Bitte wähle einen anderen freien Zeitslot.",
    invalidSlot: "Ungültiger Termin.",
    inactive: "Diese Mini Session ist derzeit nicht buchbar.",
    soldOut: "Alle Termine sind ausgebucht.",
    stylingTitle: "Styling und Vorbereitung",
    stylingIntro: "Ein paar praktische Hinweise für Stimmung und Styling.",
    chooseSlot: "Termin auswählen",
    yourData: "Deine Daten",
    name: "Name",
    email: "E-Mail",
    phone: "Telefonnummer",
    attendeeCount: "Wie viele Personen kommen zum Shooting?",
    book: "Termin buchen",
    booking: "Buchung..."
  }
} as const;

export default async function PublicMiniSessionPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ booked?: string; cancelled?: string; error?: string; calendar?: string }>;
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
              businessName: true,
              contactEmail: true,
              contactPhone: true
            }
          }
        }
      }
    }
  });

  if (!session) {
    notFound();
  }

  const brandName = session.admin.siteSettings?.businessName || "Wedding Gallery";
  const language = normalizeMiniSessionLanguage(session.language);
  const copy = MINI_SESSION_PAGE_COPY[language];
  const availableSlots = await getAvailableMiniSessionSlots(session);
  const availableSlotGroups = groupMiniSessionSlotsByDate(availableSlots, language);
  const defaultSlotToken = availableSlots[0]?.token ?? "";
  const isRecurring = session.bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING;
  const recurringSlotDays = availableSlotGroups.map((group) => ({
    key: group.key,
    label: group.label,
    slots: group.slots.map((slot) => ({
      token: slot.token,
      label: formatMiniSessionSlot(slot.startsAt, slot.endsAt, language)
    }))
  }));
  const calendarHref = flags.calendar ? `/mini-session/${session.slug}/calendar/${encodeURIComponent(flags.calendar)}` : null;
  const hasCoverImage = Boolean(session.coverImageUrl);
  const eyebrowClass = hasCoverImage ? "text-white/80" : "text-brass";
  const headingClass = hasCoverImage ? "text-white drop-shadow-sm" : "text-ink";
  const metaClass = hasCoverImage ? "text-white/85" : "text-graphite/75";
  const metaPillClass = hasCoverImage ? "border-white/25 bg-white/15 text-white backdrop-blur" : "border-ink/10 bg-paper";
  const noteClass = hasCoverImage ? "text-white/85 drop-shadow-sm" : "text-graphite/75";
  const infoPanelClass = hasCoverImage ? "border-white/20 bg-white/90 text-ink shadow-soft backdrop-blur" : "border-ink/10 bg-paper";

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className={`relative overflow-hidden border-b border-ink/10 ${hasCoverImage ? "bg-ink text-white" : "bg-white"}`}>
        {session.coverImageUrl ? (
          <div className="absolute inset-0">
            <Image
              src={session.coverImageUrl}
              alt={`${session.title} borítókép`}
              fill
              priority
              unoptimized
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-ink/45" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink/45 to-transparent" />
          </div>
        ) : null}
        <div className="relative mx-auto grid min-h-[58vh] max-w-6xl gap-8 px-5 py-10 md:grid-cols-[minmax(0,1fr)_380px] md:items-end lg:px-10">
          <div className="pb-2">
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${eyebrowClass}`}>{brandName}</p>
            <h1 className={`mt-4 max-w-3xl text-4xl font-semibold tracking-normal md:text-6xl ${headingClass}`}>{session.title}</h1>
            <div className={`mt-6 flex flex-wrap gap-3 text-sm ${metaClass}`}>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${metaPillClass}`}>
                <CalendarClock size={16} />
                {isRecurring ? copy.recurringMeta : formatMiniSessionDateRange(session.startsAt, session.endsAt, language)}
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${metaPillClass}`}>
                <MapPin size={16} />
                {session.location}
              </span>
            </div>
            {session.notes ? <p className={`mt-6 max-w-2xl text-base leading-7 ${noteClass}`}>{session.notes}</p> : null}
          </div>
          <div className={`rounded-md border p-5 ${infoPanelClass}`}>
            <p className="text-sm font-semibold text-ink">{copy.availableTimes}</p>
            <p className="mt-2 text-sm leading-6 text-graphite/70">
              {copy.intro}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8 lg:px-10">
        <div className="mb-5 space-y-3">
          {flags.booked ? (
            <Alert title={copy.bookedTitle} variant="success">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{copy.bookedText}</span>
                {calendarHref ? (
                  <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink shadow-sm transition hover:bg-paper" href={calendarHref}>
                    <CalendarPlus size={15} />
                    {copy.addCalendar}
                  </Link>
                ) : null}
              </div>
            </Alert>
          ) : null}
          {flags.cancelled ? (
            <Alert title={copy.cancelledTitle} variant="success">
              {calendarHref ? (
                <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink shadow-sm transition hover:bg-paper" href={calendarHref}>
                  <CalendarPlus size={15} />
                  {copy.removeCalendar}
                </Link>
              ) : null}
            </Alert>
          ) : null}
          {flags.error === "missing" ? <Alert title={copy.missing} variant="error" /> : null}
          {flags.error === "taken" ? <Alert title={copy.takenTitle} variant="error">{copy.takenText}</Alert> : null}
          {flags.error === "slot" ? <Alert title={copy.invalidSlot} variant="error" /> : null}
          {flags.error === "inactive" ? <Alert title={copy.inactive} variant="error" /> : null}
        </div>

        {session.stylingNotes ? (
          <div className="mb-6 rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Sparkles size={19} />
              {copy.stylingTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-graphite/65">{copy.stylingIntro}</p>
            <p className="mt-4 whitespace-pre-line text-base leading-7 text-graphite/80">{session.stylingNotes}</p>
          </div>
        ) : null}

        {!session.isActive ? (
          <Alert title={copy.inactive} />
        ) : availableSlots.length === 0 ? (
          <Alert title={copy.soldOut} />
        ) : (
          <form action={bookMiniSessionAction.bind(null, session.slug)} className="grid gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
            <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <CheckCircle2 size={19} />
                {copy.chooseSlot}
              </h2>
              {isRecurring ? (
                <MiniSessionSlotCalendar
                  days={recurringSlotDays}
                  defaultSlotToken={defaultSlotToken}
                  language={language}
                />
              ) : (
                <div className="mt-5 space-y-4">
                  {availableSlotGroups.map((group) => (
                    <section key={group.key} className="rounded-md border border-ink/10 bg-paper p-3">
                      <h3 className="text-sm font-semibold text-ink">{group.label}</h3>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {group.slots.map((slot) => (
                          <label key={slot.token} className="relative flex min-h-12 cursor-pointer items-center rounded-md border border-ink/10 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/25">
                            <input
                              name="slot"
                              type="radio"
                              value={slot.token}
                              required
                              defaultChecked={slot.token === defaultSlotToken}
                              className="peer sr-only"
                            />
                            <span className="absolute inset-0 rounded-md ring-0 transition peer-checked:ring-2 peer-checked:ring-ink" />
                            <span className="relative">{formatMiniSessionSlot(slot.startsAt, slot.endsAt, language)}</span>
                          </label>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <UserRound size={19} />
                {copy.yourData}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-graphite">{copy.name}</span>
                  <input name="name" required className={fieldClass} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.email}</span>
                  <input name="email" type="email" required className={fieldClass} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.phone}</span>
                  <input name="phone" type="tel" required className={fieldClass} />
                </label>
                <label className="block space-y-2 sm:col-span-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                    <Users size={15} />
                    {copy.attendeeCount}
                  </span>
                  <input name="attendeeCount" type="number" min="1" defaultValue="1" required className={fieldClass} />
                </label>
              </div>
              <div className="mt-6 border-t border-ink/10 pt-5">
                <FormSubmitButton pendingLabel={copy.booking}>{copy.book}</FormSubmitButton>
              </div>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
