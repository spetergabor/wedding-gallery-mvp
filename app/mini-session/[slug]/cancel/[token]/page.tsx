import { CalendarClock, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { FormSubmitButton } from "@/components/form-submit-button";
import { cancelMiniSessionBookingAction } from "@/lib/mini-session-actions";
import {
  formatMiniSessionDate,
  formatMiniSessionSlot,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  normalizeMiniSessionLanguage
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

const MINI_SESSION_CANCEL_COPY = {
  hu: {
    title: "Időpont törlése",
    alreadyCancelled: "Ez a foglalás már korábban törölve lett.",
    intro: "Ha mégsem jó az időpont, itt tudod törölni a foglalásodat.",
    pending: "Törlés...",
    submit: "Foglalás törlése"
  },
  de: {
    title: "Termin stornieren",
    alreadyCancelled: "Diese Buchung wurde bereits storniert.",
    intro: "Falls der Termin doch nicht passt, kannst du deine Buchung hier stornieren.",
    pending: "Stornieren...",
    submit: "Buchung stornieren"
  }
} as const;

export default async function CancelMiniSessionBookingPage({
  params
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const booking = await prisma.miniSessionBooking.findUnique({
    where: { cancelToken: token },
    include: {
      miniSession: true
    }
  });

  if (!booking || booking.miniSession.slug !== slug) {
    notFound();
  }

  const alreadyCancelled = booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED;
  const language = normalizeMiniSessionLanguage(booking.miniSession.language);
  const copy = MINI_SESSION_CANCEL_COPY[language];

  return (
    <main className="min-h-screen bg-paper px-5 py-10 text-ink">
      <section className="mx-auto max-w-xl rounded-lg border border-ink/10 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-md bg-red-50 text-red-700">
          <XCircle size={22} />
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-ink">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-graphite/70">
          {alreadyCancelled
            ? copy.alreadyCancelled
            : copy.intro}
        </p>

        <div className="mt-6 rounded-md border border-ink/10 bg-paper p-4">
          <p className="text-sm font-semibold text-ink">{booking.miniSession.title}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-graphite/75">
            <CalendarClock size={15} />
            {formatMiniSessionDate(booking.miniSession.sessionDate, language)} · {formatMiniSessionSlot(booking.startsAt, booking.endsAt, language)}
          </p>
          <p className="mt-2 text-sm text-graphite/75">{booking.name} · {booking.email}</p>
        </div>

        {!alreadyCancelled ? (
          <form action={cancelMiniSessionBookingAction.bind(null, token)} className="mt-6">
            <FormSubmitButton variant="danger" pendingLabel={copy.pending}>{copy.submit}</FormSubmitButton>
          </form>
        ) : null}
      </section>
    </main>
  );
}
