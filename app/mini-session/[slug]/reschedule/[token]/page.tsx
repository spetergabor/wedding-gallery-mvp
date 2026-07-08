import { CalendarClock, CalendarPlus, CheckCircle2, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MiniSessionSlotCalendar } from "@/components/mini-session-slot-calendar";
import { miniSessionBookingCalendarUrl } from "@/lib/email";
import { getAvailableMiniSessionSlots } from "@/lib/mini-session-availability";
import { rescheduleMiniSessionBookingAction } from "@/lib/mini-session-actions";
import {
  formatMiniSessionDateRange,
  formatMiniSessionSlot,
  formatMiniSessionSlotWithDate,
  groupMiniSessionSlotsByDate,
  MINI_SESSION_BOOKING_MODE_RECURRING,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  normalizeMiniSessionLanguage
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

const RESCHEDULE_COPY = {
  hu: {
    eyebrow: "Időpont módosítása",
    current: "Jelenlegi időpont",
    available: "Válassz új időpontot",
    save: "Új időpont mentése",
    saving: "Mentés...",
    back: "Vissza a foglaló oldalra",
    rescheduled: "Az időpont módosítva lett.",
    addCalendar: "Naptár frissítése",
    taken: "Ez az időpont közben betelt. Válassz másikat.",
    slot: "Érvénytelen időpont.",
    cancelled: "Ez a foglalás már törölve lett, nem módosítható.",
    soldOut: "Jelenleg nincs másik foglalható időpont."
  },
  de: {
    eyebrow: "Termin ändern",
    current: "Aktueller Termin",
    available: "Neuen Termin wählen",
    save: "Neuen Termin speichern",
    saving: "Speichern...",
    back: "Zur Buchungsseite",
    rescheduled: "Der Termin wurde geändert.",
    addCalendar: "Kalender aktualisieren",
    taken: "Dieser Termin wurde inzwischen gebucht. Bitte wähle einen anderen.",
    slot: "Ungültiger Termin.",
    cancelled: "Diese Buchung wurde bereits storniert und kann nicht geändert werden.",
    soldOut: "Derzeit ist kein anderer Termin verfügbar."
  }
} as const;

export default async function RescheduleMiniSessionBookingPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ error?: string; rescheduled?: string; calendar?: string }>;
}) {
  const [{ slug, token }, flags] = await Promise.all([params, searchParams]);
  const booking = await prisma.miniSessionBooking.findUnique({
    where: { cancelToken: token },
    include: {
      miniSession: {
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
      }
    }
  });

  if (!booking || booking.miniSession.slug !== slug) {
    notFound();
  }

  const language = normalizeMiniSessionLanguage(booking.miniSession.language);
  const copy = RESCHEDULE_COPY[language];
  const brandName = booking.miniSession.admin.siteSettings?.businessName || "Wedding Gallery";
  const availableSlots = await getAvailableMiniSessionSlots(booking.miniSession, {
    excludeBookingId: booking.id,
    excludeProjectId: booking.projectId
  });
  const availableSlotGroups = groupMiniSessionSlotsByDate(availableSlots, language);
  const currentSlotToken = booking.startsAt.toISOString();
  const defaultSlotToken = availableSlots.some((slot) => slot.token === currentSlotToken)
    ? currentSlotToken
    : availableSlots[0]?.token ?? "";
  const isRecurring = booking.miniSession.bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING;
  const recurringSlotDays = availableSlotGroups.map((group) => ({
    key: group.key,
    label: group.label,
    slots: group.slots.map((slot) => ({
      token: slot.token,
      label: formatMiniSessionSlot(slot.startsAt, slot.endsAt, language)
    }))
  }));
  const calendarHref = flags.calendar ? miniSessionBookingCalendarUrl(booking.miniSession.slug, flags.calendar) : null;

  return (
    <main className="min-h-screen bg-paper px-5 py-8 text-ink lg:px-10">
      <section className="mx-auto max-w-4xl rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">{copy.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{booking.miniSession.title}</h1>
        <p className="mt-2 text-sm text-graphite/70">{brandName}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-ink/10 bg-paper p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">{copy.current}</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarClock size={16} />
              {formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt, language)}
            </p>
          </div>
          <div className="rounded-md border border-ink/10 bg-paper p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">Session</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <MapPin size={16} />
              {booking.miniSession.location}
            </p>
            <p className="mt-1 text-xs text-graphite/60">
              {isRecurring ? copy.available : formatMiniSessionDateRange(booking.miniSession.startsAt, booking.miniSession.endsAt, language)}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {flags.rescheduled ? (
            <Alert title={copy.rescheduled} variant="success">
              {calendarHref ? (
                <Link href={calendarHref} className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink shadow-sm transition hover:bg-paper">
                  <CalendarPlus size={15} />
                  {copy.addCalendar}
                </Link>
              ) : null}
            </Alert>
          ) : null}
          {flags.error === "taken" ? <Alert title={copy.taken} variant="error" /> : null}
          {flags.error === "slot" ? <Alert title={copy.slot} variant="error" /> : null}
          {flags.error === "cancelled" || booking.status !== MINI_SESSION_BOOKING_STATUS_BOOKED ? <Alert title={copy.cancelled} variant="error" /> : null}
        </div>

        {booking.status !== MINI_SESSION_BOOKING_STATUS_BOOKED ? null : availableSlots.length === 0 ? (
          <div className="mt-6">
            <Alert title={copy.soldOut} />
          </div>
        ) : (
          <form action={rescheduleMiniSessionBookingAction.bind(null, token)} className="mt-7">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <CheckCircle2 size={19} />
              {copy.available}
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
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href={`/mini-session/${booking.miniSession.slug}`} className="text-sm font-medium text-graphite transition hover:text-ink">
                {copy.back}
              </Link>
              <FormSubmitButton pendingLabel={copy.saving}>{copy.save}</FormSubmitButton>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
