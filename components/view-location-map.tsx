"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapPin } from "lucide-react";
import type { ViewLocationPoint } from "@/lib/view-location-points";

export function ViewLocationMap({ points }: { points: ViewLocationPoint[] }) {
  const totalViews = points.reduce((sum, point) => sum + point.count, 0);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    mapRef.current = L.map(mapElementRef.current, {
      attributionControl: false,
      doubleClickZoom: true,
      dragging: true,
      scrollWheelZoom: true,
      touchZoom: true,
      zoomControl: true
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapRef.current);

    L.control.attribution({ position: "bottomright" }).addTo(mapRef.current);
    window.setTimeout(() => mapRef.current?.invalidateSize(), 0);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        layer.remove();
      }
    });

    if (points.length === 0) {
      map.setView([47.5162, 14.5501], 4);
      return;
    }

    const bounds = L.latLngBounds([]);

    for (const point of points) {
      const latLng = L.latLng(point.latitude, point.longitude);
      bounds.extend(latLng);

      L.marker(latLng, {
        icon: L.divIcon({
          className: "view-location-marker",
          html: `<span>${point.count}</span>`,
          iconSize: [42, 42],
          iconAnchor: [21, 21]
        })
      })
        .bindPopup(`<strong>${escapeHtml(point.label)}</strong><br>${point.count} megtekintés`)
        .addTo(map);
    }

    if (points.length === 1) {
      map.setView(bounds.getCenter(), 5);
    } else {
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 8
      });
    }
  }, [points]);

  return (
    <section className="mt-8 overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
      <div className="flex flex-col justify-between gap-3 border-b border-ink/10 px-5 py-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-semibold text-ink">Megtekintések térképe</h2>
          <p className="mt-1 text-sm text-graphite/70">Összesített helyszínek az összes publikus galéria megnyitásaiból. Görgetéssel vagy csippentéssel nagyítható.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-paper px-3 py-2 text-sm text-graphite">
          <MapPin size={16} />
          {totalViews} megtekintés · {points.length} hely
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px]">
        <div className="relative min-h-[420px] bg-mist">
          <div ref={mapElementRef} className="absolute inset-0" />

          {points.length === 0 ? (
            <div className="absolute inset-0 z-[500] grid place-items-center px-5 text-center">
              <div className="rounded-lg bg-white/90 px-5 py-4 shadow-soft">
                <p className="font-medium text-ink">Még nincs térképezhető lokáció</p>
                <p className="mt-1 text-sm text-graphite/70">Az új megtekintésekből automatikusan gyűjtjük a helyadatokat.</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-ink/10 bg-white lg:border-l lg:border-t-0">
          <div className="border-b border-ink/10 px-5 py-4">
            <p className="text-sm font-medium text-ink">Top helyek</p>
          </div>
          <div className="max-h-[420px] divide-y divide-ink/10 overflow-auto">
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
