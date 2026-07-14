import Link from "next/link";
import { ArrowRight, CalendarClock, MapPin } from "lucide-react";
import { dateLocaleForAdmin, type AdminLanguage } from "@/lib/admin-language";
import { APP_TIME_ZONE } from "@/lib/date-format";

export type UpcomingWorkCard = {
  key: string;
  date: Date;
  href: string;
  title: string;
  subtitle: string;
  time: string | null;
  venue: string | null;
  badges: [string, string];
  footer: string;
  footerLabel: string;
};

function formatShortCalendarDate(date: Date, language: AdminLanguage) {
  return date.toLocaleDateString(dateLocaleForAdmin(language), {
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function formatWeekday(date: Date, language: AdminLanguage) {
  return date.toLocaleDateString(dateLocaleForAdmin(language), {
    weekday: "short",
    timeZone: APP_TIME_ZONE
  });
}

export function UpcomingWorkCardGrid({
  works,
  language,
  missingTime,
  missingVenue
}: {
  works: UpcomingWorkCard[];
  language: AdminLanguage;
  missingTime: string;
  missingVenue: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 p-4 sm:p-5 lg:grid-cols-2 2xl:grid-cols-3">
      {works.map((work) => (
        <Link
          key={work.key}
          href={work.href}
          className="group min-w-0 overflow-hidden rounded-md border border-ink/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-brass/30 hover:shadow-sm"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="w-20 shrink-0 rounded-md bg-paper px-2 py-2 text-center ring-1 ring-ink/8">
              <p className="text-sm font-semibold text-ink">{formatShortCalendarDate(work.date, language)}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-graphite/55">
                {formatWeekday(work.date, language)}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-brass/10 px-2 py-0.5 text-[11px] font-medium text-brass">{work.badges[0]}</span>
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-graphite">{work.badges[1]}</span>
              </div>
              <h3 className="mt-2 truncate font-semibold text-ink">{work.title}</h3>
              <p className="mt-1 truncate text-sm text-graphite/70">{work.subtitle}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-graphite/70">
            <span className="inline-flex min-w-0 items-center gap-2">
              <CalendarClock size={15} className="shrink-0 text-brass" />
              <span className="truncate">{work.time ?? missingTime}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-2">
              <MapPin size={15} className="shrink-0 text-brass" />
              <span className="truncate">{work.venue || missingVenue}</span>
            </span>
          </div>

          <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-3">
            <span className="min-w-0 truncate text-xs font-medium text-graphite/60">{work.footer}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-brass">
              {work.footerLabel}
              <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
