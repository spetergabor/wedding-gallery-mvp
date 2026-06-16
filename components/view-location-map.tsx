"use client";

import { MapPin } from "lucide-react";
import type { ViewLocationPoint } from "@/lib/view-location-points";

const ZOOM = 3;
const TILE_COUNT = 2 ** ZOOM;

function markerPosition(latitude: number, longitude: number) {
  const x = ((longitude + 180) / 360) * 100;
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * 100;

  return {
    left: `${Math.min(100, Math.max(0, x))}%`,
    top: `${Math.min(100, Math.max(0, y))}%`
  };
}

export function ViewLocationMap({ points }: { points: ViewLocationPoint[] }) {
  const totalViews = points.reduce((sum, point) => sum + point.count, 0);

  return (
    <section className="mt-8 overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
      <div className="flex flex-col justify-between gap-3 border-b border-ink/10 px-5 py-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-semibold text-ink">Megtekintések térképe</h2>
          <p className="mt-1 text-sm text-graphite/70">Összesített helyszínek az összes publikus galéria megnyitásaiból.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-paper px-3 py-2 text-sm text-graphite">
          <MapPin size={16} />
          {totalViews} megtekintés · {points.length} hely
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px]">
        <div className="relative min-h-[360px] overflow-hidden bg-mist">
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${TILE_COUNT}, minmax(0, 1fr))` }}>
            {Array.from({ length: TILE_COUNT * TILE_COUNT }, (_, index) => {
              const x = index % TILE_COUNT;
              const y = Math.floor(index / TILE_COUNT);

              return (
                <img
                  key={`${x}-${y}`}
                  src={`https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`}
                  alt=""
                  className="h-full w-full object-cover opacity-80 saturate-0"
                  loading="lazy"
                />
              );
            })}
          </div>
          <div className="absolute inset-0 bg-white/15" />

          {points.map((point) => (
            <div
              key={point.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={markerPosition(point.latitude, point.longitude)}
              title={`${point.label}: ${point.count}`}
            >
              <div className="grid size-10 place-items-center rounded-full bg-brass text-sm font-semibold text-white shadow-soft ring-4 ring-white/80">
                {point.count}
              </div>
            </div>
          ))}

          {points.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center px-5 text-center">
              <div className="rounded-lg bg-white/90 px-5 py-4 shadow-soft">
                <p className="font-medium text-ink">Még nincs térképezhető lokáció</p>
                <p className="mt-1 text-sm text-graphite/70">Az új megtekintésekből automatikusan gyűjtjük a helyadatokat.</p>
              </div>
            </div>
          ) : null}

          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-2 right-2 rounded bg-white/85 px-2 py-1 text-[11px] text-graphite hover:underline"
          >
            © OpenStreetMap
          </a>
        </div>

        <div className="border-t border-ink/10 bg-white lg:border-l lg:border-t-0">
          <div className="border-b border-ink/10 px-5 py-4">
            <p className="text-sm font-medium text-ink">Top helyek</p>
          </div>
          <div className="max-h-[360px] divide-y divide-ink/10 overflow-auto">
            {points.slice(0, 10).map((point) => (
              <div key={point.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{point.label}</p>
                  <p className="text-xs text-graphite/60">
                    {point.latitude.toFixed(2)}, {point.longitude.toFixed(2)}
                  </p>
                </div>
                <span className="rounded-full bg-paper px-2.5 py-1 text-sm font-medium text-graphite">{point.count}</span>
              </div>
            ))}
            {points.length === 0 ? (
              <div className="px-5 py-8 text-sm text-graphite/70">Nincs megjeleníthető helyszín.</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
