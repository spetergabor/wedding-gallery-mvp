import { MapPin } from "lucide-react";
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
  return (
    <section className="rounded-lg border border-ink/10 bg-white shadow-soft">
      <div className="border-b border-ink/10 px-6 py-5">
        <h2 className="text-xl font-semibold text-ink">Galéria megtekintések</h2>
        <p className="mt-1 text-sm text-graphite/70">Ország és város szintű statisztika a publikus galéria megnyitásairól.</p>
      </div>

      {views.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={<MapPin size={22} />}
            title="Még nincs megtekintés"
            description="Ha valaki megnyitja a publikus galériát, a hozzávetőleges lokációja itt fog megjelenni."
          />
        </div>
      ) : (
        <div className="divide-y divide-ink/10">
          {views.map((view) => (
            <div key={view.id} className="grid gap-2 px-6 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
                  <MapPin size={16} />
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
        </div>
      )}
    </section>
  );
}
