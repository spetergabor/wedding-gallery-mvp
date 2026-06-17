import { Eye, MapPin } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

type ViewEntry = {
  id: string;
  country: string | null;
  region: string | null;
  city: string | null;
  referrer: string | null;
  userAgent: string | null;
  createdAt: Date;
};

function locationLabel(view: ViewEntry) {
  const parts = [view.city, view.region, view.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Ismeretlen hely";
}

function sourceLabel(view: ViewEntry) {
  if (view.referrer) {
    return view.referrer;
  }

  if (view.userAgent) {
    return view.userAgent;
  }

  return "Nincs további adat";
}

export function ViewLog({ views }: { views: ViewEntry[] }) {
  const locations = new Set(views.map((view) => locationLabel(view))).size;
  const latestView = views[0] ?? null;

  return (
    <section className="rounded-lg border border-ink/10 bg-white shadow-soft">
      <div className="px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Galéria megtekintések</h2>
            <p className="mt-1 text-sm text-graphite/70">Rövid áttekintés a publikus galéria megnyitásairól.</p>
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
            <Eye size={18} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-paper px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Összes</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{views.length}</p>
          </div>
          <div className="rounded-md bg-paper px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Helyek</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{locations}</p>
          </div>
          <div className="rounded-md bg-paper px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Legutóbbi</p>
            <p className="mt-1 truncate text-sm font-medium text-ink">{latestView ? locationLabel(latestView) : "Nincs adat"}</p>
          </div>
        </div>
      </div>

      {views.length === 0 ? (
        <div className="border-t border-ink/10 p-5">
          <EmptyState
            icon={<MapPin size={22} />}
            title="Még nincs megtekintés"
            description="Ha valaki megnyitja a publikus galériát, a hozzávetőleges lokációja itt fog megjelenni."
          />
        </div>
      ) : (
        <div className="divide-y divide-ink/10 border-t border-ink/10">
          {views.slice(0, 6).map((view) => (
            <div key={view.id} className="grid gap-2 px-5 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
                  <MapPin size={15} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{locationLabel(view)}</p>
                  <p className="truncate text-sm text-graphite/70">{sourceLabel(view)}</p>
                </div>
              </div>
              <time className="text-sm text-graphite/70" dateTime={view.createdAt.toISOString()}>
                {view.createdAt.toLocaleString("hu-HU", {
                  dateStyle: "medium",
                  timeStyle: "short"
                })}
              </time>
            </div>
          ))}
          {views.length > 6 ? (
            <div className="px-5 py-3 text-sm text-graphite/70">
              +{views.length - 6} további megtekintés az adatbázisban
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
