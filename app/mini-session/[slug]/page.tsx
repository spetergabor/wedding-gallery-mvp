import { CalendarClock, CheckCircle2, MapPin, UserRound, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { Alert } from "@/components/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { bookMiniSessionAction } from "@/lib/mini-session-actions";
import {
  createMiniSessionSlots,
  formatMiniSessionDate,
  formatMiniSessionSlot,
  MINI_SESSION_BOOKING_STATUS_BOOKED
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

const fieldClass =
  "h-12 w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-white px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";

export default async function PublicMiniSessionPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ booked?: string; cancelled?: string; error?: string }>;
}) {
  const { slug } = await params;
  const flags = await searchParams;
  const session = await prisma.miniSession.findUnique({
    where: { slug },
    include: {
      bookings: {
        where: { status: MINI_SESSION_BOOKING_STATUS_BOOKED },
        select: { startsAt: true }
      },
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

  const bookedTokens = new Set(session.bookings.map((booking) => booking.startsAt.toISOString()));
  const availableSlots = createMiniSessionSlots(session).filter((slot) => !bookedTokens.has(slot.token));
  const brandName = session.admin.siteSettings?.businessName || "Wedding Gallery";

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="border-b border-ink/10 bg-white">
        <div className="mx-auto grid min-h-[58vh] max-w-6xl gap-8 px-5 py-10 md:grid-cols-[minmax(0,1fr)_380px] md:items-end lg:px-10">
          <div className="pb-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">{brandName}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-normal text-ink md:text-6xl">{session.title}</h1>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-graphite/75">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-3 py-2">
                <CalendarClock size={16} />
                {formatMiniSessionDate(session.sessionDate)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-3 py-2">
                <MapPin size={16} />
                {session.location}
              </span>
            </div>
            {session.notes ? <p className="mt-6 max-w-2xl text-base leading-7 text-graphite/75">{session.notes}</p> : null}
          </div>
          <div className="rounded-md border border-ink/10 bg-paper p-5">
            <p className="text-sm font-semibold text-ink">Foglalható időpontok</p>
            <p className="mt-2 text-sm leading-6 text-graphite/70">
              Válassz egy szabad idősávot, add meg az adataidat, és e-mailben küldjük a megerősítést.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8 lg:px-10">
        <div className="mb-5 space-y-3">
          {flags.booked ? <Alert title="Köszönöm, a foglalásod rögzítve lett." variant="success">A megerősítő e-mail hamarosan megérkezik.</Alert> : null}
          {flags.cancelled ? <Alert title="A foglalás törölve lett." variant="success" /> : null}
          {flags.error === "missing" ? <Alert title="Kérlek tölts ki minden kötelező mezőt." variant="error" /> : null}
          {flags.error === "taken" ? <Alert title="Ez az időpont közben betelt." variant="error">Válassz egy másik szabad idősávot.</Alert> : null}
          {flags.error === "slot" ? <Alert title="Érvénytelen időpont." variant="error" /> : null}
          {flags.error === "inactive" ? <Alert title="Ez a mini session jelenleg nem foglalható." variant="error" /> : null}
        </div>

        {!session.isActive ? (
          <Alert title="Ez a mini session jelenleg nem foglalható." />
        ) : availableSlots.length === 0 ? (
          <Alert title="Minden időpont betelt." />
        ) : (
          <form action={bookMiniSessionAction.bind(null, session.slug)} className="grid gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
            <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <CheckCircle2 size={19} />
                Időpont kiválasztása
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {availableSlots.map((slot, index) => (
                  <label key={slot.token} className="relative flex min-h-14 cursor-pointer items-center rounded-md border border-ink/10 bg-paper px-4 text-sm font-medium text-ink transition hover:border-ink/25">
                    <input name="slot" type="radio" value={slot.token} required defaultChecked={index === 0} className="peer sr-only" />
                    <span className="absolute inset-0 rounded-md ring-0 transition peer-checked:ring-2 peer-checked:ring-ink" />
                    <span className="relative">{formatMiniSessionSlot(slot.startsAt, slot.endsAt)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <UserRound size={19} />
                Adataid
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-graphite">Név</span>
                  <input name="name" required className={fieldClass} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">E-mail</span>
                  <input name="email" type="email" required className={fieldClass} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">Telefonszám</span>
                  <input name="phone" type="tel" required className={fieldClass} />
                </label>
                <label className="block space-y-2 sm:col-span-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                    <Users size={15} />
                    Hányan jöttök a fotózásra?
                  </span>
                  <input name="attendeeCount" type="number" min="1" defaultValue="1" required className={fieldClass} />
                </label>
              </div>
              <div className="mt-6 border-t border-ink/10 pt-5">
                <FormSubmitButton pendingLabel="Foglalás...">Időpont foglalása</FormSubmitButton>
              </div>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
