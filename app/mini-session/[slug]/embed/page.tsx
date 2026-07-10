import { CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Alert } from "@/components/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MiniSessionSlotCalendar } from "@/components/mini-session-slot-calendar";
import { getAvailableMiniSessionSlots } from "@/lib/mini-session-availability";
import {
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
    text: "Válassz egy szabad időpontot, majd folytasd a foglalást.",
    inactive: "Ez a foglaló jelenleg nem elérhető.",
    soldOut: "Minden időpont betelt.",
    continue: "Foglalás folytatása",
    continuing: "Megnyitás..."
  },
  de: {
    title: "Termin auswählen",
    text: "Wähle einen freien Termin und fahre mit der Buchung fort.",
    inactive: "Diese Buchung ist derzeit nicht verfügbar.",
    soldOut: "Alle Termine sind ausgebucht.",
    continue: "Buchung fortsetzen",
    continuing: "Öffnen..."
  }
} as const;

export default async function MiniSessionEmbedPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await prisma.miniSession.findUnique({
    where: { slug },
    include: {
      availabilityRules: true
    }
  });

  if (!session) {
    notFound();
  }

  const language = normalizeMiniSessionLanguage(session.language);
  const copy = EMBED_COPY[language];
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

  return (
    <main className="min-h-screen bg-white text-ink">
      <section className="mx-auto max-w-xl p-4">
        <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <CheckCircle2 size={18} />
              {copy.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-graphite/65">{copy.text}</p>
          </div>

          {!session.isActive ? (
            <div className="mt-4">
              <Alert title={copy.inactive} />
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="mt-4">
              <Alert title={copy.soldOut} />
            </div>
          ) : (
            <form method="get" action={`/mini-session/${session.slug}`} target="_blank" className="mt-4">
              {isRecurring ? (
                <MiniSessionSlotCalendar days={recurringSlotDays} defaultSlotToken={defaultSlotToken} language={language} />
              ) : (
                <div className="space-y-4">
                  {availableSlotGroups.map((group) => (
                    <section key={group.key} className="rounded-md border border-ink/10 bg-paper p-3">
                      <h2 className="text-sm font-semibold text-ink">{group.label}</h2>
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

              <div className="mt-4 border-t border-ink/10 pt-4">
                <FormSubmitButton pendingLabel={copy.continuing} className="w-full">
                  {copy.continue}
                </FormSubmitButton>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
