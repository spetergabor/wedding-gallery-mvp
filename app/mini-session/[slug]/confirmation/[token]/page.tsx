import {
  CalendarClock,
  CheckCircle2,
  Mail,
  MapPin,
  Settings2,
  ShieldCheck,
  UserRound,
  Users
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MiniSessionConfirmationActions } from "@/components/mini-session-confirmation-actions";
import {
  miniSessionBookingCalendarUrl,
  miniSessionBookingManageUrl
} from "@/lib/email";
import { googleCalendarUrl } from "@/lib/google-calendar";
import {
  formatMiniSessionSlotWithDate,
  formatMiniSessionTime,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  normalizeMiniSessionLanguage
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

const COPY = {
  hu: {
    eyebrow: "Sikeres foglalás",
    title: "Az időpontod biztosan le van foglalva",
    intro: "Mentsd el most a naptáradba, így akkor is kéznél lesz, ha a visszaigazoló e-mail a spam mappába kerül.",
    saved: "A foglalás rögzítve és érvényes.",
    appointment: "A foglalásod",
    date: "Időpont",
    location: "Helyszín",
    name: "Név",
    attendees: "Létszám",
    saveTitle: "Mentsd el az időpontot",
    saveText: "Válaszd ki a telefonodon vagy számítógépeden használt naptárt.",
    emailTitle: "E-mailt is küldtünk",
    emailText: "A visszaigazolást erre a címre küldtük:",
    spamText: "Ha néhány percen belül nem találod, nézd meg a spam vagy promóciók mappát is.",
    manage: "Foglalás kezelése",
    manageText: "Ezen a személyes oldalon később módosíthatod vagy lemondhatod az időpontot.",
    keepPage: "Ezt az oldalt is elmentheted a könyvjelzőid közé vagy készíthetsz róla képernyőképet.",
    contact: "Kérdésed van?"
  },
  de: {
    eyebrow: "Buchung erfolgreich",
    title: "Dein Termin ist sicher gebucht",
    intro: "Speichere ihn jetzt in deinem Kalender. So hast du alle Angaben auch dann griffbereit, wenn die Bestätigungs-E-Mail im Spamordner landet.",
    saved: "Deine Buchung ist gespeichert und verbindlich.",
    appointment: "Deine Buchung",
    date: "Termin",
    location: "Ort",
    name: "Name",
    attendees: "Personen",
    saveTitle: "Termin jetzt speichern",
    saveText: "Wähle den Kalender, den du auf deinem Smartphone oder Computer verwendest.",
    emailTitle: "Wir haben dir auch eine E-Mail geschickt",
    emailText: "Die Bestätigung wurde an diese Adresse gesendet:",
    spamText: "Falls du sie nach einigen Minuten nicht findest, prüfe bitte auch deinen Spam- oder Werbeordner.",
    manage: "Buchung verwalten",
    manageText: "Über diese persönliche Seite kannst du deinen Termin später ändern oder stornieren.",
    keepPage: "Du kannst diese Seite zusätzlich als Lesezeichen oder Screenshot speichern.",
    contact: "Noch eine Frage?"
  }
} as const;

export default async function MiniSessionConfirmationPage({
  params
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const booking = await prisma.miniSessionBooking.findUnique({
    where: { cancelToken: token },
    select: {
      name: true,
      email: true,
      attendeeCount: true,
      startsAt: true,
      endsAt: true,
      status: true,
      miniSession: {
        select: {
          slug: true,
          title: true,
          location: true,
          language: true,
          admin: {
            select: {
              siteSettings: {
                select: {
                  businessName: true,
                  contactEmail: true,
                  contactPhone: true,
                  publicSubdomain: true
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

  const publicSubdomain = booking.miniSession.admin.siteSettings?.publicSubdomain ?? null;
  const manageHref = miniSessionBookingManageUrl(slug, token, publicSubdomain);

  if (booking.status !== MINI_SESSION_BOOKING_STATUS_BOOKED) {
    redirect(manageHref);
  }

  const language = normalizeMiniSessionLanguage(booking.miniSession.language);
  const copy = COPY[language];
  const brandName = booking.miniSession.admin.siteSettings?.businessName || "Spetly";
  const appointment = formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt, language);
  const attendeeUnit = language === "de"
    ? booking.attendeeCount === 1 ? "Person" : "Personen"
    : "fő";
  const calendarFileHref = miniSessionBookingCalendarUrl(slug, token, publicSubdomain);
  const googleCalendarHref = googleCalendarUrl({
    title: booking.miniSession.title,
    date: booking.startsAt,
    startTime: formatMiniSessionTime(booking.startsAt, language),
    endTime: formatMiniSessionTime(booking.endsAt, language),
    location: booking.miniSession.location,
    details: `${copy.manage}: ${manageHref}`
  });
  const details = [
    booking.miniSession.title,
    `${copy.date}: ${appointment}`,
    `${copy.location}: ${booking.miniSession.location}`,
    `${copy.name}: ${booking.name}`,
    `${copy.attendees}: ${booking.attendeeCount} ${attendeeUnit}`,
    `${copy.manage}: ${manageHref}`
  ].join("\n");
  const contactEmail = booking.miniSession.admin.siteSettings?.contactEmail;
  const contactPhone = booking.miniSession.admin.siteSettings?.contactPhone;

  return (
    <main className="relative min-h-screen overflow-hidden bg-paper px-4 py-6 text-ink sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute -left-24 top-20 size-72 rounded-full bg-brass/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 size-80 rounded-full bg-sage/10 blur-3xl" />

      <div className="relative mx-auto max-w-5xl">
        <header className="mb-5 flex items-center justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass">{brandName}</p>
        </header>

        <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-soft">
          <div className="border-b border-ink/10 px-5 py-8 text-center sm:px-10 sm:py-11">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-sage/15 text-sage">
              <CheckCircle2 size={36} strokeWidth={1.8} />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-brass">{copy.eyebrow}</p>
            <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold leading-tight text-ink sm:text-5xl">{copy.title}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-graphite/70 sm:text-base">{copy.intro}</p>
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-sage/10 px-4 py-2 text-sm font-medium text-ink">
              <ShieldCheck size={18} className="text-sage" />
              {copy.saved}
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
            <div className="p-5 sm:p-8 lg:border-r lg:border-ink/10">
              <h2 className="text-xl font-semibold text-ink">{copy.appointment}</h2>
              <p className="mt-1 text-sm text-graphite/60">{booking.miniSession.title}</p>

              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-ink/10 bg-paper p-4 sm:col-span-2">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-graphite/55">
                    <CalendarClock size={16} className="text-brass" />
                    {copy.date}
                  </dt>
                  <dd className="mt-2 text-base font-semibold text-ink sm:text-lg">{appointment}</dd>
                </div>
                <div className="rounded-lg border border-ink/10 bg-paper p-4">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-graphite/55">
                    <MapPin size={16} className="text-brass" />
                    {copy.location}
                  </dt>
                  <dd className="mt-2 text-sm font-medium leading-6 text-ink">{booking.miniSession.location}</dd>
                </div>
                <div className="rounded-lg border border-ink/10 bg-paper p-4">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-graphite/55">
                    <UserRound size={16} className="text-brass" />
                    {copy.name}
                  </dt>
                  <dd className="mt-2 text-sm font-medium leading-6 text-ink">{booking.name}</dd>
                </div>
                <div className="rounded-lg border border-ink/10 bg-paper p-4 sm:col-span-2">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-graphite/55">
                    <Users size={16} className="text-brass" />
                    {copy.attendees}
                  </dt>
                  <dd className="mt-2 text-sm font-medium text-ink">{booking.attendeeCount} {attendeeUnit}</dd>
                </div>
              </dl>

              <div className="mt-6 rounded-lg border border-brass/20 bg-brass/5 p-4">
                <div className="flex gap-3">
                  <Mail size={20} className="mt-0.5 shrink-0 text-brass" />
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{copy.emailTitle}</h2>
                    <p className="mt-1 text-sm leading-6 text-graphite/70">
                      {copy.emailText} <span className="font-medium text-ink">{booking.email}</span>
                    </p>
                    <p className="mt-2 text-xs leading-5 text-graphite/60">{copy.spamText}</p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="bg-paper/60 p-5 sm:p-8">
              <h2 className="text-xl font-semibold text-ink">{copy.saveTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-graphite/65">{copy.saveText}</p>
              <div className="mt-5">
                <MiniSessionConfirmationActions
                  language={language}
                  googleCalendarHref={googleCalendarHref}
                  calendarFileHref={calendarFileHref}
                  details={details}
                />
              </div>

              <div className="mt-7 border-t border-ink/10 pt-6">
                <h2 className="text-base font-semibold text-ink">{copy.manage}</h2>
                <p className="mt-2 text-sm leading-6 text-graphite/65">{copy.manageText}</p>
                <Link
                  href={manageHref}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper"
                >
                  <Settings2 size={17} />
                  {copy.manage}
                </Link>
                <p className="mt-4 text-xs leading-5 text-graphite/55">{copy.keepPage}</p>
              </div>

              {contactEmail || contactPhone ? (
                <div className="mt-7 border-t border-ink/10 pt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-graphite/50">{copy.contact}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {contactEmail ? <a className="block font-medium text-ink hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a> : null}
                    {contactPhone ? <a className="block font-medium text-ink hover:underline" href={`tel:${contactPhone}`}>{contactPhone}</a> : null}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
